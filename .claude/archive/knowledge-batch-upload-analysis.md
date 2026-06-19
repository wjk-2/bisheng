# 知识库批量上传 / 百万 PDF RAG 摄入能力调研

> 记录时间：2026-06-19
> 起因：评估知识库能否批量上传文件夹 + 百万级纯文字 PDF 的 RAG 处理方案

## 一、核心结论（先看这条）

E-Agent 知识库**现状是"半批量"**：

- **能**：前端一次性多选文件 / 拖拽一批文件；后端入库端点本就按列表批量处理。
- **不能**：
  1. 直接选一个文件夹递归上传所有 PDF（浏览器原生不支持，需加 `webkitdirectory`）。
  2. 真正的百万级规模——浏览器选 100 万文件、HTTP 逐个上传 100 万次，工程上不成立。

**百万 PDF 的正道不是"把上传框做得更大"，而是另建离线批量摄入管线，绕开 HTTP 逐文件上传。**

检索侧架构（Hybrid 向量+BM25 + RRF + 可选 rerank）已正确，不用重做。问题集中在**摄入吞吐**和**向量库规模化**两端。

---

## 二、能力现状（代码实证）

### 1. 前端上传 UI

| 能力 | 状态 | 证据 |
|---|---|---|
| 多选文件 + 拖拽 | 支持 | `src/frontend/platform/src/components/bs-comp/knowledgeUploadComponent/DropZone.tsx`：`react-dropzone`，`acceptedFiles` 是数组，`onDrop(validFiles)` 整批传递 |
| 选文件夹 | **不支持** | DropZone 的 input 无 `webkitdirectory`/`directory` 属性，浏览器不会递归整个目录 |
| 支持格式 | PDF/TXT/DOCX/DOC/PPT/PPTX/MD/HTML/XLS/XLSX/CSV（开 etl4lm 另含图片） | DropZone.tsx:13-15 |

> 全前端仅一处 `directory`（`workspace/SopTasks.tsx:165`），是工具调用展示文案，与知识库上传无关。

### 2. 后端上传端点（单文件，无批量上传）

| 端点 | 签名 | 位置 |
|---|---|---|
| `POST /api/v1/knowledge/upload` | `file: UploadFile = File(...)` 单文件 | `src/backend/bisheng/knowledge/api/endpoints/knowledge.py:51` |
| `POST /api/v1/knowledge/upload/{knowledge_id}` | 单文件 | knowledge.py:64 |
| `POST /api/v1/knowledge/preview` | 预览分块 | knowledge.py:91 |

### 3. 后端入库（支持批量列表）

| 端点 | 签名 | 位置 |
|---|---|---|
| `POST /api/v1/knowledge/process` | `req_data: KnowledgeFileProcess` | knowledge.py:167 |

`KnowledgeFileProcess` 关键字段（`src/backend/bisheng/api/v1/schemas.py:492`）：
```python
class KnowledgeFileProcess(FileProcessBase):
    file_list: List[KnowledgeFileOne]   # ← 一次可提交多个文件
    callback_url: Optional[str]         # 异步任务回调地址
    extra: Optional[str]
```

### 4. 摄入管线（Celery 异步，每文件一个任务）

- 调度：`api/services/knowledge.py:561` —— 每个文件调 `file_worker.parse_knowledge_file_celery.delay(one.id, ...)`
- 任务定义：`worker/knowledge/file_worker.py:278`，`acks_late=True, time_limit=7200`
- 队列路由：`core/config/settings.py:162` → `knowledge_celery`
- Worker 并发：`run_celery.py:5` → `-c 20 -P threads -Q knowledge_celery`（默认 20 线程）
- **无 Semaphore 限流，无批量导入 API/脚本**

### 5. PDF 解析与分块

- 解析：`api/services/knowledge_imp.py:926-968`
  - 优先：配了 `etl4lm.url` → `Etl4lmLoader`（外部 OCR/解析，支持 force_ocr）
  - 降级：`convert_file_to_md`（内部 Markdown 转换）
- Splitter：`ElemCharacterTextSplitter`（knowledge_imp.py:840，自研，非 LangChain 内置）
- 默认值（`api/v1/schemas.py:427-447`）：`chunk_size=1000`，`chunk_overlap=100`，separator 含 `\n\n \n 。！？；`
- 单 chunk 上限：`MAX_CHUNK_SIZE=50000`（knowledge_imp.py:82）

### 6. Embedding

- 入口：`api/services/knowledge_imp.py:674` → `vector_client.add_texts(texts, metadatas)`
- 模型获取：`knowledge/domain/knowledge_rag.py:39` → `LLMService.get_bisheng_knowledge_embedding(model_id)`
- **无显式 batch_size，无 Semaphore 限流**，底层靠 langchain_milvus 内部批处理
- 模型按知识库级配置（`knowledge.model` = llm_model 表 ID）

### 7. 向量库（Milvus）

- Schema：`knowledge/rag/milvus_factory.py:10` —— 索引 **HNSW**，`metric_type=L2`，`M=8, efConstruction=64`
- 字段映射：milvus_factory.py:27-51
- **每个知识库独立 collection**（knowledge_imp.py:404，partition 场景用 partition_key）
- 写入：`Milvus.add_texts`，`auto_id=True`

### 8. 检索链路（架构正确，无需重做）

- 入口：`tool/domain/langchain/knowledge.py:48` `KnowledgeRetrieverTool._run`
- **Hybrid**：Milvus 向量 + ES BM25（`knowledge/rag/elasticsearch_factory.py:56` `BM25Strategy`）
- **RRF 融合**：`tool/domain/langchain/knowledge.py:100`，`rrf_weights=[vector_weight, keyword_weight]`，默认各 0.5（`workflow/common/knowledge.py:198`）
- **Rerank**：可选，`rerank_flag` 控制（workflow/common/knowledge.py:193）
- 召回 k=100（Milvus/ES 各取，workflow/common/knowledge.py:206），最终 top_k=5（`core/vectorstore/ensemble_retriever.py:35`）

---

## 三、百万级规模量化

| 项 | 估算 |
|---|---|
| 文件数 | 100 万 |
| 单文件文本量 | 纯文字 1MB PDF，提取文本约 20–80KB |
| chunk 数（chunk_size=1000） | **2000 万 – 8000 万** chunk/向量 |
| 向量存储（Qwen3-Embedding-4B ~2560 维 float32 ≈ 10KB/向量） | **200GB – 800GB** 仅原始向量 |

→ **硬约束：Milvus 单机 HNSW 全内存索引不可行。**

---

## 四、瓶颈对照（现状 vs 百万级）

| 环节 | 现状 | 百万级下的问题 |
|---|---|---|
| 摄入入口 | 单文件 HTTP，无批量接口 | 逐个 HTTP 上传 100 万次，开销与可靠性不可接受 |
| 调度 | Celery knowledge_celery，20 线程 | 并发太低，串行估算 70 小时起，OCR 介入则数倍 |
| PDF 解析 | 优先 etl4lm(OCR)，降级 md 转换 | 纯文字 PDF 若误走 OCR，吞吐差百倍 |
| Embedding | add_texts 无显式 batch/限流 | 单实例吞吐不够，需大 batch + 多实例 |
| Milvus | 每知识库独立 collection，HNSW M=8/L2 全内存 | 数千万向量全内存装不下 |
| 检索 | Hybrid + RRF + 可选 rerank | 架构合理，海量下需强制 rerank + 元数据过滤 |

---

## 五、关键建议（按杠杆从大到小）

1. **纯文字 PDF 必须绕开 OCR** —— 最大杠杆，决定吞吐是 10 小时级还是数百小时级。确认走 pypdf/pdfplumber 直接抽文字，而非 etl4lm force_ocr。
2. **另建离线批量摄入管线**，不走单文件 API：目录扫描 → 批量解析 → 大 batch embedding → 批量写 Milvus/ES；复用现有 `/process` 的 `file_list` 批量入库 + Celery 调度，把"上传"换成"读本地文件"。Celery 提为多 worker 进程（非只加线程），按文件分片并行。
3. **Milvus 规模化**：放弃单机全内存 HNSW，改 DiskANN（磁盘索引）或 IVF_PQ 量化降内存；视规模上分布式集群；按业务域切分 collection 或用 partition_key，不要把 100 万塞一个 collection。
4. **Embedding 多实例并行** + 大 batch（128–256）；纯文字场景可评估更轻 embedding 模型（维度直接乘进存储成本）。
5. **检索侧**：强制开 rerank，召回 k 调大，善用 scalar 元数据过滤（按类目/来源缩小范围）。

---

## 六、给精确方案前需确认的 5 个变量

1. **一次性导入还是持续增量？**（决定管线是离线批处理还是常驻服务）
2. **平均每个 PDF 的文本量/页数？**（决定 chunk 总量 → Milvus 选型）
3. **检索场景：全库检索，还是按类目/租户隔离？并发查询量多大？**
4. **硬件预算：几张 GPU、多少内存、能否上 Milvus 集群？**
5. **embedding 模型固定 Qwen3-Embedding-4B，还是可换？**

---

## 七、中小批量改进（可选，非百万级）

若只是想支持"选文件夹"上传几十~几百个文件：
- DropZone 的 `<input>` 加 `webkitdirectory` 属性 + `directory`，浏览器即递归选中目录内全部文件；
- `react-dropzone` 的 onDrop 会收到带 `path` 的 File 数组，保留相对路径即可。
- 限制：仍受 HTTP 逐文件上传开销约束，不适合万级以上。

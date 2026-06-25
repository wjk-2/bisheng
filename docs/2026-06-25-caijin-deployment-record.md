# 财经实验室 E-Agent 部署情况及问题记录

> 部署时间：2026-06-24 ~ 2026-06-25
> 容器：`fhq70c6k7sl8f-0` @ 172.28.39.10
> 部署人：彭总 + Claude 协助
> 关联：memory `reference_caijin_eagent_deploy`、`project_eagent_tmp_collection_leak`

---

## 一、环境与通道

### 容器规格
- 6×RTX5090 32GB，Ubuntu 20.04，AIStation 容器
- OverlayFS（重启丢 apt 安装的系统软件）
- NFS `/peng` 持久化（数据/模型/代码全在这）
- Python311 在 `/peng/eagent/runtime/python311/bin/python3.11`（无 pip，用 `-m pip`）

### SSH 双跳通道
本机 → zckj 跳板（100.71.60.61，密钥）→ 容器 172.28.39.10:30314（密码）：
```
ssh zckj "sshpass -p 'Dg*Rh9lpstv1gUdNF&?RfZg\$3dBTsOzQ' ssh -o StrictHostKeyChecking=no -p 30314 root@172.28.39.10 'CMD'"
```
- 密码含 `$`，sshpass 单引号内需转义 `\$`
- 命令避免括号 `()` 和复杂引号，用 `;` 分隔
- scp 两跳：本机→zckj:/tmp→容器
- 复杂操作写脚本 scp 上去跑，不硬嵌套引号

### 对外访问
- 平台：`http://172.28.39.10:30634/`（账号 admin/admin@9000）
- 端口映射：22→30314, 3001→30634(平台), 8000→30273(chat), 8001→30528(embed), 8180→30255(OCR adapter), 8182→30357(OCR vllm), 8888→48149(jupyter)

---

## 二、三模型部署（vLLM nohup 裸跑）

| 模型 | GPU | 端口 | served-name | 关键参数 |
|------|-----|------|-------------|---------|
| chat Qwen3.6-35B-A3B-FP8 | 0-3 TP=4 | 8000 | `Qwen3.6-35B-A3B-FP8` | utilization 0.80, max-model-len 65536, max-num-seqs 8, no_thinking.jinja, qwen3_xml |
| embedding Qwen3-Embedding-8B | 4 | 8001 | `/peng/models/Qwen3-Embedding-8B`（默认路径名，未设 served-name） | runner=pooling, max-model-len 8192, utilization 0.60, 维度 4096 |
| ocr DeepSeek-OCR-2 | 5 | 8182 | `deepseek-ocr-2` | trust-remote-code |

启动脚本：`/peng/start-vllm-chat.sh` / `start-vllm-embed.sh` / `start-vllm-ocr.sh`（nohup 裸跑，不进 supervisord）。

### chat 四铁律（固化在 start-vllm-chat.sh）
1. `--chat-template /peng/no_thinking.jinja`（关 thinking，末尾注入空 `<think>\n\n</think>`）
2. `--enable-auto-tool-choice --tool-call-parser qwen3_xml`（工具调用）
3. `--served-model-name Qwen3.6-35B-A3B-FP8` 对齐 DB
4. FP8 权重可开、FP8-KV 绝不开（GDN 静默损坏）

utilization 必须 0.80（0.90 会 Triton autotuner OOM）。

### vLLM 不进 supervisord 的原因
vllm 慢启动（torch.compile 3-5 分钟）+ 多进程 worker 与 supervisor startsecs/autorestart 冲突，FATAL 循环抢 GPU（resource_tracker 残留）。回退 nohup 裸跑（湖州方式），supervisor 只管 ocr-adapter + 应用层。kill vllm 后 GPU 残留需 `nvidia-smi --query-compute-apps=pid` 逐个 kill -9。

---

## 三、DB 模型配置（踩坑重点）

### 两表结构
- `llm_server`（父表）：模型服务端点，字段 id/name/type/config(含 openai_api_base)
- `llm_model`（子表）：具体模型实例，字段 id/name/model_name/model_type/server_id
- bisheng 实际查 `llm_model`，通过 server_id 联表查 `llm_server`
- **两表都不可缺**

### 彭总在平台重配后的最终记录
| 用途 | llm_server | llm_model | model_name（调 vllm 用，须精确等于 served-name） |
|------|-----------|-----------|------|
| chat | id=5, name=Qwen3.6-35B-A3B-FP8, type=openai, base_url=:8000/v1 | id=6, model_type=llm | `Qwen3.6-35B-A3B-FP8` |
| embedding | id=4, name=Qwen3-Embedding-8B, type=openai, base_url=:8001/v1 | id=5, model_type=embedding | `/peng/models/Qwen3-Embedding-8B` |

### 踩坑：model_name 必须精确对齐 vllm served-name
- 清空前 chat 的 model_name 是 `/peng/models/Qwen3.6-35B-A3B-FP8`（带路径）→ vllm served-name 是 `Qwen3.6-35B-A3B-FP8`（不带路径）→ **404 model not found**
- 清空前 embedding 的 model_name 是 `/peng/models/Qwen3-Embedding-4B` → vllm 实际加载 8B → **404**
- 修复：彭总在平台重配，model_name 精确对齐 served-name（chat 用简短名，embedding 用路径名因 vllm 未设 served-name）

### 历史事件：模型表被清空
- 2026-06-25 09:48，`llm_server` 和 `llm_model` 两表被 DELETE 清空（来源 bisheng 应用连接 thread_id=57/72）
- 同时 config 表 workstation 键 models 数组被改空
- 彭总随后在平台重配两模型，生成新 id（chat=6/embed=5）
- **后果**：assistant 和 flow 的 model_id 旧引用（"3"）变悬空，需重选

### 助手/工作流模型引用（待办）
- 5 个 assistant 的 model_name 字段还是旧 "3"（悬空）
- 6 个 flow 的 LLM/rag 节点 model_id 还是旧 "3"（悬空）
- 五步翻译法工作流（flow fb2be590...）彭总已在 UI 重选为 id=6（chat），其余待处理
- 修复方式：彭总 UI 重选，或写 SQL 批量 UPDATE

---

## 四、系统配置（平台系统设置，改 DB config 表 initdb_config）

彭总在平台「系统设置-系统配置」改了 4 处（2026-06-25）：

| 字段 | 改前 | 改后 | 原因 |
|------|------|------|------|
| `env.office_url` | `http://IP:8701`（占位符） | `''` | 无 office 服务，清占位符 |
| `env.uploaded_files_maximum_size` | 50 | 200 | 适配大教材 PDF |
| `gpustack` 全段 | token+url 残留 | 全清空 | gpustack 已废弃（xmlsec FATAL + 无 docker） |
| `knowledges.etl4lm.url` | `http://198.19.19.34:8180/...` | `http://127.0.0.1:8180/...` | 同容器本机直连，更快更稳 |

- 平台系统设置改的是 DB `config` 表 `initdb_config` 键，非文件 config.yaml
- bisheng 读 DB 不读文件（文件仅首次 init 写入 DB）
- redis 缓存 `config:initdb_config`（db1，TTL 600秒），改后最长 10 分钟生效
- 立即生效：`redis-cli -a Admin@9000 -n 1 DEL config:initdb_config`

### gpustack 不可用定论
- xmlsec libxml2 版本不匹配（onelogin.saml2.auth 导入失败）
- 容器无 docker（gpustack 靠 docker.sock 拉模型容器）
- 模型走 nohup vllm 不用 gpustack
- 已从 supervisord 移除，不影响业务

---

## 五、OCR Adapter（新项目 feature/ocr-adapter）

部署在 `/peng/eagent/ocr-adapter/`，supervisord `[program:ocr-adapter]`：
```
python3.11 -m uvicorn eagent_ocr_adapter.main:create_app --factory --port 8180
environment VLLM_BASE_URL=127.0.0.1:8182 OCR_BACKEND=deepseek
```

### 自动模式（页级分类）
上传 PDF 不需用户选是否 OCR，系统自动判：
- **文档级预筛**：抽样前几页，全文字页则整篇跳过 OCR（零 GPU）
- **页级判定**：混合 PDF 逐页判，9 信号任一超阈即判图像页
  - PyMuPDF 4 信号：字符数/异常字符占比/图片覆盖率/宽高比
  - MinerU 2.x 中文专项 3 信号：跨脚本乱码/ASCII标点密集/U+72xx可疑映射（多条件 AND 触发）
  - pypdfium2 2 信号：Unicode Map 错误率/CID 字体使用率
- 文字页直取文本层（不调模型），图像页渲染 300 DPI JPEG 送 DeepSeek-OCR-2

### deepseek.py 两处生产实测改动
1. `recognize_batch` 改逐页请求（asyncio.gather 每页一个 chat/completions）——原多图单请求 vllm 返回 1 choice 导致 scheduler None
2. PROMPT 去掉 `<|grounding|>`——vllm-env 0.17.1 下 grounding 触发空输出

### force_ocr 首版是 no-op
force_ocr=true 时文字页仍直取文本层，不强制重渲染。G2 精细化待做。正常自动模式不受影响。

---

## 六、知识库问题与修复

### 问题1：Milvus 残留 tmp collection（已删）
- `tmp_workflow_data_new_4`（2521 行旧 2560 维向量，_4=旧 embedding_model_id=4）
- 根因：bisheng 工作流文件检索节点写 tmp collection 永不 drop（上游缺陷，详见 memory `project_eagent_tmp_collection_leak`）
- 处理：已 `utility.drop_collection` 删除
- 运维：换 embedding 或定期清理时查 `utility.list_collections()` 清 `tmp_workflow_data_new_*`

### 问题2：五步翻译法上传 PDF 不翻译（已修）
- 工作流 flow `fb2be590e8fa4a6f87a199a50aa09575`（user_id=11 shanls/单老师创建）
- 根因：5 个 LLM 节点的 user_prompt 引用 `{{#input_846bc.user_input#}}`（对话框文字），没引用 `{{#input_846bc.dialog_files_content#}}`（上传文件内容）→ 上传 PDF 后 user_input 为空 → 5 步全跑空
- 修复：4 处 user_input 引用改为 dialog_files_content（回译节点不引用 user_input 不动）
- 同时改 `dialog_files_content_size` 15000 → 50000（chat 64K 上下文，15000 太小）
- 备份：`/tmp/flow_backup_fb2be590.json`
- 实测通过：trace a8ea5cea，OCR Adapter 多次 200 + chat 多次 200 + 5 步流式输出，11.94s 完成

### 问题3：批量上传知识库解析失败 SchemaNotReadyException（已修，待端到端验证）
- 现象：shanls 批量上传 50+ 文件，部分报 `SchemaNotReadyException: collection already exist, schema not the same`
- 根因：knowledge worker 并发 20（`-c 20`），多文件并发对同一 collection 调 `_create_collection`，pymilvus 并发建表竞争
- **不是** 4B 残留维度（三 collection 现均 4096 维）、不是 Milvus 挂了、不是 schema 真不一致
- retry 能自愈（retry 走 delete 路径清掉冲突）
- 修复：改 `bisheng_langchain/vectorstores/milvus.py` 的 `_create_collection`，两层防御
  - 主路径：方法开头 `utility.has_collection` 检查，已存在直接 load 跳过 create
  - 兜底路径：原 except 分支（原是 `raise e`）改为若已存在则 load，否则 raise
- 本地 commit：558e2b45c（fix）+ 5e37ee7f2（test）
- 已部署服务器：备份 `/tmp/milvus.py.bak.20260625` → scp → py_compile ok → restart worker-knowledge RUNNING
- 设计文档：`docs/superpowers/specs/2026-06-25-milvus-concurrent-create-fix-design.md`
- 实施计划：`docs/superpowers/plans/2026-06-25-milvus-concurrent-create-fix.md`
- **待端到端验证**：需彭总批量上传 10-20 PDF 触发并发建表路径，确认 SchemaNotReadyException 消失

---

## 七、AsyncMilvusClient event loop 噪音错误（非阻断）

worker-knowledge 日志持续刷：
```
Failed to create new connection using: async-http://localhost:19530
Failed to initialize AsyncMilvusClient: There is no current event loop in thread 'ThreadPoolExecutor-2_X'
```
- 根因：pymilvus AsyncMilvusClient 需 event loop，celery `-P threads` 线程里没有
- **是 warning 不是 fatal**：async 失败后回退同步路径，文件解析正常完成
- 不影响业务，暂不处理

---

## 八、前端部署坑

- Vite outDir 是 `build/`（非 dist）
- nginx root 指向 `frontend/client/` 和 `frontend/platform/` 根（不是 build 子目录）
- 部署必须把 `client/build/*` 和 `platform/build/*` **平铺到各自根目录**（rm 旧 assets+index.html 后 cp -a build/* .）
- 不平铺会读旧版前端 + 最新后端 → 前后端版本不匹配 → `r.map is not a function`

---

## 九、待办清单

1. **Task 4 端到端验证**：彭总批量上传 10-20 PDF，确认 Milvus 并发建表修复生效（SchemaNotReadyException 消失）
2. **助手/工作流模型引用**：5 assistant + 6 flow 的 model_id 从旧 "3" 改到新 chat id=6（彭总 UI 重选或写 SQL）
3. **知识库重建**（如需要）：embedding 4B→8B 维度变，旧知识库向量若需重建（彭总已清空旧知识库，新库走 4096 维）
4. **restart-after-reboot.sh**：确认含 vllm nohup 启动段 + 清华源换源段（一键恢复）
5. **定期清理**：Milvus `tmp_workflow_data_new_*` 残留（见问题1）

---

## 十、关键路径速查

| 项 | 路径 |
|----|------|
| NFS 根 | `/peng/eagent/` |
| 应用源码 | `/peng/eagent/runtime/app/` |
| milvus.py（已改） | `/peng/eagent/runtime/app/bisheng_langchain/vectorstores/milvus.py` |
| OCR Adapter | `/peng/eagent/ocr-adapter/` |
| vLLM 启动脚本 | `/peng/start-vllm-{chat,embed,ocr}.sh` |
| no_thinking 模板 | `/peng/no_thinking.jinja` |
| supervisord 配置 | `/etc/supervisor/conf.d/eagent.conf` + `/peng/eagent/deploy/supervisord.conf` |
| 日志 | `/peng/eagent/logs/` |
| MySQL | root/Admin@9000，eagent 库 |
| Redis | Admin@9000，db1=config缓存 db2=celery |
| Milvus | localhost:19530 |
| 本地项目 | `C:\Users\Administrator\projects\eagent-v3\v2.0`（分支 analysis-v2.3.0） |

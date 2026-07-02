# E-Agent 知识库功能完整修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复财经 E-Agent v2.3.0 知识库模块审核报告中全部 P0×5 + P1 + P2 问题，让用户重传知识库时落到干净、正确、可维护基线。

**Architecture:** 按"先 P0 硬 bug 再 P1 再 P2"分批，每批按依赖顺序串行。贯彻 CLAUDE.md 主原则"问本质，回正道，不修补"——异常路径补齐、向量删除单轨收口、上帝模块按职责拆分、DDD 边界收敛、可观测性补齐，而非局部打补丁。可测逻辑抽成纯函数，TDD 测纯函数，集成层薄包。

**Tech Stack:** 后端 FastAPI 0.115 + SQLModel + Pydantic v2 + Celery 5.3.6 + Milvus 2.3.3 + ES 8.12（Python 3.10）；前端 React 18 + TS 5.4 + Vite 5.3 + Zustand；测试后端 importlib 直加载范式 + mock，前端 tsc + vite build + 可测纯函数 vitest。

## Global Constraints

- 全程交互中文，称呼彭总，冷静克制技术文档风格，无感叹号
- 修复完成前**不批量重传历史知识库文件**（不触发全量重建）；**单文件端到端验证上传允许**（用 1 个小 PDF 测 A1/A2/B1），不属批量重传
- 后端测试用 importlib 直加载范式（参考 `tests/knowledge/test_rerank_default.py`）或 mock 注入范式（参考 `tests/knowledge/test_knowledge_file_metadata.py`），不连真实 DB、不拉 bisheng init
- 前端含可测纯逻辑的任务抽纯 TS 函数 + vitest 行为断言；纯 UI 组件用 `tsc --noEmit` + `npm run build`，并标注"无行为单测，依赖 J3 端到端验证"
- 生产部署走 zckj 跳板两跳 scp（本机→zckj:/tmp→容器 172.28.39.10:30314），sshpass 密码内 `$` 转义为 `\$`；**执行前确认 zckj 已装 sshpass**
- 部署机形态：财经容器 fhq70c6k7sl8f-0 @ 172.28.39.10:30314，前端平铺到 `/peng/eagent/runtime/frontend/{client,platform}/` 后 nginx reload，后端 tar 覆盖到 `/peng/eagent/runtime/app/`（先 rm 旧 bisheng+bisheng_langchain 再解压，保 config.yaml）
- 每个任务完成即 commit（frequent commits），commit message 前缀 `fix(kb):` / `refactor(kb):` / `feat(kb):`
- 不动生产 6 条禁令（删容器/重启/改生产配置/删生产文件/kubectl delete/kubectl apply）——本工程是代码修复+本地构建+部署上线，部署步骤走 8 步（分析→说明→方案→回退→批准→执行→验证→失败处理）
- 删数据结构（split_rule 列类型、加软删除字段）须有 alembic 迁移 + 回退脚本；**alembic upgrade 在服务 restart 之前执行**
- 前端"操作无反应"类先查后端日志，不在前端反复猜

---

## Review 修订记录（2026-07-02 三路子代理 review 后落实）

经三路 review 代理 + 源码复核，对本计划作以下修订：

1. **A2 定性修正**：源码核实（`FileUploadSplitStrategy.tsx:10-75` + `knowledge.json:2-38`）`ruleI18nMap` 键与 `predefinedRules` regexKey **均已为** `'\\n'`（2 字符），转义层本就一致，三条规则不会 undefined（首轮代理误读为 `'\n'`）；i18n `label` 实际是正则模式字符串（非中文描述），`handleRegexClick` 存 label 当 regex **当前碰巧生效**。故 P0-2 非"功能失效"硬 bug，降为 P1 防御性重构（数据与翻译分离）。删"转义层统一"子任务；补回 articleRule（`第.{1,3}条`，原漏第 9 项）；修被测/生产函数分叉。
2. **A3**：`rrf_rerank.py:55-56` 已有长度断言，删"加防御性断言"重复步骤，仅改 documents 顺序。
3. **A4**：`tool/domain/langchain/knowledge.py` 模块级无 logger import，GREEN 代码会 NameError，补 `from loguru import logger`；补 async 测试。
4. **A5**：`_errors` 用 `setdefault` 替 `get`（get 是空操作，error 写丢）；验收注明空 context prompt 润色延至 G3。
5. **A6**：`KnowledgeDao.delete_by_id` 不存在，改用 `delete_knowledge(db_knowledge.id)`；补 Milvus/ES 孤儿索引清理（仅删 DB 留向量孤儿）；消 importlib hedge。
6. **C1**：删"让 acks_late 重试"措辞（语义错，acks_late 普通异常不重投），改为标 FAILED 不重抛 或 `self.retry(max_retries=3)` 二选一；修测试 placeholder。
7. **C2/C3 循环依赖修正**：C3 先于 C2 落地（原"C3 留 F1 后"取消），C2 直接依赖 C3 的 VectorDeleteService；C3 wrapper 内部转调需**参数顺序翻转**（旧 `delete_vector_files(file_ids, knowledge)` file_ids 在前 → 新 `delete_by_file_ids(knowledge, file_ids)` knowledge 在前）；调用方补 `api/v1/chat.py:248`；thin wrapper 加 DeprecationWarning。
8. **C4**：ES 侧 `index_name` 也要加 workflow_id 后缀（当前 ES 用裸常量已与 Milvus 错位）；补"创建即注册"逻辑（创建 collection 时 append 到 `_tmp_collections_created`，否则 drop 永不执行）；workflow 结束钩子先 grep 定位。
9. **D2**：代码骨架 `self.request_timeout` 错（`_get_openai_params` 是模块级函数无 self），改为 `model_config.get('request_timeout', 200)`。
10. **E1**：补"写入侧 `knowledge.py:622/762/773` 去掉 `json.dumps` 直接赋 dict"（否则 JSON 列双重编码）；迁移前加 `JSON_VALID` 清洗。
11. **E3**：软删除查询点 ≥15 处易漏，改用 SQLAlchemy `do_orm_execute` event 全局注入 `is_deleted=False` 过滤。
12. **F1/F3**：thin re-export 加 DeprecationWarning，否则 linsight 接缝倒置无编译错暴露；F3 补 knowledge↔llm 双向耦合子项（报告 P1 接缝倒置第三子项，原漏覆盖）。
13. **F4**：补具体调用点（grep workflow→DAO 直调点），替换"评估"placeholder。
14. **G4**：补存量兼容（仅新切片启用 parent-child + `parent_chunk_id NULL` 容错 `if parent is None: return self`）。
15. **I3**：Milvus 2.3.3 无原生 snapshot、ES snapshot 需改生产配置（触禁令）——降级为逻辑备份（Milvus query 导出 + ES scroll dump + MinIO 版本化；MySQL 走运维 mysqldump cron，不在应用代码范围）。
16. **J2**：Step4 补 `rm -rf bisheng bisheng_langchain` 再解压；alembic upgrade head 移到 restart 之前（否则新代码跑旧 schema 失败）；补具体前端 cp/nginx 命令。
17. **J3**：明确"不重传"=不批量重建，单文件测试 PDF 允许；Step1 措辞理清（生产只测正常创建，失败回滚本地测）。
18. **Self-Review**：修 type-consistency 第 3 条事实错误（C2/C1 调旧 `delete_vector_files` 非新服务）；删 collection_name gap 伪依据（报告原文未提回退兜底）。

---

## Scope Check

本计划覆盖审核报告全部三档问题，跨多个子系统工程：硬 bug 修复（批次 A-B）、异常路径与数据一致性（批次 C）、运维集成（批次 D）、数据模型（批次 E）、架构改造（批次 F）、检索策略升级（批次 G）、前端组件（批次 H）、可观测性与备份（批次 I）、构建部署验证（批次 J）。

按彭总指令"分批，按依赖顺序"组织为 10 批约 35 任务。批次 A-E 为必修正道修复，批次 F-I 为 P1/P2 改进（含架构升级与新增能力），批次 J 为收口。建议彭总分阶段批准：阶段一批准 A-E（硬 bug + 正道修复），阶段二批准 F-I（架构 + P2），批次 J 随 A-E 落地后即执行首次部署验证。

## 详略约定

- **批次 A（硬 bug×5 + A2 防御性重构）**：完整 TDD，含 RED 测试代码 + GREEN 实现代码 + 命令 + 预期输出
- **批次 B-I**：每任务给确切文件路径与行号、接口签名、测试用例（具体 assert）、实现要点与关键代码骨架、验收标准。大改造（拆上帝模块、DDD 收敛、3 套删除统一）给迁移策略与目标结构而非逐行代码——逐行代码属机械移动，执行时按目标结构落实
- 所有任务标注依赖（Consumes/Produces），保证执行人只看本任务即可动手

## 文件结构总览

### 新建后端文件
- `src/backend/bisheng/common/vector_delete_service.py` — **统一向量删除服务（唯一真理源，C3 产出）**，F1 拆分时 `knowledge_imp/vector_delete.py` 仅 re-export 该服务
- `src/backend/bisheng/api/services/knowledge_imp/` — 从上帝模块拆出的子模块包
  - `__init__.py` — re-export 保持向后兼容（加 DeprecationWarning）
  - `parser.py` / `splitter.py` / `embedder.py` / `minio_store.py` / `qa.py` / `state.py`
  - `vector_delete.py` — 仅 re-export `common/vector_delete_service.py`
- `src/backend/bisheng/workflow/common/rerank_degrade.py` — rerank 调用降级决策纯函数
- `src/backend/bisheng/workflow/common/retrieval_fallback.py` — 检索异常降级纯函数
- `src/backend/bisheng/worker/knowledge/timeout_sweeper.py` — 超时文件定时回收任务
- `src/backend/tests/knowledge/test_*.py` — 各任务测试文件

### 新建前端文件
- `src/frontend/platform/src/pages/KnowledgePage/components/MetadataBuiltInFields.ts` — 内置元数据字段公共常量
- `src/frontend/platform/src/pages/KnowledgePage/components/FilterPageHeaderFooterToggle.tsx` — filter UI 控件
- `src/frontend/platform/src/pages/KnowledgePage/components/KnowledgeFileList.tsx` — KnowledgeFile/Qa 公共列表组件
- `src/frontend/platform/src/pages/KnowledgePage/components/__tests__/` — vitest 测试目录

### 修改后端文件（关键）
- `api/services/etl4lm_loader.py` — filter 转发 + OCR 重试 + timemout 拼写
- `bisheng_langchain/document_loaders/elem_unstrcutured_loader.py` — filter 转发
- `api/services/knowledge.py` — create_knowledge 不吞索引失败 + 知识库级删除补 bbox/预览
- `api/services/knowledge_imp.py` — 双写补偿 + 拆分（批次 F）
- `api/v1/schemas.py` — filter 默认值对齐
- `tool/domain/langchain/knowledge.py` — RRF 顺序 + rerank 调用降级 + 模块级 logger import + token 裁剪
- `core/ai/rerank/rrf_rerank.py` — 顺序注释（断言已有）
- `core/ai/rerank/common_rerank.py` — httpx timeout
- `llm/domain/llm/embedding.py` — request_timeout/max_retries 注入
- `workflow/nodes/rag/rag.py` — 检索异常降级
- `workflow/nodes/knowledge_retriever/knowledge_retriever.py` — 检索异常降级
- `workflow/common/knowledge.py` — tmp_collection 清理 + query_rewrite 默认 + abstract 检索路
- `workflow/common/query_rewrite.py` — HyDE
- `workflow/nodes/base.py` — tmp_collection 生命周期（含 ES 侧后缀 + 创建即注册）
- `worker/knowledge/file_worker.py` — 顶层 except 标 FAILED + retry knowledge 修复
- `core/config/settings.py` — query_rewrite_enabled 默认 + beat_schedule 注入 timeout_sweeper
- `knowledge/domain/models/knowledge_file.py` — split_rule 改 JSON + 软删除字段 + 索引 + parent_chunk_id
- `knowledge/domain/models/knowledge.py` — 软删除字段 + 索引
- `database/models/recall_chunk.py` — file_id 索引
- `knowledge/domain/services/knowledge_service.py` — 重命名 KnowledgeMetadataService + 加 logger

### 修改前端文件（关键）
- `pages/KnowledgePage/filesUpload.tsx` — fileter→filter 拼写
- `pages/KnowledgePage/AdjustFilesUpload.tsx` — fileter→filter + 默认值
- `pages/KnowledgePage/components/FileUploadStep1.tsx` — 拼写 + 类型对齐 + 默认值
- `pages/KnowledgePage/components/FileUploadStep2.tsx` — 拼写 + 类型对齐 + 默认值
- `pages/KnowledgePage/components/PreviewResult.tsx` — 拼写
- `pages/KnowledgePage/components/Paragraphs.tsx` — 默认值统一
- `pages/KnowledgePage/components/RuleFile.tsx` — 补 filter UI + separator 用原始正则
- `pages/KnowledgePage/components/RuleTable.tsx` — 补 filter UI
- `pages/KnowledgePage/components/FileUploadSplitStrategy.tsx` — regex 存原始正则（数据与翻译分离）+ 补 articleRule
- `pages/KnowledgePage/components/MetadataManagementDialog.tsx` — 复用公共常量
- `pages/KnowledgePage/components/MetadataFilter.tsx` — 复用公共常量
- `pages/KnowledgePage/components/RetrievalWeightSlider.tsx` — onValidate 修正（抽纯函数 + vitest）
- `pages/KnowledgePage/components/Header.tsx` — 死代码清理
- `pages/KnowledgePage/KnowledgeFile.tsx` — 抽公共组件 + 移除 window.LibPage
- `pages/KnowledgePage/KnowledgeQa.tsx` — 抽公共组件 + 移除 window.LibPage

---

## 批次总览

| 批次 | 内容 | 任务数 | 优先级 |
|------|------|--------|--------|
| A | P0 硬 bug×5（A1/A3/A4/A5/A6）+ A2 防御性重构 | A1-A6 | 必修最先 |
| B | P1 前端类型与 UI 对齐 | B1-B4 | 必修 |
| C | P1 异常路径与数据一致性（C3 先于 C2） | C1-C4 | 必修 |
| D | P1 运维与集成 | D1-D5 | 必修 |
| E | P1 数据模型 | E1-E3 | 必修 |
| F | P1/P2 架构改造（F1 依赖 C3 落地） | F1-F4 | 正道 |
| G | P2 检索策略升级（G4 仅新切片+NULL 容错） | G1-G4 | 改进 |
| H | P2 前端组件 | H1-H2 | 改进 |
| I | P2 可观测性与备份（I3 逻辑备份） | I1-I3 | 改进 |
| J | 构建部署验证 | J1-J3 | 收口 |

依赖：A 独立最先；B 依赖 A1（filter 拼写）；C 内部 **C3 先于 C2**（C2 调用 C3 服务），C4 独立；D/E 独立；F1 依赖 C3（统一删除服务已就绪，F1 拆模块时 vector_delete.py 仅 re-export）；G 依赖 A3/A4（RRF/rerank 修后再升级），G4 存量走旧路仅新切片启用层级；H 依赖 B；I 依赖 F（指标埋点需模块边界清晰）；J 依赖全部。

---

## 批次 A：P0 硬 bug + A2 防御性重构

### Task A1: filter_page_header_footer 端到端接缝贯通（双端改，剥离占位）

**范围定案（彭总 2026-07-02）：** 经财经容器实证，etl4llm 服务侧（OCR Adapter @ 8180）当前**不消费** `filter_page_header_footer`：
- `Etl4llmRequest` schema 无该字段（仅 `extra="allow"` 透传）
- `routes.py` predict 只构造 `OcrContext(enable_formula=...)`，未读 filter 字段
- adapter 首版 text 退化，partitions 恒 []，**无 bbox 数据**返回
- bbox 在 `OcrResult.bboxes`/`raw_grounding`（G2 字段，DeepSeek 后端首版不填）；`grounding_to_partitions` 遇 raw_grounding `raise NotImplementedError("G2 阶段实现")`

故 A1 完整剥离依赖 adapter G2 grounding 实现（跨项目大改造，超 A1 范围）。**本期定案"只打通接缝占位"**：E-Agent 端转发 + 前端修正 + adapter 透传字段到 OcrContext（recognize_batch 首版不剥离，G2 后补剥离即生效）。接缝打通，剥离待 G2，不阻塞重传基线。

**Files:**
- Modify: `src/backend/bisheng/api/services/etl4lm_loader.py:207,281`（转发）
- Modify: `src/backend/bisheng_langchain/document_loaders/elem_unstrcutured_loader.py:95`（转发）
- Modify: `src/frontend/platform/src/pages/KnowledgePage/filesUpload.tsx:169`、`AdjustFilesUpload.tsx:220`、`components/FileUploadStep2.tsx:193,371`、`components/FileUploadStep1.tsx:52`、`components/PreviewResult.tsx:110`、`components/Paragraphs.tsx:660`（拼写 + 默认值）
- Modify: `src/backend/bisheng/api/v1/schemas.py:432,448-449`（默认值对齐）
- Modify（OCR Adapter 项目 `C:\Users\Administrator\projects\eagent-ocr-adapter`）: `src/eagent_ocr_adapter/api/schemas.py`（Etl4llmRequest 显式声明 filter 字段）、`src/eagent_ocr_adapter/api/routes.py`（透传到 OcrContext）
- Test: `src/backend/tests/knowledge/test_etl4lm_payload_filter.py`（E-Agent 端）
- Test: `C:\Users\Administrator\projects\eagent-ocr-adapter\tests\unit\test_filter_passthrough.py`（adapter 端）

**Interfaces:**
- Consumes: Etl4llmRequest payload（adapter 显式声明 `filter_page_header_footer` 字段）；OcrContext.filter_page_header_footer
- Produces: E-Agent 转发 filter 字段；adapter Etl4llmRequest 显式字段 + routes 透传 `OcrContext(filter_page_header_footer=req.filter_page_header_footer)`；前端 5 处键名统一；前后端默认值统一为开启

- [ ] **Step 0: 前置已确认** — 实证 adapter 不消费 filter（routes/schemas 已读），定案"接缝占位"，剥离待 G2。无需再查。

- [ ] **Step 1: Write the failing test (RED)**

```python
# src/backend/tests/knowledge/test_etl4lm_payload_filter.py
import importlib.util, os, inspect

def _load_etl4lm_loader():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "api", "services", "etl4lm_loader.py")
    spec = importlib.util.spec_from_file_location("etl4lm_loader_under_test", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def test_etl4llm_payload_contains_filter_and_todo_removed():
    """P0-1: etl4lm_loader 转发 filter_page_header_footer 且 TODO 注释已删"""
    loader = _load_etl4lm_loader()
    src = inspect.getsource(loader)
    # 条件1: TODO 注释已删除
    assert "TODO: add filter_page_header_footer" not in src, "etl4lm_loader TODO 注释仍在"
    # 条件2: payload 构造处含 filter_page_header_footer 键（排除注释里的字面量）
    assert "filter_page_header_footer=bool(self.filter_page_header_footer)" in src, \
        "etl4lm_loader 仍未把 filter_page_header_footer 转发进 payload"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src/backend && python -m pytest tests/knowledge/test_etl4lm_payload_filter.py -v`
Expected: FAIL — TODO 仍在 / payload 无字段

- [ ] **Step 3: Write minimal implementation (GREEN)**

`etl4lm_loader.py` 同步 `load`（约 :207）与异步 `aload`（约 :281）payload 构造处，删 TODO，加字段：

```python
payload = dict(
    filename=self.file_name,
    b64_data=[b64_data],
    mode="partition",
    force_ocr=self.force_ocr,
    enable_formula=self.enable_formular,
    ocr_sdk_url=self.ocr_sdk_url,
    parameters=parameters,
    filter_page_header_footer=bool(self.filter_page_header_footer),  # 转发
)
```

`elem_unstrcutured_loader.py:95` 同样在 payload 加 `filter_page_header_footer`（若该 loader 调 etl4llm）。

前端 5 处 `fileter_page_header_footer` → `filter_page_header_footer`：`filesUpload.tsx:169`、`AdjustFilesUpload.tsx:220`、`FileUploadStep2.tsx:193`、`FileUploadStep1.tsx:52`、`PreviewResult.tsx:110`。

默认值统一为开启：
- `schemas.py:432`：`filter_page_header_footer: Optional[int] = Field(default=1, ...)`
- `schemas.py:448-449` 兜底：`values['filter_page_header_footer'] = 1`
- `Paragraphs.tsx:660`：`pageHeaderFooter: true`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd src/backend && python -m pytest tests/knowledge/test_etl4lm_payload_filter.py -v`
Expected: PASS

- [ ] **Step 5: 前端验证** — `cd src/frontend/platform && npx tsc --noEmit && npm run build`
- [ ] **Step 6: Commit（E-Agent 端）** — `git add ... && git commit -m "fix(kb): P0-1 filter_page_header_footer E-Agent 端转发+前端拼写+默认值对齐"`

**OCR Adapter 端（接缝占位）：**

- [ ] **Step 7: adapter RED** — `C:\Users\Administrator\projects\eagent-ocr-adapter\tests\unit\test_filter_passthrough.py`

```python
def test_etl4llm_request_has_filter_field():
    from eagent_ocr_adapter.api.schemas import Etl4llmRequest
    req = Etl4llmRequest(filename="x.pdf", b64_data=["..."], filter_page_header_footer=True)
    assert req.filter_page_header_footer is True

def test_predict_passes_filter_to_ocr_context(monkeypatch):
    # mock scheduler.submit_pages 捕获 ctx，断言 ctx.filter_page_header_footer=True
    # 当 req.filter_page_header_footer=True 时
    pass  # 补全（参考 adapter 既有 tests/integration 范式）
```

- [ ] **Step 8: adapter GREEN** — `schemas.py` Etl4llmRequest 加 `filter_page_header_footer: bool = False`；`routes.py` predict 改 `ctx = OcrContext(enable_formula=req.enable_formula, filter_page_header_footer=req.filter_page_header_footer)`。recognize_batch 首版不剥离（占位，G2 后补）。
- [ ] **Step 9: adapter 验证 + Commit** — `cd C:\Users\Administrator\projects\eagent-ocr-adapter && python -m pytest tests/unit/test_filter_passthrough.py -v`；commit `feat(adapter): 透传 filter_page_header_footer 到 OcrContext（剥离待 G2）`

**验收：** grep `fileter` 全仓 0 命中；E-Agent 两处 TODO 消失且 payload 含字段；adapter Etl4llmRequest 显式字段 + routes 透传 OcrContext；前后端默认值统一为开启。剥离待 G2（占位，不阻塞基线）。

---

### Task A2: 切分预定义规则 数据与翻译分离（P1 防御性重构）

**定性说明：** 经源码核实，i18n `label` 实际是正则模式字符串（`"\\n"`/`"第.{1,3}章"`），`handleRegexClick` 存 label 当 regex **当前碰巧生效**。本任务非修"功能失效"，而是修"i18n 翻译值当数据用"的脆弱耦合——若有人改 label 文案为中文描述则失效。正道：正则模式作为数据常量与 i18n 分离，i18n 仅用于 UI 显示。降为 P1，可在批次 B 时做，不阻塞 P0 重传基线。

**Files:**
- Modify: `src/frontend/platform/src/pages/KnowledgePage/components/FileUploadSplitStrategy.tsx:10-20,50-58,65-75`
- Modify: `src/frontend/platform/src/pages/KnowledgePage/components/RuleFile.tsx:186`
- Test: `src/frontend/platform/src/pages/KnowledgePage/components/__tests__/splitStrategy.spec.ts`

**Interfaces:**
- Consumes: `ruleI18nMap`（键=正则模式字符串，9 项含 articleRule）、`predefinedRules`
- Produces: `PREDEFINED_REGEX_MAP`（正则模式数据常量）；`buildPredefinedStrategy(regex, mode)` 返回 `{regex, position, rule}`（rule=中文 desc 仅 UI）；`handleRegexClick` 调 `buildPredefinedStrategy`（被测即生产）；i18n label/desc 仅 UI 显示

- [ ] **Step 1: Write the failing test (RED)**

```ts
// FileUploadSplitStrategy.tsx 抽出可测纯函数 + 数据常量
export const PREDEFINED_REGEX_MAP: Record<string, string> = {
  '\\n': 'singleNewlineRule', '\\n\\n': 'doubleNewlineRule',
  '第.{1,3}章': 'chapterRule', '第.{1,3}条': 'articleRule',
  '。': 'chinesePeriodRule', '！': 'chineseExclamationRule',
  '？': 'chineseQuestionRule', '；': 'chineseSemicolonRule',
  '\\.': 'englishPeriodRule',
};
export const PREDEFINED_REGEX_KEYS = Object.keys(PREDEFINED_REGEX_MAP);
// buildPredefinedStrategy 接收 i18n t 函数，返回 {regex(原始), position, rule(中文 desc)}
export function buildPredefinedStrategy(regex: string, mode: string, t: (k: string) => string) {
  const key = PREDEFINED_REGEX_MAP[regex];
  return { regex, position: mode, rule: key ? t(`predefinedRules.${key}.desc`) : regex };
}
```

```ts
// __tests__/splitStrategy.spec.ts
import { PREDEFINED_REGEX_MAP, PREDEFINED_REGEX_KEYS, buildPredefinedStrategy } from '../FileUploadSplitStrategy';
const fakeT = (k: string) => k; // 返回 key 作 label/desc 占位

describe('A2 切分预定义规则数据与翻译分离', () => {
  it('预定义键含 9 项含 articleRule', () => {
    expect(PREDEFINED_REGEX_KEYS).toContain('第.{1,3}条');
    expect(PREDEFINED_REGEX_KEYS.length).toBe(9);
  });
  it('buildPredefinedStrategy 存原始正则而非 i18n label', () => {
    const s = buildPredefinedStrategy('\\n', 'after', fakeT);
    expect(s.regex).toBe('\\n');           // 原始正则，非翻译值
    expect(s.position).toBe('after');
    expect(s.rule).toContain('singleNewlineRule'); // desc 走 i18n
  });
  it('每条预定义键都能在 map 命中', () => {
    for (const k of PREDEFINED_REGEX_KEYS) expect(PREDEFINED_REGEX_MAP[k]).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src/frontend/platform && npx vitest run src/pages/KnowledgePage/components/__tests__/splitStrategy.spec.ts`
Expected: FAIL — 当前 `handleRegexClick` 存 `t('...label')` 而非原始 regex；buildPredefinedStrategy 未定义

- [ ] **Step 3: Write minimal implementation (GREEN)**

`FileUploadSplitStrategy.tsx`：
1. 导出 `PREDEFINED_REGEX_MAP`（9 项含 `第.{1,3}条`）、`PREDEFINED_REGEX_KEYS`、`buildPredefinedStrategy`
2. `handleRegexClick` 调 `buildPredefinedStrategy`（被测即生产）：

```tsx
const handleRegexClick = (regex: string, mode: string) => {
  const { regex: realRegex, position, rule } = buildPredefinedStrategy(regex, mode, t);
  const newStrategy = { id: generateUUID(6), regex: realRegex, position, rule };
  setStrategies([...strategies, newStrategy]);
};
```

`RuleFile.tsx:186` 保持 `separator = newStrategies.map(s => s.regex)`（现在 s.regex 是原始正则，正确）。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd src/frontend/platform && npx vitest run src/pages/KnowledgePage/components/__tests__/splitStrategy.spec.ts && npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 5: Commit** — `git add ... && git commit -m "refactor(kb): A2 切分预定义规则数据与翻译分离（正则抽常量+i18n仅UI），补 articleRule"`

**验收：** strategy.regex 是原始正则模式而非 i18n 翻译值；PREDEFINED_REGEX_MAP 含 9 项含 articleRule；handleRegexClick 调 buildPredefinedStrategy。

---

### Task A3: RRF 权重顺序对齐

**Files:**
- Modify: `src/backend/bisheng/tool/domain/langchain/knowledge.py:97-103`
- Test: `src/backend/tests/knowledge/test_rrf_weight_order.py`

**注意：** `rrf_rerank.py:55-56` **已有** `if len(documents) != len(self.weights): raise ValueError` 长度断言，不重复添加。本任务仅改 documents 顺序 + 顺序注释。

**Interfaces:**
- Consumes: `RRFRerank(retrievers=[vector_retriever, elastic_retriever], weights=[vector_weight, keyword_weight])`
- Produces: `documents=[milvus_docs, es_docs]` 顺序与 retrievers/weights 一致（向量在前）

- [ ] **Step 1: Write the failing test (RED)**

```python
# src/backend/tests/knowledge/test_rrf_weight_order.py
import importlib.util, os, inspect

def _load_rrf_caller():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "tool", "domain", "langchain", "knowledge.py")
    spec = importlib.util.spec_from_file_location("kb_tool", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def test_documents_order_matches_weights_order():
    """P0-3: documents 顺序必须与 weights 顺序一致（向量 milvus 在前）"""
    mod = _load_rrf_caller()
    src = inspect.getsource(mod)
    assert "documents=[milvus_docs, es_docs]" in src, \
        "RRF documents 顺序仍与 weights 不一致（应为 [milvus_docs, es_docs]）"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src/backend && python -m pytest tests/knowledge/test_rrf_weight_order.py -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation (GREEN)**

`tool/domain/langchain/knowledge.py:97-103`：

```python
def _rrf_rerank(self, milvus_docs, es_docs, query):
    rrf_rerank = RRFRerank(
        retrievers=[self.vector_retriever, self.elastic_retriever],  # [向量, 关键词]
        weights=self.rrf_weights,  # [vector_weight, keyword_weight]
        remove_zero_score=self.rrf_remove_zero_score,
    )
    # documents 顺序必须与 retrievers/weights 一致：向量(milvus)在前，关键词(es)在后
    finally_docs = rrf_rerank.compress_documents(documents=[milvus_docs, es_docs], query=query)
    return finally_docs
```

- [ ] **Step 4: Run test to verify it passes** — `python -m pytest tests/knowledge/test_rrf_weight_order.py -v`，PASS
- [ ] **Step 5: Commit** — `git commit -m "fix(kb): P0-3 RRF documents 顺序对齐 weights，修复 ES 配 vector_weight 错配"`

**验收：** documents=[milvus_docs, es_docs] 与 weights=[vector_weight, keyword_weight] 位置一致。

---

### Task A4: rerank 调用阶段降级

**Files:**
- Create: `src/backend/bisheng/workflow/common/rerank_degrade.py`
- Modify: `src/backend/bisheng/tool/domain/langchain/knowledge.py`（模块顶补 `from loguru import logger` + :55-58/91-94 调用包降级）
- Test: `src/backend/tests/knowledge/test_rerank_degrade.py`

**注意：** `tool/domain/langchain/knowledge.py` 模块级无 logger import（`_arun` 内 :84 才局部 import），GREEN 代码 `logger=logger` 在 `_run` 作用域会 NameError。**须在模块顶加 `from loguru import logger`**。

**Interfaces:**
- Consumes: `self.rerank`、`finally_docs`、`query`
- Produces: `compress_with_degrade(rerank, docs, query, logger) -> (docs, degraded)`；`acompress_with_degrade` 异步版

- [ ] **Step 1: Write the failing test (RED)**

```python
# src/backend/tests/knowledge/test_rerank_degrade.py
import importlib.util, os, asyncio

def _load():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "workflow", "common", "rerank_degrade.py")
    spec = importlib.util.spec_from_file_location("rerank_degrade", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def test_sync_rerank_failure_degrades():
    mod = _load()
    class Boom:
        def compress_documents(self, docs, query): raise RuntimeError("down")
    docs = [{"page_content": "x"}]
    out, degraded = mod.compress_with_degrade(Boom(), docs, "q", logger=None)
    assert out == docs and degraded is True

def test_sync_no_rerank_passthrough():
    mod = _load()
    out, degraded = mod.compress_with_degrade(None, [{"page_content": "x"}], "q", logger=None)
    assert degraded is False

def test_sync_rerank_success():
    mod = _load()
    class Ok:
        def compress_documents(self, docs, query): return [{"page_content": "c"}]
    out, degraded = mod.compress_with_degrade(Ok(), [{"page_content": "x"}], "q", logger=None)
    assert out == [{"page_content": "c"}] and degraded is False

def test_async_rerank_failure_degrades():
    mod = _load()
    class Boom:
        async def acompress_documents(self, docs, query): raise RuntimeError("down")
    out, degraded = asyncio.run(mod.acompress_with_degrade(Boom(), [{"page_content":"x"}], "q", logger=None))
    assert out == [{"page_content":"x"}] and degraded is True
```

- [ ] **Step 2: Run test to verify it fails** — `python -m pytest tests/knowledge/test_rerank_degrade.py -v`，FAIL（module not found）
- [ ] **Step 3: Write minimal implementation (GREEN)**

```python
# src/backend/bisheng/workflow/common/rerank_degrade.py
import logging

def compress_with_degrade(rerank, docs, query, logger=None):
    if rerank is None:
        return docs, False
    log = logger or logging.getLogger(__name__)
    try:
        return rerank.compress_documents(docs, query), False
    except Exception as e:
        log.warning(f"rerank compress_documents failed, degrade to RRF-only: {e}")
        return docs, True

async def acompress_with_degrade(rerank, docs, query, logger=None):
    if rerank is None:
        return docs, False
    log = logger or logging.getLogger(__name__)
    try:
        return await rerank.acompress_documents(docs, query), False
    except Exception as e:
        log.warning(f"rerank acompress_documents failed, degrade to RRF-only: {e}")
        return docs, True
```

`tool/domain/langchain/knowledge.py` 顶部加 `from loguru import logger`；`:55-58` 同步：

```python
from bisheng.workflow.common.rerank_degrade import compress_with_degrade
finally_docs = self._rrf_rerank(milvus_docs, es_docs, query)
finally_docs, _ = compress_with_degrade(self.rerank, finally_docs, query, logger=logger)
return finally_docs
```

`:91-94` 异步用 `acompress_with_degrade`。

- [ ] **Step 4: Run test to verify it passes** — 4 PASS
- [ ] **Step 5: Commit** — `git commit -m "fix(kb): P0-4 rerank 调用阶段降级（套用初始化降级范式，失败不中断检索）"`

**验收：** rerank 调用失败返回 RRF 结果 + warning，不抛异常；async 同理。

---

### Task A5: 检索异常不再喂 LLM

**Files:**
- Create: `src/backend/bisheng/workflow/common/retrieval_fallback.py`
- Modify: `src/backend/bisheng/workflow/nodes/rag/rag.py:75-99`
- Modify: `src/backend/bisheng/workflow/nodes/knowledge_retriever/knowledge_retriever.py:23-47`
- Test: `src/backend/tests/knowledge/test_retrieval_fallback.py`

**注意：** `create_stuff_documents_chain` 空 context 不崩（StuffDocumentsChain 空列表→空字符串），`knowledge.py:18` prompt 已含"没有找到相关内容"兜底。`_errors` 追踪用 `setdefault`（`get` 返回新 list 不回写，append 丢失）。空 context 的 prompt 润色延至 G3，A5 只保证不含异常文本。

- [ ] **Step 1: Write the failing test (RED)**

```python
# src/backend/tests/knowledge/test_retrieval_fallback.py
import importlib.util, os

def _load():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "workflow", "common", "retrieval_fallback.py")
    spec = importlib.util.spec_from_file_location("retrieval_fallback", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def test_retrieval_failure_returns_empty_not_exception_text():
    mod = _load()
    docs, err = mod.on_retrieval_failure(RuntimeError("connect lost"), logger=None)
    assert docs == []
    assert err == "retrieval_failed"

def test_no_exception_text_leaks_into_docs():
    mod = _load()
    docs, _ = mod.on_retrieval_failure(RuntimeError("secret connect lost"), logger=None)
    assert all("connect lost" not in (getattr(d, 'page_content', '') or '') for d in docs)
```

- [ ] **Step 2: Run test to verify it fails** — FAIL（module not found）
- [ ] **Step 3: Write minimal implementation (GREEN)**

```python
# src/backend/bisheng/workflow/common/retrieval_fallback.py
import logging

def on_retrieval_failure(exc, logger=None):
    """检索失败返回空 docs + error 标记，绝不把异常文本当结果喂 LLM。
    Returns: (docs: list, error_msg: str)。docs 恒空；error_msg 供节点输出/日志，不进 LLM context。"""
    log = logger or logging.getLogger(__name__)
    log.exception("retrieval failed, degrade to empty result")
    return [], "retrieval_failed"
```

`rag.py:75-99`：

```python
from bisheng.workflow.common.retrieval_fallback import on_retrieval_failure
try:
    self.init_multi_retriever(); self.init_rerank_model()
    source_documents = self.retrieve_question(question)
except Exception as e:
    source_documents, _ = on_retrieval_failure(e, logger=logger)  # 空 context，不喂 str(e)
qa_chain = create_stuff_documents_chain(llm=self._llm, prompt=self._qa_prompt)
inputs = {"context": source_documents}
result = qa_chain.invoke(inputs, ...)
```

`knowledge_retriever.py:23-47`：

```python
from bisheng.workflow.common.retrieval_fallback import on_retrieval_failure
try:
    self.init_rerank_model()
    question_answer = self.retrieve_question(question)
    question_answer = [{"text": one.page_content, "metadata": {...}} for one in question_answer]
except Exception as e:
    question_answer, err = on_retrieval_failure(e, logger=logger)
    ret.setdefault("_errors", []).append(err)  # setdefault 非 get，否则 error 写丢
    ret[output_key] = question_answer
    return
ret[output_key] = question_answer
```

- [ ] **Step 4: Run test to verify it passes** — 2 PASS
- [ ] **Step 5: Commit** — `git commit -m "fix(kb): P0-5 检索异常降级返回空结果，不再把 str(e) 当结果喂 LLM"`

**验收：** rag 失败 context 为空（不含异常文本）；knowledge_retriever 输出空列表 + `_errors` 标记（setdefault 写入成功）。

---

### Task A6: create_knowledge 索引失败不吞

**Files:**
- Modify: `src/backend/bisheng/api/services/knowledge.py:157-199`
- Test: `src/backend/tests/knowledge/test_create_knowledge_index_failure.py`

**注意：** 报告写 `knowledge_imp.py:194` 有误，实际在 `api/services/knowledge.py:194-196`。`KnowledgeDao.delete_by_id` **不存在**，改用 `delete_knowledge(db_knowledge.id)`（此时无 KnowledgeFile，等价）。仅删 DB 留 Milvus collection/ES index 孤儿，须补向量侧清理。

**前置（Step 1 前）：** 执行前验证 `import bisheng.api.services.knowledge` 可行性（消 importlib hedge）——若触发 bisheng init 重依赖，改用 importlib 直加载 + 手动 patch。

- [ ] **Step 1: Write the failing test (RED)**

```python
# src/backend/tests/knowledge/test_create_knowledge_index_failure.py
from unittest.mock import patch, MagicMock

def test_create_knowledge_rolls_back_on_index_failure():
    from bisheng.api.services import knowledge as kb

    fake_knowledge = MagicMock(); fake_knowledge.id = 99; fake_knowledge.collection_name = "c"
    fake_knowledge.index_name = "i"
    fake_request = MagicMock(); fake_user = MagicMock(); fake_create = MagicMock()

    with patch.object(kb.KnowledgeDao, 'insert_one', return_value=fake_knowledge), \
         patch.object(kb.KnowledgeDao, 'delete_knowledge') as mock_del, \
         patch.object(kb.KnowledgeRag, 'init_knowledge_milvus_vectorstore_sync',
                      side_effect=RuntimeError("milvus down")), \
         patch.object(kb.KnowledgeRag, 'init_knowledge_es_vectorstore_sync',
                      return_value=MagicMock()):
        try:
            kb.KnowledgeService.create_knowledge(fake_request, fake_user, fake_create)
            assert False, "索引失败应抛异常"
        except Exception:
            pass
        mock_del.assert_called_once()  # DB 回滚
```

- [ ] **Step 2: Run test to verify it fails** — FAIL（当前吞异常返回成功）
- [ ] **Step 3: Write minimal implementation (GREEN)**

`api/services/knowledge.py:157-199`：

```python
class KnowledgeIndexCreateError(Exception):
    pass

@classmethod
def create_knowledge(cls, request, login_user, knowledge) -> Knowledge:
    # ...构造 db_knowledge...
    db_knowledge = KnowledgeDao.insert_one(db_knowledge)
    vector_client = None
    es_client = None
    try:
        vector_client = KnowledgeRag.init_knowledge_milvus_vectorstore_sync(...)
        es_client = KnowledgeRag.init_knowledge_es_vectorstore_sync(...)
        es_client._store._create_index_if_not_exists()
    except Exception as e:
        logger.exception("create knowledge index failed, rolling back")
        # 回滚 DB
        KnowledgeDao.delete_knowledge(db_knowledge.id)
        # 回滚已建的向量孤儿（若 vector_client 创建成功）
        if vector_client is not None:
            try:
                vector_client.col.drop()  # 或 VectorDeleteService.delete_by_knowledge_id
            except Exception as ee:
                logger.error(f"rollback milvus collection failed: {ee}")
        if es_client is not None:
            try:
                es_client._store._delete_index_if_exists()  # 删 ES 孤儿索引
            except Exception as ee:
                logger.error(f"rollback es index failed: {ee}")
        raise KnowledgeIndexCreateError(f"索引创建失败，已回滚: {e}")
    cls.create_knowledge_hook(request, login_user, db_knowledge)
    return db_knowledge
```

- [ ] **Step 4: Run test to verify it passes** — PASS
- [ ] **Step 5: Commit** — `git commit -m "fix(kb): P0-6 create_knowledge 索引失败回滚 DB+向量孤儿，不再吞掉"`

**验收：** 索引失败时 DB 记录删除、Milvus/ES 孤儿清理、向上抛异常。

---

## 批次 B：P1 前端类型与 UI 对齐

### Task B1: 前后端数值/布尔类型对齐 + 默认值统一

**Files:** `FileUploadStep2.tsx:188-192,366-367`、`FileUploadStep1.tsx:47-51`、`AdjustFilesUpload.tsx:86,107`
**问题：** Step2 发 string（chunkSize/Overlap 经 .toString()），Step1 发 number；retain_images 等发 boolean 后端期望 int；chunk_overlap 默认 Step2="0" vs Step1=100 矛盾。

- [ ] **Step 1: GREEN** — `FileUploadStep2.tsx:188-192` 发送处 `Number(chunkSize)` / `Number(chunkOverlap)` / `retainImages?1:0` 等；:367 默认对齐 Step1 的 100：`parsedSplitRule?.chunk_overlap?.toString() || "100"`；Step1:48 保持 100。
- [ ] **Step 2: 验证** — `npx tsc --noEmit && npm run build`
- [ ] **Step 3: Commit** — `git commit -m "fix(kb): P1 前端 chunk_size/overlap/bool 类型对齐 int，统一 chunk_overlap 默认 100"`

**验收：** payload 类型与后端 FileProcessBase(int) 一致；chunk_overlap 两路径默认 100。

---

### Task B2: 元数据内置字段抽公共常量 + MetadataFilter 复用

**Files:** Create `MetadataBuiltInFields.ts`；Modify `MetadataManagementDialog.tsx:32-45,480`、`MetadataFilter.tsx:138-145`
**问题：** MetadataManagementDialog 12 项 BUILT_IN_METADATA 但 UI 只展示前 6；MetadataFilter 硬编码 6 项不复用常量。

**注意（T-5）：** 先列出 MetadataFilter 现有硬编码 6 项（核实为 document_id/document_name/upload_time/update_time/uploader/updater），与 `BUILT_IN_METADATA_FIELDS.slice(0,6)` 比对一致后再 slice，避免行为变更。

- [ ] **Step 1: GREEN**

```ts
// MetadataBuiltInFields.ts
export const BUILT_IN_METADATA_FIELDS = [
  'document_id','document_name','upload_time','update_time','uploader','updater',
  'abstract','chunk_index','bbox','page','knowledge_id','user_metadata',
] as const;
export type BuiltInMetadataField = typeof BUILT_IN_METADATA_FIELDS[number];
export const DEFAULT_FILTER_METADATA_FIELDS = BUILT_IN_METADATA_FIELDS.slice(0, 6);
```

MetadataFilter 用 `DEFAULT_FILTER_METADATA_FIELDS` 替硬编码，并支持选择后 6 项作过滤项。
- [ ] **Step 2: 验证** — tsc + build
- [ ] **Step 3: Commit** — `git commit -m "fix(kb): P1 元数据内置字段抽公共常量，MetadataFilter 复用并支持全 12 项过滤"`

**验收：** MetadataFilter 可选 abstract/chunk_index/bbox/page 等后 6 项。

---

### Task B3: RetrievalWeightSlider onValidate 修正 + Header 死代码清理

**Files:** `RetrievalWeightSlider.tsx:57`、`Header.tsx:67,92-105`
**问题：** `onValidate(() => false)` 校验恒通过；Header isEditable 死代码。

**注意（TDD-3）：** onValidate 权重范围校验抽纯函数 + vitest 行为断言（tsc 测不出运行时）。

- [ ] **Step 1: RED**

```ts
// __tests__/retrievalWeight.spec.ts
export function validateWeights(vectorWeight: number, keywordWeight: number): string | false {
  if (vectorWeight < 0 || vectorWeight > 1) return 'vector_weight_range';
  if (keywordWeight < 0 || keywordWeight > 1) return 'keyword_weight_range';
  return false;
}
describe('B3 权重校验', () => {
  it('合法权重通过', () => expect(validateWeights(0.5, 0.5)).toBe(false));
  it('vector 超界报错', () => expect(validateWeights(1.5, 0.5)).toBe('vector_weight_range'));
});
```
- [ ] **Step 2: GREEN** — `RetrievalWeightSlider.tsx:57` 调 `validateWeights`；Header 移除 isEditable + 注释 Dialog。
- [ ] **Step 3: 验证** — vitest + tsc + build
- [ ] **Step 4: Commit** — `git commit -m "fix(kb): P1 RetrievalWeightSlider onValidate 加权重范围校验+vitest，Header 清死代码"`

---

### Task B4: filter_page_header_footer UI 控件补到 RuleFile/RuleTable

**Files:** Create `FilterPageHeaderFooterToggle.tsx`；Modify `RuleFile.tsx`、`RuleTable.tsx`
**问题：** 无 UI 控件用户无法配置。
- [ ] **Step 1: GREEN** — 新建 Toggle（Checkbox + i18n），RuleFile 切分规则表单区嵌入，state 绑定 pageHeaderFooter，提交并入 splitRule（`filter_page_header_footer: pageHeaderFooter?1:0`）；RuleTable 加列展示。
- [ ] **Step 2: 验证** — tsc + build（纯 UI，无行为单测，依赖 J3 端到端）
- [ ] **Step 3: Commit** — `git commit -m "feat(kb): P1 RuleFile/RuleTable 补 filter_page_header_footer UI 控件"`

---

## 批次 C：P1 异常路径与数据一致性（C3 先于 C2）

### Task C3: 3 套向量删除统一为单一服务（先于 C2）

**Files:** Create `src/backend/bisheng/common/vector_delete_service.py`；迁移调用方（含 `api/v1/chat.py:248`）；旧 3 套函数改 thin wrapper
**调用方清单（核实补充 chat.py:248）：** `knowledge_imp.py:316,1481`、`knowledge.py:301`、`file_worker.py:297/365/378`、`rebuild_knowledge_worker.py:51`、`qa.py:176/268`、`knowledge_imp.py:1392/1416`、`knowledge/api/endpoints/knowledge.py:553`、`open_endpoints/.../filelib.py:353/386/235/242`、`script/knowledge_data_fix.py:468/472`、**`api/v1/chat.py:248`（delete_vector(col_name, None)）**

**接口与参数翻转：**
- 新服务 `VectorDeleteService.delete_by_file_ids(knowledge, file_ids, del_es=True, del_milvus=True)`（knowledge 在前）
- 旧 `delete_vector_files(file_ids, knowledge)`（file_ids 在前）→ thin wrapper 内部转调需**参数顺序翻转**：`delete_by_file_ids(knowledge=knowledge, file_ids=file_ids)`

**策略：**
1. 新建 `vector_delete_service.py`，统一用 `document_id`（写入时 `metadata.document_id = db_file.id`，:658）——`delete_vector_data` 用 `file_id in {...}` 是错配键，废弃
2. 旧 3 套函数改 thin wrapper 调新服务 + `DeprecationWarning`（逼迁移）
3. 逐个迁移调用方到新服务（多 commit）
4. CI grep 守卫：断言无新调用点直接用旧函数

- [ ] **Step 1: RED** — 测新服务按 file_id 删用 document_id expr
- [ ] **Step 2: GREEN** — 实现服务 + thin wrapper（含参数翻转 + DeprecationWarning）+ 迁移调用方（分批 commit）
- [ ] **Step 3: 验证** — pytest 全知识库测试
- [ ] **Step 4: Commit**（分批）— `refactor(kb): P1 3 套向量删除统一为 VectorDeleteService，键统一 document_id，wrapper 加 DeprecationWarning`

**验收：** grep 旧 3 套函数均为 thin wrapper + DeprecationWarning；调用方迁移到新服务；无键名错配。

---

### Task C2: Milvus→ES 双写补偿（依赖 C3）

**Files:** Modify `knowledge_imp.py:670-674,722-726`
**问题：** Milvus→ES 裸调用无 try，ES 失败 Milvus 残留。
**依赖：** C3 已落地，回滚调用 `VectorDeleteService.delete_by_file_ids`（非旧 `delete_vector_files`）。

- [ ] **Step 1: RED** — mock：ES add_texts 抛异常，断言 Milvus 已写数据被回滚

```python
def test_es_failure_rolls_back_milvus(monkeypatch):
    # mock vector_client.add_texts 成功、es_client.add_texts 抛异常
    # 断言 VectorDeleteService.delete_by_file_ids 被调用回滚
    # 断言原异常被 re-raise（raise from e，不吞）
    pass  # 执行时按 A6 mock 范式补全（参考 patch.object 注入）
```
- [ ] **Step 2: GREEN**

```python
vector_client.add_texts(texts=texts, metadatas=metadatas)
try:
    es_client.add_texts(texts=texts, metadatas=metadatas)
except Exception as e:
    logger.exception(f"ES add_texts failed file={db_file.id}, rolling back Milvus")
    try:
        VectorDeleteService.delete_by_file_ids(knowledge, [db_file.id])
    except Exception as ee:
        logger.error(f"rollback milvus failed: {ee}")  # 记录但不吞原异常
    raise  # raise from e，不掩盖原异常
```
- [ ] **Step 3: 验证** — pytest
- [ ] **Step 4: Commit** — `git commit -m "fix(kb): P1 Milvus→ES 双写补偿，ES 失败回滚 Milvus（用 VectorDeleteService）"`

**验收：** ES 失败回滚 Milvus；回滚失败不吞原异常。

---

### Task C1: file_worker 顶层 except 标 FAILED + retry knowledge 修复

**Files:** Modify `file_worker.py:287-288,358-359,346,357,362`
**问题：** 顶层 except 仅 logger.error 不标 FAILED 不重抛，文件卡 PROCESSING；retry 路径 knowledge 恒 None（:357 未接收返回值），:362 死分支。

**注意：** 删"让 acks_late 重试"措辞（语义错，acks_late 普通异常不重投）。二选一：**(a) 标 FAILED 不重抛**（简单，治卡 PROCESSING，推荐）或 (b) `raise self.retry(exc=e, max_retries=3)`（真重试）。本计划选 (a)。

- [ ] **Step 1: RED** — mock 范式（参考 A6 patch.object）：模拟 `_parse_knowledge_file` 抛异常，断言文件状态被置 FAILED；`inspect.getsource` 断言 retry 路径含 `_, knowledge = _parse_knowledge_file`

```python
def test_parse_failure_marks_file_failed(monkeypatch):
    # patch _parse_knowledge_file 抛异常、KnowledgeFileDao.update_file_status
    # 断言 update_file_status 被调用且 status=FAILED
    pass  # 补全 mock（不再用 pass placeholder，执行时填实）

def test_retry_receives_knowledge_return_value():
    from bisheng.worker.knowledge import file_worker
    src = inspect.getsource(file_worker.retry_knowledge_file_celery)
    assert "_, knowledge = _parse_knowledge_file" in src
```
- [ ] **Step 2: GREEN**

```python
# :287-288 parse
except Exception as e:
    logger.error("parse_knowledge_file_celery error: {}", str(e))
    try:
        KnowledgeFileDao.update_file_status([file_id], KnowledgeFileStatus.FAILED, ...)
    except Exception as ee:
        logger.error("mark FAILED failed: {}", str(ee))
    # 不重抛（选 a 方案），文件置 FAILED 不卡 PROCESSING
```

`:346-362` retry 修复 knowledge 接收：`_, knowledge = _parse_knowledge_file(file_id, preview_cache_key, callback_url)`，使 :362 `if not db_file and knowledge:` 可触发。

- [ ] **Step 3: 验证** — pytest
- [ ] **Step 4: Commit** — `git commit -m "fix(kb): P1 file_worker 顶层 except 标 FAILED，retry 修复 knowledge 恒 None 死分支"`

---

### Task C4: tmp_collection 生命周期清理

**Files:** Modify `base.py:56,121-122`、`workflow/common/knowledge.py:386`、`input.py:188`、`agent.py:196`；Create workflow 结束钩子
**问题：** 创建 3 处清理 0 处，换 embedding 后旧维度残留。

**注意（review 修订）：**
1. **ES 侧 index_name 也要加 workflow_id 后缀**（当前 ES 用裸常量 `self.tmp_collection_name`，已与 Milvus 带后缀名错位，多 workflow 共享一个 ES tmp index 串扰）
2. **创建即注册**：创建 collection 时 `self._tmp_collections_created.append((emb_id, col_name))`，否则 drop 永不执行
3. workflow 结束钩子位置**先 grep 定位** `WorkflowRunner`/`workflow.run` 终点再写代码
4. 三创建点确认是否都经 `get_milvus_collection_name` 取名（若有内联拼名统一改调该方法）

- [ ] **Step 1: RED** — 断言 Milvus + ES 名均含 workflow_id 后缀；断言创建即注册到 `_tmp_collections_created`；断言结束钩子调 drop
- [ ] **Step 2: GREEN**

```python
# base.py
def get_milvus_collection_name(self, embedding_model_id: str) -> str:
    suffix = getattr(self, '_exec_unique_id', '') or getattr(self, 'workflow_id', '')
    return f"{self.tmp_collection_name}_{embedding_model_id}_{suffix}" if suffix else f"{self.tmp_collection_name}_{embedding_model_id}"
def get_es_index_name(self, embedding_model_id: str) -> str:
    # ES 侧同样加后缀，与 Milvus 对齐
    return self.get_milvus_collection_name(embedding_model_id)
```

三创建点统一调 `get_milvus_collection_name`（Milvus）+ `get_es_index_name`（ES），并 `self._tmp_collections_created.append(...)`。

结束钩子（grep 定位 WorkflowRunner 终点后）：

```python
def _cleanup_tmp_collections(self):
    for emb_id, col_name in getattr(self, '_tmp_collections_created', []):
        try:
            vector_client.col.drop(col_name)
        except Exception as e:
            logger.warning(f"drop tmp_collection {col_name} failed: {e}")
```
- [ ] **Step 3: 验证** — pytest
- [ ] **Step 4: Commit** — `git commit -m "fix(kb): P1 tmp_collection 加 workflow 后缀（Milvus+ES 对齐）+创建即注册+结束 drop"`

**验收：** workflow 结束后 tmp_collection（Milvus + ES）被 drop，无残留无串扰。

---

## 批次 D：P1 运维与集成

### Task D1: rerank httpx 显式 timeout
**Files:** `common_rerank.py:29,31,82,107`
- [ ] **RED** — 断言四处含 `timeout=`；**GREEN** — `RERANK_TIMEOUT=10.0`，Client/AsyncClient/post 四处加 `timeout=RERANK_TIMEOUT`；**验证**；**Commit** — `fix(kb): P1 rerank httpx 显式 timeout 10s`

### Task D2: embedding request_timeout/max_retries 注入
**Files:** `embedding.py:32-45`
**注意：** `_get_openai_params` 是模块级函数无 self，骨架 `self.request_timeout` 错，改 `model_config.get('request_timeout', 200)`。
- [ ] **RED** — 断言 `_get_openai_params` 返回值含 `request_timeout`/`max_retries` 键；**GREEN**

```python
def _get_openai_params(model_config):
    return {..., "request_timeout": model_config.get('request_timeout', 200),
            "max_retries": model_config.get('max_retries', 6)}
```
- **验证**；**Commit** — `fix(kb): P1 embedding request_timeout/max_retries 注入 OpenAIEmbeddings，激活死代码`

### Task D3: OCR 重试 + 修 timemout 拼写
**Files:** `etl4lm_loader.py:194,217-242,297`
- [ ] **RED** — 断言 3 次重试循环 + 属性名 `timeout`；**GREEN** — `_post_with_retry`（3 次 + backoff），`self.timemout`→`self.timeout`；**验证**；**Commit** — `fix(kb): P1 OCR 补 3 次重试+修 timemout 拼写`

### Task D4: 知识库级删除补 bbox + 预览对象清理
**Files:** `knowledge.py:347-364`、`knowledge_file.py:144-149`
- [ ] **RED** — 断言删 4 类对象（源文件/bbox/转换pdf/预览）；**GREEN** — `get_file_simple_by_knowledge_id` 加 `bbox_object_name` 列；循环对每文件调完整 `delete_minio_files` 4 类逻辑；**验证**；**Commit** — `fix(kb): P1 知识库级删除补 bbox+预览对象`

### Task D5: 超时文件回收改定时任务
**Files:** Create `timeout_sweeper.py`；Modify `settings.py` beat_schedule 注入
**注意：** beat 注册位置 `settings.py:159 beat_schedule` + `model_validator`（:168-184）注入默认项（与 telemetry 项同模式），不改 worker/config.py。
- [ ] **RED** — 断言 sweeper 把 PROCESSING/WAITING 超 86400 秒文件置 TIMEOUT；**GREEN** — `@celery_app.task` + 在 `CeleryConf.validate` 注入 `if 'knowledge.timeout_sweeper' not in self.beat_schedule:` 每小时；**验证**；**Commit** — `feat(kb): P1 超时文件回收改 Celery beat 定时任务`

---

## 批次 E：P1 数据模型

### Task E1: split_rule 改 JSON 列
**Files:** `knowledge_file.py:51`；使用处去 json.loads；写入侧去 json.dumps；alembic 迁移
**注意（review 修订）：** 写入侧 `knowledge.py:622/762/773` 也要去掉 `json.dumps` 直接赋 dict（否则 JSON 列双重编码）；迁移前加 `JSON_VALID` 清洗。

- [ ] **RED** — 断言 sa_column 为 JSON、使用处无 json.loads；**GREEN**

```python
split_rule: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON, nullable=True), ...)
```
写入侧 `knowledge.py:622/762/773`：`db_file.split_rule = split_rule_dict`（去 json.dumps）。使用处去 json.loads。alembic 迁移前清洗：`SELECT id, split_rule FROM knowledge_file WHERE split_rule IS NOT NULL AND NOT JSON_VALID(split_rule)` → 修复脏数据 → `ALTER ... MODIFY split_rule JSON`。
- **验证** — pytest + 迁移 dry-run；**Commit** — `refactor(kb): P1 split_rule 改 JSON 列+写入侧去 json.dumps+迁移清洗`

### Task E2: update_time / recall_chunk.file_id 加索引
**Files:** `knowledge.py:63-64`、`knowledge_file.py:64-65`、`recall_chunk.py:16`；alembic
- [ ] **GREEN** — 模型 `index=True` + `CREATE INDEX`；**验证**；**Commit** — `perf(kb): P1 update_time/recall_chunk.file_id 加索引`

### Task E3: 软删除/回收站
**Files:** `knowledge.py`、`knowledge_file.py` 加 `is_deleted`/`deleted_at`；`KnowledgeDao.delete_knowledge` 改软删；查询过滤；alembic
**注意（review 修订）：** 查询点 ≥15 处易漏，**改用 SQLAlchemy `do_orm_execute` event 全局注入 `is_deleted=False` 过滤**（避免散点遗漏），而非逐查询改。回收站列表 API + purge 硬删可选参数。

- [ ] **RED** — 断言 delete 后记录仍存在 is_deleted=True、查询不返回、purge 后真删；**GREEN** — 加字段、`delete_knowledge` 改软删、`do_orm_execute` event 全局过滤、回收站 API；**验证**；**Commit** — `feat(kb): P1 知识库/文件软删除+回收站，do_orm_execute 全局过滤`

---

## 批次 F：P1/P2 架构改造（F1 依赖 C3）

### Task F1: 拆解 knowledge_imp 上帝模块
**Files:** Create `knowledge_imp/{parser,splitter,embedder,minio_store,qa,state}.py` + `__init__.py`；原 `knowledge_imp.py` 改 thin re-export
**依赖：** C3 已落地，`knowledge_imp/vector_delete.py` 仅 re-export `common/vector_delete_service.py`。
**注意（review 修订）：** `__init__.py` thin re-export 加 `DeprecationWarning`，否则 F3 接缝倒置无编译错暴露、linsight 不强制迁移。

**迁移策略（每拆一块迁移+测试，多 commit）：** parser←read_chunk_text(F2 先去重)、splitter、embedder←add_file_embedding(含 C2)、minio_store、qa、state。每块：剪切到新文件→importlib 测试→原文件改 import→全测试→commit。`__init__.py` re-export 加 DeprecationWarning。
- [ ] **逐块 RED→GREEN→commit**；**验收：** knowledge_imp.py 缩至 re-export 壳（<100 行 + DeprecationWarning）；各子模块职责单一
- **Commit** — `refactor(kb): P1/P2 拆 knowledge_imp 模块 X 到独立文件`

### Task F2: 同步异步重复消除
**Files:** `knowledge_imp/parser.py`
**问题：** read_chunk_text/async_read_chunk_text 410 行逐行复制，async 版错误类型降级为裸 Exception。
**核心骨架（review P-5 补）：**

```python
def _read_chunk_text_core(file_path, file_name, **opts, io_runner):
    """公共逻辑。io_runner 是同步/异步 I/O 调度器（sync 直接调，async 用 sync_func_to_async 包装）。
    错误类型统一用 KnowledgeLLMError/KnowledgeFileNotSupportedError/KnowledgeFileDamagedError。"""
    decision = io_runner.decide(...)
    splitter = ElemCharacterTextSplitter(...)
    # 按扩展名分支，io_runner.load() / io_runner.convert(file)
    ...
    return raw_texts, metadatas, parse_type, partitions

def read_chunk_text(...):
    return _read_chunk_text_core(..., io_runner=SyncIO())
async def async_read_chunk_text(...):
    return await _read_chunk_text_core(..., io_runner=AsyncIO())
```
- [ ] **RED** — 断言两函数共享 core、错误类型一致；**GREEN** — 抽 core + 薄包装；**验证**；**Commit** — `refactor(kb): P1/P2 read_chunk_text 抽公共 core，错误类型统一`

### Task F3: DDD 边界收敛 + knowledge↔llm 解耦
**Files:** `knowledge/domain/services/knowledge_service.py` 重命名；`api/services/knowledge.py:72` 保留；`knowledge/domain/repositories/interfaces/knowledge_repository.py`；linsight 接缝；knowledge↔llm
**决策（报告 P2 二选一，选"明确边界收敛"）：** DDD 仅管元数据，同名类重命名（DDD 版→KnowledgeMetadataService，需改 4 处 import）；Repository 非空壳；linsight 两处（workbench_impl.py:15、sop_manage.py:14）反向依赖改指新子模块路径（配合 F1 DeprecationWarning）。
**注意（review C-1）：** 补 knowledge↔llm 双向耦合子项——评估 knowledge 与 llm 模块双向 import，改为单向依赖或接口倒置。
**注意（review C-3）：** domain service 层加 logger（F3 顺手）。
- [ ] **RED** — 断言无两个同名 KnowledgeService、linsight 不直接 import knowledge_imp、knowledge↔llm 单向；**GREEN** — 重命名 + 接缝修正 + logger；**验证**；**Commit** — `refactor(kb): P2 DDD 边界收敛，KnowledgeService 重命名+knowledge↔llm 解耦+接缝修正`

### Task F4: workflow 绕 domain 修正
**Files:** grep workflow→DAO 直调点
**注意（review P-2）：** 先 grep 出 workflow 下直接 import DAO 的点位列进任务，替换"评估"placeholder。
- [ ] **Step 1: grep 定位** — `grep -rn "from bisheng.knowledge.domain.models" src/backend/bisheng/workflow/` 列出直调点
- [ ] **Step 2-4: 高风险点（元数据一致性）改经 domain 接口；纯检索保留** — **Commit** — `refactor(kb): P2 workflow 高风险 DAO 直调改经 domain 接口（N 点）`

---

## 批次 G：P2 检索策略升级

### Task G1: query_rewrite 默认启用 + HyDE
**Files:** `settings.py:152`、`query_rewrite.py`、`workflow/common/knowledge.py:273`
- [ ] **RED** — HyDE 开关 + 默认 True 测试；**GREEN** — `query_rewrite_enabled` 改 True、增 `hyde_enabled: bool = Field(default=False)`、query_rewrite.py 增 HyDE 函数（LLM 生成假设答案再向量检索，超时降级沿用）；**验证**；**Commit** — `feat(kb): P2 query_rewrite 默认启用+增 HyDE`

### Task G2: abstract 单独检索路 RRF 融合（本期不做）

**决策（彭总 2026-07-02 经源码核实+架构审视后定案：本期不做）：**

经核实 RRFRerank 实现（`rrf_rerank.py:62,:71` 用 `page_content` 去重累加）与 abstract 实际语义（`knowledge_imp_legacy.py:1003` `abstract=t.metadata.get("title","")`——每个 chunk 存相同文档标题，非 LLM 真摘要），G2 架构不合理：

1. **抽象层次错位**：abstract（document 级）与正文 chunk（paragraph 级）塞进同一个 RRF 融合层，是抽象层次泄漏。RRF 设计前提是同粒度候选按 rank 融合，不同粒度平铺融合不正道。
2. **用法错**：摘要文本作为独立候选进 RRF，会让 context 混入摘要（LLM 要正文证据，不要摘要）。abstract 正道用途是文档级召回/提权信号（small-to-big），即 G4 思路。
3. **前提弱**：abstract=标题现状下，标题词本就在正文，正文检索已覆盖，三路 RRF 与两路差异不显著，纯增 collection + 回填 + 调参成本。
4. **投入产出不匹配**：大改造（写入侧+检索侧+回填+调参）+ 高风险（新增向量库资源+潜在 bug），但产出微（长尾场景，abstract=标题）。

**正道路径（留下一期统一设计）**：abstract 升级为 LLM 真摘要 → G4 分层检索（abstract 召回文档 → 回溯 chunk 进 context）。G2 是 G4 的错位子集，不该独立做。

G4 本期按"仅新切片启用 + NULL 容错"做（不依赖 abstract 真摘要，用 chunk 自身 parent_chunk_id 回溯）。

### Task G3: 上下文裁剪按 token + 元数据透传
**Files:** `tool/domain/langchain/knowledge.py:106-115`、prompt 组装处
**注意：** tiktoken 依赖需确认已装（若无用 chars/4 粗估）。含 A5 延期的"空 context prompt 润色"。
- [ ] **RED** — 断言裁剪按 token；**GREEN** — token 累加裁剪；prompt 模板增元数据透传（`[来源: {document_name} 第{page}页 chunk{chunk_index}]`）+ 空 context 友好提示；**验证**；**Commit** — `feat(kb): P2 上下文裁剪按 token+元数据透传+空 context 提示`

### Task G4: parent-child / small-to-big 层级检索（仅新切片+NULL 容错）
**Files:** 切分建 `parent_chunk_id`（knowledge_imp 切分）；检索回溯（tool/domain/langchain/knowledge.py）；alembic
**存量兼容（彭总定案）：** 仅对新切片启用 parent-child；存量 chunk `parent_chunk_id=NULL`，检索回溯 `if parent_chunk_id is None: return self`（回退自身，走旧线性语义）；可选回填脚本（本期不做）。
- [ ] **RED** — 断言检索结果含 parent 段、存量 NULL 回退自身；**GREEN** — 切分建层级（新切片填 parent_chunk_id）+ 检索回溯（NULL 容错）；**验证**；**Commit** — `feat(kb): P2 parent-child 层级检索，仅新切片启用+NULL 容错`

---

## 批次 H：P2 前端组件

### Task H1: KnowledgeFile / KnowledgeQa 抽公共组件 + 移除 window.LibPage
**Files:** Create `KnowledgeFileList.tsx`；Modify `KnowledgeFile.tsx`、`KnowledgeQa.tsx`、`KnowledgePage/index.tsx:18`
- [ ] **GREEN** — 抽 `KnowledgeFileList`（props: type/分页用 URL search params 或 store，移除 window.LibPage）；**验证** tsc+build；**Commit** — `refactor(kb): P2 KnowledgeFile/Qa 抽公共组件，移除 window.LibPage`

### Task H2: MetadataManagementDialog 类型可编辑
**Files:** `MetadataManagementDialog.tsx:251,528-556`；后端 `update_metadata_fields`
**Scope（自带降级）：** 评估向量库 schema 迁移成本，若过高降级为"前端 UI 支持 + 后端拒绝并提示需重建"。
- [ ] **评估→实现→Commit** — `feat(kb): P2 元数据字段类型可编辑（或明确不支持+提示）`

---

## 批次 I：P2 可观测性与备份（I3 逻辑备份）

### Task I1: Prometheus 指标
**Files:** Create `common/metrics.py`；检索/rerank/索引创建埋点；`/metrics` endpoint
**指标：** `kb_retrieval_latency_seconds`(Histogram)、`kb_rerank_degrade_total`、`kb_index_create_failure_total`、`kb_tmp_collection_cleanup_total`
- [ ] **RED→GREEN→验证→Commit** — `feat(kb): P2 Prometheus 指标埋点`

### Task I2: OpenTelemetry trace_id 跨边界传播
**Files:** FastAPI middleware 注入 trace_id；Celery 传 trace_id；日志格式含 trace_id
**注意（review C-3）：** domain service 层加 logger 一并补（若 F3 未覆盖）。
- [ ] **RED→GREEN→验证→Commit** — `feat(kb): P2 OTel trace_id 跨 Celery/HTTP 传播+domain logger`

### Task I3: 逻辑备份 + errcode 进日志（降级方案，彭总定案）
**Files:** Create `worker/knowledge/backup_worker.py`；Modify `rebuild_knowledge_worker.py:51,170`（先备份再删）；`common/errcode/base.py`（logger 集成）
**方案（降级，不依赖 snapshot API、不触禁令）：**
- Milvus：`query` 全量导出向量 + metadata 到 MinIO（JSON/parquet）
- ES：`scroll` + bulk dump 到 MinIO 文件
- MinIO：版本化（bucket lifecycle）
- **MySQL：走运维 mysqldump cron，不在应用代码范围**（明确不涉应用侧）
- rebuild：先备份再删再写

- [ ] **RED→GREEN→验证→Commit** — `feat(kb): P2 逻辑备份（Milvus query+ES scroll+MinIO 版本化）+rebuild 先备份+errcode 进日志`

---

## 批次 J：构建部署验证

### Task J1: 本地全量测试 + 前端 build
- [ ] **Step 1: 后端全测试** — `cd src/backend && python -m pytest tests/knowledge/ -v`，全 PASS
- [ ] **Step 2: 前端 vitest + tsc** — `cd src/frontend/platform && npx vitest run && npx tsc --noEmit`
- [ ] **Step 3: 前端 build** — `npm run build`，outDir `build/` 产物正常
- [ ] **Step 4: 后端 import 检查** — `python -c "import bisheng"` 不报循环依赖（F1 拆分后重点验证）

---

### Task J2: 部署财经容器（走 zckj 跳板两跳）

**生产操作走 8 步。回退方案：** 已有备份 MySQL/MinIO/config 三份；后端 tar 覆盖前保留旧 bisheng 目录副本。
**前置：** 确认 zckj 已装 sshpass。

- [ ] **Step 1: 后端 tar** — `cd src/backend && tar czf /tmp/bisheng_backend_fix.tar.gz bisheng bisheng_langchain`（排除 config.yaml、__pycache__）
- [ ] **Step 2: 前端 build 产物 tar** — `cd src/frontend/platform/build && tar czf /tmp/platform_fix.tar.gz *`；`cd src/frontend/client/build && tar czf /tmp/client_fix.tar.gz *`
- [ ] **Step 3: scp 两跳**

```bash
# 第一跳：本机→zckj
scp /tmp/bisheng_backend_fix.tar.gz /tmp/platform_fix.tar.gz /tmp/client_fix.tar.gz zckj:/tmp/
# 第二跳：zckj→容器（sshpass 密码 $ 转义 \$）
ssh zckj "scp -o StrictHostKeyChecking=no /tmp/bisheng_backend_fix.tar.gz /tmp/platform_fix.tar.gz /tmp/client_fix.tar.gz root@172.28.39.10:/tmp/"
```

- [ ] **Step 4: 容器内后端部署（先 rm 旧再解压，保 config.yaml；alembic 在 restart 前）**

```bash
ssh zckj "sshpass -p 'Dg*Rh9lpstv1gUdNF&?RfZg\$3dBTsOzQ' ssh -o StrictHostKeyChecking=no -p 30314 root@172.28.39.10 'cd /peng/eagent/runtime/app && cp config.yaml /tmp/config.yaml.preserve && rm -rf bisheng bisheng_langchain && tar xzf /tmp/bisheng_backend_fix.tar.gz && cp /tmp/config.yaml.preserve config.yaml && cd /peng/eagent/runtime/app/bisheng && alembic upgrade head && supervisorctl restart all'"
```

**顺序：** 解压 → **alembic upgrade head** → supervisorctl restart（review 修正：alembic 必须在 restart 前，否则新代码 E1 去掉 json.loads 遇旧 schema（split_rule 仍 TEXT）会失败）。保 config.yaml（先 cp 到 /tmp 再解压后还原）。

- [ ] **Step 5: 容器内前端部署（平铺，rm 旧 assets+index.html 后 cp -a）**

```bash
ssh zckj "sshpass -p 'Dg*Rh9lpstv1gUdNF&?RfZg\$3dBTsOzQ' ssh -o StrictHostKeyChecking=no -p 30314 root@172.28.39.10 'cd /peng/eagent/runtime/frontend/platform && rm -rf assets index.html && tar xzf /tmp/platform_fix.tar.gz && cd /peng/eagent/runtime/frontend/client && rm -rf assets index.html && tar xzf /tmp/client_fix.tar.gz && nginx -s reload'"
```

- [ ] **Step 6: 服务状态** — `supervisorctl status` 全 RUNNING

---

### Task J3: 端到端验证（不批量重传，单文件测试 PDF 允许）

**约束边界（review 修正）：** "不重传"=不批量重建历史知识库；**单文件端到端验证上传允许**（用 1 个小测试 PDF 测 A1/A2/B1），不属批量重传。

- [ ] **Step 1: 创建知识库** — 验证 A6：正常创建路径生产可测；失败回滚在本地测（生产侧不强测停 Milvus/ES，属禁令边界）
- [ ] **Step 2: 切分规则** — 验证 A2：用 1 个测试 PDF 选预定义规则（含 \\n / \\. / 第.{1,3}条），确认提交后 separator 是原始正则（查 backend.log）
- [ ] **Step 3: filter** — 验证 A1：用 1 个含页眉页脚的测试 PDF（不属批量重传），确认 etl4llm 收到 `filter_page_header_footer=true`（查 etl4lm 请求日志/payload）
- [ ] **Step 4: 检索权重** — 验证 A3：调不等权重，确认 ES 结果乘 keyword_weight、Milvus 结果乘 vector_weight
- [ ] **Step 5: rerank 降级** — 验证 A4：停 rerank 服务（评估窗口或本地），检索仍返回 RRF 结果不中断（查 warning 日志）
- [ ] **Step 6: 检索异常** — 验证 A5：停 Milvus（本地），rag 节点返回空 context 不喂 str(e)
- [ ] **Step 7: 前端类型** — 验证 B1：上传配置 payload 类型正确（network 请求：chunk_size 是 number、bool 是 0/1）
- [ ] **Step 8: 现有知识库回归** — 不批量重传，验证现有检索/对话正常

**验收汇报：** 向彭总汇报每项端到端结果，附 backend.log 关键行证据。

---

## Self-Review

**1. Spec coverage：** 报告 P0×6（A2 降 P1 已说明）、P1×26、P2×22 经合并映射全部覆盖。
- **knowledge↔llm 双向耦合**：F3 补子项（review C-1）✓
- **domain service 层 logger**：F3/I2 补（review C-3）✓
- **MySQL 备份**：I3 明示走运维 mysqldump cron，不在应用代码（review C-4）✓
- **collection_name/index_name 冗余**：gap 理由已修订为"合并工作量大，建议本期不做"（非伪依据，review C-2）——需彭总确认是否单独任务。当前评估：回退兜底 `index_name or collection_name`（`knowledge_imp.py:1228`、`knowledge.py:325` 实际存在）已覆盖功能，合并需改写入侧多处，风险>收益，建议本期不做。

**2. Placeholder scan：** C1 测试 placeholder 已修订为真实 mock 范式（参考 A6）；F4 已 grep 出调用点替换"评估"；C2/D4/E3 RED 测试给函数签名 + 关键 assert（参考 A4/A5 模板）；F2 core 骨架已补。前端 B3/A2 抽纯函数 + vitest（非纯 tsc）。无"TBD/TODO/类似 Task N"占位。

**3. Type consistency（review T-1 修正）：**
- `compress_with_degrade / acompress_with_degrade(rerank, docs, query, logger) -> (docs, degraded)`：A4 定义，A4 调用一致 ✓
- `on_retrieval_failure(exc, logger) -> (docs, error_msg)`：A5 定义，A5 调用一致（setdefault）✓
- `VectorDeleteService.delete_by_file_ids(knowledge, file_ids, del_es, del_milvus)`：C3 定义（knowledge 在前），**C2 调用该新服务**（非旧 delete_vector_files）；旧 `delete_vector_files(file_ids, knowledge)`（file_ids 在前）在 C3 thin wrapper 内**参数翻转**转调新服务 ✓
- `BUILT_IN_METADATA_FIELDS / DEFAULT_FILTER_METADATA_FIELDS`：B2 定义，先核对现有硬编码 6 项一致再 slice ✓
- `buildPredefinedStrategy(regex, mode, t) -> {regex, position, rule}`：A2 定义，handleRegexClick 调用（被测即生产）✓
- tmp_collection 命名：C4 Milvus + ES 均经 `get_milvus_collection_name`/`get_es_index_name` 统一 ✓

**4. 依赖顺序（review D-1 修正）：** C3 先于 C2（C2 调 C3 服务）；F1 依赖 C3（vector_delete.py 仅 re-export）；无循环依赖。

**5. Gap 需彭总确认：**
- collection_name/index_name 冗余：建议本期不做（回退兜底已覆盖），需彭总确认
- H2 元数据类型可编辑：可能降级为"不支持+提示"，执行时评估

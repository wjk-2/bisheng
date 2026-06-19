# 模型管理架构

> 从 CLAUDE.md 外移的模型管理子系统文档。涉及模型注册、llm 表结构、调用链路、GPUStack 桥接等改动时读此。

### 两套注册路径，落同一张表

```
路径 A：GPUStack 自动注册（deployment_bridge.py）
  GPUStack 创建部署 → 自动建 LLMServer + LLMModel → 前端"模型部署"页可见
  endpoint 固定为 {gpustack_url}/v1-openai，依赖 GPUStack 中间层

路径 B：手动注册（模型管理页 → POST /api/v1/llm）
  管理员填写名称、type(openai)、config(endpoint/key) → 手动建 LLMServer + LLMModel
```

### 关键文件

| 文件 | 作用 |
|------|------|
| `src/backend/bisheng/llm/domain/models/llm_server.py` | LLMServer + LLMModel ORM 模型 + LLMDao |
| `src/backend/bisheng/llm/domain/schemas.py` | LLMServerCreateReq / LLMModelCreateReq 请求体 |
| `src/backend/bisheng/llm/domain/services/llm.py` | LLMService：注册、验证、调用入口 |
| `src/backend/bisheng/llm/domain/llm/llm.py` | EagentLLM：按 server_type 选 LangChain 客户端 |
| `src/backend/bisheng/llm/api/router.py` | LLM REST API（/api/v1/llm） |
| `src/backend/bisheng/api/services/deployment_bridge.py` | GPUStack ↔ LLM 表桥接（自动注册/注销/状态同步） |
| `src/backend/bisheng/api/services/deployment.py` | GPUStackService：与 GPUStack API 交互 |
| `src/backend/bisheng/api/v1/deployment.py` | 模型部署 REST API（/api/v1/deployment） |
| `src/frontend/platform/src/pages/ModelPage/management/` | 模型管理前端（手动注册页） |
| `src/frontend/platform/src/pages/ModelPage/deployment/` | 模型部署前端（GPUStack 部署页） |

### 数据库表结构

**llm_server**（一个"模型供应商"）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 自增主键 |
| name | str unique | 显示名称（如"本地对话模型"） |
| type | char(20) | 供应商类型：openai / azure_openai / ollama 等 25+ 种 |
| config | JSON | 连接配置：`{openai_api_base, openai_api_key, ...}` |
| limit_flag | bool | 是否启用每日调用限制 |
| limit | int | 每日调用上限 |

**llm_model**（一个具体模型，挂在 server 下，unique(server_id, model_name)）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 自增主键 |
| server_id | int FK | 关联 llm_server.id |
| name | str | 模型显示名称 |
| model_name | str | 调用时传给 API 的模型标识（必须与 vLLM --served-model-name 一致） |
| model_type | char(20) | `llm` / `embedding` / `rerank` / `asr` / `tts` |
| status | int | 0=正常, 1=异常, 2=未知 |
| online | bool | 是否在线 |
| config | JSON | 模型级配置 |

### 调用链路

```
用户对话/智能体 → ChatManager
  → LLMService.get_bisheng_llm(model_id)
    → 读 llm_model 表 → 获取 model_name + server_id
    → 读 llm_server 表 → 获取 type + config
    → 按 type 选 LangChain 客户端
      type=openai → ChatOpenAICompatible（即 OpenAI SDK）
    → 调用 config.openai_api_base + /chat/completions 或 /embeddings
```

### type=openai 时的客户端映射

LLM 初始化时，`type=openai` 对应 LangChain 的 `ChatOpenAICompatible`（[llm.py:164-189](../src/backend/bisheng/llm/domain/llm/llm.py#L164-L189)），
会读取 `config` 中的 `openai_api_base` 和 `openai_api_key`。vLLM 部署的模型统一用 `type=openai` 即可。

### 模型类型枚举（LLMModelType）

```python
LLM = 'llm'          # 对话模型
EMBEDDING = 'embedding'  # 向量模型
RERANK = 'rerank'      # 重排模型
ASR = 'asr'           # 语音识别
TTS = 'tts'           # 语音合成
```

### 各场景默认模型配置（存 config 表）

| 配置键 | 说明 | 配置 API |
|--------|------|---------|
| KNOWLEDGE_LLM | 知识库默认模型 | GET/POST /api/v1/llm/knowledge |
| ASSISTANT_LLM | 智能体默认模型 | GET/POST /api/v1/llm/assistant |
| WORKFLOW_LLM | 工作流默认模型 | GET/POST /api/v1/llm/workflow |
| EVALUATION_LLM | 评测默认模型 | GET/POST /api/v1/llm/evaluation |

### Workspace 对话模型启用

注册到 llm_model 后，还需启用到 Workspace 对话才对普通用户可见：
- `POST /api/v1/llm/chat/enable` — 启用（传 model_id + 可选 display_name）
- `POST /api/v1/llm/chat/disable` — 禁用
- `GET /api/v1/llm/chat/enabled-ids` — 查看已启用列表

### 手动注册示例（无 GPUStack 时的标准方式）

```
POST /api/v1/llm
Content-Type: application/json

{
  "name": "本地对话模型",
  "type": "openai",
  "config": {
    "openai_api_base": "http://172.20.20.34:30425/v1",
    "openai_api_key": "EMPTY"
  },
  "models": [
    {
      "name": "Qwen3.5-35B-A3B",
      "model_name": "Qwen3.5-35B-A3B",
      "model_type": "llm",
      "online": true
    }
  ]
}
```

### GPUStack 桥接自动注册原理（deployment_bridge.py）

当通过 GPUStack 部署模型时，自动注册到 LLM 表：
1. `register_deployment_to_llm()` — 创建 LLMServer(type=openai) + LLMModel
2. 根据 categories 自动判断 model_type（含 "sentence-similarity" / "embedding" 等 → embedding，否则 → llm）
3. `sync_deployment_status()` — 部署启停时同步 llm_model.online
4. `unregister_deployment_from_llm()` — 部署删除时级联删除 LLM 记录
5. 幂等：通过 `config._gpustack_model_id` 去重，不会重复注册

### 注册后自动验证流程

`LLMService.add_llm_server()` 会自动测试模型是否可用：
- llm → 调用 `ainvoke('hello')`
- embedding → 调用 `aembed_query('hello')`
- 测试失败会将 status 设为 1（异常），记录失败原因到 remark

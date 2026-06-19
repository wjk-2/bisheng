# E-Agent v2.3.0

IMPORTANT: 修改任何代码前，先读对应源码确认当前实现。
本项目有两个代码库（主代码 vs 旧版参考）、容器内临时修改、DDD 特定规范，
不读代码直接动手极易改错文件或用错路径。

## 强制规范（每次涉及相关改动必须执行）

### 前端文件上传改动：必须双路径验证
改动任何涉及文件上传的前端代码后，**必须同时验证两条路径**，缺一不可：
1. **广场页**（已登录，`shareToken` 为空）— 上传走 `uploadFile(file, flow.id)`
2. **分享页**（未登录，`shareToken` 非空）— 上传走 `uploadChatFile` + `share-token` header

验证方法：查 `backend.log` 确认两条路径均返回 200 且无 403。

### 前端"操作无反应"类问题：先查后端日志
不要在前端反复猜测，第一步直接查：
```bash
ssh node4-gpu "ssh root@172.20.20.35 'grep -E \"upload|403|No permission\" /mnt/nodestor/eagent/logs/backend.log | tail -20'"
```

### 前端部署：先确认目标机器，两套形态不可混用
本项目两台部署机形态不同，命令不可互换：

- aliyun-agent（120.55.180.232）：全容器栈。前端以 eagent/frontend 容器运行，3001 由 docker-proxy 监听，宿主机无裸 nginx。整体用 cd docker && docker compose up -d。前端改动需重建 eagent/frontend 镜像后 docker compose up -d eagent-frontend。
- node3（172.20.20.35，湖州师范）：裸 nginx + scp。前端改动执行项目根 deploy-client.sh，脚本覆盖构建→打包→清理→上传→解压→验证，写 /usr/share/nginx/html/client/。

禁止在 aliyun-agent 跑 deploy-client.sh，禁止在 node3 跑 docker compose。

## 产品定位
面向高等教育（高校）的智能体教学与应用平台，围绕智能体技术展开。
覆盖：智能体教学、智能体应用、智能体开发。
用户：普通教师/学生（使用智能体）、开发教师/实验室（开发智能体）、管理员。


## 源码路径（不要混淆）
|代码库|本地路径|角色|
|---|---|---|
|E-Agent 主代码|eagent-v3/v2.0/|所有开发在这里，git HEAD=v2.3.0 tag，定制代码为未提交修改|
|旧版代码|eagent-v2/bisheng-feature-tangshunew/|仅供参考，不要修改，无 .git|

|主代码后端|src/backend/|主代码前端 Platform|src/frontend/platform/|主代码前端 Client|src/frontend/client/


## 双前端架构
|应用|URL|定位|
|---|---|---|
|Client (Workspace)|/workspace/*|统一入口 — 使用智能体|
|Platform|/education /build /model /sys 等|教学及开发中心 — 开发/管理智能体|

用户动线：所有人登录 → Workspace → 普通用户留在应用广场，开发者点"教学及开发平台"进 Platform。
认证：同域同端口共享 cookie，登录一次两边认证。权限由 web_menu 数组控制。

## 技术栈
后端：FastAPI 0.115 + SQLModel 0.0.14 + Pydantic v2 | Python >=3.10,<3.11
数据库：MySQL 8.0 + Redis 7.0 + Milvus 2.3.3 + Elasticsearch 8.12
AI：LangChain 0.3.23 + LangGraph | 异步：Celery 5.3.6（队列 knowledge_celery, workflow_celery）
前端：React 18 + TypeScript 5.4 + Vite 5.3 + Zustand 4.5.2 + Tailwind CSS 3.4
部署：两套形态并存 — aliyun-agent 全容器栈（docker compose），node3 裸 nginx + scp（详见运维信息）

## 项目结构索引
|src/backend/bisheng/main.py — FastAPI 入口
|src/backend/bisheng/api/router.py — 主路由注册
|src/backend/bisheng/api/v1/ — REST API v1 端点
|src/backend/bisheng/education/ — ★ 教育模块（自研，DDD）
|  ├── api/router.py — 所有教育端点集中在此
|  ├── domain/models/education.py — 数据模型 + DAO
|  ├── domain/schemas/education_schema.py — 请求/响应 Schema
|  ├── domain/services/ — 业务逻辑（course, video, progress, stats, guided_builder）
|  └── domain/const.py — 常量
|src/backend/bisheng/api/v1/deployment.py — ★ 模型部署 API（自研，对接 GPUStack + ModelScope）
|src/backend/bisheng/api/services/deployment.py — ★ 模型部署服务层（自研，GPUStackService）
|src/frontend/platform/src/pages/ModelPage/deployment/ — ★ 模型部署前端页面（自研）
|src/backend/bisheng/api/services/ — 官方业务服务层
|src/backend/bisheng/common/ — 公共基础设施（模型基类、认证、配置）
|src/backend/bisheng/{database,worker,chat,graph,linsight}/ — 数据库、任务、聊天、流程图、灵思
|src/backend/pyproject.toml — Python 依赖（Poetry）
|src/frontend/platform/src/routes/index.tsx — Platform 路由定义
|src/frontend/platform/src/layout/{MainLayout,HeaderMenu}.tsx — 布局和导航
|src/frontend/platform/src/pages/EducationPage/ — ★ 教育页面（自研）
|src/frontend/platform/src/controllers/API/ — Platform HTTP 客户端
|src/frontend/platform/src/components/{bs-comp,bs-icons}/ — Bisheng 自有组件和图标
|src/frontend/client/src/components/Nav/ — Workspace 侧边栏（NewChat.tsx, AccountSettings.tsx）
|src/frontend/client/src/locales/ — 国际化文案
|docker/nginx/conf.d/default.conf — Nginx 路由配置（bind mount 持久化）
旧版参考：bisheng-feature-tangshunew/（扁平结构，非 DDD）

## 开发规范

### 后端 Python — 验证过的导入路径
- DDD 分层：domain/models → domain/schemas → domain/services → api/
- ORM 基类：from bisheng.common.models.base import SQLModelSerializable
- 数据库会话：from bisheng.core.database import get_sync_db_session（不是 session_getter）
- 认证：from bisheng.common.dependencies.user_deps import UserPayload
- 认证用法：login_user: UserPayload = Depends(UserPayload.get_login_user)
- 配置：from bisheng.common.services.config_service import settings（不是 from bisheng.settings）
- 时间戳字段：create_time / update_time（不是 created_at / updated_at）
- 路由注册：bisheng/api/router.py

### 前端 TypeScript/React
- Platform 状态管理：Zustand | HTTP 客户端：controllers/API/ + axios
- Client (Workspace) 的 HTTP 层不同于 Platform，不在 controllers/API/ 下
- UI 组件优先用 bs-comp 体系，不要直接引 Radix UI
- 路由文件：routes/index.tsx（不是 routes.tsx）
- 命名：组件 PascalCase.tsx，工具 camelCase.ts

### Nginx
Nginx 中不存在 /education /build 等独立 location 块，Platform 路由靠 SPA try_files 兜底。
具体规则读 docker/nginx/conf.d/default.conf，不要凭本文档猜测。

## 踩坑记录
详见 `.claude/lessons.md`，不在此重复。

## 常用命令
|前端开发：cd src/frontend/platform && npm run start
|前端构建：cd src/frontend/platform && npm run build
|aliyun-agent 容器栈部署：cd docker && docker compose up -d（仅 120.55.180.232）
|node3 裸 nginx 前端部署：./deploy-client.sh（仅 172.20.20.35）

## 模型管理架构

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

LLM 初始化时，`type=openai` 对应 LangChain 的 `ChatOpenAICompatible`（[llm.py:164-189](src/backend/bisheng/llm/domain/llm/llm.py#L164-L189)），
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

## 运维信息

两台部署机形态不同，命令不可互换（见上方「前端部署」段）。SSH 连接方式与密钥见全局记忆 reference_ssh_aliyun_agent、reference_ssh_hznu_eagent，本文件不存密码。

### aliyun-agent（容器栈）
- IP：120.55.180.232（公网，阿里云）
- 形态：docker compose 全容器栈
- 实跑容器：eagent-frontend、eagent-backend、eagent-backend-worker、eagent-office、mysql、redis、milvus、es、etcd、minio
- 部署命令：cd docker && docker compose up -d
- 镜像来源：本地 docker build（见 build-images.sh）

### node3（裸 nginx，湖州师范）
- IP：172.20.20.35（内网，经 node4-gpu 跳板）
- 形态：裸 nginx + scp + 独立后端进程
- 前端落点：/usr/share/nginx/html/client/
- 部署命令：./deploy-client.sh

### 上游官方镜像（不可改名、不可自建）
- ft：dataelement/bisheng-ft:v0.5.0
- uns：dataelement/bisheng-unstructured:v0.0.3.14
仓库无其 Dockerfile 与源码，直接拉取上游。

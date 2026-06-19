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
- node3（172.20.20.35，湖州师范）：裸 nginx + scp。前端改动执行项目根 deploy-client.sh（client）或 deploy-platform.sh（platform），脚本采用原子回退部署（构建→打包→上传→stage 校验→mv 原子替换→备份轮转），分别写 /usr/share/nginx/html/client/ 与 /platform/。

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
|Platform|/education /build /model /sys 等（前端 SPA 路由前缀，非 Nginx location）|教学及开发中心 — 开发/管理智能体|

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

### 后端 Python
导入路径、ORM 基类、数据库会话、认证、配置等权威清单见 `.claude/dev-guide.md §3` 与 `.claude/dev-conventions.md §1`，两处有出入以 dev-guide 为准。

### 前端 TypeScript/React
- Platform 用 Zustand，HTTP 层在 controllers/API/；Client (Workspace) 的 HTTP 层不同，不在该目录下
- UI 组件优先用 bs-comp 体系，不直接引 Radix UI；路由文件 routes/index.tsx；组件 PascalCase.tsx，工具 camelCase.ts
- 细则见 `.claude/dev-conventions.md §4`

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

## 模型管理
模型注册（GPUStack 自动注册 / 手动 POST /api/v1/llm）、llm_server/llm_model 表结构、调用链路、各场景默认模型配置、GPUStack 桥接原理、注册后自动验证等详见 `.claude/model-architecture.md`。

## 运维信息
SSH 连接方式与密钥见全局记忆 reference_ssh_aliyun_agent、reference_ssh_hznu_eagent，本文件不存密码。两台部署机（aliyun-agent 容器栈 / node3 裸 nginx）的形态与部署命令见上方「前端部署」段。

### 上游官方镜像（不可改名、不可自建）
- ft：dataelement/bisheng-ft:v0.5.0
- uns：dataelement/bisheng-unstructured:v0.0.3.14
仓库无其 Dockerfile 与源码，直接拉取上游。

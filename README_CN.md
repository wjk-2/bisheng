# E-Agent

> 面向高等教育的智能体教学与应用平台，基于 Bisheng v2.3.0 深度定制。

## 概述

E-Agent 是一款面向高校的 AI 智能体平台，覆盖智能体教学、智能体应用、智能体开发三大场景。

**目标用户：** 教师、学生、实验室开发者、管理员。

## 架构

- **Client (工作台)** `/workspace/*` — 统一入口，使用智能体
- **Platform (教学及开发中心)** `/education` `/build` `/model` `/sys` — 开发和管理智能体

## 技术栈

- **后端：** FastAPI + SQLModel + Pydantic v2 + LangChain + LangGraph
- **前端：** React 18 + TypeScript + Vite + Tailwind CSS
- **基础设施：** MySQL 8.0 + Redis 7.0 + Milvus 2.3.3 + Elasticsearch 8.12
- **部署：** Docker Compose + Nginx

## 基座项目

基于 [Bisheng v2.3.0](https://github.com/dataelement/bisheng) 深度定制，自研扩展包括：
- 教育模块（课程管理、引导式构建器、学习进度追踪）
- 模型部署（GPUStack 对接）
- 品牌定制（E-Agent）
- 工作台统一入口改造

## 快速启动

```bash
cd docker
docker compose -f docker-compose.yml up -d
```

启动后访问 `http://IP:3001`，第一个注册的用户成为系统管理员。

## 许可证

基于 Bisheng 开源项目，详见原始许可证。

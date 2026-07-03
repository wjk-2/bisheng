# 财经容器组合部署计划（知识库修复 + adapter filter）

日期 2026-07-03｜状态：待彭总批准

## 目标
容器 `fhq70c6k7sl8f-0` @ 172.28.39.10:30314（经 zckj 跳板，密码 `$` 转义）
平台 http://172.28.39.10:30634/ admin/admin@9000

## 部署内容（三块）
1. **E-Agent 后端**（eagent-v3/v2.0）：`bisheng` + `bisheng_langchain` tar 覆盖
2. **E-Agent 前端 platform**：`build/*` 平铺到 `frontend/platform/`
3. **adapter**（eagent-ocr-adapter）：源码覆盖 `/peng/eagent/ocr-adapter/`

## 预检结论（已核实）
- 应用层全 RUNNING，vllm 6 进程在跑，磁盘剩 13T
- DB alembic = `education_v5_courses_seed_20260428`（= e1.down_revision，链路通）
- 表名已修正对齐：`knowledgefile`/`recallchunk`/`knowledge`（e1/e2/e3 改完）
- 表极小：knowledgefile 15 / knowledge 3 / recallchunk 656 → e1/e2 锁表可忽略
- split_rule 15 条全合法 JSON、0 非法 → e1 清洗零影响，ALTER 平滑
- config.yaml `query_rewrite_enabled: false`（G1 代码就位，config 显式关）
- 生产 adapter 旧版（f79b46c 前，无 filter 消费）

## DB 迁移（restart 前执行）
`alembic upgrade head`：education_v5 → e1（split_rule Text→JSON）→ e2（加索引）→ e3（is_deleted/deleted_at）
表小无锁表风险，split_rule 全合法无清洗影响。

## 部署顺序（路径/命令 2026-07-03 现场核实）
1. **备份**：mysqldump eagent 库 + minio 备份 + config.yaml 备份 + 旧 bisheng/前端 assets/adapter 各 mv `.bak`
2. **传输**：本机 → zckj:/tmp → 容器（scp 两跳，避免括号、`;` 分隔）
3. **后端**：`/peng/eagent/runtime/app/` 下 rm 旧 bisheng+bisheng_langchain → tar 解压 → 恢复 `/peng/eagent/runtime/app/bisheng/config.yaml`
4. **DB**：`cd /peng/eagent/runtime/app && /peng/eagent/runtime/python311/bin/python3.11 -m alembic upgrade head`（env.py 走 config.yaml 的 MySQL url）
5. **前端**：`platform/build/*` 平铺到 `/peng/eagent/runtime/frontend/platform/`（rm 旧 assets+index.html）→ `nginx -s reload`
6. **adapter**：覆盖 `/peng/eagent/ocr-adapter/src/eagent_ocr_adapter/`（保 config.yaml，filter 无新依赖免 pip）→ `supervisorctl restart ocr-adapter`
7. **应用层**：`supervisorctl restart backend worker-knowledge worker-workflow worker-default worker-linsight worker-beat`（不碰 vllm）
8. **验证**（见下）

## 回退
- **DB**：`alembic downgrade` e3→e2→e1→education_v5（每步有 downgrade，表小秒级）
- **后端/前端/adapter**：各 `.bak` mv 回
- **全量**：mysqldump 恢复 + minio 恢复

## 验证（端到端）
- backend 启动无报错（日志无 `Unknown column 'is_deleted'`）
- 知识库列表正常（3 条 knowledge 可见）
- 上传测试 PDF（文字页）勾选 filter → 页眉页脚剔除生效（adapter filter 端到端，本次核心验证）
- 检索知识库（query rewrite false，走原 RRF）
- 删除知识库（走 purge 硬删，E3 字段就位）
- 工作流/助手调用知识库正常

## 风险与对策
- 前端版本不匹配 → platform 必须同步部署（否则 `r.map is not a function`，已踩过）
- config.yaml 被覆盖 → 解压前备份、解压后恢复
- 老旧副本残留 → 先 rm 旧 bisheng 再解压
- G1 query_rewrite → 本期保持 config false 不开（保守），代码就位待评估

## 决策点（需彭总定）
1. **G1 query_rewrite**：保持 config false（推荐，保守）/ 改 config true 启用
2. **部署时机**：现在执行 / 另约

## 失败处理
任一步失败 → 停当前步 → 按对应块回退 → 报告彭总。DB 迁移失败先 downgrade 回 education_v5 再恢复旧后端。

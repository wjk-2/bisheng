# Milvus 并发建表竞争修复设计

## 背景

财经实验室 E-Agent 平台，用户 shanls 批量上传 50+ 文件到知识库时，部分文件解析报错：

```
SchemaNotReadyException: The collection already exist,
but the schema is not the same as the schema passed in.
```

retry 后成功。根因：knowledge worker 并发 20（`-c 20`），多文件并发对同一 collection 调 `_create_collection`，pymilvus 在并发建表竞争下抛 schema 不一致（瞬时状态，schema 实际一致）。

## 根因

`src/backend/bisheng_langchain/vectorstores/milvus.py` 的 `_create_collection` 方法（line 297）：

- 每个 worker 进程独立初始化 vectorstore，`self.col` 是进程内状态
- `add_texts`（line 501）在 `self.col` 为 None 时调 `_init` → `_create_collection`
- `_create_collection` 直接 `create_collection`，**无"collection 已存在则跳过"检查**
- `__init__`（line 217）已有 `utility.has_collection` 检查模式，但 `_create_collection` 自己没复用——bisheng 上游疏漏
- 并发下第一个 worker 建表，其余 worker 调 create 时 collection 已存在，pymilvus 校验 schema 瞬时状态不一致，抛 `SchemaNotReadyException`

确认：服务器 `/peng/eagent/runtime/app/bisheng_langchain/vectorstores/milvus.py` 与本地源码一致。三 collection 现均为 4096 维、schema 一致，无残留维度问题。Milvus 服务正常。

## 目标并发

knowledge worker 并发 20（`-c 20`，不改）。瓶颈在 GPU 推理（chat vLLM max-num-seqs=8），worker 并发 20 已超 GPU 承受，不应再提高。

## 方案

在 `_create_collection` 加两层防御：

1. **主路径**：方法开头 `utility.has_collection` 检查，已存在直接 `self.col = Collection(...)` + return。覆盖 95% 并发场景（第一个 worker 建完后，后续 worker 都走这）。
2. **兜底路径**：原 create 调用外包 `try/except MilvusException`，捕获后若 collection 已存在则 load（覆盖极窄窗口：多个 worker 同时 past has_collection 检查同时 create）。

捕获 `MilvusException`（父类），不依赖 `SchemaNotReadyException` 字符串匹配，避免 pymilvus 升级脆弱性。

## 改动范围

- 改：`src/backend/bisheng_langchain/vectorstores/milvus.py` 的 `_create_collection` 方法
- 不改：`__init__` / `add_texts` / `_init` / 其他方法 / 其他文件
- 不改：worker 并发数（保持 20）

## 测试

本地无 Milvus 测试基建，写 mock 单元测试验证逻辑：
- mock `utility.has_collection` 返回 True → 走 load 不 create
- mock create 抛 `MilvusException` + has_collection 返回 True → 兜底 load
- mock create 抛 `MilvusException` + has_collection 返回 False → 原样抛出（真异常不吞）

## 回退

改前确认 git 干净，改完 commit。回退 = `git revert`。

## 部署

本地改完 review → scp 传服务器 `/peng/eagent/runtime/app/bisheng_langchain/vectorstores/milvus.py` → `supervisorctl restart worker-knowledge`。不需重建镜像（runtime/app 是 NFS 持久化源码目录）。

## 风险

改动 bisheng 上游代码，未来升级有冲突。但该文件本就是定制过的（本地有未提交修改），且属 bisheng 本身疏漏修复，合理。

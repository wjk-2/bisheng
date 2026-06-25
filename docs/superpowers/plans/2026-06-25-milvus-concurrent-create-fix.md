# Milvus 并发建表竞争修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `_create_collection` 并发建表竞争导致的 `SchemaNotReadyException`，让 knowledge worker 并发 20 下批量入库不失败。

**Architecture:** 在 `bisheng_langchain/vectorstores/milvus.py` 的 `_create_collection` 加两层防御——方法开头 `has_collection` 检查（主路径，已存在直接 load 跳过 create）+ 原 except 分支加兜底 load（极窄窗口下并发 create 失败时 load 已建好的表）。捕获 `MilvusException`（父类），不依赖异常字符串匹配。

**Tech Stack:** Python 3.10, pymilvus, bisheng_langchain, Celery worker（knowledge_celery 队列）

## Global Constraints

- 只改 `src/backend/bisheng_langchain/vectorstores/milvus.py` 的 `_create_collection` 方法，不动其他方法/文件
- 不改 worker 并发数（保持 `-c 20`）
- 不改 `_create_collection` 的 schema 构建逻辑（dim/metadata fields/CollectionSchema），只加"已存在检查"和"异常兜底 load"
- 捕获 `MilvusException`（pymilvus.exceptions 已在方法内 import），不用字符串匹配
- 本地无 pymilvus/langchain_community 全套依赖，无法 import milvus 模块跑真实 pytest；测试用独立验证脚本（mock pymilvus，复制待测逻辑），端到端验证在服务器做
- 改完 scp 传服务器 `/peng/eagent/runtime/app/bisheng_langchain/vectorstores/milvus.py` + `supervisorctl restart worker-knowledge`，不重建镜像
- 部署操作走生死线 8 步：分析→说明→方案→回退→批准→执行→验证→失败处理

## 关键发现（影响改法）

原代码 line 350-360 **已有 try/except MilvusException**，但 except 分支是 `raise e`（直接抛，无兜底）。所以本计划不是"加 try/except"，而是：
1. 方法开头加 `has_collection` 检查（主路径）
2. 改原 except 分支：从 `raise e` 改成"若已存在则 load 兜底，否则 raise"

---

### Task 1: 写本地逻辑验证脚本（先写，验证待测逻辑）

**Files:**
- Create: `src/backend/tests/test_milvus_create_concurrent_fix.py`

**Interfaces:**
- Consumes: 无（独立脚本，mock pymilvus）
- Produces: 验证 `_create_collection` 两层防御逻辑的测试用例，供 Task 2 实现时对照

**说明:** 本地无 pymilvus，无法 import 真实 milvus 模块。本脚本把 `_create_collection` 的待测逻辑提取为一个纯函数 `_decide_create_or_load`，用 mock pymilvus 验证决策逻辑对不对。这是逻辑层验证，不是真实集成测试（真实验证在 Task 4 服务器端到端）。

- [ ] **Step 1: 写验证脚本**

```python
"""验证 _create_collection 并发兜底决策逻辑（本地无 pymilvus，用 mock）。"""
from unittest.mock import MagicMock


def _decide_create_or_load(has_collection_before, create_raises, has_collection_after):
    """模拟 _create_collection 的两层防御决策，返回 ('load'|'create'|'raise', reason)。

    对应待实现的逻辑：
    - 主路径：进方法 has_collection=True → load 已有，return
    - create 路径：has_collection=False → 尝试 create
        - create 成功 → done
        - create 抛 MilvusException → 兜底 has_collection 检查
            - 已存在（被别 worker 建了）→ load，return
            - 不存在（真异常）→ raise
    """
    if has_collection_before:
        return ('load', 'main-path: already exists')
    if create_raises:
        if has_collection_after:
            return ('load', 'fallback: race, load existing')
        return ('raise', 'real exception, re-raise')
    return ('create', 'normal create')


def test_main_path_load_when_exists():
    """主路径：collection 已存在 → load，不 create。"""
    action, _ = _decide_create_or_load(True, False, False)
    assert action == 'load'


def test_normal_create_when_not_exists():
    """正常路径：不存在 + create 不抛 → create。"""
    action, _ = _decide_create_or_load(False, False, False)
    assert action == 'create'


def test_fallback_load_on_race():
    """兜底路径：create 抛异常但已被别 worker 建好 → load。"""
    action, _ = _decide_create_or_load(False, True, True)
    assert action == 'load'


def test_re_raise_real_exception():
    """真异常：create 抛且确实没建成 → raise，不吞。"""
    action, _ = _decide_create_or_load(False, True, False)
    assert action == 'raise'
```

- [ ] **Step 2: 运行验证脚本，确认 4 个用例全过**

Run: `cd src/backend && python -m pytest tests/test_milvus_create_concurrent_fix.py -v`
Expected: 4 passed

- [ ] **Step 3: Commit**

```bash
git add src/backend/tests/test_milvus_create_concurrent_fix.py
git commit -m "test(milvus): 并发建表兜底决策逻辑验证脚本"
```

---

### Task 2: 实现 `_create_collection` 两层防御

**Files:**
- Modify: `src/backend/bisheng_langchain/vectorstores/milvus.py:297-360`

**Interfaces:**
- Consumes: Task 1 验证的决策逻辑（main-path load / fallback load / re-raise）
- Produces: 修改后的 `_create_collection`，并发下不抛 `SchemaNotReadyException`

**当前代码（line 297-360）关键段:**
- line 298-305: 方法内 `from pymilvus import Collection, CollectionSchema, DataType, FieldSchema, MilvusException`
- line 307-348: 构建 fields + schema（不改）
- line 350-360: `try: self.col = Collection(...) except MilvusException as e: logger.error(...); raise e`

**改动两处:**

- [ ] **Step 1: 方法开头加 has_collection 检查（主路径）**

在 line 305（`from pymilvus.orm.types import infer_dtype_bydata`）之后、line 307（`# Determine embedding dim`）之前插入：

```python
        # 并发兜底（主路径）：collection 已存在则直接 load，跳过 create。
        # 避免 knowledge worker 并发批量入库时多 worker 同时 create_collection
        # 触发 SchemaNotReadyException 竞争。
        from pymilvus import utility
        if utility.has_collection(self.collection_name, using=self.alias):
            self.col = Collection(self.collection_name, using=self.alias)
            return
```

注意：`Collection` 已在 line 299 import，复用；`utility` 需新 import（pymilvus 顶层模块）。

- [ ] **Step 2: 改原 except 分支加兜底 load**

把 line 358-360：
```python
        except MilvusException as e:
            logger.error('Failed to create collection: %s error: %s', self.collection_name, e)
            raise e
```
改为：
```python
        except MilvusException as e:
            # 并发兜底（异常路径）：极窄窗口下多个 worker 同时 past 主路径的 has_collection
            # 检查并同时 create，失败的兜底 load 已被别 worker 建好的表。
            # 若确实没建成（真异常），原样抛出不吞。
            if utility.has_collection(self.collection_name, using=self.alias):
                logger.warning(
                    'concurrent create_collection race on %s, load existing: %s',
                    self.collection_name, e,
                )
                self.col = Collection(self.collection_name, using=self.alias)
                return
            logger.error('Failed to create collection: %s error: %s', self.collection_name, e)
            raise e
```

- [ ] **Step 3: 本地语法检查（无法 import，只查语法）**

Run: `cd src/backend && python -m py_compile bisheng_langchain/vectorstores/milvus.py`
Expected: 无输出（语法正确）。注：py_compile 不 import 依赖，只编译语法，本地可跑。

- [ ] **Step 4: Commit**

```bash
git add src/backend/bisheng_langchain/vectorstores/milvus.py
git commit -m "fix(milvus): _create_collection 并发建表竞争兜底（has_collection 检查 + 异常 load）"
```

---

### Task 3: 部署到服务器（生死线 8 步）

**Files:**
- 服务器目标: `/peng/eagent/runtime/app/bisheng_langchain/vectorstores/milvus.py`

**Interfaces:**
- Consumes: Task 2 改完的本地 milvus.py
- Produces: 服务器运行态更新，worker-knowledge 重启加载新代码

**SSH 通道:** `ssh zckj "sshpass -p 'Dg*Rh9lpstv1gUdNF&?RfZg\$3dBTsOzQ' ssh -o StrictHostKeyChecking=no -p 30314 root@172.28.39.10 'CMD'"`

- [ ] **Step 1: 分析+说明+方案+回退（8步前4步，向彭总汇报）**

向彭总汇报：
- 分析：Task 2 已改完本地 milvus.py，两层防御就位
- 方案：scp 传服务器覆盖 + restart worker-knowledge
- 回退：改前先备份服务器原文件到 `/tmp/milvus.py.bak.20260625`，失败还原

- [ ] **Step 2: 彭总批准后，备份服务器原文件**

Run:
```
ssh zckj "sshpass -p 'Dg*Rh9lpstv1gUdNF&?RfZg\$3dBTsOzQ' ssh -o StrictHostKeyChecking=no -p 30314 root@172.28.39.10 'cp /peng/eagent/runtime/app/bisheng_langchain/vectorstores/milvus.py /tmp/milvus.py.bak.20260625 && echo backup_ok'"
```
Expected: `backup_ok`

- [ ] **Step 3: scp 本地改后文件到服务器（两跳：本机→zckj→容器）**

Run:
```
scp src/backend/bisheng_langchain/vectorstores/milvus.py zckj:/tmp/milvus_new.py
ssh zckj "sshpass -p 'Dg*Rh9lpstv1gUdNF&?RfZg\$3dBTsOzQ' scp -o StrictHostKeyChecking=no -P 30314 /tmp/milvus_new.py root@172.28.39.10:/peng/eagent/runtime/app/bisheng_langchain/vectorstores/milvus.py"
```
Expected: 两次 scp 成功无报错

- [ ] **Step 4: 服务器端语法校验 + 确认改动落地**

Run:
```
ssh zckj "sshpass -p 'Dg*Rh9lpstv1gUdNF&?RfZg\$3dBTsOzQ' ssh -o StrictHostKeyChecking=no -p 30314 root@172.28.39.10 '/peng/eagent/runtime/python311/bin/python3.11 -m py_compile /peng/eagent/runtime/app/bisheng_langchain/vectorstores/milvus.py && echo compile_ok; grep -c \"concurrent create_collection race\" /peng/eagent/runtime/app/bisheng_langchain/vectorstores/milvus.py'"
```
Expected: `compile_ok` + 计数 `1`（兜底分支已落地）

- [ ] **Step 5: restart worker-knowledge**

Run:
```
ssh zckj "sshpass -p 'Dg*Rh9lpstv1gUdNF&?RfZg\$3dBTsOzQ' ssh -o StrictHostKeyChecking=no -p 30314 root@172.28.39.10 'supervisorctl restart worker-knowledge && sleep 5 && supervisorctl status worker-knowledge'"
```
Expected: worker-knowledge RUNNING

- [ ] **Step 6: 失败处理预案**

若 restart 后 worker-knowledge FATAL 或启动报错：
```
ssh zckj "sshpass -p 'Dg*Rh9lpstv1gUdNF&?RfZg\$3dBTsOzQ' ssh -o StrictHostKeyChecking=no -p 30314 root@172.28.39.10 'cp /tmp/milvus.py.bak.20260625 /peng/eagent/runtime/app/bisheng_langchain/vectorstores/milvus.py && supervisorctl restart worker-knowledge'"
```
回退后重新分析。

---

### Task 4: 端到端验证（服务器批量上传复现）

**Files:**
- 无文件改动，只验证

**Interfaces:**
- Consumes: Task 3 部署完成
- Produces: 确认并发批量入库不再 `SchemaNotReadyException`

- [ ] **Step 1: 清空 worker-knowledge 旧报错日志标记**

Run:
```
ssh zckj "sshpass -p 'Dg*Rh9lpstv1gUdNF&?RfZg\$3dBTsOzQ' ssh -o StrictHostKeyChecking=no -p 30314 root@172.28.39.10 'echo \"=== verify_start $(date) ===\" >> /peng/eagent/logs/worker-knowledge.log'"
```

- [ ] **Step 2: 请彭总在平台批量上传文件复现**

请彭总用 shanls 账号，向知识库批量上传 10-20 个 PDF（模拟原发场景）。或彭总指示是否用 retry 之前失败的文件测试。

- [ ] **Step 3: 验证日志无 SchemaNotReadyException**

上传完成后 Run:
```
ssh zckj "sshpass -p 'Dg*Rh9lpstv1gUdNF&?RfZg\$3dBTsOzQ' ssh -o StrictHostKeyChecking=no -p 30314 root@172.28.39.10 'awk \"/verify_start/{p=1} p\" /peng/eagent/logs/worker-knowledge.log | grep -c SchemaNotReadyException; awk \"/verify_start/{p=1} p\" /peng/eagent/logs/worker-knowledge.log | grep -c \"concurrent create_collection race\"'"
```
Expected: 第一个计数 `0`（无 schema 冲突），第二个计数可能 `>=0`（兜底触发次数，触发说明防御生效，但不阻断）

- [ ] **Step 4: 确认文件解析状态**

Run（查本次上传文件是否都成功）:
```
ssh zckj "sshpass -p 'Dg*Rh9lpstv1gUdNF&?RfZg\$3dBTsOzQ' ssh -o StrictHostKeyChecking=no -p 30314 root@172.28.39.10 'awk \"/verify_start/{p=1} p\" /peng/eagent/logs/worker-knowledge.log | grep -E \"process_file_fail|process_file_end\" | tail -30'"
```
Expected: process_file_end 多于 process_file_fail，无 SchemaNotReadyException 相关 fail。

- [ ] **Step 5: 向彭总汇报验证结果**

汇报：并发批量入库是否成功、SchemaNotReadyException 是否消失、兜底是否触发。若仍有失败，回 Task 1 重新分析。

---

## 不改动的文件（手术刀边界）

- `bisheng_langchain/vectorstores/milvus.py` 除 `_create_collection` 外的其他方法
- `bisheng/api/services/knowledge_imp.py`（知识库解析主流程）
- `worker/knowledge/file_worker.py`（celery 任务）
- supervisord 配置（并发数不改）
- 其他 vectorstores（es.py 等）

## 关键文件路径

- 改：`src/backend/bisheng_langchain/vectorstores/milvus.py`（`_create_collection` 方法，line 297-360）
- 新增：`src/backend/tests/test_milvus_create_concurrent_fix.py`（本地逻辑验证脚本）
- 服务器：`/peng/eagent/runtime/app/bisheng_langchain/vectorstores/milvus.py`
- 设计文档：`docs/superpowers/specs/2026-06-25-milvus-concurrent-create-fix-design.md`

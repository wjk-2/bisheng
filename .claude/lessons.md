# 踩坑记录
> 本文件只保留真正的 Bug 根因。已沉淀为代码规范的见 .claude/dev-conventions.md；运维事实/前端技巧/已失效条目见 .claude/archive/lessons-history-2026-06.md。详见 CLAUDE.md「踩坑记录」段。

## 指针

- **2026-04-06 Platform axios 拦截器已剥离响应包装**：现象 — `res?.data?.data` 拿到 undefined。根因 — `controllers/request.ts` 拦截器已自动 `return response.data.data`，API 调用回调拿到的就是业务数据本身。详见 `.claude/dev-guide.md §7`。
- **2026-04-27 Worktree 分支策略**：同 Milestone 前后端必须共用同一 worktree，不得拆分到不同分支。规范见 `.claude/dev-conventions.md §6`。
- **2026-06-09 InputForm 文件上传双 bug 互相掩护**：根因 — `isSSO` 硬编码 `true` 掩盖了 `flow` prop 未传的 bug，修复分享页后广场页立即崩溃；改动 `InputFileComponent` props 时必须同时验证广场页与分享页两条路径。双路径验证强制规范见 CLAUDE.md「前端文件上传改动：必须双路径验证」。

## 2026-04-07 workstation update_config 勿加 model ID 验证逻辑

**问题**：工作台配置页保存时提示「服务器错误」。

**根因**：`update_config` 中手动加了一段 model ID 存在性验证，但 `valid_model_ids` 从数据库取的是 `int`（`LLMModelInfo.id: Optional[int]`），而前端传来的 `WSModel.id` 是 `str`，Python 集合成员检查 `"1" not in {1}` 永远为 `True`，导致任何合法配置都被判定无效并返回 `resp_500`。

**教训**：`update_config` 不需要也不应该做 model ID 验证。前端选模型时已经从合法列表中选取，后端只需原样存库。官方实现就是 3 行：接收 data → `WorkStationService.update_config` → `resp_200`。定制时不要在这里加额外校验。

**检查点**：
- `WSModel.id` 类型是 `str`，`LLMModelInfo.id` 类型是 `int`，跨层比较必须先统一类型
- `update_config` 官方为同步 `def`，加了 `await LLMService.get_all_llm()` 后必须改为 `async def`，改回时也要一并还原
- 回退方法：删除整段验证代码，函数签名改回 `def`，import 中移除 `resp_500`

## 2026-04-13 工作流 CodeNode exec 沙箱：辅助函数必须定义在 main() 内部

**问题**：工作流 CODE 节点中在 `main()` 外部定义辅助函数（如 `nature_classify`、`class_size_coeff`），运行时报 `NameError: name 'nature_classify' is not defined`。

**根因**：`CodeParser.parse_functions()` 用 `exec(compiled_func, exec_globals, exec_locals)` 执行函数定义，函数对象落入 `exec_locals`。`exec_method('main')` 调用时，main 函数的 `__globals__` 是 `exec_globals`，无法访问 `exec_locals` 中的同级函数，因此模块级辅助函数对 main 不可见。

**修复方式**：将所有辅助函数改为 main() 内的嵌套函数。main 调用嵌套函数走 `__closure__` 和局部作用域，不经过 `__globals__`，可以正常访问。

**教训**：工作流 CODE 节点的代码中，除 `import` 语句外，所有函数定义必须放在 `main()` 内部。不要在模块级定义辅助函数，否则 exec 沙箱会导致 NameError。

**检查点**：
- 模块级只允许 `import` 语句，所有 `def` 必须在 `main()` 内
- 嵌套函数缩进 4 格，与 main 内的其他代码对齐
- `get_minio()` 等涉及内部 import 的函数同样适用此规则

## 2026-04-13 工作流 InputNode Milvus metadata 字段必须填充默认值

**问题**：工作流运行 INPUT 节点上传文件时，Milvus 报 `MilvusException: int64 field 'update_time' is illegal, nil is not allowed`，以及 `varchar field 'uploader' is illegal, nil is not allowed`。

**根因**：`input.py` 的 `parse_upload_file()` 中构建 metadata 时未填充 `update_time`、`abstract`、`uploader`、`updater`、`user_metadata` 字段，Milvus 2.3.x 对 non-nullable 字段传 None 会直接报错。

**修复位置**：`src/backend/bisheng/workflow/nodes/input/input.py` 的 `metadata.update()` 调用，补充：
```python
'update_time': int(time.time()),
'abstract': metadata.get('abstract') or '',
'uploader': metadata.get('uploader') or '',
'updater': metadata.get('updater') or '',
'user_metadata': metadata.get('user_metadata') or {},
```

**额外修复**：同文件第 96 行 `else key` 应为 `else (key, [])`，否则解包报 `too many values to unpack`。

**检查点**：修改后需同步 `/peng/eagent/runtime/app/` 和 `/peng/eagent/package/backend/` 两个路径。

## 2026-04-25 /chat/online 响应结构变更

**变更**：`src/backend/bisheng/api/v1/chat.py` L508 将 `data=data` 改为 `data={'list': data, 'total': total}`。

**影响**：前端 `getChatOnlineApi` 的调用方需要从 `res.data` 改为读 `res.data.list`（列表）和 `res.data.total`（总数）。已在 `AgentList.tsx` 中做兼容处理（`res.data?.list ?? res.data`）。

**检查点**：如果将来有其他地方也调用 `/api/v1/chat/online`，注意响应结构已变更。

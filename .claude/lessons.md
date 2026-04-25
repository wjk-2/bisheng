# 经验教训

## 2026-04-06 Platform axios 拦截器已剥离响应包装

**问题**：修改 `locationContext.tsx` 时，计划中写了 `res?.data?.data` 来访问 workstation config 数据，实际运行时拿到 `undefined`。

**原因**：Platform 端的 axios 响应拦截器（`src/frontend/platform/src/controllers/request.ts` 第28-31行）已经做了 `return response.data.data`，即自动剥离了两层包装（axios envelope + UnifiedResponseModel）。所以 `getWorkstationConfigApi()` resolve 后拿到的直接就是业务数据对象。

**教训**：修改 Platform 前端代码时，必须先读 `controllers/request.ts` 的拦截器逻辑，确认 API 调用返回值的实际结构。不能想当然地按后端原始响应结构来访问。

**检查点**：
- Client 和 Platform 的 HTTP 层不同。Client 用 `data-provider` 体系（有自己的 `_get` 函数做 `response.data` 剥离再加 `.then(res => res.data)`），Platform 用原始 axios + 拦截器
- Platform 拦截器在 `status_code === 200` 时直接 `return response.data.data`
- 所以 Platform 中任何 `getWorkstationConfigApi()` 等 API 函数，`.then()` 回调的参数就是业务数据本身

## 2026-04-06 Platform Logo 动态化改造要点

**改动文件**：
- `src/frontend/platform/src/contexts/locationContext.tsx` — `getWorkstationConfigApi()` 响应存入 `appConfig`
- `src/frontend/platform/src/layout/MainLayout.tsx` — Logo 从硬编码改为动态绑定

**关键设计决策**：
- 两端（Client + Platform）共用同一个后端配置 API `/api/v1/workstation/config`
- `sidebarSlogan` 和 `sidebarIcon` 由管理员在系统管理中统一维护
- 字号统一为 `text-sm`（14px），与 Client 一致
- 图片 URL 需拼 `__APP_ENV__.BASE_URL` 前缀
- 图标显示条件对齐 Client：只检查 `image` 是否存在，不检查 `enabled`

## 2026-04-06 benchMenu 字段已废弃

**问题**：`locationContext.tsx` 中原来有 `benchMenu` 的处理逻辑（从 workstation config 读取）。

**原因**：`benchMenu` 在整个前端代码中已无任何引用，属于遗留代码。

**教训**：本次改造时已一并清理。如果未来看到 workstation config 中有 `menuShow` 字段，那是 benchMenu 的后端来源，但前端已不使用。

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

## 2026-04-25 Tailwind 不支持多层渐变叠加

**问题**：设计稿要求卡片 hover 时叠加 `linear-gradient(179deg, rgba(50,82,255,0.22)..., rgba(255,255,255,0) ...), #fff` 这种复合背景。

**教训**：Tailwind utility class 无法表达多层渐变叠加（`background` 属性多值）。解决方法：用 `onMouseEnter/Leave` state 切换 `style={{ background: ... }}` inline style，不要试图用 Tailwind class 实现。

**检查点**：凡是需要 `background: <gradient1>, <gradient2>` 两层叠加的场景，直接用 inline style。

## 2026-04-06 nginx 缓存策略与部署

**事实**：Platform 的 nginx 配置中：
- `index.html` — `no-store, no-cache, must-revalidate`，不会缓存
- `assets/*` — `max-age=31536000, immutable`，缓存一年
- Vite 构建产物文件名带 content hash，内容变文件名就变
- 因此部署后用户刷新页面即可拿到最新版本，无需 touch 或额外操作

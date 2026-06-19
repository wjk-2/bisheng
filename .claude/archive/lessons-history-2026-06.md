# lessons 历史条目（归档于 2026-06-19）

> 从 lessons.md 归档的运维事实、行为说明、前端技巧、已失效字段。真正的 Bug 根因保留在 lessons.md，已沉淀为规范的在 dev-conventions.md。

## 2026-04-06 nginx 缓存策略与部署

**事实**：Platform 的 nginx 配置中：
- `index.html` — `no-store, no-cache, must-revalidate`，不会缓存
- `assets/*` — `max-age=31536000, immutable`，缓存一年
- Vite 构建产物文件名带 content hash，内容变文件名就变
- 因此部署后用户刷新页面即可拿到最新版本，无需 touch 或额外操作

## 2026-06-09 上传文件后直接离开页面的行为

**场景**：用户在工作流智能体的 InputForm 中上传文件（file_path 已返回），未提交对话，直接点击浏览器返回。

**前端行为**：
- 上传请求已完成，`file_path` 写入 `InputForm` 的 `formDataRef.current`（`useRef`，组件本地）
- 页面卸载 → `formDataRef` 随组件销毁，`file_path` 永久丢失
- WebSocket cleanup effect（`useWebsocket.ts` L220-235）仅在 `running=false` 时关闭连接并清理 `wsMap`/`sessionInfoMap`
- 无 `AbortController`，上传一旦发出无法中断；无任何"取消上传"或自动清理 file_path 的逻辑
- 用户重新进入同一对话：`InputForm` 需等 WS 重新推送 `category=input` 消息才会显示，之前的 `file_path` 无法恢复，用户需重新上传

**后端行为**：
- 两条路径（`/upload/{flow_id}` 和 `/knowledge/upload`）均存入 MinIO **`tmp-dir` 临时桶**，不写数据库，不关联任何 session/chat/flow
- MinIO bucket lifecycle 规则：**3 天后自动过期删除**（`minio_storage.py` 初始化时设置，`Expiration(days=3)`）
- WebSocket 断开时后端不删临时文件（cleanup 只取消任务、关闭连接）

**结论**：无资源泄漏风险（3 天 TTL 兜底），但用户体验上没有提示，重新进入后需重新选文件。这是当前设计的既有行为。

**检查点**：
- `InputForm` 的表单数据（含 `file_path`）存在 `formDataRef`，不持久化，路由切换即丢失
- 如需"返回后继续填表"体验，需将 `formDataRef` 提升为 Recoil atom 并持久化，属于 P2 改造项

## 2026-04-25 Tailwind 不支持多层渐变叠加

**问题**：设计稿要求卡片 hover 时叠加 `linear-gradient(179deg, rgba(50,82,255,0.22)..., rgba(255,255,255,0) ...), #fff` 这种复合背景。

**教训**：Tailwind utility class 无法表达多层渐变叠加（`background` 属性多值）。解决方法：用 `onMouseEnter/Leave` state 切换 `style={{ background: ... }}` inline style，不要试图用 Tailwind class 实现。

**检查点**：凡是需要 `background: <gradient1>, <gradient2>` 两层叠加的场景，直接用 inline style。

## 2026-04-06 benchMenu 字段已废弃

**问题**：`locationContext.tsx` 中原来有 `benchMenu` 的处理逻辑（从 workstation config 读取）。

**原因**：`benchMenu` 在整个前端代码中已无任何引用，属于遗留代码。

**教训**：本次改造时已一并清理。如果未来看到 workstation config 中有 `menuShow` 字段，那是 benchMenu 的后端来源，但前端已不使用。

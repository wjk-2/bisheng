# 项目上下文

## 正式发布前审核报告（2026-06-09）

**范围**：死因审卡、慢病AI审卡（workflow，flow_type=10），广场页 + 分享页  
**结论：主链路通过，可正式发布**

### 已验证通过的关键链路

| 链路 | 状态 |
|------|------|
| 广场页文件上传：`uploadFile → postMultiPart → /upload/{flow_id}` | 通过（后端日志 Jun 9 13:16 HTTP 200 实测）|
| 分享页文件上传：`uploadChatFile → post(带config) → /knowledge/upload` | 通过 |
| `GET /flows/{flow_id}` share 访客可访问 | 通过（`get_user_or_default_operator`）|
| `GET /chat/history` share 访客可访问 | 通过（flowId 匹配校验）|
| `POST /upload/{flow_id}` share 访客可访问 | 通过（已登记 share-accessible）|
| share-token 解析：过期/禁用检查 | 通过（dependencies.py 状态+时间双重校验）|
| ChatView → ChatMessages → InputForm → InputFileComponent shareToken 透传 | 通过 |
| 响应结构 `res.data.file_path` / `data.data.file_path` | 通过 |
| `isSSO={!!shareToken}` 动态判断 | 通过（广场页=false，分享页=true）|

### P1 修复完成（2026-06-19 已部署湖州师范 node3 并线上验证）

| 优先级 | 问题 | 位置 | 修复 |
|--------|------|------|------|
| P1-A | isSSO 分支缺 `.catch`，上传失败 loading 卡死 | `InputFileComponent.tsx` isSSO 分支 | 已修复：isSSO 分支补 `.catch` → `setLoading(false)` + 提示 |
| P1-B | sessionInfoMap 无 null 守卫，WS 断连后提交报 TypeError | `useWebsocket.ts` INPUT/FORM_SUBMIT | 已修复：`sessionInfoMap.get(chatId)?.message_id ?? ''` 可选链 + 空值兜底 |
| P1-C | WS 发送失败后 inputDisabled 不重置，界面卡死 | `useWebsocket.ts` sendWsMsg catch | 已修复：catch 补 `helpers.handleMsgError({ code: '', data: null }, false)` 恢复输入状态 |

**线上验证**（node3 `/usr/share/nginx/html/client/`，useWebsocket chunk `index.DERAZJSL.js`）：
- P1-A/B 此前版本已含修复；P1-C 于 2026-06-19 构建部署，线上 grep 命中 `handleMsgError({code:"",data:null},!1`（独立子代理交叉验证 5 项全通过）
- 部署方式：全量替换（先删旧 hash 再解压 build.zip），备份 `client_backup_20260619_pre_p1c`
- 数据安全：仅覆盖前端静态文件，backend/mysql/milvus/minio 进程未重启（uptime 多天连续），智能体（死因审卡/慢病审卡）数据无影响

### 待处理问题（P2）

| 优先级 | 问题 | 位置 | 说明 |
|--------|------|------|------|
| P2-A | `/chat/share/{flow_id}` WebSocket 不校验 share-token 归属 | `chat.py` | 任意知道 flow_id 可连接，当前智能体已公开可接受，建议后续加绑定 |
| P2-B | `_postMultiPart` headers 覆盖 options.headers | `request.ts` | 当前无自定义 header 调用，不影响现有功能 |
| P2-C | 分享页 workflow chatId 每次刷新重新生成 | `share.tsx` | 当前设计意图，可改为 `getOrCreateShareChatId` 模式 |

### 历史 Bug 根因备忘（2026-06-09 彻底修复）

双 bug 互相掩护的完整历史：
1. `isSSO` 硬编码 `true` → 广场页走 SSO 分支 → `uploadFileWithProgress` 缺 url 参数 → 打到错误端点
2. 修分享页将 `isSSO` 改为 `!!shareToken` → 广场页切回 `uploadFile` → `request.post(url, formData)` 无 config → `_post` 的 ternary 把 FormData JSON.stringify 成 `{}` → 后端 422

最终修复：`uploadFile` 改用 `request.postMultiPart`，绕过有问题的 ternary。

---

## 开发状态快照（2026-04-29）

> 此为 2026-04-29 快照，最新进展见本文件顶部审核报告与 P1 修复记录。

### 活跃 Worktree

| worktree | 本地路径 | 分支 | 状态 |
|---------|---------|------|------|
| 主工作树 | `eagent-v3/v2.0/` | `analysis-v2.3.0` | ✅ UI Redesign 已合并，基线干净 |

### 里程碑进度

| 里程碑 | 状态 | 说明 |
|--------|------|------|
| Milestone 1 — 课程学习（学生端静态） | ✅ 完成 | 课程列表/详情/单元学习页 |
| Milestone 2 — 班级、进度、作品集 | ✅ 完成，已部署验证通过 | 前后端已合并主分支，功能性测试通过 |
| Milestone 3 — 三层结构 + UI 重设计 | ✅ 完成，已合并主分支 | Path→Course→Unit 三层、29门课种子、EduAvatar、紧凑卡片 |

### 下一步

规划 Milestone 4，候选方向：
- **DialogPanel 真实对话接入**：右栏 `dialog` 面板接入真实助手（当前仅占位）
- **教师学情看板**：班级维度的学习进度统计页

---

## 已完成里程碑摘要

| 里程碑 | 完成时间 | 说明 |
|--------|---------|------|
| 双前端视觉重构（AI Studio 风格） | 2026-04-25 | 设计 Token 落地，颜色规范见 `dev-guide.md §8` |
| 教育模块 Milestone 1（学生端静态） | 2026-04-27 | 课程列表/详情/单元学习，已合并至主分支 |
| 教育模块 Milestone 2（班级、进度、作品集） | 2026-04-27 | 前后端已合并主分支，构建+部署验证通过，功能性测试通过 |
| 教育模块 Milestone 3（三层结构+UI重设计） | 2026-04-29 | Path→Course→Unit 三层数据模型，29门高职课程种子，EduAvatar 组件，CoursesPage/PathDetailPage 紧凑卡片重设计，CourseLearningPage 比例+面包屑+进度修复，path_title 字段 |

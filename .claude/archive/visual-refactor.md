# 双前端视觉全量补完方案

> 创建日期：2026-04-25
> 最后更新：2026-04-25（Phase A/B/C 全部完成）
> 参考规范：AI Studio 应用中心设计规范（`C:\Users\Administrator\.claude\plans\https-aistudio-baidu-com-application-cen-drifting-meerkat.md`）

---

## 一、已完成部分（勿重复）

| 文件 | 内容 |
|------|------|
| `client/src/style.css` | Studio Design Token（14个 `--studio-*` 变量）+ `--primary: 240 100% 64%`（#4658FF）+ `--background: 228 100% 99%` + `--border: 220 22% 87%` |
| `client/tailwind.config.cjs` | `studio-*` 颜色别名 7 个 |
| `platform/src/style/index.css` | `--primary: 240 100% 64%` + `--background-main: rgba(247,249,255,1)` + `--border: 220 22% 87%` |
| `platform/src/App.css` | `.bs-table-td → #FFFFFF`，`.bs-table-row:nth-child(odd) .bs-table-td → #F7F9FF`，hover `#ebf0ff` 保留 |
| `platform/src/layout/MainLayout.tsx` | Header 边框 `#E5EAF4`；Sidebar `rgba(255,255,255,0.8)` + 边框 `#E5EAF4`；NavLink 选中 `bg-[#F1F5FF] text-[#4658FF] font-semibold rounded-lg`；分组标题 `text-[#9498AC]`；内容区 `bg-[#F7F9FF]` |
| `client/src/components/Nav/Nav.tsx` | `bg-[rgba(255,255,255,0.8)]` + `border-[#E5EAF4]`；底部按钮 `text-[#9498AC] hover:text-[#140E35] hover:bg-[#F7F9FF]` |
| `client/src/pages/apps/index.tsx` | 渐变背景 `var(--studio-page-bg)`；搜索框 `rounded-md`；`useAuthContext` 取 `user.id` |
| `client/src/pages/apps/components/AgentCard.tsx` | 258px 固定高度；hover 顶部蓝紫渐变（inline style）；5区域布局；类型 `user_id: string` `currentUserId: string` |
| `client/src/pages/apps/components/AgentList.tsx` | Grid `grid-cols-4 2xl:grid-cols-6`；真分页 `PAGE_SIZE=12`；骨架占位；`loading` 初始值 `true`；`currentUserId` prop 贯通 |
| `client/src/pages/apps/components/CategoryTabs.tsx` | 「全部」为首项；三态 button；「全部」右侧 `#E5EAF4` 竖线分隔符 |
| `platform/src/components/bs-comp/cardComponent/index.tsx` | 普通卡片蓝色阴影 + hover 更大阴影；sheet 卡片 `bg-white hover:bg-[#F1F5FF]`；新建卡片边框 `#D9DEE9` |
| `platform/src/pages/BuildPage/apps.tsx` | `grid grid-cols-4 gap-4` |
| `src/backend/bisheng/api/v1/chat.py` | `/chat/online` 响应 `data={'list': data, 'total': total}` |
| `platform/src/components/bs-ui/table/index.tsx` | TableCell `bg-white group-odd:bg-[#F7F9FF]`（已修复 hardcode 旧灰色） |
| `platform/src/pages/ModelPage/manage/index.tsx` | 标题 `font-semibold text-[#140E35]`；空状态 `text-[#9498AC]` |
| `platform/src/pages/ModelPage/deployment/index.tsx` | 标题 `font-semibold text-[#140E35]` |
| `platform/src/pages/Monitor/index.tsx` | 标题 `font-semibold text-[#140E35]`；GPU 内存进度条 `bg-[#4658FF]` |
| `client/src/routes/Root.tsx` | Header 边框 `border-[#E5EAF4]`（与 Platform 保持一致） |

---

## 二、bs-ui 组件库现状

**已自动跟随 `--primary` 变量（无需改动）**：
- `Button` — `bg-primary` → 已是 #4658FF
- `Input` / `Textarea` — `border-input bg-search-input` → 已跟随
- `Dialog` — `bg-background border` → 已跟随
- `Select` / `Tabs` / `Badge` / `Switch` → 已跟随

**需要修复**（已全部完成）：

| 文件 | 问题 | 修复内容 |
|------|------|---------|
| `platform/src/components/bs-ui/table/index.tsx` | ~~`TableCell` hardcode `bg-[#FBFBFB] group-odd:bg-[#f4f5f8]`~~ | ✅ 已改为 `bg-white group-odd:bg-[#F7F9FF]` |

---

## 三、待补完文件清单

### 明确排除
- `BuildPage/flow/` 及其下所有文件（流程图编辑器，高风险不动）
- `BuildPage/assistant/` 助手编辑器（节点类交互组件）
- `EducationPage/`（另有专项计划）
- 聊天气泡 / Markdown 渲染（影响阅读体验，不动）

### Phase A — bs-ui 基础组件（已完成）

- [x] `platform/src/components/bs-ui/table/index.tsx` — TableCell 改为 `bg-white group-odd:bg-[#F7F9FF]`

### Phase B — Platform 业务页面（已完成）

审核结论：顶层容器均继承 MainLayout `bg-[#F7F9FF]`，已正确。逐文件确认后实际需改项如下：

| 模块 | 文件 | 状态 | 具体改动 |
|------|------|------|---------|
| 模型管理 | `pages/ModelPage/manage/index.tsx` | ✅ 已改 | 标题色 `text-[#140E35]`；空状态 `text-[#9498AC]` |
| 模型部署 | `pages/ModelPage/deployment/index.tsx` | ✅ 已改 | 标题色 `text-[#140E35]` |
| 监控 | `pages/Monitor/index.tsx` | ✅ 已改 | 标题色 `text-[#140E35]`；GPU 进度条 `bg-[#4658FF]` |
| 知识库 | `pages/KnowledgePage/index.tsx` | ✅ 无需改 | 仅 Tabs 容器，颜色跟随变量 |
| 评测 | `pages/EvaluationPage/index.tsx` | ✅ 无需改 | 无 hardcode 颜色 |
| 系统管理 | `pages/SystemPage/index.tsx` | ✅ 无需改 | 仅 Tabs 容器 |
| 日志 | `pages/LogPage/index.tsx` | ✅ 无需改 | 仅 Tabs 容器 |

### Phase C — Client 聊天页（已完成）

| 文件 | 状态 | 具体改动 |
|------|------|---------|
| `client/src/routes/Root.tsx` | ✅ 已改 | Header 边框 `border-gray-100` → `border-[#E5EAF4]` |
| `client/src/components/Chat/` 容器层 | ✅ 无需改 | 继承 CSS 变量，已自动跟随 |

---

## 四、颜色替换速查表

| 旧值（需替换） | 新值 | 场景 |
|--------------|------|------|
| `text-gray-900` + `font-bold` 主标题 | `text-[#140E35] font-semibold` | 页面主标题 |
| `text-gray-500` / `text-gray-400` | `text-[#9498AC]` | 说明文字、空状态、辅助文字 |
| `text-gray-600` 正文（手写，非 muted-foreground） | `text-[#565772]` | 表格内容、描述文字 |
| `bg-blue-50` / `bg-blue-100` | `bg-[#F1F5FF]` | 选中背景、高亮区域 |
| `border-blue-500` / `border-blue-600` | `border-[#4658FF]` | 选中/焦点边框 |
| `text-blue-600` / `text-blue-700` | `text-[#4658FF]` | 链接、操作按钮文字 |
| `bg-gray-50`（手写非变量的容器背景） | `bg-[#F7F9FF]` | 卡片区域、侧栏背景 |
| `border-gray-200` / `border-gray-100` | `border-[#E5EAF4]` | 分割线、容器边框 |
| `bg-[#f4f5f8]` / `bg-[#FBFBFB]` 表格行 | `bg-[#F7F9FF]` / `bg-white` | 表格奇偶行 |

**保留不改**：
- `text-green-500` / `text-orange-500` / `text-red-500` — 语义状态色
- `.dark` 块内所有颜色 — 暗色模式保持原样
- `text-muted-foreground` — 已跟随 CSS 变量，无需改

---

## 五、实施顺序（已全部完成，待构建验证）

```
Phase A  ✅ bs-ui/table/index.tsx — 完成
Phase B  ✅ Platform 各业务模块 — 完成
Phase C  ✅ Client 聊天页容器确认 — 完成
最后     ⬜ npm run build（client + platform 各一次）— 待执行
```

---

## 六、验证清单

- [ ] `npm run build`（client）— 无 TypeScript 错误
- [ ] `npm run build`（platform）— 无 TypeScript 错误
- [ ] Platform `/model`：表格行背景为淡蓝 `#F7F9FF`，非灰色 `#f4f5f8`；页面标题深紫 `#140E35`
- [ ] Platform `/model`（部署页）：页面标题深紫 `#140E35`
- [ ] Platform `/monitor`：页面标题深紫 `#140E35`；GPU 内存进度条蓝紫色
- [ ] Platform `/sys`：页面标题为深紫 `#140E35`，非纯黑
- [ ] Platform `/evaluation`：整体背景蓝紫系，无灰色割裂
- [ ] Platform `/knowledge`：局部蓝色 badge/border 为 `#4658FF` 系列
- [ ] Client Header 边框：与 Platform 一致为 `#E5EAF4`，非灰色 `#e5e7eb`
- [ ] Client 聊天页：主容器背景与应用广场一致，无视觉跳变
- [ ] Dark 模式：各页面暗色样式正常

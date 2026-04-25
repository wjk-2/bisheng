# 项目上下文

## 当前状态（2026-04-06）

### 双前端 Logo 统一 — 已完成

两端 Logo（品牌名 + 图标）已统一从后端 `/api/v1/workstation/config` 动态读取，管理员改一处两端同步更新。

| 端 | Logo 位置 | 实现方式 |
|----|----------|---------|
| Client | `src/frontend/client/src/routes/Root.tsx` 第88-100行（Header） | `useGetBsConfig()` → React Query |
| Platform | `src/frontend/platform/src/layout/MainLayout.tsx` 第282-287行（Header） | `useContext(locationContext).appConfig` |

**数据流**：
- Client: API → `data-provider` → `BsConfig` → `bsConfig` state → UI
- Platform: API → axios 拦截器剥离包装 → `wc` → `appConfig` context → UI

### Client 导航栏改造 — 已完成

`src/frontend/client/src/components/Nav/NewChat.tsx` 已改为四项垂直导航：
1. 智能体广场（`/apps`）
2. 教学及开发平台（`/build`，`<a href>` 硬跳转）
3. 个人知识库（`setShowKnowledge(true)`）
4. 开始新对话

样式统一：`text-sm font-medium text-gray-600 dark:text-gray-300`

### Client Header 改造 — 已完成

`src/frontend/client/src/routes/Root.tsx` 新增全宽 Header：
- 左：Logo + Slogan（动态配置）
- 右：主题切换 + 用户菜单（头像+下拉：设置/退出登录）
- 认证逻辑补全 `isLoading`/`isError` 状态判断



---

## 双前端视觉重构 — AI Studio 风格（2026-04-25）

### 目标
参考 AI Studio 应用中心设计规范，将两个前端 SPA（Client/Workspace + Platform）的视觉层替换为蓝紫色相统一风格，不破坏现有功能逻辑。

### 设计 Token（核心颜色）
```
主色:      #4658FF   (hsl 240 100% 64%)
标题色:    #140E35
正文色:    #565772
次级描述:  #9498AC
边框:      #D9DEE9
分割线:    #E5EAF4
模块背景:  #F7F9FF
页面背景:  linear-gradient(180deg, #F7F9FF 0%, #F2F5FE 100%)
```

### 修改文件清单

#### Client (Workspace) — src/frontend/client/

| 文件 | 变更内容 |
|------|---------|
| `src/style.css` | 新增 `--studio-*` 14个 token；`--primary` → `240 100% 64%`；`--background` → `228 100% 99%`；`--border` → `220 22% 87%` |
| `tailwind.config.cjs` | extend.colors 新增 7 个 `studio-*` alias |
| `src/pages/apps/index.tsx` | 蓝紫渐变背景 `var(--studio-page-bg)`；32px 边距；`rounded-md` 搜索框；初始分类改为 `''`（全部） |
| `src/pages/apps/components/AgentCard.tsx` | 完整重写：258px 固定高度，hover 顶部蓝紫渐变（onMouseEnter/Leave inline style），5 区域布局（头像→标题→描述→作者→数据行） |
| `src/pages/apps/components/AgentList.tsx` | CSS Grid `grid-cols-4 2xl:grid-cols-6`；移除加载更多；真分页（`PAGE_SIZE=12`，含骨架占位）；响应解析适配 `data.list` / `data.total` |
| `src/pages/apps/components/CategoryTabs.tsx` | 新增「全部」(`value: ''`) 为第一项；去掉 lucide 图标；三态 button 样式（透明/hover `#F7F9FF`/选中 `#4658FF`） |
| `src/components/Nav/Nav.tsx` | 侧边栏：`bg-[rgba(255,255,255,0.8)]`；边框 `border-[#E5EAF4]`；底部按钮文字/hover 色蓝紫化 |

#### 后端 — src/backend/

| 文件 | 变更内容 |
|------|---------|
| `bisheng/api/v1/chat.py` 约 L507-508 | `/chat/online` 响应从 `data=data` 改为 `data={'list': data, 'total': total}`，透传分页 total |

#### Platform — src/frontend/platform/

| 文件 | 变更内容 |
|------|---------|
| `src/style/index.css` | `--primary` → `240 100% 64%`；`--background-main` → `rgba(247,249,255,1)`；`--border` → `220 22% 87%` |
| `src/App.css` | `bs-table-td` → `#FFFFFF`；`:nth-child(odd) bs-table-td` → `#F7F9FF`（hover `#ebf0ff` 保留） |
| `src/layout/MainLayout.tsx` | Header 边框 `#E5EAF4`；Sidebar `rgba(255,255,255,0.8)` + 边框 `#E5EAF4`；NavLink hover `#F7F9FF`；NavLink 选中：`bg-[#F1F5FF] text-[#4658FF] font-semibold rounded-lg`（去左竖条）；分组标题 `#9498AC`；内容区 `bg-[#F7F9FF]` |
| `src/components/bs-comp/cardComponent/index.tsx` | 普通卡片加 `shadow-[rgba(122,161,225,0.2)...]` + hover 更大阴影；sheet 卡片改白底/hover `#F1F5FF`；新建空卡片边框 `#D9DEE9` |
| `src/pages/BuildPage/apps.tsx` | 卡片区 `flex gap-2 flex-wrap` → `grid grid-cols-4 gap-4` |

### 关键决策记录

1. **分页 API 兼容**：后端 `WorkFlowService.get_all_flows` 原本已有 total 返回但被丢弃，修一行透传即可，无需改 DAO 层
2. **hover 复合渐变**：Tailwind 不支持多层渐变叠加，用 `onMouseEnter/Leave` + inline style 切换
3. **dark 模式保护**：`--studio-*` token 仅加在 `:root`，`.dark` 块保留原值，dark 模式不受影响
4. **AgentCard 数据行**：原有 `is_public`/`user_id` 标识（我的/公开/组内）逻辑全部保留

### 构建验证（待执行）
```bash
# Client
cd src/frontend/client && npm run build

# Platform
cd src/frontend/platform && npm run build
```

---

### nginx 缓存策略（已确认）
- `index.html`: no-store, 不缓存
- `assets/*`: max-age=31536000 + content hash, 部署后自动更新

# 项目上下文

## 双前端视觉重构 — AI Studio 风格（2026-04-25 已完成）

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

### 页面背景统一（2026-04-26）

**架构原则**：Platform 所有业务页面的背景由 `MainLayout.tsx:426` 单一控制点承载，页面组件顶层容器不得设置任何背景色（透明即可）。Client 架构不同，`Root.tsx` 的 `<Outlet/>` 无背景，页面级背景由页面自身设置（如 `apps/index.tsx`），属于合理设计。

**已修改文件（共 17 处，分两轮）**：

| 文件 | 行号 | 改动 |
|------|------|------|
| `layout/MainLayout.tsx` | 426 | `bg-[#F7F9FF]` → `[background:var(--studio-page-bg)]` |
| `pages/BuildPage/apps.tsx` | 226 | 删除内联 `style={{ background: 'var(--studio-page-bg)' }}` |
| `pages/ModelPage/deployment/index.tsx` | 137 | 删除 `bg-background-login` |
| `pages/ModelPage/finetune.tsx` | 65 | 删除 `bg-background-login` |
| `pages/ModelPage/manage/index.tsx` | 218 | 删除 `bg-background-login` |
| `pages/ModelPage/manage/SystemModelConfig.tsx` | 90 | 删除 `bg-background-login` |
| `pages/Monitor/index.tsx` | 201 | 删除 `bg-background-login` |
| `pages/KnowledgePage/detail.tsx` | 24 | 删除 `bg-background-login` |
| `pages/KnowledgePage/qas.tsx` | 453 | 删除 `bg-background-login` |
| `pages/LabelPage/taskApps.tsx` | 30 | 删除 `bg-background-login` |
| `pages/LabelPage/taskAppChats.tsx` | 136 | 删除 `bg-background-login` |
| `pages/LogPage/useAppLog/appChatDetail.tsx` | 58 | 删除 `bg-background-login` |
| `pages/ModelPage/deployment/components/DeploymentDetail.tsx` | 137 | 删除 `bg-background-login` |
| `pages/ModelPage/deployment/components/CreateDeployment.tsx` | 694 | 删除 `bg-background-login` |
| `pages/DiffFlowPage/index.tsx` | 39 | 删除 `bg-gray-100 dark:bg-[#111]` |
| `pages/EducationPage/index.tsx` | 8 | 删除 `bg-background` |
| `pages/EducationPage/EducationLayout.tsx` | 8 | 删除 `bg-background` |

**不处理（合理设计）**：
- `Page404.tsx` — 独立错误页，在 MainLayout 外渲染
- `Page403.tsx` — `fixed z-50` 遮罩层
- `LoginPage/resetPwd.tsx` — 登录系统独立页
- `BuildPage/` — 高风险交互组件，不动

### 前端视觉分层原则（正道）

变化传播路径：Design Token → Tailwind 配置扩展 → 布局组件 → 业务页面

| 层级 | 职责 | 典型文件 |
|------|------|---------|
| 1. Design Token | CSS 变量定义，改这一层全局生效 | `globals.css` 或 `index.css` |
| 2. Tailwind 扩展 | 将 Token 映射为 Tailwind class | `tailwind.config.js` |
| 3. 布局组件 | 结构性容器，最多 2-3 个文件 | `MainLayout.tsx`、`HeaderMenu.tsx` |
| 4. 业务页面 | 通过继承拿到颜色，几乎不动 | `pages/**` |

**判断标准**：改一个颜色需要 grep 全库 → Token 层缺失；改完还要逐页检查 → Token 未被正确引用。

**反模式**：跳过 1-2 层直接在业务组件写颜色值，改动量是 O(n)，本次视觉重构中因此修改了 30+ 文件。

### nginx 缓存策略
- `index.html`: no-store, 不缓存
- `assets/*`: max-age=31536000 + content hash, 部署后自动更新

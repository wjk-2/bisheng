# 智能体广场卡片优化 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 Client 前端智能体广场卡片（三色权限 + 类型前置 + 合并作者行 + 光带 signature + 响应式 + a11y），并部署到湖州师范 node3。

**Architecture:** 纯表现层重构，两个文件：`AgentCard.tsx` 整体重构（D1~D6、D8），`AgentList.tsx` 改网格断点与骨架高度（D7、D5 同步）。数据契约不变，后端零改动。验证靠 Vite 构建通过 + 视觉自检 + 部署后实地回归（组件无单测基础，不写测试）。

**Tech Stack:** React 18 + TypeScript 5.4 + Vite 6 + Tailwind CSS 3.4 + lucide-react。部署：`deploy-client.sh`（node3 裸 nginx + scp，原子回退）。

**Spec:** [docs/superpowers/specs/2026-06-19-agent-card-refinement-design.md](../specs/2026-06-19-agent-card-refinement-design.md)

**Commit 策略:** 本项目纯本地仓库（analysis-v2.3.0），定制代码为未提交修改是常态。计划不强制 commit，各任务末尾留 commit 检查点，由彭总在部署验证后决定是否落本地 commit。部署用的是本地 build 产物，与 git 解耦。

---

## File Structure

| 文件 | 责任 | 改动类型 |
|------|------|----------|
| `src/frontend/client/src/pages/apps/components/AgentCard.tsx` | 卡片渲染（顶部行/封面+标题/描述/底栏/光带/a11y） | 整体重构 |
| `src/frontend/client/src/pages/apps/components/AgentList.tsx` | 卡片网格容器 + 骨架 | 局部改 className |

不改：`index.tsx`、`CategoryTabs.tsx`、`Avator/index.tsx`、后端、API、数据结构。

---

## Task 1: 重构 AgentCard.tsx

**Files:**
- Modify: `src/frontend/client/src/pages/apps/components/AgentCard.tsx`（整体替换）

本任务实现 D1（三色权限）、D2（类型 chip 前置）、D3（合并作者行 + 首字色块）、D4（描述升级）、D5（容器高度/圆角/阴影）、D6（光带 signature 三段）、D8（键盘 a11y + 焦点环）。

- [ ] **Step 1: 用下方完整代码整体替换 AgentCard.tsx**

```tsx
"use client"

import { useState } from "react"
import { Bot, Layers, Tag, Workflow } from "lucide-react"
import AppAvator from "~/components/Avator"

interface Agent {
    id: string
    name: string
    description: string
    flow_type: number
    logo: string
    category: string
    is_public?: number
    user_id?: string
    user_name?: string
}

interface AgentCardProps {
    agent: Agent
    onClick: (e: React.MouseEvent<HTMLDivElement>) => void
    currentUserId?: string
}

// flow_type: 1=技能, 5=助手, 10=工作流
const flowTypeConfig: Record<number, { label: string; Icon: React.ElementType }> = {
    1:  { label: '技能',   Icon: Bot },
    5:  { label: '助手',   Icon: Layers },
    10: { label: '工作流', Icon: Workflow },
}

// 权限三色：我的=蓝紫 / 公开=emerald / 组内=amber。光圈用透明度版，dark mode 自适应（spec D1）
const permConfig = {
    me:     { label: '我的', dot: 'bg-primary',     ring: 'ring-primary/15' },
    public: { label: '公开', dot: 'bg-emerald-500', ring: 'ring-emerald-500/20' },
    group:  { label: '组内', dot: 'bg-amber-500',   ring: 'ring-amber-500/20' },
} as const

// 首字色块：按 Unicode 码点取首字符（emoji/中文安全），空值兜底「?」（spec D3）
function getInitial(name?: string): string {
    return (Array.from((name || '').trim())[0] || '?').toUpperCase()
}

export function AgentCard({ agent, onClick, currentUserId }: AgentCardProps) {
    const [hovered, setHovered] = useState(false)

    const isMyApp = !!(currentUserId && agent.user_id === currentUserId)
    const permKey = isMyApp ? 'me'
        : agent.is_public === 2 ? 'public'
        : agent.is_public === 1 ? 'group'
        : null
    const perm = permKey ? permConfig[permKey] : null

    const typeConf = flowTypeConfig[agent.flow_type] ?? { label: '应用', Icon: Bot }

    // 键盘可达性：Enter / Space 触发点击（spec D8）
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick(e as unknown as React.MouseEvent<HTMLDivElement>)
        }
    }

    return (
        <div
            className="relative h-[210px] w-full overflow-hidden rounded-xl px-5 pt-5 pb-3.5 flex flex-col cursor-pointer transition-[transform,box-shadow] duration-300 [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            style={{
                background: hovered
                    ? 'linear-gradient(179deg, hsl(var(--primary) / 0.10) -8%, transparent 45%), hsl(var(--card))'
                    : 'hsl(var(--card))',
                boxShadow: hovered
                    ? '0 10px 30px 0 hsl(var(--primary) / 0.12)'
                    : '0 1px 2px 0 rgba(11,13,20,0.04), 0 4px 14px 0 rgba(11,13,20,0.035)',
                transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
            }}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            role="button"
            tabIndex={0}
            aria-label={agent.name}
        >
            {/* D6 光带 signature：hover 时浮起（三段之一）。pointer-events-none 防误拦截 */}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-r bg-gradient-to-b from-primary to-primary/70 transition-all duration-300"
                style={{ opacity: hovered ? 1 : 0, transform: hovered ? 'scaleY(1)' : 'scaleY(0.5)' }}
            />

            {/* 顶部行：D2 类型 chip + D1 权限 dot */}
            <div className="flex items-center justify-between gap-2">
                <span className="pointer-events-none inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 border border-primary/15 rounded-full px-2 py-0.5">
                    <typeConf.Icon className="w-3 h-3" />
                    {typeConf.label}
                </span>
                {perm && (
                    <span className="pointer-events-none inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <span className={`w-1.5 h-1.5 rounded-full ring-2 ${perm.dot} ${perm.ring}`} />
                        {perm.label}
                    </span>
                )}
            </div>

            {/* 封面头像（保持现状 rounded-full w-12）+ 标题 */}
            <div className="mt-3.5 flex items-center gap-3 min-w-0">
                <AppAvator
                    id={agent.name}
                    url={agent.logo}
                    flowType={agent.flow_type}
                    className="w-12 h-12 min-w-12 rounded-full object-cover"
                />
                <h3 className={`text-base font-semibold leading-6 truncate transition-colors ${hovered ? 'text-primary' : 'text-foreground'}`}>
                    {agent.name}
                </h3>
            </div>

            {/* D4 描述：13px / 行高 1.625 / 2 行截断 / 空占位斜体 */}
            <p className={`mt-2 text-[13px] leading-relaxed line-clamp-2 overflow-hidden flex-1 ${agent.description ? 'text-muted-foreground' : 'text-muted-foreground/60 italic'}`}>
                {agent.description || '该智能体暂未填写介绍'}
            </p>

            {/* D3 底栏：作者首字色块（左）+ 分类（右），虚线分隔 */}
            <div className="mt-3 pt-3 border-t border-dashed border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 min-w-0">
                    <span className="w-[18px] h-[18px] min-w-[18px] rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-gradient-to-br from-[#4658FF] to-[#6B7FFF]">
                        {getInitial(agent.user_name)}
                    </span>
                    <span className="truncate max-w-[100px]">{agent.user_name || '未知'}</span>
                </span>
                <span className="inline-flex items-center gap-1 flex-shrink-0">
                    <Tag className="w-3 h-3 text-primary/80" />
                    {agent.category || '通用'}
                </span>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: 视觉自检（本地起 dev 或对照预览稿）**

可选：`cd src/frontend/client && npm run start` 本地起 dev server，肉眼核对：顶部类型 chip + 权限三色 dot、封面头像+标题、描述 2 行、底栏首字色块+分类、hover 光带+上浮+标题变色、Tab 键焦点环。若不起 dev，留到 Task 3 构建后部署实地核对。

- [ ] **Step 3: commit 检查点（可选，待彭总确认）**

改动验证通过后，彭总可决定是否 `git add src/frontend/client/src/pages/apps/components/AgentCard.tsx && git commit -m "refactor(client): 智能体卡片重构-三色权限/类型前置/合并作者行/光带signature/a11y"`。默认不 commit。

---

## Task 2: 修改 AgentList.tsx 网格与骨架

**Files:**
- Modify: `src/frontend/client/src/pages/apps/components/AgentList.tsx:72`（卡片网格 className）
- Modify: `src/frontend/client/src/pages/apps/components/AgentList.tsx:85-87`（骨架网格 className + 高度）

本任务实现 D7（响应式四档）+ D5 同步（骨架高度 210px、圆角 xl）。

- [ ] **Step 1: 改卡片网格断点**

将 AgentList.tsx 中卡片网格（注释 `{/* 卡片网格 */}` 下方那一行）：

```tsx
            <div className="grid grid-cols-4 2xl:grid-cols-6 gap-4">
```

改为：

```tsx
            <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
```

- [ ] **Step 2: 改骨架网格断点 + 高度**

将 AgentList.tsx 中骨架块（注释 `{/* 加载中骨架占位 */}` 下方）：

```tsx
                <div className="grid grid-cols-4 2xl:grid-cols-6 gap-4">
                    {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                        <div key={i} className="h-[258px] rounded-lg bg-muted animate-pulse" />
                    ))}
                </div>
```

改为：

```tsx
                <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                    {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                        <div key={i} className="h-[210px] rounded-xl bg-muted animate-pulse" />
                    ))}
                </div>
```

- [ ] **Step 3: commit 检查点（可选，待彭总确认）**

同 Task 1，默认不 commit。

---

## Task 3: 本地构建验证

**Files:** 无（验证步骤）

- [ ] **Step 1: 跑生产构建**

Run:
```bash
cd src/frontend/client && npm run build
```
Expected: 构建成功，无 TS 类型错误，产出 `build/index.html` + `build/assets/*`。Vite 退出码 0。

- [ ] **Step 2: 若构建失败，按错误修复**

常见可能：
- Tailwind 任意值 class 拼写错误 → 核对 Task 1 代码
- TS 类型错误（如 onClick 签名）→ 核对 `handleKeyDown` 的类型转换
- 未使用 import → 删除

修复后重跑 Step 1，直到构建通过。

- [ ] **Step 3: 确认产物完整**

Run:
```bash
ls -la src/frontend/client/build/index.html src/frontend/client/build/assets/ | head -5
```
Expected: index.html 存在，assets 目录非空（含 hashed JS/CSS + PWA sw.js）。

---

## Task 4: 部署 node3 + 实地验证（生产操作，需彭总显式批准）

**Files:** 无（部署 + 验证）

> 生产 8 步：分析(spec)→说明(本计划)→方案(spec)→回退(下方 runbook)→**批准(本任务起点，彭总确认)→执行→验证→失败处理**。未获彭总批准前，不得执行本任务任何命令。

**数据安全保证（彭总红线：不破坏任何现有数据）：**

本次是**纯前端静态文件部署**——只替换 nginx 的 client 目录，**不连数据库、不动后端代码与配置、不动模型/智能体配置/知识库/对话历史/用户数据**。前端只读后端 API 渲染，无任何写库路径。

为给证据（不只口头承诺），部署前后做**只读数据快照对比**（全部 SELECT 只读，不改任何数据）：

- **Step 2 部署前基线**：① 查智能体广场列表（total + 名称清单，本次改动最相关）；② 关键业务表行数快照（`information_schema.tables`，覆盖全部表）
- **Step 4 部署后核对**：同样查询，diff 对比。预期：智能体清单完全一致；表行数除后端正常业务写入外无异常跳变
- **异常处置**：若核对发现非正常数据变化，立即执行 Step 5 回退 runbook，并向彭总汇报

- [ ] **Step 1: 获彭总批准**

向彭总确认：本地构建已通过，可以执行 `deploy-client.sh` 部署到 node3。未批准则停在此步。

- [ ] **Step 2: 执行部署**

Run（项目根目录）:
```bash
bash deploy-client.sh
```
Expected: 脚本输出 5 个阶段（构建→打包→上传→原子部署→验证），最后 `=== 部署完成 ===`。`deploy-client.sh` 会自动用 Task 3 的 build 产物（注意：脚本默认会重新 `npm run build`，若想复用 Task 3 产物加 `--skip-build`）。

校验点：脚本第 4 阶段会校验 stage 的 index.html + assets 非空，失败则中止、live 不被触碰。

- [ ] **Step 3: 实地功能回归（浏览器开 http://172.20.20.35:3001 或经 node4-gpu 跳板访问）**

核对清单：
1. 进智能体广场，卡片以新样式渲染（三色权限 dot、类型 chip、首字色块、固定 210 高、四档响应式）
2. hover 卡片：左侧光带浮起 + 整卡上浮 + 标题变蓝紫（三段）
3. Tab 键聚焦卡片：出现 primary 焦点环；Enter/Space 能进对话
4. 点卡片：正常进对话 `/chat/:chatId/:flowId/:flowType`
5. 切换分类标签（助教/助学等）、搜索框输入：卡片列表正常刷新
6. 分页：翻页正常
7. dark mode（若平台支持切换）：三色 ring 对比度可辨
8. 混合长短描述的一页：卡片高度对齐，无明显参差

- [ ] **Step 4: 若实地异常，执行回退 runbook**

```bash
# 查看可用备份（按时间倒序）
ssh node4-gpu "ssh root@172.20.20.35 'ls -1dt /usr/share/nginx/html/.backup/client/*/ | head -5'"

# 原子回滚到最近一份（live 非空，先移走再替换）
ssh node4-gpu "ssh root@172.20.20.35 'set -euo pipefail; \
  BK=\$(ls -1dt /usr/share/nginx/html/.backup/client/*/ | head -1); \
  mv /usr/share/nginx/html/client /usr/share/nginx/html/.client_rolled_\$(date +%s) && \
  mv \$BK /usr/share/nginx/html/client && echo rollback_done'"
```

回滚后浏览器强刷确认恢复旧卡片样式，向彭总汇报失败现象 + 已回滚。

- [ ] **Step 5: 部署成功，向彭总汇报**

实地全部通过后，汇报：部署完成、功能回归通过、卡片新样式已上线。彭总决定是否 commit 本地 + 是否更新项目文档（lessons.md / 部署记录）。

---

## 自审（writing-plans skill）

**1. Spec 覆盖：**
- D1 三色权限 → Task 1 permConfig + 顶部行 ✓
- D2 类型 chip 前置 → Task 1 顶部行 ✓
- D3 合并作者行 + 首字色块 → Task 1 底栏 + getInitial ✓
- D4 描述升级 → Task 1 描述段 ✓
- D5 容器高度/圆角/阴影 → Task 1 卡片根 + Task 2 骨架 ✓
- D6 光带 signature 三段 → Task 1 光带 span + 上浮 + 标题变色 ✓
- D7 响应式四档 → Task 2 网格 ✓
- D8 a11y → Task 1 role/tabIndex/onKeyDown/focus-visible ✓
- 数据契约不变 → Task 1 接口未改 ✓
- 回退 runbook → Task 4 Step 4 ✓
- chip/dot pointer-events-none → Task 1 ✓
全部覆盖，无遗漏。

**2. 占位符扫描：** 无 TBD/TODO/"实现细节"，每个代码步骤都给了完整代码或确切 className。

**3. 类型一致性：** `permConfig` 键 `me/public/group` 与 `permKey` 取值一致；`getInitial` 签名 `(name?: string) => string` 与调用 `getInitial(agent.user_name)` 一致；`onClick` 回调签名与 AgentList 传入的 `() => onCardClick(agent)` 兼容（handleKeyDown 内 cast 为 MouseEvent）。

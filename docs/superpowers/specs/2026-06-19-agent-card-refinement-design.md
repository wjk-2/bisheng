# 智能体广场卡片优化设计 (spec)

> **日期**: 2026-06-19
> **项目**: 湖州师范 E-Agent v2.3.0 (Workspace / Client 前端)
> **状态**: 设计已确认并经子代理审核修订，待实现计划
> **视觉参考**: [智能体卡片优化预览.html](../../../湖州项目部署计划/智能体卡片优化预览.html)
> **审核**: 已由 3 个并行子代理（技术可行性 / 手术刀原则 / 回归风险）审核，修订记录见末节

## 一、背景与目标

智能体广场是师生进入智能体的第一屏。当前卡片（`AgentCard.tsx`）信息齐全，但存在三类实质问题：

1. **权限标识同色** ——「我的 / 公开 / 组内」三个徽标都用 `bg-primary/10 text-primary`，仅靠文字区分，辨识度为零。
2. **作者行独占** —— 卡片已有封面头像，作者又用单独的 20px 头像 + 用户名占一整行，吃掉约 60px 垂直空间，压缩了描述区。
3. **网格响应式不足 / 可访问性缺口** —— 网格只有 `grid-cols-4` 和 `2xl:grid-cols-6` 两档；卡片是 `<div onClick>`，无键盘可达性、无焦点环。

**目标**：在**不破坏品牌蓝紫与整体设计系统**的前提下，重排卡片信息层级、引入三色权限体系，并以「左侧浮起光带」作为卡片的 signature 记忆点。同步补齐网格响应式与键盘可访问性。

**美学方向**：精致学术编辑感（Refined Academic）。品牌蓝紫保留为锚点色，但降低统治地位。装饰密度收敛——工具卡片优先信息清晰，不做消费级落地页式的堆砌动画。

**铁律**：手术刀式代码。不碰无关代码（除非遇 BUG），不写屎山，最小改动。

## 二、范围

### 在范围

| 文件 | 改动 |
|------|------|
| `src/frontend/client/src/pages/apps/components/AgentCard.tsx` | 重构卡片结构与样式（D1~D8） |
| `src/frontend/client/src/pages/apps/components/AgentList.tsx` | 网格补响应式断点 + 骨架高度同步 |

### 不在范围（YAGNI，明确排除）

- 不改 `pages/apps/index.tsx` 头部（标题、欢迎语、分类标签、搜索框）
- 不改 `CategoryTabs.tsx`、`MarkLabel.tsx`
- **不改 `Avator/index.tsx`**（D3 首字色块在 AgentCard 内用原生 div 完成，已审核确认不越界）
- 不新增卡片次级操作（收藏 / 详情 / 预览）—— 保持「整卡点击进对话」的单一动线
- 不改后端、不改数据结构、不改 API、不改 `Agent` 接口字段
- 不引入新依赖（lucide-react、Tailwind 已满足）
- 不在 style.css 新增 CSS 变量（权限三色接受硬编码，不扩散）

## 三、现状关键事实（实现前校验基准）

- AgentCard **仅被 `AgentList.tsx` 一处 import**，分享页 `share.tsx` 走独立的 ChatView 路径不引用它 —— 改 AgentCard 不波及分享页（CLAUDE.md 双路径红线安全）
- 卡片固定高 `h-[258px]`，内边距 `px-5 pt-7 pb-3.5`（[AgentCard.tsx:44](../../../src/frontend/client/src/pages/apps/components/AgentCard.tsx#L44)）
- `flow_type` 映射：`1=技能(Bot)` / `5=助手(Layers)` / `10=工作流(Workflow)`，默认兜底「应用」（[AgentCard.tsx:27-31](../../../src/frontend/client/src/pages/apps/components/AgentCard.tsx#L27-L31)）
- 权限判定：`isMyApp = user_id===currentUserId`；`isPublicApp = is_public===2`；`isGroupApp = is_public===1`（[AgentCard.tsx:36-38](../../../src/frontend/client/src/pages/apps/components/AgentCard.tsx#L36-L38)）
- `AppAvator` 无 `url` 时渲染品牌渐变方块 + flowType 图标；`flowType=0` 不在映射内 → 渲染空方块（现状作者头像即此空方块，无信息量）
- 网格 `grid grid-cols-4 2xl:grid-cols-6 gap-4`，`PAGE_SIZE=12`（[AgentList.tsx:72,28](../../../src/frontend/client/src/pages/apps/components/AgentList.tsx)）
- 设计变量：`--primary: 240 100% 64%`（HSL 三值，tailwind.config 包成 `hsl(var(--primary))` 支持 `/透明度`）、`--card`、`--studio-page-bg`；含 dark mode 覆盖。emerald/amber 为 Tailwind 内置色板（dark 下不随变量变，需用透明度版自适应）

## 四、设计决策

### D1. 三色权限标识（P0）

替换现状三个同源 `bg-primary/10 text-primary` 标签。采用 **dot + 文字** 形式，配低饱和光圈。光圈用**透明度版**（非 -100 浅色），确保 dark mode 自适应：

| 权限 | 条件 | dot 色 | 光圈 |
|------|------|--------|------|
| 我的 | `isMyApp` | `bg-primary` | `ring-2 ring-primary/15` |
| 公开 | `!isMyApp && is_public===2` | `bg-emerald-500` | `ring-2 ring-emerald-500/20` |
| 组内 | `!isMyApp && is_public===1` | `bg-amber-500` | `ring-2 ring-amber-500/20` |

文字用 `text-muted-foreground`。emerald/amber 接受硬编码（语义固定色，不扩散到 style.css 加变量）。三者互斥，判定逻辑与现状一致。

### D2. 类型 chip 前置（P1）

`flow_type` 从底栏右下角弱文字升级为**顶部 chip**，与权限标识同行置顶。复用 `flowTypeConfig` 的图标 + 文案：

```
[ 类型 chip ........ 权限 dot ]
```

类型 chip 样式：`bg-primary/10 text-primary border border-primary/15`，药丸 `rounded-full`，`text-[11px]`。

### D3. 合并作者行 + 首字色块（P0）

删除现状独占的作者头像行。作者名移入**底栏左侧**（底栏分左右：作者左、分类右）。底栏用**虚线 hairline**（`border-t border-dashed border-border/60`）替代实线。

底栏作者用 **18px 首字色块**（原生 `<div>`，`bg-gradient-to-br from-[#4658FF] to-[#6B7FFF]`，内嵌首字符）+ 用户名截断（`max-w-[100px] truncate`）。替代现状 `AppAvator(flowType=0)` 的空渐变方块。

**首字取值（emoji/中文安全）**：`(Array.from(agent.user_name?.trim() || '?')[0]?.toUpperCase() || '?')` —— 用 `Array.from` 按 Unicode 码点切分（避免中文/emoji surrogate pair 截半），trim 防纯空格，空值兜底「?」。**不碰 `Avator/index.tsx`**。

### D4. 描述升级（P1）

- 字号 `text-xs`（12px）→ `text-[13px]`，行高 `leading-relaxed`（1.625）
- 保持 2 行截断（`line-clamp-2`），`flex-1` 撑高
- 空描述占位：`text-muted-foreground/60 italic`「该智能体暂未填写介绍」。**用 `text-muted-foreground/60`，不引入不存在的 `text-faint`**

### D5. 卡片容器：固定高度 + 圆角 + 双层柔影（P1）

- 圆角 `rounded-lg`（8px）→ `rounded-xl`（12px）
- 默认阴影升级为双层柔影：`shadow-[0_1px_2px_rgba(11,13,20,0.04),0_4px_14px_rgba(11,13,20,0.035)]`（Tailwind 任意值，空格用下划线）
- **高度：固定 `h-[258px]` → 固定 `h-[210px]`**（合并作者行后内容变少，210px 更合适）。用固定高度而非弹性 `min-h`，**规避跨行参差**（grid stretch 会让短描述行留白）。骨架占位同步 `h-[210px]`

### D6. Signature：左侧光带 + 整卡上浮 + 标题变色（P1，hover 三段协同）

收敛自预览稿的五段（已砍头像 ring-4 光晕和 -3deg 旋转——工具卡片不需要卖萌动画）。保留三段：

- **左侧光带**（signature）：卡片根内首个子元素，`absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-r bg-gradient-to-b from-primary to-primary/70`，默认 `opacity-0 scale-y-50`，hover 时 `opacity-100 scale-y-100`，`transition` 0.3s
- **整卡上浮**：hover 时 `-translate-y-[3px]` + 阴影升级 `shadow-[0_10px_30px_rgba(70,88,255,0.12)]`
- **标题变色**：hover 时 `text-primary`

**实现要点**：卡片根补 `relative` + `overflow-hidden`（光带 left-0 贴左内侧，3px 全在卡内不裁切）。过渡曲线 `cubic-bezier(0.2,0.8,0.2,1)`。

### D7. 网格响应式（P2）—— 四档

`grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4`。内网教育平台以 PC 为主，删去手机/平板的 1/2 列档（YAGNI）；默认 3 列起，覆盖笔记本(3)→台式(4/5)→大屏(6)。骨架网格同步。

### D8. 键盘可访问性（P2）

卡片根元素补：
- `role="button"`、`tabIndex={0}`、`aria-label={agent.name}`
- `onKeyDown`：`Enter` / `Space`（`e.key === ' '`）触发 `onClick`，`e.preventDefault()`
- **焦点环（D8 内在闭环，必补）**：`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`
- `cursor-pointer` 保留
- ~~`active:scale`~~ 删除（PC 无感，YAGNI）

## 五、数据契约（不变，已核实）

`Agent` 接口字段、`flow_type` 枚举、`is_public` 枚举、权限判定逻辑、`onClick(agent)` 回调签名、`currentUserId` prop —— 全部不变。`handleCardClick`（[index.tsx:54-80](../../../src/frontend/client/src/pages/apps/index.tsx#L54-L80)）只读 `agent.id/flow_type/name`，不受影响。`getChatOnlineApi` 透传 page/keyword/limit/category，字段不变。本设计是纯表现层重构，后端与状态管理零改动。

## 六、验证策略

1. **本地构建**：`cd src/frontend/client && npm run build` 必须通过（Vite production build + TS 类型检查）
2. **视觉自检**（对照预览稿）：三色权限可辨、类型 chip 可见、作者行已合并、光带 hover、响应式四档、dark mode 下三色 ring 对比度
3. **功能回归**（部署后实地）：卡片点击进对话、分页、搜索、分类切换不受影响
4. **重点实测**：一页内混合长短描述的视觉（D5 固定高度下是否仍有明显留白）；dark mode 三色辨识
5. **不写单测**：卡片组件无现有测试基础，以构建通过 + 实地回归代替

## 七、部署与回退

- **部署**：本地 build 通过后，`bash deploy-client.sh`（湖州师范 node3 专用，已验证 [deploy-client.sh:3-5,26-30](../../../deploy-client.sh#L3-L30)，原子回退 + 备份保留 3 份）
- **回退 runbook**（脚本自带 stage 校验失败不触 live；成功部署后手动回滚）：
  ```bash
  # 1. 查看可用备份（按时间倒序）
  ssh node4-gpu "ssh root@172.20.20.35 'ls -1dt /usr/share/nginx/html/.backup/client/*/ | head -5'"
  # 2. 原子回滚到最近一份（live 非空，先移走再替换）
  ssh node4-gpu "ssh root@172.20.20.35 'set -euo pipefail; \
    BK=\$(ls -1dt /usr/share/nginx/html/.backup/client/*/ | head -1); \
    mv /usr/share/nginx/html/client /usr/share/nginx/html/.client_rolled_\$(date +%s) && \
    mv \$BK /usr/share/nginx/html/client && echo rollback_done'"
  ```
- **生产 8 步**：分析→说明→方案(本 spec)→回退(脚本内建 + 上面的 runbook)→批准→执行→验证→失败处理。部署执行需彭总显式批准

## 八、风险

| 风险 | 等级 | 缓解 |
|------|------|------|
| dark mode 三色 ring 对比 | 已化解 | D1 用透明度版 `ring-{color}/20`，跨主题自适应 |
| 描述长短混合时固定高度留白 | 低 | D5 固定 210px；若实测留白明显，微调高度值（不回退弹性） |
| chip/dot 误拦截点击 | 已化解 | 纯展示 span，加 `pointer-events-none` 物理杜绝拦截 |
| 首字色块硬编码渐变色与 Avator 重复 | 极低 | 接受重复（抽公共会迫改 Avator，越界） |

## 九、视觉参考

完整效果见高保真预览稿：`湖州项目部署计划/智能体卡片优化预览.html`。**注意**：预览稿展示的是最大化五段 hover 效果；落地 spec 已按手术刀原则收敛为三段（D6），砍掉头像光晕与旋转。实现以本 spec 为准。

## 十、审核修订记录（2026-06-19）

经 3 个并行子代理审核后的修订：

| 来源 | 修订 |
|------|------|
| 技术可行性 | D4 `text-faint`（不存在）→ `text-muted-foreground/60` |
| 技术可行性 + 回归 | D8 补 `focus-visible` 焦点环（键盘可达性闭环） |
| 技术可行性 | D6 补卡片根 `relative`（光带定位上下文） |
| 回归 R1 | D1 光圈 `-100` 浅色 → `-{color}/20` 透明度版（dark 自适应） |
| 回归 R2 | 第七节补手动回滚 runbook 命令 |
| 回归 R4 | D3 首字用 `Array.from` 按 Unicode 码点切（emoji/中文安全）+ 空值兜底 |
| 回归 R5 | chip/dot 加 `pointer-events-none` |
| 手术刀 | D5 弹性 `min-h-[200px]` → 固定 `h-[210px]`（规避参差） |
| 手术刀 | D7 六档 → 四档（内网 PC，YAGNI） |
| 手术刀 | D8 删 `active:scale`（PC 无感） |
| 手术刀 | D6 五段 → 三段（砍头像光晕 + 旋转，守住光带 signature） |

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

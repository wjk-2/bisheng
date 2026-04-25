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

const defaultBg = '#fff'
const hoverBg = 'linear-gradient(179deg, rgba(50,82,255,0.22) -8.26%, rgba(255,255,255,0) 44.84%), #fff'
const defaultShadow = 'rgba(122,161,225,0.2) 0px 1px 2px 0px'
const hoverShadow = 'rgba(181,199,235,0.5) 0px 12px 30px 0px'

// flow_type: 1=技能, 5=助手, 10=工作流
const flowTypeConfig: Record<number, { label: string; Icon: React.ElementType }> = {
    1:  { label: '技能',   Icon: Bot },
    5:  { label: '助手',   Icon: Layers },
    10: { label: '工作流', Icon: Workflow },
}

export function AgentCard({ agent, onClick, currentUserId }: AgentCardProps) {
    const [hovered, setHovered] = useState(false)

    const isMyApp = currentUserId && agent.user_id === currentUserId
    const isPublicApp = agent.is_public === 2
    const isGroupApp = agent.is_public === 1

    const typeConf = flowTypeConfig[agent.flow_type] ?? { label: '应用', Icon: Bot }

    return (
        <div
            className="h-[258px] w-full px-5 pt-7 pb-3.5 rounded-lg cursor-pointer flex flex-col transition-colors duration-300"
            style={{
                background: hovered ? hoverBg : defaultBg,
                boxShadow: hovered ? hoverShadow : defaultShadow,
            }}
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* 1. 封面头像 */}
            <AppAvator
                id={agent.name}
                url={agent.logo}
                flowType={agent.flow_type}
                className="w-12 h-12 min-w-12 rounded-full object-cover"
            />

            {/* 2. 标题 + 标识 */}
            <div className="mt-4 flex items-center gap-1.5 min-w-0">
                <h3 className="text-lg font-semibold text-[#140E35] truncate leading-7">
                    {agent.name}
                </h3>
                {isMyApp && (
                    <span className="px-1.5 py-0.5 text-xs bg-[#F1F5FF] text-[#4658FF] rounded whitespace-nowrap flex-shrink-0">
                        我的
                    </span>
                )}
                {!isMyApp && isPublicApp && (
                    <span className="px-1.5 py-0.5 text-xs bg-[#F1F5FF] text-[#4658FF] rounded whitespace-nowrap flex-shrink-0">
                        公开
                    </span>
                )}
                {!isMyApp && isGroupApp && (
                    <span className="px-1.5 py-0.5 text-xs bg-[#F1F5FF] text-[#6674FF] rounded whitespace-nowrap flex-shrink-0">
                        组内
                    </span>
                )}
            </div>

            {/* 3. 描述（2行） */}
            <p className="mt-2 text-xs text-[#565772] leading-5 line-clamp-2 overflow-hidden flex-1">
                {agent.description || '暂无描述'}
            </p>

            {/* 4. 作者行 */}
            <div className="mt-auto flex items-center">
                <AppAvator
                    id={agent.user_name || agent.name}
                    url=""
                    flowType={0}
                    className="w-5 h-5 min-w-5 rounded-full object-cover"
                />
                <span className="ml-1.5 text-xs text-[#9498AC] truncate max-w-[120px]">
                    {agent.user_name || '未知'}
                </span>
            </div>

            {/* 5. 底部数据行 */}
            <div className="mt-3.5 pt-3.5 border-t border-[#E5EAF4] flex items-center justify-between text-xs text-[#9498AC]">
                {/* 左：分类 */}
                <div className="flex items-center gap-1 min-w-0">
                    <Tag className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{agent.category || '通用'}</span>
                </div>
                {/* 右：应用类型 */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    <typeConf.Icon className="w-3 h-3" />
                    <span>{typeConf.label}</span>
                </div>
            </div>
        </div>
    )
}

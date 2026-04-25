"use client"

import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { getChatOnlineApi } from "~/api/apps"
import { useLocalize } from "~/hooks"
import { AgentCard } from "./AgentCard"

interface Agent {
    id: string
    name: string
    description: string
    logo: string
    category: string
    flow_type: number
    user_id: string
    user_name?: string
    is_public?: number
}

interface AgentListProps {
    category: string
    searchQuery: string
    onCardClick: (agent: Agent) => void
    currentUserId?: string
}

const PAGE_SIZE = 12

export function AgentList({ category, searchQuery, onCardClick, currentUserId }: AgentListProps) {
    const localize = useLocalize()
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)

    const totalPages = Math.ceil(total / PAGE_SIZE)

    const loadAgents = async (pageNum: number) => {
        setLoading(true)
        try {
            const res = await getChatOnlineApi(pageNum, searchQuery, PAGE_SIZE, category)
            const list = res.data?.list ?? res.data ?? []
            setAgents(list)
            setTotal(res.data?.total ?? res.total ?? list.length)
            setPage(pageNum)
        } catch (error) {
            console.error("加载智能体失败:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setPage(1)
        loadAgents(1)
    }, [category, searchQuery])

    if (!loading && agents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-[#9498AC]">
                <Search className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-base font-medium">暂无{category ? category : ''}智能体</p>
                <p className="text-sm mt-2">请尝试其他分类或搜索关键词</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            {/* 卡片网格 */}
            <div className="grid grid-cols-4 2xl:grid-cols-6 gap-4">
                {agents.map((agent) => (
                    <AgentCard
                        key={agent.id}
                        agent={agent}
                        onClick={() => onCardClick(agent)}
                        currentUserId={currentUserId}
                    />
                ))}
            </div>

            {/* 加载中骨架占位 */}
            {loading && (
                <div className="grid grid-cols-4 2xl:grid-cols-6 gap-4">
                    {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                        <div key={i} className="h-[258px] rounded-lg bg-[#F7F9FF] animate-pulse" />
                    ))}
                </div>
            )}

            {/* 分页 */}
            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 pt-6 pb-2">
                    <button
                        disabled={page <= 1}
                        onClick={() => loadAgents(page - 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-md border border-[#D9DEE9] text-[#565772] disabled:text-[#AEB4C9] disabled:border-[#E5EAF4] hover:border-[#4658FF] hover:text-[#4658FF] transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                        .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                            if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...')
                            acc.push(p)
                            return acc
                        }, [])
                        .map((p, idx) =>
                            p === '...' ? (
                                <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-[#9498AC] text-sm">…</span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => loadAgents(p as number)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors ${
                                        p === page
                                            ? 'bg-[#F1F4FF] border border-[#4658FF] text-[#4658FF]'
                                            : 'text-[#565772] hover:text-[#4658FF]'
                                    }`}
                                >
                                    {p}
                                </button>
                            )
                        )
                    }

                    <button
                        disabled={page >= totalPages}
                        onClick={() => loadAgents(page + 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-md border border-[#D9DEE9] text-[#565772] disabled:text-[#AEB4C9] disabled:border-[#E5EAF4] hover:border-[#4658FF] hover:text-[#4658FF] transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    )
}

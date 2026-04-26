"use client"

import { useQueryClient } from '@tanstack/react-query'
import { Search, X } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Input } from "~/components/ui"
import { useDebounce } from '~/components/ui/MultiSelect'
import { useGetBsConfig } from '~/data-provider'
import { ConversationData, QueryKeys } from "~/data-provider/data-provider/src"
import { useAuthContext, useLocalize } from '~/hooks'
import store from "~/store"
import { addConversation, generateUUID } from "~/utils"
import { CategoryTabs, CategoryValue } from "./components/CategoryTabs"
import { AgentList } from "./components/AgentList"

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

export default function AgentSquare() {
    const [category, setCategory] = useState<CategoryValue>('')
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const localize = useLocalize()
    const navigate = useNavigate()

    const handleSearchChange = useDebounce((query: string) => {
        setDebouncedSearch(query)
    }, 300, false)

    const handleSearchInput = (value: string) => {
        setSearchQuery(value)
        handleSearchChange(value)
    }

    const handleClearSearch = () => {
        setSearchQuery("")
        setDebouncedSearch("")
    }

    const queryClient = useQueryClient()
    const clearAllConversations = store.useClearConvoState()
    const { setConversation } = store.useCreateConversationAtom(0)

    const handleCardClick = (agent: Agent) => {
        const _chatId = generateUUID(32)
        const flowId = agent.id
        const flowType = agent.flow_type

        queryClient.setQueryData<ConversationData>([QueryKeys.allConversations], (convoData) => {
            if (!convoData) return convoData
            setConversation((prevState: any) => ({
                ...prevState,
                conversationId: _chatId
            }))
            return addConversation(convoData, {
                conversationId: _chatId,
                createdAt: "",
                endpoint: null,
                endpointType: null,
                model: "",
                flowId,
                flowType: flowType,
                title: agent.name,
                tools: [],
                updatedAt: ""
            })
        })

        navigate(`/chat/${_chatId}/${flowId}/${flowType}`)
    }

    const { user } = useAuthContext()
    const { data: bsConfig } = useGetBsConfig()

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--studio-page-bg)' }}>
            {/* 固定头部 */}
            <div className="flex-shrink-0 px-8 pt-6 pb-0">
                {/* 标题 */}
                <h1 className="text-[32px] font-medium text-foreground leading-[46px]">
                    {bsConfig?.applicationCenterWelcomeMessage || localize('com_app_center_welcome')}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {bsConfig?.applicationCenterDescription || localize('com_app_center_description')}
                </p>

                {/* 分类标签 + 搜索框 */}
                <div className="mt-4 flex items-start justify-between gap-4">
                    <CategoryTabs active={category} onChange={setCategory} />

                    <div className="relative w-72 min-w-48 flex-shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 w-4 h-4" />
                        <Input
                            type="text"
                            placeholder={localize('com_agent_search_placeholder')}
                            value={searchQuery}
                            onChange={(e) => handleSearchInput(e.target.value)}
                            className="pl-10 pr-10 h-8 rounded-md border-border bg-transparent text-sm"
                            style={{ borderWidth: '0.8px' }}
                        />
                        {searchQuery && (
                            <button
                                onClick={handleClearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 可滚动卡片区 */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
                <AgentList
                    category={category}
                    searchQuery={debouncedSearch}
                    onCardClick={handleCardClick}
                    currentUserId={user?.id}
                />
            </div>
        </div>
    )
}

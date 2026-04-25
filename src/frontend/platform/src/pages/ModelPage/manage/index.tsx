import { Button } from "@/components/bs-ui/button"
import { Switch } from "@/components/bs-ui/switch"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/bs-ui/table"
import { userContext } from "@/contexts/userContext"
import { useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
// import { transformModule, transformEvent, transformObjectType } from "../LogPage/utils"
import { LoadingIcon } from "@/components/bs-icons/loading"
import { useToast } from "@/components/bs-ui/toast/use-toast"
import { QuestionTooltip } from "@/components/bs-ui/tooltip"
import { changeLLmServerStatus, getAssistantModelList, getModelListApi, enableModelChatApi, disableModelChatApi, getChatEnabledIdsApi } from "@/controllers/API/finetune"
import { captureAndAlertRequestErrorHoc } from "@/controllers/request"
import { Badge } from "@/components/bs-ui/badge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/bs-ui/dialog"
import { CircleMinus, CirclePlus, MessageSquare } from "lucide-react"
import { useQuery } from "@tanstack/react-query";
import ModelConfig from "./ModelConfig"

function CustomTableRow({ data, index, user, onModel, onCheck, onEnableChat, onDisableChat }) {
    const { t } = useTranslation()
    const [expand, setExpand] = useState(false)
    const isGpuStack = data.source === 'gpustack'
    const isSft = data.source === 'sft'

    return <div className="text-sm bs-table-row">
        <div className={`grid grid-cols-2 transition-colors hover:bg-muted/50 items-center mt-1 mx-2 h-[52px] rounded-sm`}>
            <div className="bs-table-td h-full p-2 flex items-center gap-x-3 first:rounded-l-md last:rounded-r-md font-medium">
                {
                    expand ?
                        <CircleMinus className="cursor-pointer min-w-4 w-4 h-4" onClick={() => setExpand(false)} />
                        : <CirclePlus onClick={() => setExpand(true)} className="cursor-pointer min-w-4 w-4 h-4" />
                }
                {data.name}
                {isGpuStack && <Badge variant="secondary">本地部署</Badge>}
                {isSft && <Badge variant="secondary">微调模型</Badge>}
            </div>
            <div className="bs-table-td h-full p-2 flex justify-end items-center gap-x-3 first:rounded-l-md last:rounded-r-md font-medium">
                <Button variant="link" onClick={() => onModel(data.id)}
                    disabled={user.role !== 'admin' || isGpuStack}
                    className={`link px-0 pl-6`}>
                    {t('model.modelConfiguration')}
                </Button>
            </div>
        </div>
        {
            expand && <div className="px-12 py-2 m-auto border-collapse">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">{t('model.modelName')}</TableHead>
                            <TableHead className="w-[200px] min-w-[100px]">{t('model.modelType')}</TableHead>
                            <TableHead className="w-[200px] min-w-[100px]">{t('model.status')}</TableHead>
                            <TableHead className="w-[100px] min-w-[100px]">{t('model.onlineOfflineOperation')}</TableHead>
                            <TableHead className="w-[150px] min-w-[120px]">对话状态</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.models.map(m => (
                            <TableRow key={m.id}>
                                <TableCell>{m.model_name}</TableCell>
                                <TableCell>{m.model_type}</TableCell>
                                <TableCell>
                                    <span className={['text-green-500', 'text-orange-500', 'text-gray-500'][m.status]}>
                                        {[t('model.available'), t('model.abnormal'), t('model.unknown')][m.status]}
                                    </span>
                                    {m.status === 1 && <QuestionTooltip className=" align-middle" content={m.remark} />}
                                </TableCell>
                                <TableCell>
                                    <Switch disabled={user.role !== 'admin'} checked={m.online} onCheckedChange={(bool) => onCheck(index, bool, m.id)} />
                                </TableCell>
                                <TableCell>
                                    {m.model_type === 'llm' && user.role === 'admin' ? (
                                        m.chat_enabled ? (
                                            <div className="flex items-center gap-1">
                                                <Badge variant="default" className="text-xs">
                                                    <MessageSquare className="w-3 h-3 mr-1" />对话可用
                                                </Badge>
                                                <Button variant="ghost" size="sm" className="h-6 px-1 text-xs text-muted-foreground"
                                                    onClick={() => onDisableChat(m.id)}>
                                                    移除
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button variant="outline" size="sm" className="h-7 text-xs"
                                                onClick={() => onEnableChat(m.id, m.model_name)}>
                                                启用到对话
                                            </Button>
                                        )
                                    ) : m.model_type === 'llm' ? (
                                        m.chat_enabled ? <Badge variant="secondary" className="text-xs">对话可用</Badge> : null
                                    ) : null}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    {!data.models.length && <TableFooter>
                        <TableRow>
                            <TableCell colSpan={9} className="text-center text-[#9498AC]">{t('model.empty')}</TableCell>
                        </TableRow>
                    </TableFooter>}
                </Table>
            </div>
        }
    </div >
}

export default function Management() {
    const { t, i18n } = useTranslation();
    useEffect(() => {
        i18n.loadNamespaces('model');
    }, [i18n]);

    const [data, setData] = useState([])
    const { user } = useContext(userContext)
    const isAdmin = user.role === 'admin'
    const [modelId, setModelId] = useState(null)
    const [loading, setLoading] = useState(false)
    const { refetch } = useModel()
    // B++: 引导弹窗状态
    const [showChatGuide, setShowChatGuide] = useState<{ models: any[] } | null>(null)

    const reload = async () => {
        setLoading(true)
        // B++: 并行获取模型列表和已启用对话的 ID 列表
        const [models, enabledIds] = await Promise.all([
            getModelListApi(),
            getChatEnabledIdsApi().catch(() => [])
        ])
        const enabledSet = new Set((enabledIds || []).map(String))
        // 将 chat_enabled 标记注入每个 model，同时标记 source
        const enriched = models.map(server => {
            const cfg = server.config || {}
            let source = server.source || ''
            if (!source && cfg._source === 'sft') source = 'sft'
            return {
                ...server,
                source,
                models: server.models.map(m => ({
                    ...m,
                    chat_enabled: enabledSet.has(String(m.id))
                }))
            }
        })
        setData(enriched)
        setLoading(false)
        refetch()
    }
    useEffect(() => { reload() }, [])

    const handleGetRepeatName = (name) => {
        let index = 0
        let nameIndex = ''
        data.forEach(el => {
            if (el.name.indexOf(name) === 0) {
                const match = el.name.match(/\d+$/)
                const num = match ? match[0] : 0
                index = Math.max(index, Number(num))
                nameIndex = ` ${index + 1}`
            }
        })
        return `${name}${nameIndex}`
    }
    const { message } = useToast()

    // 权限不足提示
    const showPermissionDenied = () => {
        message({ variant: 'warning', description: '暂无权限，请联系管理员' });
    };

    // off & online
    const handleCheck = (index, bool, id) => {
        captureAndAlertRequestErrorHoc(changeLLmServerStatus(id, bool).then(res => {
            refetch()
        }))
        data[index].models = data[index].models.map(el => el.id === id ? { ...el, online: bool } : el)
        setData([...data])
    }

    // B++: 启用模型到对话
    const handleEnableChat = async (modelId: number, modelName: string) => {
        await captureAndAlertRequestErrorHoc(
            enableModelChatApi(modelId, modelName).then(() => {
                message({ variant: 'success', description: `${modelName} 已启用到对话` })
                reload()
            })
        )
    }

    // B++: 从对话移除模型
    const handleDisableChat = async (modelId: number) => {
        await captureAndAlertRequestErrorHoc(
            disableModelChatApi(modelId).then(() => {
                message({ variant: 'success', description: '已从对话移除' })
                reload()
            })
        )
    }

    if (modelId) return <ModelConfig
        id={modelId}
        onGetName={handleGetRepeatName}
        onBack={() => setModelId(null)}
        onReload={reload}
        onBerforSave={(id, name) => data.some(el => el.name === name && el.id !== id)}
        onAfterSave={(msg, serverData?) => {
            message({ variant: 'success', description: msg })
            reload()
            // B++: 新增模型时弹出引导
            if (serverData?.models?.length) {
                const llmModels = serverData.models.filter(m => m.model_type === 'llm')
                if (llmModels.length > 0) {
                    setShowChatGuide({ models: llmModels })
                }
            }
        }}
    />

    return <div className="relative bg-background-login h-full px-2 py-4">
        {loading && (
            <div className="absolute left-0 top-0 z-10 flex h-full w-full items-center justify-center bg-[rgba(255,255,255,0.6)] dark:bg-blur-shared">
                <LoadingIcon />
            </div>
        )}
        <div className="h-full overflow-y-auto">
            {/* 页面头部 */}
            <div className="flex justify-between items-center mb-6 px-4">
                <h1 className="text-2xl font-semibold text-[#140E35]">{t('model.modelManagement')}</h1>
                <div className="flex gap-4">
                    <Button onClick={() => isAdmin ? setModelId(-1) : showPermissionDenied()}>{t('model.addModel')}</Button>
                    <Button className="bg-black-button" onClick={reload}>{t('model.refresh')}</Button>
                </div>
            </div>
            <div className="flex-1">
                <div className="flex h-10 justify-between items-center font-medium text-muted-foreground text-sm">
                    <span className="ml-5">{t('model.serviceProvider')}</span>
                    <span className="mr-5">{t('model.actions')}</span>
                </div>
                <div className="pb-20">
                    {
                        data.map((d, index) => <CustomTableRow
                            key={d.id}
                            user={user}
                            data={d}
                            index={index}
                            onCheck={handleCheck}
                            onModel={setModelId}
                            onEnableChat={handleEnableChat}
                            onDisableChat={handleDisableChat}
                        />)
                    }
                </div>
            </div>
        </div>
        <div className="eagent-table-footer bg-background-login px-6">
            <p className="desc">{t('model.modelCollectionCaption')}.</p>
        </div>

        {/* B++: 添加模型后的引导弹窗 */}
        <Dialog open={!!showChatGuide} onOpenChange={() => setShowChatGuide(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>模型添加成功</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">是否将以下 LLM 模型启用到 Workspace 对话？</p>
                <div className="space-y-2 mt-2">
                    {showChatGuide?.models?.map(m => (
                        <div key={m.id} className="flex items-center justify-between p-2 border rounded-md">
                            <span className="text-sm font-medium">{m.model_name || m.name}</span>
                            <Button size="sm" onClick={async () => {
                                await handleEnableChat(m.id, m.model_name || m.name)
                                // 从列表中移除已启用的
                                setShowChatGuide(prev => {
                                    if (!prev) return null
                                    const remaining = prev.models.filter(item => item.id !== m.id)
                                    return remaining.length > 0 ? { models: remaining } : null
                                })
                            }}>
                                <MessageSquare className="w-3 h-3 mr-1" />启用到对话
                            </Button>
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setShowChatGuide(null)}>稍后再说</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>

}

// model list（embeddings llm）
export function useModel(type = 'llm') {
    const { data, isLoading, refetch } = useQuery({
        queryKey: [type === 'llm' ? "QueryModelsKey" : "QueryAssistantModelsKey"],
        queryFn: () => type === 'llm' ? getModelListApi() : getAssistantModelList(),
        select: (data) => {
            const llmOptions = []
            const embeddings = []
            const asrModel = []
            const ttsModel = []
            const rerank = []
            data.forEach(server => {
                const serverEmbItem = { value: server.id, label: server.name, children: [] }
                const serverLlmItem = { value: server.id, label: server.name, children: [] }
                const serverAsrItem = { value: server.id, label: server.name, children: [] }
                const serverTtsItem = { value: server.id, label: server.name, children: [] }
                const rerankItem = { value: server.id, label: server.name, children: [] }
                server.models.forEach(model => {
                    const item = {
                        value: String(model.id),
                        label: model.model_name
                    }
                    if (!model.online) return
                    if (model.model_type === 'asr') {
                        serverAsrItem.children.push(item)
                    } else if (model.model_type === 'tts') {
                        serverTtsItem.children.push(item)
                    } else if (model.model_type === 'embedding') {
                        serverEmbItem.children.push(item)
                    } else if (model.model_type === 'llm') {
                        serverLlmItem.children.push(item)
                    } else {
                        rerankItem.children.push(item)
                    }
                })

                if (serverLlmItem.children.length) llmOptions.push(serverLlmItem)
                if (serverEmbItem.children.length) embeddings.push(serverEmbItem)
                if (serverAsrItem.children.length) asrModel.push(serverAsrItem)
                if (serverTtsItem.children.length) ttsModel.push(serverTtsItem)
                if (rerankItem.children.length) rerank.push(rerankItem)
            });

            return { llmOptions, embeddings, asrModel, ttsModel, rerank }
        }
    });

    const {
        llmOptions = [],
        embeddings = [],
        asrModel = [],
        ttsModel = [],
        rerank=[]
    } = data ?? {};
    return {
        llmOptions,
        embeddings,
        asrModel,
        ttsModel,
        isLoading,
        rerank,
        refetch
    }
}
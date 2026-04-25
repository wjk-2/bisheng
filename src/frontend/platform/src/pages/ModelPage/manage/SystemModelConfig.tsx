import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/bs-ui/tabs";
import { Button } from "@/components/bs-ui/button";
import { LoadingIcon } from "@/components/bs-icons/loading";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getModelListApi } from "@/controllers/API/finetune";
import AssisModel from "./tabs/AssisModel";
import EvaluationModel from "./tabs/EvaluationModel";
import KnowledgeModle from "./tabs/KnowledgeModel";
import WorkflowModel from "./tabs/WorkflowModel";
import WorkbenchModel from "./tabs/WorkbenchModel";

export default function SystemModelConfig({ data: externalData, onBack }: any = {}) {
    const { t, i18n } = useTranslation('model')
    const [internalData, setInternalData] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        i18n.loadNamespaces('model');
    }, [i18n]);

    // 独立页面模式：自行加载数据
    const isStandalone = !externalData

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const models = await getModelListApi()
            setInternalData(models || [])
        } catch (e) {
            console.error('Failed to load model list:', e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (isStandalone) {
            loadData()
        }
    }, [isStandalone, loadData])

    const data = isStandalone ? internalData : externalData

    const { llmOptions, embeddings, asrModel, ttsModel} = useMemo(() => {
        let llmOptions = []
        let embeddings = []
        let asrModel = []
        let ttsModel = []
        const rerank = []
        data.forEach(server => {
            const serverEmbItem = { value: server.id, label: server.name, children: [] }
            const serverLlmItem = { value: server.id, label: server.name, children: [] }
            const serverAsrItem = { value: server.id, label: server.name, children: [] }
            const serverTtsItem = { value: server.id, label: server.name, children: [] }
            const rerankItem = { value: server.id, label: server.name, children: [] }

            server.models.forEach(model => {
                const item = {
                    value: model.id,
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

        return { llmOptions, embeddings, asrModel, ttsModel, rerank}
    }, [data])

    const handleBack = onBack || (() => {})

    return <div className="relative bg-background-login h-full px-2 py-4">
        {loading && (
            <div className="absolute left-0 top-0 z-10 flex h-full w-full items-center justify-center bg-[rgba(255,255,255,0.6)] dark:bg-blur-shared">
                <LoadingIcon />
            </div>
        )}
        <div className="h-full overflow-y-auto pb-20">
            {/* 页面头部 */}
            {isStandalone && (
                <div className="flex justify-between items-center mb-6 px-4">
                    <h1 className="text-2xl font-bold">{t('model.systemModelSettings')}</h1>
                    <Button variant="outline" onClick={loadData}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {t('model.refresh')}
                    </Button>
                </div>
            )}
            {!isStandalone && (
                <div className="flex ml-6 items-center gap-x-3 mb-4">
                    <span>{t('model.systemModelSettings')}</span>
                </div>
            )}
            <div className="px-4">
                <Tabs defaultValue="workbench" className="flex flex-col">
                    <TabsList className="w-[550px] m-auto">
                        <TabsTrigger value="workbench" className="w-[150px]">{t('model.workModel')}</TabsTrigger>
                        <TabsTrigger value="knowledge" className="w-[150px]">{t('model.knowledgeBaseModel')}</TabsTrigger>
                        <TabsTrigger value="assis" className="w-[150px]">{t('model.assistantModel')}</TabsTrigger>
                        <TabsTrigger value="evaluation" className="w-[150px]">{t('model.evaluationModel')}</TabsTrigger>
                        <TabsTrigger value="workflow" className="w-[150px]">{t('model.workflowModel')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="workbench">
                        <WorkbenchModel llmOptions={llmOptions} embeddings={embeddings} asrModel={asrModel} ttsModel={ttsModel} onBack={handleBack}></WorkbenchModel>
                    </TabsContent>
                    <TabsContent value="knowledge">
                        <KnowledgeModle llmOptions={llmOptions} embeddings={embeddings} onBack={handleBack}></KnowledgeModle>
                    </TabsContent>
                    <TabsContent value="assis">
                        <AssisModel llmOptions={llmOptions} onBack={handleBack}></AssisModel>
                    </TabsContent>
                    <TabsContent value="evaluation">
                        <EvaluationModel llmOptions={llmOptions} onBack={handleBack}></EvaluationModel>
                    </TabsContent>
                    <TabsContent value="workflow">
                        <WorkflowModel llmOptions={llmOptions} onBack={handleBack}></WorkflowModel>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    </div>
}

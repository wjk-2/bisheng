import { Loader2, MessageSquare } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../../components/bs-ui/badge";
import { Button } from "../../../components/bs-ui/button";
import EditLabel from "../../../components/bs-ui/editLabel";
import { alertContext } from "../../../contexts/alertContext";
import { getModelInfoApi } from "../../../controllers/API";
import { cancelTaskApi, getTaskInfoApi, publishTaskApi, unPublishTaskApi, updataTaskNameApi, enableModelChatApi, getLLmServerDetail } from "../../../controllers/API/finetune";
import { captureAndAlertRequestErrorHoc } from "../../../controllers/request";
import { TaskDB } from "../../../types/api/finetune";
import FinetuneResult from "./FinetuneResult";
import { formatMilliseconds } from "../../../util/utils";
import { bsConfirm } from "@/components/bs-ui/alertDialog/useConfirm";
import { useToast } from "@/components/bs-ui/toast/use-toast";

export const enum TaskStatus {
    /** 训练中 */
    TRAINING_IN_PROGRESS = 1,
    /** 训练失败 */
    TRAINING_FAILED,
    /** 训练中止 */
    TASK_ABORTED,
    /** 训练成功 */
    TRAIN_SUCCESS,
    /** 训练成功 */
    PUBLISH_SUCCESS
}

// 徽章
export const BadgeView = ({ value }) => {
    const { t } = useTranslation('model')
    // 训练成功
    // return null
    const colors = ['', '', 'text-red-500', '', 'text-green-500', 'text-green-500']
    const texts = ['', t('finetune.trainingInProgress'), t('finetune.trainingFailed'), t('finetune.taskAborted'), t('finetune.trainingSuccess'), t('finetune.publishSuccess')]
    return <Badge size="sm" variant="secondary" className={`${colors[value]} break-keep`}>{texts[value]}</Badge>
}

const HeadButtonView = ({ name, status, online, onPublish, onUnPublish, onDelete, onStop, chatEnabled, onEnableChat, isAdmin = true, showPermissionDenied }) => {
    const { t } = useTranslation('model')
    const [loading, setLoading] = useState(false)

    const cancelPublish = async () => {
        if (online) {
            bsConfirm({
                desc: t('finetune.confirmCancelPublish'),
                async onOk(next) {
                    next()
                    setLoading(true)
                    await onUnPublish()
                    setLoading(false)
                }
            })
        } else {
            setLoading(true)
            await onUnPublish()
            setLoading(false)
        }
    }

    const handlePublish = async () => {
        if (!isAdmin) {
            showPermissionDenied()
            return
        }
        setLoading(true)
        await onPublish()
        setLoading(false)
    }

    const deleteClick = () => {
        if (!isAdmin) {
            showPermissionDenied()
            return
        }
        let tip = t('finetune.confirmDeleteModel', { name })
        if (online) {
            tip = t('finetune.confirmDeleteOnlineModel', { name })
        } else if (status === TaskStatus.PUBLISH_SUCCESS) {
            tip = t('finetune.confirmDeletePublishedModel', { name })
        }
        bsConfirm({
            desc: tip,
            onOk(next) {
                onDelete()
                next()
            }
        })
    }

    const stopClick = () => {
        if (!isAdmin) {
            showPermissionDenied()
            return
        }
        bsConfirm({
            desc: t('finetune.confirmStopTraining'),
            onOk(next) {
                onStop()
                next()
            }
        })
    }

    return <div className="absolute right-4 flex gap-2">
        {/* B++: 发布成功后显示启用到对话按钮 */}
        {status === TaskStatus.PUBLISH_SUCCESS && !chatEnabled && onEnableChat && (
            <Button size="sm" variant="outline" onClick={onEnableChat}>
                <MessageSquare className="w-3 h-3 mr-1" />{t('finetune.enableChat')}
            </Button>
        )}
        {status === TaskStatus.PUBLISH_SUCCESS && chatEnabled && (
            <Badge variant="default" className="h-8 flex items-center">
                <MessageSquare className="w-3 h-3 mr-1" />{t('finetune.chatAvailable')}
            </Badge>
        )}
        {status === TaskStatus.PUBLISH_SUCCESS ?
            <Button size="sm" disabled={loading} onClick={() => isAdmin ? cancelPublish() : showPermissionDenied()}>
                {loading && <Loader2 className="animate-spin mr-2" size={14} />}
                {t('finetune.cancelPublish')}
            </Button> :
            status === TaskStatus.TRAIN_SUCCESS ?
                <Button size="sm" disabled={loading} onClick={handlePublish}>
                    {loading && <Loader2 className="animate-spin mr-2" size={14} />}
                    {t('finetune.publish')}
                </Button> : null
        }
        {status === TaskStatus.TRAINING_IN_PROGRESS ?
            <Button size="sm" className="bg-red-400 hover:bg-red-500" onClick={stopClick}>{t('finetune.stop')}</Button> :
            <Button size="sm" className="bg-red-400 hover:bg-red-500" onClick={deleteClick}>{t('bs:delete')}</Button>
        }
    </div>
}




export default function FinetuneDetail({ id, onDelete, onStatusChange, isAdmin = true }) {
    const { t } = useTranslation('model')

    const { setSuccessData } = useContext(alertContext);
    const { message } = useToast()

    // 权限不足提示
    const showPermissionDenied = () => {
        message({ variant: 'warning', description: '暂无权限，请联系管理员' });
    };

    const [baseInfo, setBaseInfo] = useState<TaskDB>(null)

    // 上线状态
    const [online, setOnline] = useState(false)
    // B++: 对话启用状态
    const [chatEnabled, setChatEnabled] = useState(false)

    const getOnlineState = (modelId) => {
        if (modelId) {
            return getModelInfoApi(modelId).then((data) => {
                setOnline(data.status === '已上线')
            })
        }
    }

    // B++: 查询对话状态
    const checkChatEnabled = async (llmServerId: number) => {
        if (!llmServerId) return
        try {
            const serverDetail = await getLLmServerDetail(String(llmServerId))
            if (serverDetail?.models?.length) {
                const { getChatEnabledIdsApi } = await import("../../../controllers/API/finetune")
                const enabledIds = await getChatEnabledIdsApi().catch(() => [])
                const enabledSet = new Set((enabledIds || []).map(String))
                const isEnabled = serverDetail.models.some((m: any) => enabledSet.has(String(m.id)))
                setChatEnabled(isEnabled)
            }
        } catch (e) {
            // ignore
        }
    }

    useEffect(() => {
        captureAndAlertRequestErrorHoc(getTaskInfoApi(id).then((data) => {
            setBaseInfo(data.finetune)
            getOnlineState(data.finetune.model_id)
            // B++: 检查对话状态
            if (data.finetune.llm_server_id) {
                checkChatEnabled(data.finetune.llm_server_id)
            }
        }), (err) => {
            setBaseInfo(null)
        })
    }, [id])

    // B++: 启用微调模型到对话
    const handleEnableChat = async () => {
        if (!baseInfo?.llm_server_id) {
            message({ variant: 'error', description: '该模型未注册到 LLM 管理' })
            return
        }
        try {
            const serverDetail = await getLLmServerDetail(String(baseInfo.llm_server_id))
            const llmModel = serverDetail?.models?.find((m: any) => m.model_type === 'llm')
            if (llmModel) {
                await enableModelChatApi(llmModel.id, baseInfo.model_name)
                message({ variant: 'success', description: `${baseInfo.model_name} 已启用到对话` })
                setChatEnabled(true)
            } else {
                message({ variant: 'error', description: '未找到对应的 LLM 模型' })
            }
        } catch (error) {
            message({ variant: 'error', description: '启用到对话失败' })
        }
    }

    const handlePublish = async () => {
        const res = await captureAndAlertRequestErrorHoc(publishTaskApi(id))
        if (!res) return
        // 成功
        onStatusChange(TaskStatus.PUBLISH_SUCCESS)
        setBaseInfo({ ...baseInfo, status: TaskStatus.PUBLISH_SUCCESS })
        setSuccessData({ title: t('finetune.publishSuccess') })
        // B++: 发布后刷新任务信息以获取 llm_server_id
        setTimeout(async () => {
            const data = await getTaskInfoApi(id)
            if (data?.finetune?.llm_server_id) {
                setBaseInfo(data.finetune)
            }
        }, 1000)
    }

    const handleUnPublish = async () => {
        const res = await captureAndAlertRequestErrorHoc(unPublishTaskApi(id))
        if (!res) return
        onStatusChange(TaskStatus.TRAIN_SUCCESS)
        setBaseInfo({ ...baseInfo, status: TaskStatus.TRAIN_SUCCESS })
    }

    const handleStopTrain = async () => {
        const res = await captureAndAlertRequestErrorHoc(cancelTaskApi(id))
        if (!res) return

        onStatusChange(TaskStatus.TASK_ABORTED)
        return setBaseInfo({ ...baseInfo, status: TaskStatus.TASK_ABORTED })
    }

    const handleChangeName = async (name) => {
        const res = await captureAndAlertRequestErrorHoc(updataTaskNameApi(id, name))
        if (!res) return

        onStatusChange(baseInfo.status)
        setBaseInfo({ ...baseInfo, model_name: name })
    }

    if (!baseInfo) return <></>

    return <div>
        {/* <div>选择模型已查看详情</div> */}
        <HeadButtonView
            name={baseInfo.model_name}
            status={baseInfo.status}
            online={online}
            onPublish={handlePublish}
            onUnPublish={handleUnPublish}
            onDelete={onDelete}
            onStop={handleStopTrain}
            chatEnabled={chatEnabled}
            onEnableChat={baseInfo.llm_server_id ? handleEnableChat : undefined}
            isAdmin={isAdmin}
            showPermissionDenied={showPermissionDenied}
        ></HeadButtonView>
        <div className="border-b pb-4">
            <div className="flex gap-4 items-center">
                <EditLabel
                    rule={[
                        {
                            pattern: /^(?=.*[a-zA-Z])(?=.*\d)?[a-zA-Z\d_-]+$/,
                            message: t('finetune.enterModelName'),
                        }
                    ]}
                    str={baseInfo.model_name}
                    onChange={(model_name) => handleChangeName(model_name)}>
                    {(val) => <div className="text-lg font-semibold">{val}</div>}
                </EditLabel>
                <BadgeView value={baseInfo.status} />
            </div>
            <div className="flex gap-4 mt-4">
                <small className="text-sm font-medium leading-none text-gray-500">{t('finetune.taskId')}</small>
                <small className="text-sm font-medium leading-none text-gray-700">{baseInfo.id}</small>
            </div>
            <div className="flex gap-4 mt-4">
                <small className="text-sm font-medium leading-none text-gray-500">{t('finetune.baseModel')}</small>
                <small className="text-sm font-medium leading-none text-gray-700">{baseInfo.base_model_name}</small>
            </div>
        </div>
        <div className="border-b pb-4">
            <div className="flex gap-4 mt-4">
                <small className="text-sm font-medium leading-none text-gray-500">{t('bs:createTime')}</small>
                <small className="text-sm font-medium leading-none text-gray-700">{baseInfo.create_time.replace('T', ' ')}</small>
            </div>
            <div className="flex gap-4 mt-4">
                <small className="text-sm font-medium leading-none text-gray-500">{t('finetune.runtime')}</small>
                <small className="text-sm font-medium leading-none text-gray-700">
                    {TaskStatus.TRAINING_IN_PROGRESS === baseInfo.status ? '--' : formatMilliseconds(baseInfo.report?.train_runtime || 0, t('finetune.formatTime'))}
                </small>
            </div>
            <div className="flex gap-4 mt-4">
                <small className="text-sm font-medium leading-none text-gray-500">{t('finetune.creator')}</small>
                <small className="text-sm font-medium leading-none text-gray-700">{baseInfo.user_name}</small>
            </div>
        </div>
        <div className="border-b pb-4">
            <div className="flex gap-4 mt-4">
                <small className="text-sm font-medium leading-none text-gray-500">{t('finetune.dataset')}</small>
                <small className="text-sm font-medium leading-none text-gray-700">{
                    baseInfo.preset_data.concat(baseInfo.train_data).map(el => el.name).join(',')
                }</small>
            </div>
        </div>
        <FinetuneResult
            id={id}
            isStop={TaskStatus.TASK_ABORTED === baseInfo.status}
            training={TaskStatus.TRAINING_IN_PROGRESS === baseInfo.status}
            failed={TaskStatus.TRAINING_FAILED === baseInfo.status}
            onChange={status => {
                setBaseInfo({ ...baseInfo, status });
                onStatusChange(status)
            }}
        ></FinetuneResult>
    </div>
};

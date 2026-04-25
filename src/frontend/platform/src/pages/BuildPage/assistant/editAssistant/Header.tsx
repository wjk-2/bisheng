import AppAvator from "@/components/bs-comp/cardComponent/avatar";
import { Button } from "@/components/bs-ui/button";
import { Dialog, DialogTrigger } from "@/components/bs-ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/bs-ui/tooltip";
import OnlineConfirmModal from "@/components/OnlineConfirmModal";
import { useAssistantStore } from "@/store/assistantStore";
import { OnlineState } from "@/types/flow";
import { ChevronLeft, SquarePen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import EditAssistantDialog from "./EditAssistantDialog";

export default function Header({ loca, onSave, onLine, onTabChange }) {
    const { t } = useTranslation()
    const navigate = useNavigate()

    const { assistantState, dispatchAssistant } = useAssistantStore()
    {/* Edit assistant */ }
    const [editShow, setEditShow] = useState(false);
    const [onlineModalShow, setOnlineModalShow] = useState(false);
    const [onlineLoading, setOnlineLoading] = useState(false);

    const needSaveRef = useRef(false)
    useEffect(() => {
        if (needSaveRef.current) {
            needSaveRef.current = false
            onSave()
        }
    }, [assistantState])
    const handleEditSave = (form) => {
        dispatchAssistant('setBaseInfo', form)
        setEditShow(false)
        needSaveRef.current = true
    }

    // 处理上线确认
    const handleOnlineConfirm = async (isPublic: number, category: string) => {
        setOnlineLoading(true);
        try {
            await onLine(true, isPublic, category); // 传递isPublic(0/1/2)和category参数
            setOnlineModalShow(false);
        } finally {
            setOnlineLoading(false);
        }
    };

    // 处理上线/下线按钮点击
    const handleOnlineClick = () => {
        if (assistantState.status === OnlineState.OffLine) {
            // 上线时显示选择弹窗
            setOnlineModalShow(true);
        } else {
            // 下线时直接操作
            onLine(false, assistantState.is_public || 0);
        }
    };

    const [tabType, setTabType] = useState('edit')
    return (
        <div className="flex justify-between bg-background-login items-center border-b px-4">
        <div className="flex items-center gap-2 py-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <AppAvator id={assistantState.name} url={assistantState.viewLogo || assistantState.logo} flowType={5} className="ml-4"></AppAvator>
            <span id="app-title" className="eagent-title">{assistantState.name}</span>
            {/* edit dialog */}
            <Dialog open={editShow} onOpenChange={setEditShow}>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon"><SquarePen className="w-4 h-4" /></Button>
                </DialogTrigger>
                {
                    editShow && <EditAssistantDialog
                        logo={assistantState.logo || ''}
                        viewLogo={assistantState.viewLogo || ''}
                        name={assistantState.name}
                        desc={assistantState.desc}
                        onSave={handleEditSave}
                        loca={loca}
                    ></EditAssistantDialog>
                }
            </Dialog>
        </div>
        <div className="flex gap-4 items-center">
            <div
                className={`${tabType === 'edit' ? 'text-primary' : ''} hover:bg-secondary px-4 py-1 rounded-md cursor-pointer`}
                onClick={() => { setTabType('edit'); onTabChange('edit') }}
            >{t('api.assistantOrchestration')}</div>
            <div
                className={`${tabType === 'api' ? 'text-primary' : ''} hover:bg-secondary px-4 py-1 rounded-md cursor-pointer`}
                onClick={() => { setTabType('api'); onTabChange('api') }}
            >{t('api.externalPublishing')}</div>
        </div>
        <div className="flex gap-4">
            <Button variant="outline" className="px-10" type="button" onClick={onSave}>{t('build.save')}</Button>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="submit"
                            className="px-10"
                            onClick={handleOnlineClick}
                        >
                            {assistantState.status === OnlineState.OnLine ? t('build.offline') : t('build.online')}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>
                            {assistantState.status === OnlineState.OnLine
                                ? '下线后，应用将从工作台广场移除'
                                : '上线后，应用可在工作台广场使用'}
                        </p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>

        {/* 上线选择弹窗 */}
        <OnlineConfirmModal
            visible={onlineModalShow}
            loading={onlineLoading}
            onConfirm={handleOnlineConfirm}
            onCancel={() => setOnlineModalShow(false)}
        />
    </div>
    );
}
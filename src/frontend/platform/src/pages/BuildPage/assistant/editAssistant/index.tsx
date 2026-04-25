import ApiMainPage from "@/components/bs-comp/apiComponent";
import { useMessageStore } from "@/components/bs-comp/chatComponent/messageStore";
import { Button } from "@/components/bs-ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/bs-ui/dialog";
import { useToast } from "@/components/bs-ui/toast/use-toast";
import { changeAssistantStatusApi, saveAssistanttApi } from "@/controllers/API/assistant";
import { checkAppEditPermission } from "@/controllers/API/flow";
import { captureAndAlertRequestErrorHoc } from "@/controllers/request";
import { useAssistantStore } from "@/store/assistantStore";
import { OnlineState } from "@/types/flow";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { unstable_useBlocker as useBlocker, useLocation, useNavigate, useParams } from "react-router-dom";
import Header from "./Header";
import Prompt from "./Prompt";
import Setting from "./Setting";
import TestChat from "./TestChat";

export default function editAssistant() {
    const { t } = useTranslation()
    const { id: assisId } = useParams()
    const navigate = useNavigate()
    const { state } = useLocation();
    const loca = state?.flow; // Get the passed flow data

    // assistant data
    const { assistantState, changed, loadAssistantState, changeStatus, saveAfter, destroy } = useAssistantStore()
    const { startNewRound, insetSystemMsg, insetBsMsg, destory, setShowGuideQuestion } = useMessageStore()
    const [checking, setChecking] = useState(true)

    const flowInit = async () => {
        await checkAppEditPermission(assisId, 5)

        loadAssistantState(assisId, 'v1').then((res) => {
            setChecking(false)
            setShowGuideQuestion(true)
            setGuideQuestion(res.guide_question?.filter((item) => item) || [])
            res.guide_word && insetBsMsg(res.guide_word)
        })
    }

    useEffect(() => {
        flowInit()
    }, [])

    // Store displayed guide words independently
    const [guideQuestion, setGuideQuestion] = useState([])
    const [openChat, setOpenChat] = useState(true)
    const handleStartChat = async (save) => {
        if (!handleCheck()) return
        destory()
        setOpenChat(false)
        save ? await handleSave(true) : await new Promise((resolve) => setTimeout(resolve, 0))
        saveAfter()
        startNewRound(t('build.configurationUpdated'))
        setGuideQuestion(assistantState.guide_question.filter((item) => item))
        assistantState.guide_word && insetBsMsg(assistantState.guide_word)
        setOpenChat(true)
    }

    const { message, toast } = useToast()
    // Save assistant details
    const handleSave = async (showMessage = false) => {
        if (!handleCheck()) return
        await captureAndAlertRequestErrorHoc(saveAssistanttApi({
            ...assistantState,
            flow_list: assistantState.flow_list.map(item => item.id),
            tool_list: assistantState.tool_list.map(item => item.id),
            knowledge_list: assistantState.knowledge_list.map(item => item.id),
            guide_question: assistantState.guide_question.filter((item) => item),
            logo: assistantState.viewLogo ? assistantState.logo : '',
        })).then(res => {
            if (!res) return
            showMessage && message({
                title: t('prompt'),
                variant: 'success',
                description: t('skills.saveSuccessful')
            })
        })
        saveAfter()
    }

    // Publish assistant online
    // isPublic: 0=仅自己, 1=组内, 2=全部
    const handleOnline = async (online, isPublic: number = 0, category: string = '其他') => {
        if (!handleCheck()) return
        if (online) {
            await handleSave()
            // 上线时传递 is_public(0/1/2) 和 category 参数
            await captureAndAlertRequestErrorHoc(changeAssistantStatusApi(assistantState.id, 2, isPublic, category)).then(res => {
                if (res === false) return
                const publicText = isPublic === 2 ? '已公开发布到广场' : isPublic === 1 ? '已发布到组内' : '已发布（仅自己可见）';
                message({
                    title: t('prompt'),
                    variant: 'success',
                    description: publicText
                })
            })
            setTimeout(() => {
                navigate('/build')
            }, 1200);
        } else {
            // 下线时保留原有的 is_public 和 category 状态
            captureAndAlertRequestErrorHoc(changeAssistantStatusApi(assistantState.id, 1, assistantState.is_public || 0, assistantState.category || '其他')).then(res => {
                if (res === false) return
                changeStatus(1)
            })
        }
    }

    // Validate assistant data
    const handleCheck = () => {
        const errors = []
        if (
            assistantState.max_token === undefined ||
            !Number.isInteger(assistantState.max_token) ||
            assistantState.max_token < 0 ||
            assistantState.max_token > 100 * 10000
        ) {
            errors.push(t('skills.chatHistoryMaxToken'));
        }
        if (!assistantState.model_name) {
            errors.push(t('build.modelRequired'))
        }
        if (assistantState.guide_question.some(que => que.length > 50)) {
            errors.push(t('skills.guideQuestions50'))
        }
        if (assistantState.guide_word.length > 1000) {
            errors.push(t('skills.promptWords1000'))
        }

        if (errors.length) {
            message({
                title: t('prompt'),
                variant: 'error',
                description: errors
            })
            return false
        }
        return true
    }

    // Cleanup
    useEffect(() => {
        return destroy
    }, [])

    const [showApiPage, setShowApiPage] = useState(false)
    // Save on leave
    const blocker = useBeforeUnload(changed, checking)
    const handleSaveAndClose = async () => {
        await handleSave(true)
        blocker.proceed?.()
    }

    if (checking) return null

    return <div className="bg-background-main">
        <Header loca={loca} onSave={() => handleSave(true)} onLine={handleOnline} onTabChange={(t) => setShowApiPage(t === 'api')}></Header>
        <div className="h-[calc(100vh-70px)]">
            <div className={`flex h-full ${showApiPage ? 'hidden' : ''}`}>
                <div className="w-[60%]">
                    <div className="text-md font-medium leading-none p-4 shadow-sm">{t('build.assistantConfiguration')}</div>
                    <div className="flex h-[calc(100vh-120px)]">
                        <Prompt></Prompt>
                        <Setting></Setting>
                    </div>
                </div>
                <div className="w-[40%] h-full bg-[#fff] dark:bg-background-main relative">
                    {openChat && <TestChat guideQuestion={guideQuestion} assisId={assisId} onClear={() => handleStartChat(false)}></TestChat>}
                    {/* Mask button triggered by changes to save */}
                    {changed && <div className="absolute w-full bottom-0 h-60" onClick={() => handleStartChat(true)}></div>}
                </div>
            </div>
            <div className={`h-full ${showApiPage ? '' : 'hidden'}`}>
                <ApiMainPage />
            </div>
        </div>
        <Dialog open={blocker.state === "blocked"}>
            <DialogContent className="sm:max-w-[425px]" close={false}>
                <DialogHeader>
                    <DialogTitle>{t('prompt')}</DialogTitle>
                    <DialogDescription>{assistantState.status === OnlineState.OnLine ? t('build.assistantOnlineNoEdit') : t('build.unsavedChangesLeave')}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    {
                        assistantState.status !== OnlineState.OnLine && <Button className="leave h-8" onClick={handleSaveAndClose}>
                            {t('build.leaveAndSave')}
                        </Button>
                    }
                    <Button className="h-8" variant="destructive" onClick={() => blocker.proceed?.()}>
                        {t('build.leaveWithoutSave')}
                    </Button>
                    <Button className="h-8" variant="outline" onClick={() => {
                        blocker.reset?.()
                    }}>
                        {t('cancel')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
};


// Save prompt when leaving page
const useBeforeUnload = (changed, checking) => {
    const { t } = useTranslation()

    // Prompt to save when leaving
    useEffect(() => {
        if (checking) return // Don't prompt when checking permissions
        const fun = (e) => {
            var confirmationMessage = `${t('flow.unsavedChangesConfirmation')}`;
            (e || window.event).returnValue = confirmationMessage; // Compatible with different browsers
            return confirmationMessage;
        }
        window.addEventListener('beforeunload', fun);
        return () => { window.removeEventListener('beforeunload', fun) }
    }, [checking])

    return useBlocker(changed);
}
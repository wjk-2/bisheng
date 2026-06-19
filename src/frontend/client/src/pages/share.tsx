
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getShareParamsApi } from "~/api";
import request from "~/api/request";
import ChatView from "~/components/Chat/ChatView";
import Sop from "~/components/Sop";
import AppChat from "./appChat";
import { generateUUID } from "~/utils";

const Apptypes = {
    'skill': 1,
    'assistant': 5,
    'workflow': 10
}

// 密码验证页
function PasswordGate({ shareToken, onPass }: { shareToken: string; onPass: () => void }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length !== 6) {
            setError('请输入6位密码');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await request.post('/api/v1/share-link/verify_password', {
                share_token: shareToken,
                password,
            });
            onPass();
        } catch {
            setError('密码错误，请重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-full w-full items-center justify-center bg-background">
            <div className="w-80 rounded-xl border border-border bg-card p-8 shadow-md">
                <h2 className="mb-1 text-center text-lg font-semibold">访问验证</h2>
                <p className="mb-6 text-center text-sm text-muted-foreground">该内容已加密，请输入6位访问密码</p>
                <form onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={password}
                        onChange={e => setPassword(e.target.value.slice(0, 6))}
                        placeholder="请输入6位密码"
                        maxLength={6}
                        className="mb-3 w-full rounded-md border border-input bg-background px-3 py-2 text-center text-lg tracking-widest outline-none focus:ring-2 focus:ring-primary"
                    />
                    {error && (
                        <p className="mb-3 text-center text-sm text-red-500">{error}</p>
                    )}
                    <button
                        type="submit"
                        disabled={loading || password.length !== 6}
                        className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
                    >
                        {loading ? '验证中...' : '确认访问'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// 同一 share 链接在同一浏览器内复用同一 chatId，保证会话连续性
function getOrCreateShareChatId(shareToken: string): string {
    const key = `share_chat_id_${shareToken}`
    let chatId = sessionStorage.getItem(key)
    if (!chatId) {
        chatId = generateUUID(32)
        sessionStorage.setItem(key, chatId)
    }
    return chatId
}

export default function Share() {
    const { token: shareToken, vid } = useParams()
    const [type, setType] = useState('')
    const [shareInfo, setShareInfo] = useState<any>(null)
    const [hasPassword, setHasPassword] = useState(false)
    const [passwordPassed, setPasswordPassed] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        getShareParamsApi(shareToken).then((res: any) => {
            if (res.status_code === 404) {
                return navigate('/404', { replace: true })
            }
            setType(res.data.resource_type?.toLowerCase())
            setShareInfo(res.data)
            setHasPassword(!!res.data.has_password)
        })
    }, [])

    if (!shareInfo) return null

    // 有密码且未通过验证，显示密码输入页
    if (hasPassword && !passwordPassed) {
        return (
            <div className="h-screen w-screen overflow-hidden">
                <PasswordGate shareToken={shareToken!} onPass={() => setPasswordPassed(true)} />
            </div>
        )
    }

    switch (type) {
        case 'linsight_session':
            return (
                <div className="h-screen w-screen overflow-hidden">
                    <Sop id={shareInfo.resource_id} vid={vid} shareToken={shareToken} />
                </div>
            )
        case 'workbench_chat':
            return (
                <div className="h-screen w-screen overflow-hidden">
                    <ChatView id={shareInfo.resource_id} shareToken={shareToken} />
                </div>
            )
        case 'workflow':
            // workflow 每次访问都生成新 chatId，确保 isNew=true，input 节点正确推送 dialog_input
            return (
                <div className="h-screen w-screen overflow-hidden">
                    <AppChat
                        chatId={generateUUID(32)}
                        flowId={shareInfo.meta_data.flowId}
                        shareToken={shareToken}
                        flowType={Apptypes[type]}
                    />
                </div>
            )
        default:
            return (
                <div className="h-screen w-screen overflow-hidden">
                    <AppChat
                        chatId={getOrCreateShareChatId(shareToken!)}
                        flowId={shareInfo.meta_data.flowId}
                        shareToken={shareToken}
                        flowType={Apptypes[type]}
                    />
                </div>
            )
    }
};

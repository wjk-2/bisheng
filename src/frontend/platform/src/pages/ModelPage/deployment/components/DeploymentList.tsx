import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/bs-ui/table";
import { Button } from "@/components/bs-ui/button";
import { Badge } from "@/components/bs-ui/badge";
import { useTranslation } from "react-i18next";
import { Eye, MessageSquare, Play, Square, Trash2 } from "lucide-react";
import { useToast } from "@/components/bs-ui/toast/use-toast";
import { enableModelChatApi, getLLmServerDetail } from "@/controllers/API/finetune";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/bs-ui/alertDialog";

import {
    startDeploymentApi,
    stopDeploymentApi,
    deleteDeploymentApi,
} from "@/controllers/API/deployment";

interface Deployment {
    id: string;
    modelId?: string;
    name: string;
    modelName: string;
    source?: string;
    modelScopeModelId?: string;
    status: 'running' | 'stopped' | 'pending' | 'paused' | 'error';
    replicas: number;
    readyReplicas?: number;
    gpu?: string | number | null;
    memory?: string | null;
    createdAt: string;
    endpoint: string;
    llm_registered?: boolean;
    llm_server_id?: number;
}

interface DeploymentListProps {
    deployments: Deployment[];
    onViewDetail: (id: string) => void;
    onRefresh: () => void;
    chatEnabledIds?: Set<string>;
    isAdmin?: boolean;
}

export default function DeploymentList({ deployments, onViewDetail, onRefresh, chatEnabledIds = new Set(), isAdmin = true }: DeploymentListProps) {
    const { t } = useTranslation('model');
    const { message } = useToast();
    const [confirmContext, setConfirmContext] = useState<{ type: 'stop' | 'delete'; deployment: Deployment } | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);

    // 权限不足提示
    const showPermissionDenied = () => {
        message({ variant: 'warning', description: '暂无权限，请联系管理员' });
    };

    // B++: 启用部署模型到对话
    const handleEnableChat = async (deployment: Deployment) => {
        if (!deployment.llm_server_id) {
            message({ variant: 'error', description: '该部署未注册到模型管理' });
            return;
        }
        try {
            const serverDetail = await getLLmServerDetail(String(deployment.llm_server_id));
            const llmModel = serverDetail?.models?.find((m: any) => m.model_type === 'llm');
            if (llmModel) {
                await enableModelChatApi(llmModel.id, deployment.name);
                message({ variant: 'success', description: `${deployment.name} 已启用到对话` });
                onRefresh();
            } else {
                message({ variant: 'error', description: '未找到对应的 LLM 模型' });
            }
        } catch (error) {
            message({ variant: 'error', description: '启用到对话失败' });
        }
    };

    const getStatusBadge = (status: string) => {
        const statusConfig = {
            running: { variant: 'success' as const, label: t('model.statusRunning') },
            stopped: { variant: 'secondary' as const, label: t('model.statusStopped') },
            pending: { variant: 'warning' as const, label: t('model.statusPending') },
            paused: { variant: 'secondary' as const, label: t('model.statusPaused') },
            error: { variant: 'destructive' as const, label: t('model.statusError') }
        };

        const normalizedStatus = status.toLowerCase();
        const config = statusConfig[normalizedStatus] || statusConfig.error;
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    const handleStart = async (deployment: Deployment) => {
        try {
            await startDeploymentApi(deployment.modelId || deployment.id);
            message({
                variant: 'success',
                description: t('model.deploymentStarting', { name: deployment.name })
            });
            onRefresh();
        } catch (error) {
            message({
                variant: 'error',
                description: t('model.deploymentStartFailed')
            });
        }
    };

    const openConfirm = (type: 'stop' | 'delete', deployment: Deployment) => {
        setConfirmContext({ type, deployment });
    };

    const closeConfirm = () => {
        if (confirmLoading) return;
        setConfirmContext(null);
    };

    const confirmDialogContent = useMemo(() => {
        if (!confirmContext) return null;
        const name = confirmContext.deployment.name;
        if (confirmContext.type === 'stop') {
            return {
                title: t('model.confirmStopTitle', { name }),
                description: t('model.confirmStopDescription', { defaultValue: '停止后将释放计算资源，可随时重新启动。' }),
                confirmText: t('model.confirm'),
            };
        }
        return {
            title: t('model.confirmDeleteTitle', { name }),
            description: t('model.confirmDeleteDescription', { defaultValue: '删除后将无法恢复，该部署的访问地址会立即失效。' }),
            confirmText: t('model.confirm'),
        };
    }, [confirmContext, t]);

    const handleConfirmAction = async () => {
        if (!confirmContext) return;
        const { type, deployment } = confirmContext;
        setConfirmLoading(true);
        try {
            if (type === 'stop') {
                await stopDeploymentApi(deployment.modelId || deployment.id);
                message({
                    variant: 'success',
                    description: t('model.deploymentStopping', { name: deployment.name })
                });
            } else {
                await deleteDeploymentApi(deployment.modelId || deployment.id);
                message({
                    variant: 'success',
                    description: t('model.deploymentDeleted', { name: deployment.name })
                });
            }
            onRefresh();
        } catch (error) {
            const errorMessage = type === 'stop' ? t('model.deploymentStopFailed') : t('model.deploymentDeleteFailed');
            message({
                variant: 'error',
                description: errorMessage
            });
        } finally {
            setConfirmLoading(false);
            setConfirmContext(null);
        }
    };

    return (
        <div className="px-4">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t('model.deploymentName')}</TableHead>
                        <TableHead>{t('model.modelName')}</TableHead>
                        <TableHead>{t('model.source')}</TableHead>
                        <TableHead>{t('model.status')}</TableHead>
                        <TableHead>对话状态</TableHead>
                        <TableHead>{t('model.createdTime')}</TableHead>
                        <TableHead className="text-right">{t('model.actions')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {deployments.map((deployment) => {
                        const statusKey = (deployment.status ?? '').toLowerCase();
                        const canStart = statusKey === 'stopped' || statusKey === 'paused';
                        const canStop = statusKey === 'running';

                        return (
                            <TableRow key={deployment.id}>
                                <TableCell className="font-medium">{deployment.name}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span>{deployment.modelName}</span>
                                        {deployment.modelScopeModelId && (
                                            <span className="text-xs text-muted-foreground">{deployment.modelScopeModelId}</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <span>{deployment.source || 'model_scope'}</span>
                                    </div>
                                </TableCell>
                                <TableCell>{getStatusBadge(statusKey)}</TableCell>
                                <TableCell>
                                    {(() => {
                                        // B++: 对话状态列
                                        if (!deployment.llm_registered) {
                                            return <Badge variant="secondary">未注册</Badge>;
                                        }
                                        // 通过 deployment.chat_enabled 判断是否已启用到对话
                                        if (deployment.chat_enabled) {
                                            return <Badge variant="default"><MessageSquare className="w-3 h-3 mr-1" />对话可用</Badge>;
                                        }
                                        if (statusKey === 'running' && deployment.llm_server_id && deployment.llm_model_type !== 'embedding') {
                                            return (
                                                <Button variant="outline" size="sm" className="h-7 text-xs"
                                                    onClick={() => handleEnableChat(deployment)}>
                                                    启用到对话
                                                </Button>
                                            );
                                        }
                                        if (deployment.llm_model_type === 'embedding') {
                                            return <Badge variant="secondary">向量模型</Badge>;
                                        }
                                        return <Badge variant="secondary">已注册</Badge>;
                                    })()}
                                </TableCell>
                                <TableCell>{deployment.createdAt}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onViewDetail(deployment.id)}
                                            title={t('model.viewDetail')}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        {canStart ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => isAdmin ? handleStart(deployment) : showPermissionDenied()}
                                                title={t('model.start')}
                                            >
                                                <Play className="h-4 w-4" />
                                            </Button>
                                        ) : canStop ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => isAdmin ? openConfirm('stop', deployment) : showPermissionDenied()}
                                                title={t('model.stop')}
                                            >
                                                <Square className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => isAdmin ? openConfirm('delete', deployment) : showPermissionDenied()}
                                            title={t('model.delete')}
                                            className="text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            {deployments.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <p>{t('model.noDeployments')}</p>
                </div>
            )}

            <AlertDialog open={!!confirmContext} onOpenChange={(open) => (open ? null : closeConfirm())}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirmDialogContent?.title}</AlertDialogTitle>
                        <AlertDialogDescription>{confirmDialogContent?.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={closeConfirm} disabled={confirmLoading}>
                            {t('model.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault();
                                handleConfirmAction();
                            }}
                            disabled={confirmLoading}
                        >
                            {confirmLoading ? t('model.processing', { defaultValue: '处理中...' }) : (confirmDialogContent?.confirmText ?? t('model.confirm'))}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

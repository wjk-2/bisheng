import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/bs-ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { useToast } from "@/components/bs-ui/toast/use-toast";
import DeploymentList from "./components/DeploymentList";
import CreateDeployment from "./components/CreateDeployment";
import DeploymentDetail from "./components/DeploymentDetail";
import { LoadingIcon } from "@/components/bs-icons/loading";
import { getDeploymentListApi } from "@/controllers/API/deployment";
import { getChatEnabledIdsApi, getLLmServerDetail } from "@/controllers/API/finetune";
import { userContext } from "@/contexts/userContext";

enum ViewMode {
    LIST = 'list',
    CREATE = 'create',
    DETAIL = 'detail'
}

export default function Deployment() {
    const { t, i18n } = useTranslation('model');
    const navigate = useNavigate();
    const { user } = useContext(userContext);
    const isAdmin = user?.role === 'admin';
    const { message } = useToast();

    // 权限不足提示
    const showPermissionDenied = () => {
        message({ variant: 'warning', description: '暂无权限，请联系管理员' });
    };

    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.LIST);
    const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [deployments, setDeployments] = useState([]);
    // B++: 已启用对话的 model_id 集合
    const [chatEnabledIds, setChatEnabledIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        i18n.loadNamespaces('model');
    }, [i18n]);

    const loadDeployments = useCallback(async () => {
        setLoading(true);
        try {
            // B++: 并行获取部署列表和已启用对话的 ID 列表
            const [response, enabledIds] = await Promise.all([
                getDeploymentListApi(),
                getChatEnabledIdsApi().catch(() => [])
            ]);
            const enabledSet = new Set((enabledIds || []).map(String));
            setChatEnabledIds(enabledSet);

            const items = Array.isArray(response?.items) ? response.items : [];
            const normalized = items.map((item: any) => {
                const d = {
                    ...item,
                    modelId: item.modelId || item.modelID || item.model_id || item.id,
                    createdAt: item.createdAt || item.created_at,
                    updatedAt: item.updatedAt || item.updated_at,
                    modelName: item.modelName || item.model_name || item.name,
                    readyReplicas: item.readyReplicas ?? item.ready_replicas ?? 0,
                    replicas: item.replicas ?? item.desiredReplicas ?? item.desired_replicas ?? 0,
                    chat_enabled: false,
                };
                // B++: 如果 llm_server_id 存在，异步标记 chat_enabled 待处理
                // 简单方案：后端 batch_sync_and_annotate 已返回 llm_server_id
                // 通过 llm_server_id 关联判断需要更复杂的逻辑，此处先标记
                return d;
            });
            setDeployments(normalized);
        } catch (error) {
            console.error('Failed to load deployments:', error);
            setDeployments([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDeployments();
    }, [loadDeployments]);

    const hasInProgress = useMemo(() => {
        if (!Array.isArray(deployments) || deployments.length === 0) return false;
        return deployments.some((item: any) => {
            const status = (item?.status ?? "").toLowerCase();
            if (status === "pending" || status === "paused") {
                return true;
            }
            const desired = Number(item?.replicas ?? item?.desiredReplicas ?? item?.desired_replicas ?? 0);
            const ready = Number(item?.readyReplicas ?? item?.ready_replicas ?? item?.running_replicas ?? 0);
            return desired > 0 && ready < desired;
        });
    }, [deployments]);

    useEffect(() => {
        if (viewMode !== ViewMode.LIST || !hasInProgress) {
            return;
        }
        const timer = setInterval(() => {
            loadDeployments();
        }, 5000);
        return () => clearInterval(timer);
    }, [viewMode, hasInProgress, loadDeployments]);

    const handleCreateDeployment = () => {
        setViewMode(ViewMode.CREATE);
    };

    const handleViewDetail = (deploymentId: string) => {
        setSelectedDeploymentId(deploymentId);
        setViewMode(ViewMode.DETAIL);
    };

    const handleBack = () => {
        setViewMode(ViewMode.LIST);
        setSelectedDeploymentId(null);
        loadDeployments();
    };

    const handleDeploymentCreated = () => {
        setViewMode(ViewMode.LIST);
        loadDeployments();
    };

    if (viewMode === ViewMode.CREATE) {
        return <CreateDeployment onBack={handleBack} onSuccess={handleDeploymentCreated} />;
    }

    if (viewMode === ViewMode.DETAIL && selectedDeploymentId) {
        return <DeploymentDetail deploymentId={selectedDeploymentId} onBack={handleBack} />;
    }

    return (
        <div className="relative h-full px-2 py-4">
            {loading && (
                <div className="absolute left-0 top-0 z-10 flex h-full w-full items-center justify-center bg-[rgba(255,255,255,0.6)] dark:bg-blur-shared">
                    <LoadingIcon />
                </div>
            )}
            
            <div className="h-full overflow-y-auto">
                {/* 页面头部 */}
                <div className="flex justify-between items-center mb-6 px-4">
                    <h1 className="text-2xl font-semibold text-[#140E35]">{t('model.modelDeployment')}</h1>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={loadDeployments}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            {t('model.refresh')}
                        </Button>
                        <Button onClick={() => isAdmin ? handleCreateDeployment() : showPermissionDenied()}>
                            <Plus className="w-4 h-4 mr-2" />
                            {t('model.createDeployment')}
                        </Button>
                    </div>
                </div>

                {/* 部署列表 */}
                <DeploymentList
                    deployments={deployments}
                    onViewDetail={handleViewDetail}
                    onRefresh={loadDeployments}
                    chatEnabledIds={chatEnabledIds}
                    isAdmin={isAdmin}
                />
            </div>

            {/* 页脚说明 */}
            <div className="eagent-table-footer px-6">
                <p className="desc">{t('model.deploymentCaption')}</p>
            </div>
        </div>
    );
}

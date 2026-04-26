import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/bs-ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/bs-ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/bs-ui/tabs";
import { Badge } from "@/components/bs-ui/badge";
import { ArrowLeft, RefreshCw, Copy, Terminal, Activity, Settings, FileText } from "lucide-react";
import { useToast } from "@/components/bs-ui/toast/use-toast";
import { LoadingIcon } from "@/components/bs-icons/loading";
import ResourceMonitor from "./ResourceMonitor";
import DeploymentLogs from "./DeploymentLogs";
import { getDeploymentDetailApi } from "@/controllers/API/deployment";

interface DeploymentDetailProps {
    deploymentId: string;
    onBack: () => void;
}

interface DeploymentInfo {
    id: string;
    name: string;
    modelName: string;
    status: 'running' | 'stopped' | 'pending' | 'paused' | 'error';
    replicas: number;
    readyReplicas: number;
    gpu?: string | number | null;
    memory?: string | null;
    cpuCores?: string | number | null;
    createdAt: string;
    updatedAt: string;
    endpoint: string;
    backendType: string;
    backendVersion?: string | null;
    description: string;
    source?: string | null;
    modelScopeModelId?: string | null;
    instances: Array<{
        id: string;
        name: string;
        status: string;
        node: string;
        gpu: string;
        memory: string;
        cpu: string;
        startTime: string;
    }>;
}

export default function DeploymentDetail({ deploymentId, onBack }: DeploymentDetailProps) {
    const { t } = useTranslation('model');
    const { message } = useToast();
    const [loading, setLoading] = useState(true);
    const [deployment, setDeployment] = useState<DeploymentInfo | null>(null);
    const [activeTab, setActiveTab] = useState("overview");

    useEffect(() => {
        loadDeploymentDetail();
    }, [deploymentId]);

    const loadDeploymentDetail = async () => {
        setLoading(true);
        try {
            const data = await getDeploymentDetailApi(deploymentId);
            setDeployment(data);
        } catch (error) {
            console.error('Failed to load deployment detail:', error);
            message({
                variant: 'error',
                description: t('model.loadDeploymentDetailFailed')
            });
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        message({
            variant: 'success',
            description: t('model.copiedToClipboard')
        });
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

    const instancesToRender = useMemo(() => {
        if (!deployment) return [];
        if (Array.isArray(deployment.instances) && deployment.instances.length > 0) {
            return deployment.instances;
        }
        if (deployment.status === 'stopped' || deployment.status === 'paused') {
            return [
                {
                    id: `${deployment.id}-${deployment.status}`,
                    name: deployment.name,
                    status: deployment.status,
                    node: '-',
                    gpu: typeof deployment.gpu === 'number' ? `${deployment.gpu} GPUs` : (deployment.gpu ?? '-'),
                    memory: deployment.memory ?? '-',
                    cpu: deployment.cpuCores ? `${deployment.cpuCores} cores` : '-',
                    startTime: deployment.updatedAt,
                },
            ];
        }
        return [];
    }, [deployment]);

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <LoadingIcon />
            </div>
        );
    }

    if (!deployment) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <p>{t('model.deploymentNotFound')}</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto p-6">
                {/* 页面头部 */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={onBack}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-medium text-[#140E35]">{deployment.name}</h1>
                            <p className="text-muted-foreground">{deployment.description}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {getStatusBadge(deployment.status)}
                        <Button variant="outline" size="sm" onClick={loadDeploymentDetail}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* 主要内容区域 */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="overview" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {t('model.overview')}
                        </TabsTrigger>
                        <TabsTrigger value="instances" className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            {t('model.instances')}
                        </TabsTrigger>
                        <TabsTrigger value="monitoring" className="flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            {t('model.monitoring')}
                        </TabsTrigger>
                        <TabsTrigger value="logs" className="flex items-center gap-2">
                            <Terminal className="h-4 w-4" />
                            {t('model.logs')}
                        </TabsTrigger>
                    </TabsList>

                    {/* 概览标签页 */}
                    <TabsContent value="overview" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t('model.deploymentInfo')}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('model.modelName')}</span>
                                        <span className="font-medium">{deployment.modelName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('model.backend')}</span>
                                        <span className="font-medium">{deployment.backendType} ({deployment.backendVersion ?? 'latest'})</span>
                                    </div>
                                    {deployment.modelScopeModelId && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">ModelScope</span>
                                            <span className="font-medium">{deployment.modelScopeModelId}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('model.replicas')}</span>
                                        <span className="font-medium">{deployment.readyReplicas}/{deployment.replicas}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('model.createdTime')}</span>
                                        <span className="font-medium">{deployment.createdAt}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('model.updatedTime')}</span>
                                        <span className="font-medium">{deployment.updatedAt}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>{t('model.resourceAllocation')}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('model.gpuCount')}</span>
                                        <span className="font-medium">
                                            {typeof deployment.gpu === 'number'
                                                ? `${deployment.gpu} GPUs`
                                                : (deployment.gpu || '-')}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('model.memory')}</span>
                                        <span className="font-medium">{deployment.memory ?? '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('model.cpuCores')}</span>
                                        <span className="font-medium">
                                            {deployment.cpuCores ? `${deployment.cpuCores} cores` : '-'}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t('model.apiEndpoint')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 p-2 bg-muted rounded text-sm">
                                        {deployment.endpoint}
                                    </code>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => copyToClipboard(deployment.endpoint)}
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="mt-4">
                                    <p className="text-sm text-muted-foreground mb-2">{t('model.exampleCurlCommand')}:</p>
                                    <code className="block p-2 bg-muted rounded text-xs overflow-x-auto">
                                        {`curl -X POST ${deployment.endpoint}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"model": "${deployment.modelName}", "messages": [{"role": "user", "content": "Hello!"}]}'`}
                                    </code>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* 实例标签页 */}
                    <TabsContent value="instances" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('model.instanceList')}</CardTitle>
                                <CardDescription>
                                    {t('model.totalInstances', { count: instancesToRender.length })}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {instancesToRender.map(instance => (
                                        <Card key={instance.id}>
                                            <CardContent className="pt-6">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">{t('model.instanceName')}</p>
                                                        <p className="font-medium text-sm">{instance.name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">{t('model.status')}</p>
                                                        <div>{getStatusBadge(instance.status)}</div>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">{t('model.node')}</p>
                                                        <p className="font-medium text-sm">{instance.node}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">{t('model.startTime')}</p>
                                                        <p className="font-medium text-sm">{instance.startTime}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">GPU</p>
                                                        <p className="font-medium text-sm">{instance.gpu}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">{t('model.memory')}</p>
                                                        <p className="font-medium text-sm">{instance.memory}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">CPU</p>
                                                        <p className="font-medium text-sm">{instance.cpu}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* 监控标签页 */}
                    <TabsContent value="monitoring">
                        <ResourceMonitor deploymentId={deploymentId} />
                    </TabsContent>

                    {/* 日志标签页 */}
                    <TabsContent value="logs">
                        <DeploymentLogs deploymentId={deploymentId} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

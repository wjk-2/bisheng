import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/bs-ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/bs-ui/select";
import { Button } from "@/components/bs-ui/button";
import { Input } from "@/components/bs-ui/input";
import { Download, RefreshCw, Search, Pause, Play } from "lucide-react";
import { getDeploymentInstancesApi, getDeploymentLogsApi } from "@/controllers/API/deployment";
import { useToast } from "@/components/bs-ui/toast/use-toast";

interface DeploymentLogsProps {
    deploymentId: string;
}

export default function DeploymentLogs({ deploymentId }: DeploymentLogsProps) {
    const { t } = useTranslation('model');
    const { message } = useToast();
    const [selectedInstance, setSelectedInstance] = useState("all");
    const [logLevel, setLogLevel] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [logs, setLogs] = useState<string[]>([]);
    const [isAutoRefresh, setIsAutoRefresh] = useState(true);
    const [instances, setInstances] = useState<Array<{ id: string; name: string }>>([
        { id: "all", name: t('model.allInstances') }
    ]);
    
    const logsEndRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        loadInstances();
    }, [deploymentId]);

    useEffect(() => {
        loadLogs();

        if (isAutoRefresh) {
            intervalRef.current = setInterval(loadLogs, 5000); // 每5秒刷新一次
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deploymentId, selectedInstance, logLevel, isAutoRefresh]);

    useEffect(() => {
        // 自动滚动到底部
        scrollToBottom();
    }, [logs]);

    const loadInstances = async () => {
        try {
            const data = await getDeploymentInstancesApi(deploymentId);
            const list = Array.isArray(data) ? data : data?.items ?? [];
            const normalized = list.map((item: any) => ({
                id: item.id ?? item.instanceId ?? item.worker_name ?? Math.random().toString(36).slice(-6),
                name: item.name ?? item.id ?? item.worker_name ?? t('model.unknownInstance')
            }));
            setInstances([{ id: "all", name: t('model.allInstances') }, ...normalized]);
        } catch (error) {
            message({ variant: 'error', description: t('model.loadDeploymentDetailFailed') });
        }
    };

    const loadLogs = async () => {
        try {
            const params: Record<string, any> = {
                log_level: logLevel !== 'all' ? logLevel : undefined,
                lines: 200,
            };

            const activeInstance = selectedInstance !== 'all' ? selectedInstance : undefined;
            if (activeInstance) {
                params.instance_id = activeInstance;
            }

            const data = await getDeploymentLogsApi(deploymentId, params);
            const resultLogs = Array.isArray(data) ? data : data?.logs ?? [];
            const newLogs = resultLogs.map((item: any) => (typeof item === 'string' ? item : JSON.stringify(item)));
            setLogs(newLogs);
        } catch (error) {
            message({ variant: 'error', description: t('model.loadDeploymentDetailFailed') });
        }
    };

    const scrollToBottom = () => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleDownloadLogs = () => {
        const logsText = logs.join('\n');
        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deployment-${deploymentId}-logs-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        message({
            variant: 'success',
            description: t('model.logsDownloaded')
        });
    };

    const toggleAutoRefresh = () => {
        setIsAutoRefresh(!isAutoRefresh);
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch = !searchTerm || log.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesLevel = logLevel === "all" || log.includes(`[${logLevel.toUpperCase()}]`);
        return matchesSearch && matchesLevel;
    });

    const getLogColor = (log: string) => {
        if (log.includes('[ERROR]')) return 'text-red-500';
        if (log.includes('[WARN]')) return 'text-yellow-500';
        if (log.includes('[DEBUG]')) return 'text-gray-500';
        return 'text-foreground';
    };

    return (
        <Card className="h-full">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>{t('model.deploymentLogs')}</CardTitle>
                    <div className="flex items-center gap-2">
                        {/* 实例选择 */}
                        <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                            <SelectTrigger className="w-64">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {instances.map(instance => (
                                    <SelectItem key={instance.id} value={instance.id}>
                                        {instance.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* 日志级别选择 */}
                        <Select value={logLevel} onValueChange={setLogLevel}>
                            <SelectTrigger className="w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('model.allLevels')}</SelectItem>
                                <SelectItem value="error">ERROR</SelectItem>
                                <SelectItem value="warn">WARN</SelectItem>
                                <SelectItem value="info">INFO</SelectItem>
                                <SelectItem value="debug">DEBUG</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* 搜索框 */}
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                className="pl-8 w-64"
                                placeholder={t('model.searchLogs')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* 操作按钮 */}
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={toggleAutoRefresh}
                            title={isAutoRefresh ? t('model.pauseRefresh') : t('model.startRefresh')}
                        >
                            {isAutoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={loadLogs}
                            title={t('model.refresh')}
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleDownloadLogs}
                            title={t('model.downloadLogs')}
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* 日志内容区域 */}
                <div className="bg-black rounded-lg p-4 h-[600px] overflow-y-auto font-mono text-sm">
                    {filteredLogs.length === 0 ? (
                        <p className="text-gray-500">{t('model.noLogs')}</p>
                    ) : (
                        filteredLogs.map((log, index) => (
                            <div key={index} className={`${getLogColor(log)} hover:bg-gray-900 px-1`}>
                                {log}
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
                
                {/* 状态栏 */}
                <div className="mt-4 flex justify-between items-center text-sm text-muted-foreground">
                    <span>{t('model.showingLogs', { count: filteredLogs.length })}</span>
                    <span>
                        {isAutoRefresh ? (
                            <span className="flex items-center gap-1">
                                <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
                                {t('model.autoRefreshing')}
                            </span>
                        ) : (
                            t('model.paused')
                        )}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

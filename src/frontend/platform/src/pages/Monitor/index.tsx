import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/bs-ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/bs-ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/bs-ui/table";
import { Button } from "@/components/bs-ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/bs-ui/tooltip";
import { listGpuDevicesApi, listWorkersApi } from "@/controllers/API/deployment";
import { LoadingIcon } from "@/components/bs-icons/loading";
import { RefreshCw } from "lucide-react";

interface WorkerItem {
    id: string | number;
    name?: string;
    hostname?: string;
    state?: string;
    status?: {
        cpu?: {
            total?: number;
            utilization_rate?: number;
        };
        memory?: {
            total?: number;
            used?: number;
        };
        gpu_devices?: Array<{ index?: number }>;
    };
    ip?: string;
    address?: string;
    updated_at?: string;
    created_at?: string;
}

interface GpuItem {
    id: string | number;
    name?: string;
    vendor?: string;
    index?: number;
    worker_id?: number;
    worker_name?: string;
    worker_ip?: string;
    core?: {
        utilization_rate?: number;
    };
    memory?: {
        utilization_rate?: number;
    };
    temperature?: number;
    updated_at?: string;
}

const percentageText = (value?: number, digits: number = 1) => {
    if (value === undefined || value === null || Number.isNaN(value)) return "-";
    return `${Number(value).toFixed(digits)}%`;
};

const formatMemoryUsage = (used?: number, total?: number) => {
    if (!used && !total) return "-";
    if (!total) return `${(used ?? 0) / (1024 ** 3)}`;
    const usedGB = (used ?? 0) / (1024 ** 3);
    const totalGB = total / (1024 ** 3);
    return `${usedGB.toFixed(1)} / ${totalGB.toFixed(1)} GB`;
};

const DEFAULT_PAGE_SIZE = 50;

const formatBytes = (bytes?: number) => {
    if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return "-";
    if (bytes === 0) return "0 B";
    const units = ["B", "KiB", "MiB", "GiB", "TiB"];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    return `${value.toFixed(1)} ${units[exponent]}`;
};

interface ProgressCellProps {
    percent?: number;
    colorClass?: string;
    label?: string;
    tooltipContent?: React.ReactNode;
}

const ProgressCell = ({ percent, colorClass = "bg-emerald-500", label, tooltipContent }: ProgressCellProps) => {
    const safePercent = Math.min(Math.max(percent ?? 0, 0), 100);
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-3 cursor-default select-none w-48">
                        <div className="relative flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                                className={`absolute inset-y-0 left-0 ${colorClass}`}
                                style={{ width: `${safePercent}%` }}
                            />
                        </div>
                        <span className="text-xs text-muted-foreground min-w-[36px] text-right">
                            {label ?? `${safePercent.toFixed(1)}%`}
                        </span>
                    </div>
                </TooltipTrigger>
                {tooltipContent && (
                    <TooltipContent className="bg-popover text-popover-foreground border border-border shadow-lg">
                        <div className="min-w-[180px] space-y-1 text-xs leading-relaxed">
                            {tooltipContent}
                        </div>
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    );
};

export default function MonitorPage() {
    const { t } = useTranslation("model");
    const [activeTab, setActiveTab] = useState("workers");
    const [loading, setLoading] = useState(false);
    const [workers, setWorkers] = useState<WorkerItem[]>([]);
    const [gpus, setGpus] = useState<GpuItem[]>([]);

    const loadWorkers = async () => {
        setLoading(true);
        try {
            const response = await listWorkersApi({ page: 1, per_page: DEFAULT_PAGE_SIZE });
            const items = (response?.items || response?.data?.items || []);
            setWorkers(items as WorkerItem[]);
        } catch (error) {
            console.error("Failed to load workers", error);
            setWorkers([]);
        } finally {
            setLoading(false);
        }
    };

    const loadGpus = async () => {
        setLoading(true);
        try {
            const response = await listGpuDevicesApi({ page: 1, per_page: DEFAULT_PAGE_SIZE });
            const items = (response?.items || response?.data?.items || []);
            setGpus(items as GpuItem[]);
        } catch (error) {
            console.error("Failed to load GPU devices", error);
            setGpus([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === "workers") {
            loadWorkers();
        } else {
            loadGpus();
        }
    }, [activeTab]);

    const workerRows = useMemo(() => {
        return workers.map((worker) => {
            const gpuCount = worker.status?.gpu_devices?.length ?? 0;
            const cpuUsage = worker.status?.cpu?.utilization_rate;
            const memory = worker.status?.memory;
            return {
                id: worker.id,
                name: worker.name || worker.hostname || "-",
                ip: worker.ip || worker.address || "-",
                status: worker.state || "-",
                gpuCount,
                cpuUsage,
                memoryUsage: memory ? formatMemoryUsage(memory.used, memory.total) : "-",
                updated: worker.updated_at || worker.created_at || "-",
            };
        });
    }, [workers]);

    const gpuRows = useMemo(() => {
        return gpus.map((gpu) => ({
            id: gpu.id,
            name: gpu.name || "-",
            vendor: gpu.vendor || "-",
            index: gpu.index ?? "-",
            worker: gpu.worker_name || gpu.worker_ip || "-",
            corePercent: gpu.core?.utilization_rate,
            memoryPercent: gpu.memory?.utilization_rate,
            temperature: gpu.temperature ?? "-",
            memoryInfo: {
                total: gpu.memory?.total,
                used: gpu.memory?.used,
                allocated: gpu.memory?.allocated,
            },
        }));
    }, [gpus]);

    const handleRefresh = () => {
        if (activeTab === "workers") {
            loadWorkers();
        } else {
            loadGpus();
        }
    };

    return (
        <div className="h-full overflow-y-auto bg-background-login">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold text-[#140E35]">{t("monitorPageTitle", { defaultValue: "资源监控" })}</h1>
                    <Button variant="outline" onClick={handleRefresh} disabled={loading}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {t("refresh")}
                    </Button>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="workers">{t("monitorWorkersTab", { defaultValue: "Workers" })}</TabsTrigger>
                        <TabsTrigger value="gpus">{t("monitorGpusTab", { defaultValue: "GPUs" })}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="workers">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("monitorWorkersTab", { defaultValue: "Workers" })}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <LoadingIcon />
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>{t("workersName", { defaultValue: "Worker" })}</TableHead>
                                                    <TableHead>{t("workersIP", { defaultValue: "IP" })}</TableHead>
                                                    <TableHead>{t("workersStatus", { defaultValue: "Status" })}</TableHead>
                                                    <TableHead>{t("workersGpuCount", { defaultValue: "GPU Count" })}</TableHead>
                                                    <TableHead>{t("workersCpuUsage", { defaultValue: "CPU Usage" })}</TableHead>
                                                    <TableHead>{t("workersMemoryUsage", { defaultValue: "Memory Usage" })}</TableHead>
                                                    <TableHead>{t("workersUpdated", { defaultValue: "Updated" })}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {workerRows.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                                                            {t("noModels", { defaultValue: "暂无数据" })}
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    workerRows.map((row) => (
                                                        <TableRow key={row.id}>
                                                            <TableCell className="font-medium">{row.name}</TableCell>
                                                            <TableCell>{row.ip}</TableCell>
                                                            <TableCell>{row.status}</TableCell>
                                                            <TableCell>{row.gpuCount}</TableCell>
                                                            <TableCell>{percentageText(row.cpuUsage)}</TableCell>
                                                            <TableCell>{row.memoryUsage}</TableCell>
                                                            <TableCell>{row.updated}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="gpus">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("monitorGpusTab", { defaultValue: "GPUs" })}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <LoadingIcon />
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>{t("gpusName", { defaultValue: "GPU" })}</TableHead>
                                                    <TableHead>{t("gpusIndex", { defaultValue: "Index" })}</TableHead>
                                                    <TableHead>{t("gpusWorker", { defaultValue: "Worker" })}</TableHead>
                        <TableHead>{t("gpusVendor", { defaultValue: "Vendor" })}</TableHead>
                        <TableHead>{t("gpusCoreUsage", { defaultValue: "Core Usage" })}</TableHead>
                        <TableHead>{t("gpusMemoryUsage", { defaultValue: "Memory Usage" })}</TableHead>
                        <TableHead>{t("gpusTemperature", { defaultValue: "Temperature" })}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {gpuRows.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                                                            {t("noModels", { defaultValue: "暂无数据" })}
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    gpuRows.map((row) => (
                                                        <TableRow key={row.id}>
                                                            <TableCell className="font-medium">{row.name}</TableCell>
                                                            <TableCell>{row.index}</TableCell>
                                                            <TableCell>{row.worker}</TableCell>
                                            <TableCell>{row.vendor}</TableCell>
                                            <TableCell>
                                                <ProgressCell
                                                    percent={row.corePercent}
                                                    colorClass="bg-emerald-500"
                                                    label={percentageText(row.corePercent)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <ProgressCell
                                                    percent={row.memoryPercent}
                                                    colorClass="bg-[#4658FF]"
                                                    label={percentageText(row.memoryPercent)}
                                                    tooltipContent={
                                                        row.memoryInfo.total ? (
                                                            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                                                                <span className="text-muted-foreground">{t('gpusMemoryTotal', { defaultValue: 'Total' })}</span>
                                                                <span>{formatBytes(row.memoryInfo.total)}</span>
                                                                <span className="text-muted-foreground">{t('gpusMemoryUsed', { defaultValue: 'Used' })}</span>
                                                                <span>{formatBytes(row.memoryInfo.used)}</span>
                                                                <span className="text-muted-foreground">{t('gpusMemoryAllocated', { defaultValue: 'Allocated' })}</span>
                                                                <span>{formatBytes(row.memoryInfo.allocated)}</span>
                                                            </div>
                                                        ) : (
                                                            <span>{t('noModels', { defaultValue: 'No data' })}</span>
                                                        )
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>{row.temperature}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

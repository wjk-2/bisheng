import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/bs-ui/card";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/bs-ui/select";
import { getDeploymentMetricsApi } from "@/controllers/API/deployment";

interface ResourceMonitorProps {
    deploymentId: string;
}

export default function ResourceMonitor({ deploymentId }: ResourceMonitorProps) {
    const { t } = useTranslation('model');
    const [timeRange, setTimeRange] = useState("1h");
    const [metricsData, setMetricsData] = useState({
        gpu: [],
        memory: [],
        cpu: [],
        requests: []
    });

    useEffect(() => {
        loadMetrics();
        // 设置定时刷新
        const interval = setInterval(loadMetrics, 30000); // 每30秒刷新一次
        return () => clearInterval(interval);
    }, [deploymentId, timeRange]);

    const loadMetrics = async () => {
        try {
            const data = await getDeploymentMetricsApi(deploymentId, timeRange);
            setMetricsData({
                gpu: data.gpu || [],
                memory: data.memory || [],
                cpu: data.cpu || [],
                requests: data.requests || []
            });
        } catch (error) {
            console.error('Failed to load metrics:', error);
            // 如果加载失败，显示空数据
            setMetricsData({
                gpu: [],
                memory: [],
                cpu: [],
                requests: []
            });
        }
    };

    const formatYAxis = (value: number) => `${value}%`;
    const formatRequestsYAxis = (value: number) => `${value}`;

    return (
        <div className="space-y-4">
            {/* 时间范围选择器 */}
            <div className="flex justify-end">
                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-32">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1h">{t('model.last1Hour')}</SelectItem>
                        <SelectItem value="6h">{t('model.last6Hours')}</SelectItem>
                        <SelectItem value="24h">{t('model.last24Hours')}</SelectItem>
                        <SelectItem value="7d">{t('model.last7Days')}</SelectItem>
                        <SelectItem value="30d">{t('model.last30Days')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* 监控图表 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('model.gpuUtilization')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={metricsData.gpu}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" />
                                <YAxis tickFormatter={formatYAxis} />
                                <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                                <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#10b981" 
                                    fill="#10b98133" 
                                    name={t('model.gpuUsage')}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('model.memoryUtilization')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={metricsData.memory}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" />
                                <YAxis tickFormatter={formatYAxis} />
                                <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                                <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#3b82f6" 
                                    fill="#3b82f633" 
                                    name={t('model.memoryUsage')}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('model.cpuUtilization')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={metricsData.cpu}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" />
                                <YAxis tickFormatter={formatYAxis} />
                                <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                                <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#f59e0b" 
                                    fill="#f59e0b33" 
                                    name={t('model.cpuUsage')}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('model.requestsPerMinute')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={metricsData.requests}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" />
                                <YAxis tickFormatter={formatRequestsYAxis} />
                                <Tooltip formatter={(value) => `${Number(value).toFixed(0)} req/min`} />
                                <Line 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#8b5cf6" 
                                    strokeWidth={2}
                                    name={t('model.requests')}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* 实时指标卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* TODO: 对接 GPUStack 监控 API 获取真实数据 */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-muted-foreground">--</div>
                        <p className="text-xs text-muted-foreground">{t('model.currentGPUUsage')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-muted-foreground">--</div>
                        <p className="text-xs text-muted-foreground">{t('model.currentMemoryUsage')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-muted-foreground">--</div>
                        <p className="text-xs text-muted-foreground">{t('model.avgResponseTime')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-muted-foreground">--</div>
                        <p className="text-xs text-muted-foreground">{t('model.availability')}</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

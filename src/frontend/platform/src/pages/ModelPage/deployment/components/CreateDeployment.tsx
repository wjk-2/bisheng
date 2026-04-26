import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Rocket, Search, AlertTriangle, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

import { Button } from "@/components/bs-ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/bs-ui/card";
import { Input } from "@/components/bs-ui/input";
import { Label } from "@/components/bs-ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/bs-ui/select";
import { Slider } from "@/components/bs-ui/slider";
import { Switch } from "@/components/bs-ui/switch";
import { Textarea } from "@/components/bs-ui/input";
import { useToast } from "@/components/bs-ui/toast/use-toast";
import { Badge } from "@/components/bs-ui/badge";

import {
    createDeploymentApi,
    evaluateModelScopeModelApi,
    getModelScopeModelDetailApi,
    listModelScopeModelsApi,
} from "@/controllers/API/deployment";

interface CreateDeploymentProps {
    onBack: () => void;
    onSuccess: () => void;
}

interface ModelScopeItem {
    id?: string;
    repository_id?: string;
    numeric_id?: string | number;
    name?: string;
    description?: string;
    tags?: string[];
    tasks?: string[];
    downloads?: number;
    favourites?: number;
    updated_at?: string;
    publisher?: string;
    owner?: string;
    icon?: string;
    isGGUF?: boolean;
    evaluation?: EvaluationResult | null;
    evaluationStatus?: 'success' | 'warning' | 'error' | null;
    raw?: Record<string, unknown>;
}

interface ModelScopeDetail {
    id?: string;
    name?: string;
    description?: string;
    tags?: string[];
    tasks?: string[];
    owner?: string;
    readme?: string;
    repository_id?: string;
    path?: string;
    raw?: Record<string, unknown>;
}

interface EvaluationResult {
    compatible?: boolean;
    compatibility_messages?: string[] | null;
    scheduling_messages?: string[] | null;
    error?: boolean | null;
    error_message?: string | null;
}

type EvaluationCacheEntry = {
    evaluation: EvaluationResult | null;
    status: ModelScopeItem['evaluationStatus'];
};

const backendOptions = [
    { value: "llama-box", label: "Llama Box" },
    { value: "vllm", label: "vLLM" },
    { value: "tgi", label: "Text Generation Inference" },
    { value: "triton", label: "Triton Inference Server" },
];

const sortOptions = [
    { value: "Default", label: "Default" },
    { value: "Trending", label: "Trending" },
    { value: "Latest", label: "Latest" },
];

const placementOptions = [
    { value: "spread", label: "Spread" },
    { value: "binpack", label: "Binpack" },
];

const pageSize = 10;

const buildDefaultName = (modelName?: string | null) => {
    if (!modelName) return `deployment-${Math.random().toString(36).slice(-6)}`;
    const normalized = modelName
        .toLowerCase()
        .replace(/[^a-z0-9\-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$|\s+/g, "");
    return `${normalized}-${Math.random().toString(36).slice(-5)}`;
};

const extractFilesFromDetail = (detail?: ModelScopeDetail) => {
    const raw = detail?.raw as Record<string, any> | undefined;
    if (!raw) return [] as Array<{ id: string; label: string }>;

    const data = raw.Data || raw.data || raw;
    const files = data.Files || data.files || data.ModelFiles || [];

    if (!Array.isArray(files)) return [];

    return files
        .map((file: any) => {
            const fileId = file?.FileId || file?.Id || file?.FileName || file?.name;
            const label = file?.FileName || file?.name || fileId;
            return fileId && label ? { id: String(fileId), label: String(label) } : null;
        })
        .filter(Boolean) as Array<{ id: string; label: string }>;
};

const extractLabelFromEntry = (entry: unknown): string | null => {
    if (typeof entry === "string") {
        const trimmed = entry.trim();
        return trimmed ? trimmed : null;
    }
    if (typeof entry === "number") {
        return String(entry);
    }
    if (entry && typeof entry === "object") {
        const candidateKeys = [
            "Name",
            "name",
            "TagName",
            "tagName",
            "DisplayName",
            "displayName",
            "ChineseName",
            "chineseName",
            "Description",
            "description",
            "DomainName",
            "domainName",
            "Id",
            "id",
        ];
        for (const key of candidateKeys) {
            const value = (entry as Record<string, unknown>)[key];
            if (typeof value === "string") {
                const trimmed = value.trim();
                if (trimmed) return trimmed;
            }
            if (typeof value === "number") {
                return String(value);
            }
        }
    }
    return null;
};

const normalizeLabelList = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const result: string[] = [];

    value.forEach((item) => {
        const label = extractLabelFromEntry(item);
        if (label && !seen.has(label)) {
            seen.add(label);
            result.push(label);
        }
    });

    return result;
};

const determineEvaluationStatus = (evaluation?: EvaluationResult | null): ModelScopeItem['evaluationStatus'] => {
    if (!evaluation) return null;
    if (evaluation.error) return 'error';
    if (evaluation.compatible) return 'success';
    return 'warning';
};

const extractEvaluationMessage = (evaluation?: EvaluationResult | null): string | null => {
    if (!evaluation) return null;
    return (
        evaluation.error_message ||
        (Array.isArray(evaluation.compatibility_messages) && evaluation.compatibility_messages[0]) ||
        (Array.isArray(evaluation.scheduling_messages) && evaluation.scheduling_messages[0]) ||
        null
    );
};

const buildCacheKey = (value?: string | number | null): string | undefined => {
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim().toLowerCase();
    return normalized ? normalized : undefined;
};

const normalizeModelScopeItem = (item: any): ModelScopeItem => {
    if (!item || typeof item !== "object") {
        return item as ModelScopeItem;
    }

    const normalizedTags = normalizeLabelList(item.tags ?? item.TagNames ?? item.Tags);
    const normalizedTasks = normalizeLabelList(item.tasks ?? item.Tasks);

    const repositoryId = extractLabelFromEntry(item.repository_id ?? item.RepositoryId ?? item.ModelId ?? item.modelId ?? item.Name ?? item.name);
    const numericId = item.numeric_id ?? item.NumericId ?? item.Id ?? item.id ?? item.uid ?? item.Uid;
    const isGGUF = normalizedTags.some((tag) => tag?.toUpperCase() === "GGUF");

    return {
        ...item,
        tags: normalizedTags,
        tasks: normalizedTasks,
        repository_id: repositoryId ?? item.repository_id,
        numeric_id: numericId,
        isGGUF,
        evaluation: item.evaluation ?? null,
        evaluationStatus: item.evaluationStatus ?? null,
    };
};

const normalizeModelScopeDetail = (detail: any): ModelScopeDetail => {
    if (!detail || typeof detail !== "object") {
        return detail as ModelScopeDetail;
    }

    const rawData = (() => {
        const raw = detail.raw as Record<string, any> | undefined;
        if (!raw) return undefined;
        return raw.Data || raw.data || raw;
    })();

    const primaryPath = detail.repository_id || detail.RepositoryPath || detail.Path || detail.Namespace;
    const fallbackPath = rawData?.Path || rawData?.Namespace;
    const name = detail.name || detail.Name || rawData?.Name;
    const repositoryId = detail.repository_id || rawData?.RepositoryPath || rawData?.RepositoryId;
    const owner = detail.owner || detail.OwnerName || detail.UserName || rawData?.OwnerName || rawData?.UserName || primaryPath || fallbackPath;

    return {
        ...detail,
        tags: normalizeLabelList(detail.tags ?? detail.TagNames ?? detail.Tags),
        tasks: normalizeLabelList(detail.tasks ?? detail.Tasks),
        repository_id:
            repositoryId ||
            (primaryPath && name ? `${primaryPath}/${name}` : undefined) ||
            (fallbackPath && name ? `${fallbackPath}/${name}` : undefined) ||
            detail.ModelId ||
            detail.id,
        path: primaryPath || fallbackPath,
        owner,
    };
};

const resolveRepositoryId = (item: ModelScopeItem | null | undefined): string | null => {
    if (!item) return null;

    const candidates: Array<unknown> = [
        item.repository_id,
        item.owner,
        item.id,
        item.raw && (item.raw as any).ModelId,
        item.raw && (item.raw as any).modelId,
        item.raw && (item.raw as any).RepositoryPath,
        item.raw && (item.raw as any).repositoryPath,
        item.raw && (item.raw as any).RepositoryId,
        item.raw && (item.raw as any).repositoryId,
        item.name,
    ];

    for (const candidate of candidates) {
        if (!candidate) continue;
        const value = String(candidate).trim();
        if (!value) continue;
        if (value.includes("/")) return value;
        if (value.includes("-")) {
            return value;
        }
    }

    return null;
};

const resolveCacheKeyFromModel = (model: ModelScopeItem | null | undefined): string | undefined => {
    if (!model) return undefined;
    const repositoryId = resolveRepositoryId(model) || model.repository_id || model.id;
    return buildCacheKey(repositoryId);
};

export default function CreateDeployment({ onBack, onSuccess }: CreateDeploymentProps) {
    const { t } = useTranslation("model");
    const { message } = useToast();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingModels, setLoadingModels] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [evaluating, setEvaluating] = useState(false);

    const [models, setModels] = useState<ModelScopeItem[]>([]);
    const [totalModels, setTotalModels] = useState(0);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState("");
    const [searchKeyword, setSearchKeyword] = useState("");
    const [sortBy, setSortBy] = useState("Default");
    const [onlyGGUF, setOnlyGGUF] = useState(false);

    const [selectedModel, setSelectedModel] = useState<ModelScopeItem | null>(null);
    const [modelDetail, setModelDetail] = useState<ModelScopeDetail | null>(null);
    const [availableFiles, setAvailableFiles] = useState<Array<{ id: string; label: string }>>([]);
    const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
    const [evaluationCache, setEvaluationCache] = useState<Record<string, EvaluationCacheEntry>>({});

    const lastAutoEvaluatedIdRef = useRef<string | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        modelScopeModelId: "",
        modelScopeFilePath: "",
        backend: "vllm",
        replicas: 1,
        description: "",
        environmentVariables: "",
        cpuOffloading: false,
        distributedInferenceAcrossWorkers: true,
        placementStrategy: "spread",
        restartOnError: true,
    });

    const allowCpuOffloading = selectedModel?.isGGUF ?? false;
    const cpuOffloadingValue = allowCpuOffloading ? formData.cpuOffloading : false;

    const updateForm = (key: keyof typeof formData, value: unknown) => {
        setFormData((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const updateModelEvaluation = (modelId: string | undefined, evaluation: EvaluationResult | null) => {
        if (!modelId) return;
        const targetKey = buildCacheKey(modelId);
        if (!targetKey) return;

        const status = determineEvaluationStatus(evaluation);
        setEvaluationCache((prev) => ({
            ...prev,
            [targetKey]: {
                evaluation,
                status,
            },
        }));

        setModels((prev) =>
            prev.map((model) => {
                const modelKey = resolveCacheKeyFromModel(model);
                if (modelKey !== targetKey) return model;
                return { ...model, evaluation, evaluationStatus: status };
            })
        );

        setSelectedModel((prev) => {
            if (!prev) return prev;
            const currentKey = resolveCacheKeyFromModel(prev);
            if (currentKey !== targetKey) return prev;
            return { ...prev, evaluation, evaluationStatus: status };
        });
    };

    useEffect(() => {
        const handler = setTimeout(() => {
            setSearchKeyword(searchInput.trim());
            setPage(1);
        }, 400);

        return () => clearTimeout(handler);
    }, [searchInput]);

    useEffect(() => {
        loadModels();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, sortBy, onlyGGUF, searchKeyword]);

    useEffect(() => {
        if (!selectedModel || !modelDetail) return;
        if (selectedModel.isGGUF) return;

        const repoIdentifier = selectedModel.repository_id || selectedModel.id;
        const cacheKey = buildCacheKey(repoIdentifier);
        if (!cacheKey) return;

        const cachedEntry = evaluationCache[cacheKey];
        if (cachedEntry && cachedEntry.evaluation !== null) {
            lastAutoEvaluatedIdRef.current = cacheKey;
            return;
        }

        if (evaluating) return;
        if (lastAutoEvaluatedIdRef.current === cacheKey) return;
        lastAutoEvaluatedIdRef.current = cacheKey;
        handleEvaluate({ silent: true, ignoreFilePath: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedModel, modelDetail, evaluating, evaluationCache]);

    const loadModels = async () => {
        setLoadingModels(true);
        try {
            const response = await listModelScopeModelsApi({
                page_number: page,
                page_size: pageSize,
                name: searchKeyword,
                sort_by: sortBy,
                tags: onlyGGUF ? ["GGUF"] : [],
            });

            const rawItems =
                (response &&
                    ((response as any).items ||
                        (response as any).Items ||
                        (response as any).list ||
                        (response as any).List)) ||
                [];
            const items = Array.isArray(rawItems)
                ? (rawItems as ModelScopeItem[]).map((model) => normalizeModelScopeItem(model))
                : [];
            const itemsWithCache = items.map((model) => {
                const cacheKey = resolveCacheKeyFromModel(model);
                if (!cacheKey) return model;
                const cachedEntry = evaluationCache[cacheKey];
                if (!cachedEntry) return model;
                return {
                    ...model,
                    evaluation: cachedEntry.evaluation,
                    evaluationStatus: cachedEntry.status,
                };
            });
            setModels(itemsWithCache);
            const totalValue =
                (response &&
                    ((response as any).total ||
                        (response as any).Total ||
                        (response as any).count ||
                        (response as any).TotalCount)) ?? items.length ?? 0;

            const normalizeTotal = (value: unknown): number | null => {
                if (typeof value === 'number') return value;
                if (typeof value === 'string') {
                    const trimmed = value.trim().replace(/,/g, '');
                    if (!trimmed) return null;
                    const parsed = Number(trimmed);
                    return Number.isFinite(parsed) ? parsed : null;
                }
                if (typeof value === 'bigint') return Number(value);
                return null;
            };

            const rawTotalCandidates = [
                (response as any)?.raw?.Data?.Model?.TotalCount,
                (response as any)?.raw?.Data?.Model?.totalCount,
                (response as any)?.raw?.Data?.Model?.Total,
                (response as any)?.raw?.Data?.Model?.total,
                (response as any)?.raw?.Data?.TotalCount,
                (response as any)?.raw?.Data?.totalCount,
                (response as any)?.raw?.Data?.Total,
                (response as any)?.raw?.Data?.total,
            ];

            const rawTotal = rawTotalCandidates.map(normalizeTotal).find((value) => typeof value === 'number' && value > 0);
            const normalizedTotal = normalizeTotal(totalValue) ?? rawTotal ?? items.length;
            setTotalModels(normalizedTotal);

            if (!selectedModel && itemsWithCache.length > 0) {
                handleSelectModel(itemsWithCache[0]);
            }
        } catch (error: any) {
            message({
                variant: "error",
                description: error?.response?.data?.message || t("model.loadModelListFailed", { defaultValue: "加载模型列表失败" }),
            });
        } finally {
            setLoadingModels(false);
        }
    };

    const handleSelectModel = async (item: ModelScopeItem) => {
        const normalizedItem = normalizeModelScopeItem(item);
        const repositoryId = resolveRepositoryId(normalizedItem);
        const cacheKey = buildCacheKey(repositoryId);
        const cachedEntry = cacheKey ? evaluationCache[cacheKey] : undefined;
        const modelWithCache = cachedEntry
            ? { ...normalizedItem, evaluation: cachedEntry.evaluation, evaluationStatus: cachedEntry.status }
            : normalizedItem;

        setSelectedModel(modelWithCache);
        setEvaluationResult(cachedEntry?.evaluation ?? null);
        setAvailableFiles([]);
        setFormData((prev) => ({
            ...prev,
            modelScopeFilePath: "",
            cpuOffloading: normalizedItem.isGGUF ? true : false,
        }));

        if (cacheKey && cachedEntry && cachedEntry.evaluation !== null) {
            lastAutoEvaluatedIdRef.current = cacheKey;
        } else {
            lastAutoEvaluatedIdRef.current = null;
        }

        if (!repositoryId) {
            message({
                variant: "error",
                description: t("model.modelIdMissing", { defaultValue: "该模型缺少仓库 ID" }),
            });
            return;
        }

        updateForm("name", buildDefaultName(normalizedItem.name));
        updateForm("modelScopeModelId", repositoryId);

        setLoadingDetail(true);
        try {
            const detailResponse = await getModelScopeModelDetailApi(repositoryId);
            const normalizedDetail = normalizeModelScopeDetail(detailResponse);
            setModelDetail(normalizedDetail);

            const files = extractFilesFromDetail(normalizedDetail);
            setAvailableFiles(files);
            if (files.length > 0) {
                setFormData((prev) => ({
                    ...prev,
                    modelScopeFilePath: prev.modelScopeFilePath?.trim() ? prev.modelScopeFilePath : files[0].label,
                }));
            }
        } catch (error: any) {
            message({
                variant: "error",
                description: error?.response?.data?.message || t("model.loadModelDetailFailed", { defaultValue: "加载模型详情失败" }),
            });
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleEvaluate = async (options?: { silent?: boolean; ignoreFilePath?: boolean }) => {
        const silent = options?.silent ?? false;
        const ignoreFilePath = options?.ignoreFilePath ?? false;
        const normalizedModelId = formData.modelScopeModelId.trim();
        if (!normalizedModelId) {
            message({ variant: "error", description: t("model.modelRequired") });
            return;
        }

        if (normalizedModelId !== formData.modelScopeModelId) {
            updateForm("modelScopeModelId", normalizedModelId);
        }

        const cacheKey = buildCacheKey(normalizedModelId);

        setEvaluating(true);
        setEvaluationResult(null);
        try {
            const trimmedFilePath = formData.modelScopeFilePath?.trim();
            if (!ignoreFilePath && availableFiles.length > 0 && !trimmedFilePath) {
                if (!silent) {
                    message({ variant: "warning", description: t("model.modelScopeFileRequired", { defaultValue: "请选择具体的模型文件" }) });
                }
                if (cacheKey) {
                    lastAutoEvaluatedIdRef.current = cacheKey;
                }
                return;
            }

            const cpuOffloadingAllowed = selectedModel?.isGGUF ?? false;
            const cpuOffloadingSetting = cpuOffloadingAllowed ? formData.cpuOffloading : false;

            const result = await evaluateModelScopeModelApi({
                name: formData.name.trim() || buildDefaultName(selectedModel?.name),
                modelScopeModelId: normalizedModelId,
                modelScopeFilePath: !ignoreFilePath && trimmedFilePath
                    ? trimmedFilePath
                    : undefined,
                backend: formData.backend,
                replicas: formData.replicas,
                description: formData.description?.trim() || undefined,
                environmentVariables: formData.environmentVariables?.trim() || undefined,
                restartOnError: formData.restartOnError,
                placementStrategy: formData.placementStrategy,
                workerSelector: {},
                cpuOffloading: cpuOffloadingSetting,
                distributedInferenceAcrossWorkers: formData.distributedInferenceAcrossWorkers,
                categories: selectedModel?.tags ?? [],
                backendParameters: [],
            });

            const evaluation = (result?.results && result.results[0]) as EvaluationResult | undefined;
            setEvaluationResult(evaluation ?? null);
            if (evaluation) {
                updateModelEvaluation(normalizedModelId, evaluation);
                if (cacheKey) {
                    lastAutoEvaluatedIdRef.current = cacheKey;
                }
                if (evaluation.compatible && !silent) {
                    message({ variant: "success", description: t("model.evaluationPassed", { defaultValue: "评估通过，可以提交部署" }) });
                } else if (evaluation.error) {
                    message({ variant: "error", description: evaluation.error_message || t("model.evaluationFailed", { defaultValue: "评估失败" }) });
                } else if (!silent) {
                    message({ variant: "warning", description: t("model.evaluationWarnings", { defaultValue: "评估存在警告，请检查配置" }) });
                }
            } else {
                updateModelEvaluation(normalizedModelId, null);
                if (cacheKey) {
                    lastAutoEvaluatedIdRef.current = cacheKey;
                }
                if (!silent) {
                    message({ variant: "warning", description: t("model.evaluationNoResult", { defaultValue: "未返回评估结果" }) });
                }
            }
        } catch (error: any) {
            updateModelEvaluation(normalizedModelId, null);
            if (cacheKey) {
                lastAutoEvaluatedIdRef.current = cacheKey;
            }
            if (!silent) {
                message({
                    variant: "error",
                    description: error?.response?.data?.message || t("model.evaluationFailed", { defaultValue: "评估失败" }),
                });
            }
        } finally {
            setEvaluating(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            message({ variant: "error", description: t("model.deploymentNameRequired") });
            return;
        }
        if (!formData.modelScopeModelId.trim()) {
            message({ variant: "error", description: t("model.modelRequired") });
            return;
        }

        setIsSubmitting(true);
        try {
            const cpuOffloadingAllowed = selectedModel?.isGGUF ?? false;
            const cpuOffloadingSetting = cpuOffloadingAllowed ? formData.cpuOffloading : false;

            await createDeploymentApi({
                name: formData.name.trim(),
                modelScopeModelId: formData.modelScopeModelId.trim(),
                modelScopeFilePath: formData.modelScopeFilePath.trim() || undefined,
                backend: formData.backend,
                replicas: formData.replicas,
                description: formData.description?.trim() || undefined,
                environmentVariables: formData.environmentVariables?.trim() || undefined,
                restartOnError: formData.restartOnError,
                placementStrategy: formData.placementStrategy,
                workerSelector: {},
                cpuOffloading: cpuOffloadingSetting,
                distributedInferenceAcrossWorkers: formData.distributedInferenceAcrossWorkers,
                categories: selectedModel?.tags ?? [],
                backendParameters: [],
            });

            message({ variant: "success", description: t("model.deploymentWaitingReady", { defaultValue: "部署已创建，正在等待实例就绪…" }) });
            onSuccess();
        } catch (error: any) {
            const errorMessage = error?.response?.data?.message || t("model.deploymentCreatedFailed");
            message({ variant: "error", description: errorMessage });
        } finally {
            setIsSubmitting(false);
        }
    };

    const modelReadme = useMemo(() => {
        if (!modelDetail?.readme) return "";
        return modelDetail.readme;
    }, [modelDetail]);

    const totalPages = useMemo(() => {
        if (!totalModels || totalModels <= 0) return 1;
        return Math.max(1, Math.ceil(totalModels / pageSize));
    }, [totalModels]);

    const showNext = page * pageSize < totalModels;
    const showPrev = page > 1;

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto p-6">
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-2xl font-medium text-[#140E35]">{t("model.createDeployment")}</h1>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
                    <Card className="flex flex-col min-h-[560px]">
                        <CardHeader className="space-y-4">
                            <CardTitle>{t("model.modelScopeLibrary", { defaultValue: "ModelScope 模型" })}</CardTitle>
                            <CardDescription>{t("model.modelScopeLibraryDesc", { defaultValue: "选择需要部署的 ModelScope 仓库" })}</CardDescription>
                            <div className="space-y-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pl-9"
                                        placeholder={t("model.searchPlaceholder", { defaultValue: "搜索模型" })}
                                        value={searchInput}
                                        onChange={(event) => {
                                            setSearchInput(event.target.value);
                                            setPage(1);
                                        }}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Select value={sortBy} onValueChange={(value) => setSortBy(value)}>
                                        <SelectTrigger className="w-[140px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sortOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Switch
                                            id="gguf-filter"
                                            checked={onlyGGUF}
                                            onCheckedChange={(checked) => {
                                                setOnlyGGUF(checked);
                                                setPage(1);
                                            }}
                                        />
                                        <Label htmlFor="gguf-filter">GGUF</Label>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden flex flex-col gap-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b">
                                <span className="text-xs text-muted-foreground">
                                    {t("model.totalModelsLabel", {
                                        defaultValue: "共 {{total}} 个模型",
                                        total: totalModels,
                                    })}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={!showPrev}
                                        onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                                    >
                                        {t("model.prev", { defaultValue: "上一页" })}
                                    </Button>
                                    <span className="text-xs text-muted-foreground">
                                        {t("model.pageIndicator", {
                                            defaultValue: "第 {{page}} / {{totalPages}} 页",
                                            page,
                                            totalPages,
                                        })}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={!showNext}
                                        onClick={() => setPage((prev) => prev + 1)}
                                    >
                                        {t("model.next", { defaultValue: "下一页" })}
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                                {loadingModels ? (
                                    <div className="text-sm text-muted-foreground">{t("model.loading", { defaultValue: "加载中..." })}</div>
                                ) : models.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">{t("model.noModels", { defaultValue: "暂无模型" })}</div>
                                ) : (
                                    models.map((item) => {
                                        const isActive = selectedModel?.id === item.id;
                                        const evaluationStatus = item.evaluationStatus || determineEvaluationStatus(item.evaluation);
                                        const evaluationMessage = extractEvaluationMessage(item.evaluation);
                                        const statusVariant = evaluationStatus === 'success' ? 'default' : evaluationStatus === 'warning' ? 'secondary' : 'destructive';
                                        const statusLabel =
                                            evaluationStatus === 'success'
                                                ? t('model.evaluationStatusSuccess', { defaultValue: '评估通过' })
                                                : evaluationStatus === 'warning'
                                                ? t('model.evaluationStatusWarning', { defaultValue: '存在警告' })
                                                : evaluationStatus === 'error'
                                                ? t('model.evaluationStatusError', { defaultValue: '评估失败' })
                                                : null;
                                        return (
                                            <button
                                                key={`${item.id}-${item.name}`}
                                                type="button"
                                                className={`w-full text-left border rounded-lg p-3 transition ${
                                                    isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary"
                                                }`}
                                                onClick={() => handleSelectModel(item)}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="font-medium line-clamp-1">{item.name || item.id}</div>
                                                        {item.description && (
                                                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
                                                        )}
                                                        {statusLabel && (
                                                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                                                                <Badge variant={statusVariant} className="text-[10px] uppercase tracking-wide">
                                                                    {statusLabel}
                                                                </Badge>
                                                                {evaluationMessage && (
                                                                    <span className="text-[10px] text-muted-foreground line-clamp-1 max-w-[240px]">
                                                                        {evaluationMessage}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {item.tags?.slice(0, 3).map((tag) => (
                                                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                    {item.tasks?.slice(0, 2).map((task) => (
                                                        <span key={task} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                                            {task}
                                                        </span>
                                                    ))}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card className="min-h-[260px]">
                            <CardHeader>
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle>{selectedModel?.name || t("model.modelInformation", { defaultValue: "模型信息" })}</CardTitle>
                                    {(modelDetail?.repository_id || selectedModel?.id) && (
                                        <Button asChild variant="ghost" size="sm">
                                            <a
                                                href={`https://www.modelscope.cn/models/${modelDetail?.repository_id || selectedModel?.id}`}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                <ExternalLink className="h-4 w-4" /> {t("model.viewOnModelScope", { defaultValue: "在 ModelScope 查看" })}
                                            </a>
                                        </Button>
                                    )}
                                </div>
                                <CardDescription>
                                    {selectedModel?.description || t("model.modelInformationDesc", { defaultValue: "选择模型后展示详细信息" })}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {loadingDetail ? (
                                    <div className="text-sm text-muted-foreground">{t("model.loading", { defaultValue: "加载中..." })}</div>
                                ) : (
                                    <>
                                        {modelDetail?.owner && (
                                            <div className="text-sm text-muted-foreground">
                                                {t("model.publisher", { defaultValue: "发布者" })}: {modelDetail.owner}
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            {modelDetail?.tags?.map((tag) => (
                                                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                        {modelReadme ? (
                                            <div className="max-h-64 overflow-y-auto">
                                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        rehypePlugins={[rehypeRaw, rehypeSanitize]}
                                                    >
                                                        {modelReadme}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                {t("model.readmePlaceholder", { defaultValue: "暂无 README 内容" })}
                                            </p>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t("model.basicConfiguration")}</CardTitle>
                                <CardDescription>{t("model.basicConfigurationDesc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="deploymentName">{t("model.deploymentName")} *</Label>
                                    <Input
                                        id="deploymentName"
                                        value={formData.name}
                                        onChange={(event) => updateForm("name", event.target.value)}
                                        placeholder={t("model.deploymentNamePlaceholder")}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="modelScopeId">ModelScope ID *</Label>
                                    <Input
                                        id="modelScopeId"
                                        value={formData.modelScopeModelId}
                                        onChange={(event) => updateForm("modelScopeModelId", event.target.value)}
                                        placeholder="unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="modelScopeFile">{t("model.modelScopeFilePath", { defaultValue: "模型文件" })}</Label>
                                    {availableFiles.length > 0 ? (
                                        <Select
                                            value={formData.modelScopeFilePath}
                                            onValueChange={(value) => updateForm("modelScopeFilePath", value)}
                                        >
                                            <SelectTrigger id="modelScopeFile">
                                                <SelectValue placeholder={t("model.selectFile", { defaultValue: "选择文件" })} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableFiles.map((file) => (
                                                    <SelectItem key={file.id} value={file.label}>
                                                        {file.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Input
                                            id="modelScopeFile"
                                            value={formData.modelScopeFilePath}
                                            onChange={(event) => updateForm("modelScopeFilePath", event.target.value)}
                                            placeholder={t("model.modelScopeFilePlaceholder", { defaultValue: "可选，填写具体模型文件路径" })}
                                        />
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="backend">{t("model.backendType")}</Label>
                                    <Select
                                        value={formData.backend}
                                        onValueChange={(value) => updateForm("backend", value)}
                                    >
                                        <SelectTrigger id="backend">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {backendOptions.map((backend) => (
                                                <SelectItem key={backend.value} value={backend.value}>
                                                    {backend.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>{t("model.replicas")}: {formData.replicas}</Label>
                                    <Slider
                                        value={[formData.replicas]}
                                        onValueChange={(value) => updateForm("replicas", value[0])}
                                        min={0}
                                        max={10}
                                        step={1}
                                        className="mt-2"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {t("model.replicaHint", { defaultValue: "副本为 0 时仅创建模型，不自动启动实例" })}
                                    </p>
                                </div>
                                <div>
                                    <Label htmlFor="placement">{t("model.placementStrategy", { defaultValue: "调度策略" })}</Label>
                                    <Select
                                        value={formData.placementStrategy}
                                        onValueChange={(value) => updateForm("placementStrategy", value)}
                                    >
                                        <SelectTrigger id="placement">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {placementOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center justify-between border rounded-lg px-3 py-2">
                                        <div>
                                            <Label htmlFor="cpuOffloading">CPU Offloading</Label>
                                            <p className="text-xs text-muted-foreground">
                                                {allowCpuOffloading
                                                    ? t("model.cpuOffloadHint", { defaultValue: "显存不足时将部分权重卸载到 CPU" })
                                                    : t("model.cpuOffloadUnsupportedHint", { defaultValue: "仅 GGUF 模型支持 CPU Offloading" })}
                                            </p>
                                        </div>
                                        <Switch
                                            id="cpuOffloading"
                                            checked={cpuOffloadingValue}
                                            disabled={!allowCpuOffloading}
                                            onCheckedChange={(checked) => {
                                                if (!allowCpuOffloading) return;
                                                updateForm("cpuOffloading", checked);
                                            }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between border rounded-lg px-3 py-2">
                                        <div>
                                            <Label htmlFor="distributed">
                                                {t("model.distributedInference", { defaultValue: "分布式推理" })}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("model.distributedInferenceHint", { defaultValue: "允许跨 Worker 切分模型运行" })}
                                            </p>
                                        </div>
                                        <Switch
                                            id="distributed"
                                            checked={formData.distributedInferenceAcrossWorkers}
                                            onCheckedChange={(checked) => updateForm("distributedInferenceAcrossWorkers", checked)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between border rounded-lg px-3 py-2 md:col-span-2">
                                        <div>
                                            <Label htmlFor="restartOnError">{t("model.restartOnError", { defaultValue: "故障自动重启" })}</Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("model.restartOnErrorHint", { defaultValue: "推理进程异常退出后自动拉起" })}
                                            </p>
                                        </div>
                                        <Switch
                                            id="restartOnError"
                                            checked={formData.restartOnError}
                                            onCheckedChange={(checked) => updateForm("restartOnError", checked)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="description">{t("model.description")}</Label>
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(event) => updateForm("description", event.target.value)}
                                        placeholder={t("model.descriptionPlaceholder")}
                                        rows={3}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="envVars">{t("model.environmentVariables")}</Label>
                                    <Textarea
                                        id="envVars"
                                        value={formData.environmentVariables}
                                        onChange={(event) => updateForm("environmentVariables", event.target.value)}
                                        placeholder={"KEY1=value1\nKEY2=value2"}
                                        rows={4}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {t("model.envVarsHelp")}
                                    </p>
                                </div>
                                {evaluationResult && (
                                    <div
                                        className={`border rounded-lg px-3 py-2 text-sm flex items-start gap-2 ${
                                            evaluationResult.compatible
                                                ? "border-green-500 text-green-600"
                                                : "border-amber-500 text-amber-600"
                                        }`}
                                    >
                                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                                        <div className="space-y-1">
                                            <div className="font-medium">
                                                {evaluationResult.compatible
                                                    ? t("model.evaluationPassed", { defaultValue: "评估通过，可以提交部署" })
                                                    : t("model.evaluationWarnings", { defaultValue: "评估存在警告，请检查配置" })}
                                            </div>
                                            <ul className="list-disc list-inside space-y-1">
                                                {evaluationResult.compatibility_messages?.map((msg, index) => (
                                                    <li key={`compat-${index}`}>{msg}</li>
                                                ))}
                                                {evaluationResult.scheduling_messages?.map((msg, index) => (
                                                    <li key={`schedule-${index}`}>{msg}</li>
                                                ))}
                                                {evaluationResult.error_message && <li>{evaluationResult.error_message}</li>}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-3">
                                    <Button variant="outline" onClick={() => handleEvaluate()} disabled={evaluating}>
                                        {evaluating ? t("model.evaluating", { defaultValue: "评估中..." }) : t("model.evaluate", { defaultValue: "评估兼容性" })}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-end gap-4">
                            <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
                                {t("model.cancel")}
                            </Button>
                            <Button onClick={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>{t("model.creating")}...</>
                                ) : (
                                    <>
                                        <Rocket className="h-4 w-4 mr-2" />
                                        {t("model.createDeployment")}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

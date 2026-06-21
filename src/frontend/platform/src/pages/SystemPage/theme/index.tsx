/**
 * Theme orchestrator —— 3B.5 步骤 4 主题配置编排层。
 *
 * 定位：装配层（非展示、非机制）。组合 4 个展示组件（BrandPicker / PresetThemes /
 *   DerivedPreview / ThemePreview）+ bg RadioGroup，接 themeApply 三态接口
 *   （previewTheme / commitTheme / resetTheme），完成单向数据流 + M1/M2/M3 闭环。
 *
 * 数据流（单向，props down / callback up）：
 *   - 编辑态（preview）：BrandPicker.onChange / PresetThemes.onSelect / 还原默认
 *       → setBrand + previewTheme（写 #theme-vars-preview，不落库、不碰 window.ThemeStyle）
 *       → setDerived（刷新右栏 DerivedPreview / ThemePreview）
 *   - 落库态（commit）：「应用」按钮 / bg RadioGroup
 *       → commitTheme（撤预览 → 写线上双 style → 写 window.ThemeStyle v3 → save）
 *
 * 砍项（相对 3B.5 前的手工调色版）：
 *   - 删 HSLitem.tsx（react-color SketchPicker 逐令牌手工调色）→ 改 brand 驱动派生
 *   - 删 themeKeys（HSLitem 专用 i18n 映射）、handleHSLChange、serializeThemeStyle
 *     （序列化收敛进 themeApply.commitTheme 内部的 serializeV3）
 *   - 删 NeutralToneSelector（plan 砍，neutral 硬编码 slate）
 *
 * window.ThemeStyle 写入收敛：本编排层不再直接写 window.ThemeStyle，写入全部经
 *   themeApply.commitTheme（v3 结构）。preview 态不写 window.ThemeStyle（themeApply 保证）。
 */
import { Button } from "@/components/bs-ui/button";
import { RefreshCw, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/bs-ui/radio";
import { Label } from "@/components/bs-ui/label";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/bs-ui/toast/use-toast";
import { deriveTheme, type CompTheme, type ThemeValue } from "@/services/theme/themeConfig";
import {
    previewTheme,
    commitTheme,
    resetTheme,
    type ApplyDeps,
} from "@/services/theme/themeApply";
import {
    saveThemeDebounced,
    getCurrentVersion,
    cancelPendingSave,
} from "@/services/theme/themePersistence";
import { PRESETS, type BrandValue } from "./presets";
import BrandPicker from "./BrandPicker";
import PresetThemes from "./PresetThemes";
import DerivedPreview from "./DerivedPreview";
import ThemePreview from "./ThemePreview";

declare global {
    interface Window {
        ThemeStyle: ThemeValue;
        // bootstrap（index.html inline）fetch web_config 后塞入，供 theme/index.tsx
        // versionRef 同步读初值，消除 getCurrentVersion 异步窗口（version 方案 B）。
        // fetch 失败或缺字段时为 undefined，versionRef fallback 到 0 并仍走 getCurrentVersion。
        __themeVersion?: number;
    }
}

/**
 * 中性灰阶常量（plan 砍了 NeutralToneSelector，3B 阶段固定 slate）。
 * deriveTheme / previewTheme / commitTheme 三处共用同一引用，避免散落。
 */
const NEUTRAL = { preset: 'slate' } as const;

/**
 * 计算初始品牌色（v1/v2/v3 加载兜底链，plan 验收项）。
 *
 * 三态判定（与 themeConfig.parseWebConfig 的 schema 判定同源）：
 *   - v3：window.ThemeStyle.v3Schema===true 且 brand 完整 → 用现有 v3 brand（保留用户已存配置）
 *   - v2：window.ThemeStyle.light 存在但无 v3Schema → v2 手工调色无法逆向出单一品牌色，
 *     降级到默认预设 PRESETS[0]（学术蓝），并由 detectLegacy 标记触发降级 banner（4.5）
 *   - 兜底（空 / 损坏 / v1）：PRESETS[0].brand（学术蓝）
 *
 * 注：本函数只决定 brand 初值，不读 _lock_version 作版本源（M2 由 versionRef 方案 B 负责）。
 */
function computeInitialBrand(): BrandValue {
    const ts = window.ThemeStyle;
    if (ts?.v3Schema && ts.brand
        && typeof ts.brand.light === 'string'
        && typeof ts.brand.dark === 'string'
        && typeof ts.brand.darkMode === 'boolean') {
        return { light: ts.brand.light, dark: ts.brand.dark, darkMode: ts.brand.darkMode };
    }
    // v2 / v1 / 空 / 损坏：统一降级到默认预设（v2 手工值无法逆向出品牌色）
    return { ...PRESETS[0].brand };
}

/**
 * 检测是否为 v2 手工调色遗留配置（用于决定是否渲染降级 banner）。
 *
 * 判定：window.ThemeStyle.light 存在（v2/v1 手工色板）但无 v3Schema 标记。
 * 这与 computeInitialBrand 的 v2 降级分支同条件——v2 数据走 PRESETS[0] 默认值，
 * 应用后旧手工配置将被 brand 派生覆盖，故需 banner 提示（plan 3B.2 v2 降级 UI 闭环）。
 */
function detectLegacyV2(): boolean {
    const ts = window.ThemeStyle;
    return !!(ts && !ts.v3Schema && ts.light && Object.keys(ts.light).length > 0);
}

export default function Theme() {
    const { t } = useTranslation();

    // 单向数据流 state（4.1）：
    //   brand —— 当前编辑的品牌色（preview 态，未 commit）
    //   bg    —— 工作流背景类型（'logo' | 'gradient'），向下兼容 window.ThemeStyle.bg
    //   derived —— brand 派生出的 {light, dark}，喂右栏 DerivedPreview / ThemePreview
    const [brand, setBrand] = useState<BrandValue>(() => computeInitialBrand());
    const [bg, setBg] = useState<string>(window.ThemeStyle?.bg || 'logo');
    // 初始 derived 用纯 deriveTheme（无副作用），**不调 previewTheme**：
    // previewTheme 会写 #theme-vars-preview 覆盖线上主题，预览态只应由用户交互（preview 回调）触发，
    // 组件 mount 不应污染线上态（用户只是打开主题页，尚未调色）。
    const [derived, setDerived] = useState<{ light: CompTheme; dark: CompTheme }>(
        () => deriveTheme(brand, NEUTRAL),
    );
    // v2 降级 banner 可见性（4.5）。初值据 detectLegacyV2，用户可关闭。
    const [legacyBanner, setLegacyBanner] = useState<boolean>(() => detectLegacyV2());

    /**
     * C7 乐观锁 version 缓存（M2 闭环，方案 B）。
     *
     * 方案 B（消除竞态）：初值同步读 window.__themeVersion（bootstrap fetch web_config 后塞入），
     * 消除「versionRef 初值 0 + getCurrentVersion 异步」窗口期——首次应用可能误报 10032 冲突。
     * getCurrentVersion 仍作 fallback：bootstrap 没塞时 useEffect 内异步补拉。
     * 卸载时 cancelPendingSave 取消挂起 save，防旧请求后到覆盖。
     * 用 useRef 而非 useState：version 变化不触发重渲染。
     */
    const versionRef = useRef<number>(window.__themeVersion ?? 0);
    useEffect(() => {
        if (window.__themeVersion === undefined) {
            getCurrentVersion().then(v => { versionRef.current = v; });
        }
        return () => {
            cancelPendingSave();
        };
    }, []);

    /**
     * 持久化依赖注入（M2 闭环：onConflict 刷新 versionRef）。
     *
     * commitTheme 内部：getCurrentVersion 取锁版本 → saveThemeDebounced(value, version, onConflict)。
     * onConflict 在 10032 冲突后把 versionRef 刷新到 latest（下次 commit 用新 version 重试）。
     * useRef 持有 deps，避免每次 render 重建对象引用。
     */
    const depsRef = useRef<ApplyDeps>({
        getCurrentVersion,
        saveThemeDebounced,
        cancelPendingSave,
    });
    // M2 闭环点：冲突回调刷新 versionRef（与 commitTheme 写的 _lock_version 天然一致，
    // 不读 window.ThemeStyle._lock_version 作版本源——themeApply 写它仅向下兼容）。
    const onConflict = (latest: number) => { versionRef.current = latest; };

    /**
     * 预览品牌色（编辑态，不落库）：setBrand + previewTheme + setDerived。
     * BrandPicker.onChange 与 PresetThemes.onSelect 共用此路径。
     */
    const preview = (next: BrandValue) => {
        setBrand(next);
        const d = previewTheme(next, NEUTRAL);
        setDerived(d);
    };

    /**
     * 应用当前 brand（commit，落库）。
     *
     * M1 闭环（一致性窗口）：commitTheme 调用包 try/catch，依赖 themePersistence 全兜底
     *   （冲突 toast + onConflict + 失败 toast）。orchestrator 不实现自动回滚——persistence
     *   全兜底下 M1 窗口不触发（YAGNI）。成功后 orchestrator 自己 toast「已应用」
     *   （独立于 persistence 静默成功）。
     * M3 最后防线：万一非法 hex 漏过 BrandPicker 校验，commitTheme→deriveTheme reject，
     *   catch 后 toast 错误，不白屏。
     */
    const handleApply = async () => {
        try {
            await commitTheme(
                { brand, neutral: NEUTRAL, bg, _lock_version: versionRef.current },
                depsRef.current,
                onConflict,
            );
            // M1 闭环：应用成功 toast（persistence 静默成功，编排层独立反馈）
            toast({ title: t('prompt'), variant: 'success', description: t('theme.applied') });
        } catch {
            // M3 最后防线：非法 hex / 派生异常兜底，不白屏
            toast({ title: t('prompt'), variant: 'error', description: t('theme.applyFailed') });
        }
    };

    /**
     * 还原默认（4.2）：resetTheme（撤预览）+ 回到 PRESETS[0] 默认预设并刷新派生。
     * 不自动 commit——用户确认后点「应用」才落库。
     */
    const handleReset = () => {
        resetTheme();
        const def = { ...PRESETS[0].brand };
        setBrand(def);
        setDerived(previewTheme(def, NEUTRAL));
    };

    /**
     * bg 切换（4.2 / M2 闭环点）：走 commitTheme 统一路径。
     * bg 也经 commitTheme（不走老 serializeThemeStyle），versionRef 与 commitTheme 写的
     * _lock_version 天然一致，消除老序列化路径。
     */
    const handleBgChange = async (val: string) => {
        setBg(val);
        try {
            await commitTheme(
                { brand, neutral: NEUTRAL, bg: val, _lock_version: versionRef.current },
                depsRef.current,
                onConflict,
            );
        } catch {
            toast({ title: t('prompt'), variant: 'error', description: t('theme.applyFailed') });
        }
    };

    return (
        <div className="flex justify-center border-t bg-accent">
            {/* 左栏：编辑区 */}
            <div className="w-[28rem] py-4 pr-8 border-r">
                {/* v2 降级 banner（4.5）：检测到旧版手工调色配置时显示，可关闭 */}
                {legacyBanner && (
                    <div
                        data-testid="legacy-v2-banner"
                        className="mb-4 flex items-start justify-between gap-2 rounded border border-warning bg-warning/10 px-3 py-2 text-xs text-warning-foreground"
                    >
                        <span>{t('theme.legacyV2Notice')}</span>
                        <button
                            type="button"
                            data-testid="legacy-v2-banner-close"
                            aria-label={t('close')}
                            onClick={() => setLegacyBanner(false)}
                            className="shrink-0 opacity-70 hover:opacity-100"
                        >
                            <X className="size-3.5" />
                        </button>
                    </div>
                )}

                <p className="flex justify-between items-center mb-4">
                    <span className="text-lg">{t('theme.colorConfig')}</span>
                    <Button className="right" variant="link" onClick={handleReset}>
                        <RefreshCw className="mr-1 size-4" />{t('theme.restoreDefault')}
                    </Button>
                </p>

                {/* 品牌色输入（light/dark + darkMode） */}
                <BrandPicker value={brand} onChange={preview} />

                {/* 预设品牌色网格 */}
                <p className="text-lg my-4">{t('theme.presetThemes')}</p>
                <PresetThemes current={brand} onSelect={preview} />

                {/* 工作流背景配置（bg 走 commitTheme 统一路径） */}
                <p className="flex justify-between items-center mt-6 mb-4">
                    <span className="text-lg">{t('theme.workflowBackgroundConfig')}</span>
                </p>
                <RadioGroup
                    value={bg}
                    onValueChange={handleBgChange}
                    className="flex space-x-2 h-[20px] mb-6"
                >
                    <div>
                        <Label className="flex justify-center">
                            <RadioGroupItem className="mr-2" value="logo" />{t('theme.eagentLogo')}
                        </Label>
                    </div>
                    <div>
                        <Label className="flex justify-center">
                            <RadioGroupItem className="mr-2" value="gradient" />{t('theme.themeColorGradientEffect')}
                        </Label>
                    </div>
                </RadioGroup>

                {/* 应用按钮（commit 落库） */}
                <Button data-testid="theme-apply" onClick={handleApply}>
                    {t('theme.apply')}
                </Button>
            </div>

            {/* 右栏：预览区 */}
            <div className="px-4 py-4 bg-card overflow-auto">
                <p className="text-xl mb-4">{t('theme.componentPreview')}</p>
                <div className="flex flex-col gap-8">
                    <DerivedPreview light={derived.light} dark={derived.dark} />
                    <ThemePreview light={derived.light} dark={derived.dark} />
                </div>
            </div>
        </div>
    );
};

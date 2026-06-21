/**
 * themeApply —— 三态预览编排层（theme-service 第四层，机制非 UI）。
 *
 * 层次定位：
 *   themeConfig（纯函数，数据层）→ themeRuntime（DOM 注入）
 *   → themePersistence（持久化）→ **themeApply（本模块，三态编排）**。
 *
 * 深模块：3 个动词接口（previewTheme / commitTheme / resetTheme），内部封装
 *   派生(deriveTheme) + DOM 双写(applyPreview/applyLight/applyDark/clearPreview)
 *   + 顺序 + window.ThemeStyle 组装 + serializeV3 + save。
 *
 * 三态语义（与 3B.5 orchestrator 的契约）：
 *   - preview：所见即所得预览。派生 + applyPreview 写 #theme-vars-preview（head 末尾，
 *     source order 覆盖线上）。**绝不碰 window.ThemeStyle、绝不调 persistence**。
 *   - commit：落库。派生 → clearPreview（撤预览覆盖）→ applyLight/applyDark（写线上双 style）
 *     → 写 window.ThemeStyle（v3 结构，向下兼容 + v3 元数据）→ deps.saveThemeDebounced。
 *     **首行 deps.cancelPendingSave**（防挂起 save 后到覆盖新 commit）。
 *   - reset：撤预览。clearPreview（删 #theme-vars-preview）。**不动 window.ThemeStyle、
 *     不调 persistence**（与 preview 对称，都是临时态）。
 *
 * 接缝设计（codebase-design）：
 *   - ApplyDeps 只注入持久化 3 函数（getCurrentVersion/saveThemeDebounced/cancelPendingSave），
 *     隔离 axios/toast/i18n，使本模块可在 jsdom + spy 下完整测试。
 *   - serialize/derive/applyLight/applyDark/clearPreview 全部硬引纯函数/jsdom 层，不再注入。
 *   - 返回值策略：previewTheme 返回 {light, dark} 派生结果（调用方 3B.5 可读用），
 *     commitTheme/resetTheme 返回 void（副作用型，无产物需返）。
 *
 * window.ThemeStyle v3 结构（commitTheme 写入契约）：
 *   直接复用 ThemeValue 类型，必含字段：
 *     - light: CompTheme（向下兼容 theme/index.tsx L96 读取点）
 *     - dark: CompTheme（向下兼容 theme/index.tsx L96 读取点）
 *     - bg: string（向下兼容 theme/index.tsx L100/186 读取点）
 *     - v3Schema: true（serializeThemeStyle v3 分支判定 L77）
 *     - brand / neutral / _lock_version（serializeThemeStyle v3 分支读 L77-87）
 *   依据：
 *     1. 现有 theme/index.tsx 读取契约：.light / .dark / .bg 必须存在
 *     2. serializeV3 产出 {version:3, brand, neutral, bg, _lock_version}（themeConfig L338-344）
 *     3. ThemeValue 类型（themeConfig L127-139）已含全部字段，无冲突
 */
import {
    deriveTheme,
    serializeV3,
    type CompTheme,
    type ThemeValue,
} from '@/services/theme/themeConfig';
import {
    applyPreview,
    clearPreview,
    applyLight,
    applyDark,
} from '@/services/theme/themeRuntime';

/**
 * 主题输入（v3 schema，brand 驱动）。
 *
 * 与 themeConfig.V3Serializable 对齐，但独立定义（编排层有自己的契约边界）：
 *   - brand：品牌色 { light, dark, darkMode }，light/dark 是 hex，darkMode 决定应用哪套
 *     （本编排层不读 darkMode，由调用方 / setMode 控制；deriveTheme 也总派生两套）
 *   - neutral：中性灰阶预设 { preset }
 *   - bg：背景类型（'logo' | ...），向下兼容 ThemeValue.bg
 *   - _lock_version：C7 乐观锁版本号
 */
export type ThemeInput = {
    brand: { light: string; dark: string; darkMode: boolean };
    neutral: { preset: string };
    bg: string;
    _lock_version: number;
};

/**
 * 持久化副作用注入（隔离 axios/toast/i18n）。
 *
 * serialize/derive/applyLight/applyDark/clearPreview 全部硬引纯函数/jsdom，不再注入；
 * 只把会触发网络 / UI 副作用的 3 函数留接缝，方便测试 mock。
 *
 * 接缝性质（codebase-design 诚实标注）：这是 **test seam（为可测性注入）**，非领域接缝——
 * 生产中只有 themePersistence 一套实现，无第二适配器。保留注入是为测试隔离 axios/toast/i18n，
 * 不为多适配器扩展（YAGNI）。
 *
 * saveThemeDebounced 签名与 themePersistence.saveThemeDebounced 对齐
 * （value: 序列化后的 JSON 字符串；version: 乐观锁版本；onConflict: 冲突回调）。
 */
export type ApplyDeps = {
    getCurrentVersion: () => Promise<number>;
    saveThemeDebounced: (
        value: string,
        version: number,
        onConflict?: (latestVersion: number) => void,
    ) => Promise<void>;
    cancelPendingSave: () => void;
};

/**
 * 预览主题：派生 + applyPreview 写 #theme-vars-preview。
 *
 * 行为：
 *   1. deriveTheme(brand, neutral) 产出 {light, dark}（纯函数，真跑派生算法）
 *   2. applyPreview(light, dark) 写 head 末尾的 #theme-vars-preview（source order 覆盖线上）
 *
 * 边界（与 commitTheme/resetTheme 的区分点）：
 *   - 绝不碰 window.ThemeStyle（不替换、不 in-place 改）
 *   - 绝不调 persistence（preview 是临时预览，不落库）
 *   - 不调 clearPreview / applyLight / applyDark（预览用独立 #theme-vars-preview 节点，
 *     不污染线上双 style）
 *
 * 输入契约（M3，调用方职责）：brand.light / brand.dark 必须是合法 #rrggbb（或 rrggbb），
 *   否则 deriveTheme → colorUtils.hexToRgb 抛 Error（hexToRgb 有意不兜底，见 colorUtils.ts）。
 *   调用方（3B.5 BrandPicker）负责 HEX 输入校验，非法中间态不调本函数或 catch 后 UI 提示。
 *
 * @returns {light, dark} 派生结果，调用方（3B.5 BrandPicker）可读用做后续 commit 的派生缓存
 *          或 UI 显示（如色板预览）
 */
export function previewTheme(
    brand: ThemeInput['brand'],
    neutral: ThemeInput['neutral'],
): { light: CompTheme; dark: CompTheme } {
    const { light, dark } = deriveTheme(brand, neutral);
    applyPreview(light, dark);
    return { light, dark };
}

/**
 * 落库主题：派生 + clearPreview + applyLight/applyDark + 写 ThemeStyle + save。
 *
 * 执行顺序（关键：cancelPendingSave 必为首行）：
 *   1. **首行 deps.cancelPendingSave()** —— 取消挂起的 debounce save，防旧请求后到
 *      覆盖本次 commit（对应 theme/index.tsx L150-152 C4 语义）
 *   2. deriveTheme 产出 {light, dark}
 *   3. clearPreview —— 撤预览覆盖（#theme-vars-preview 删除），后续 applyLight/applyDark
 *      写线上双 style 后预览态自然失效（且 preview 节点不该残留进落库后状态）
 *   4. applyLight(light) / applyDark(dark) —— 写线上 #theme-vars-light / #theme-vars-dark
 *   5. 写 window.ThemeStyle（v3 结构：{light, dark, bg, v3Schema:true, brand, neutral, _lock_version}）
 *      向下兼容现有读取点 + 携带 v3 元数据供 serializeThemeStyle v3 分支读
 *   6. getCurrentVersion 取当前锁版本 → serializeV3(input) 产出落库 JSON
 *      → deps.saveThemeDebounced(value, version, onConflict)
 *
 * 已知遗留（诚实标注，3B.5/3B.6 接入时处理，plan 已登记）：
 *   - M1 一致性窗口：步骤 4-5（写 DOM/ThemeStyle）先于步骤 6（save）。当前 persistence
 *     全兜底（getCurrentVersion 失败返 0、saveThemeDebounced 内部全 catch），save 不抛、
 *     窗口不触发；若 3B.5 注入非兜底 deps 或 save 实际失败，会出现「内存已改 / DB 未改」
 *     两态分裂。3B.5 评估是否需 save 成功确认或失败回滚。
 *   - M2 version 闭环：window.ThemeStyle._lock_version 写 input._lock_version（调用方快照），
 *     save 成功后后端 version+1 但本字段不自动同步。3B.5 orchestrator 应用 versionRef
 *     （getCurrentVersion + onConflict 刷新）做乐观锁，不依赖此字段；若仍走 serializeThemeStyle
 *     老路径保存，需确保 versionRef 与 _lock_version 一致。
 *   - M3 brand 契约：同 previewTheme，brand.light/dark 必须合法 #rrggbb，否则步骤 2
 *     deriveTheme 抛 Error。调用方（3B.5 BrandPicker）负责输入校验。
 *
 * 副作用分别断言（见 themeApply.test.ts 的 commitTheme describe 块）：
 *   - 不绑函数调用顺序——顺序断言脆弱、重构易碎，只锁最终副作用产物。
 *   - cancelPendingSave 被调 / #theme-vars-preview 被删 / light-dark style 被更新 /
 *     ThemeStyle 写 v3 字段 / saveThemeDebounced 收到 serialize 产物 / version 来自
 *     getCurrentVersion / onConflict 透传并触发。
 *
 * @param input       ThemeInput（brand/neutral/bg/_lock_version）
 * @param deps        持久化副作用注入
 * @param onConflict  冲突回调（透传给 saveThemeDebounced，参数为 latest version）
 */
export async function commitTheme(
    input: ThemeInput,
    deps: ApplyDeps,
    onConflict?: (latestVersion: number) => void,
): Promise<void> {
    // 1. 首行：取消挂起 save（防旧请求后到覆盖本次 commit）
    deps.cancelPendingSave();

    // 2. 派生
    const { light, dark } = deriveTheme(input.brand, input.neutral);

    // 3. 撤预览（clearPreview 幂等，未预览时也不报错）
    clearPreview();

    // 4. 写线上双 style
    applyLight(light);
    applyDark(dark);

    // 5. 写 window.ThemeStyle（v3 结构，向下兼容 + v3 元数据）
    const newThemeStyle: ThemeValue = {
        light,
        dark,
        bg: input.bg,
        v3Schema: true,
        brand: input.brand,
        neutral: input.neutral,
        _lock_version: input._lock_version,
    };
    (window as unknown as { ThemeStyle: ThemeValue }).ThemeStyle = newThemeStyle;

    // 6. 落库：getCurrentVersion → serializeV3 → saveThemeDebounced
    const version = await deps.getCurrentVersion();
    const value = serializeV3({
        brand: input.brand,
        neutral: input.neutral,
        bg: input.bg,
        _lock_version: input._lock_version,
    });
    await deps.saveThemeDebounced(value, version, onConflict);
}

/**
 * 重置预览：clearPreview 删除 #theme-vars-preview。
 *
 * 边界（与 previewTheme 对称，都是临时态）：
 *   - 不动 window.ThemeStyle（reset 只撤预览，不回滚线上 ThemeStyle 到旧值——
 *     「回滚线上」是 3B.5 orchestrator 的职责，需重新派生 + commit 才能完成）
 *   - 不调 persistence（reset 是纯 DOM 清理，不落库）
 *
 * 幂等：未预览（#theme-vars-preview 不存在）时直接调不报错（clearPreview 已兜底）。
 */
export function resetTheme(): void {
    clearPreview();
}

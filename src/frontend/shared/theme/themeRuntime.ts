/**
 * themeRuntime —— 主题 DOM 注入层（theme-service 三浅接口的第二层）。
 *
 * 层次定位：
 *   themeConfig（纯函数，数据层）→ **themeRuntime（本模块，DOM 注入）**
 *   → themePersistence（任务3，持久化）。
 *
 * 本模块只负责把 CompTheme 数据写进 DOM（<style> 标签 + html class），
 * 不含业务逻辑、不读 localStorage、不调 API。
 *
 * 双 style 常驻方案（消除现有单 #theme-vars 整体替换导致的两类缺陷）：
 *   - A4：现有 applyThemeComp 用单个 #theme-vars，切模式时整体重写该 style，
 *     若时机错位会出现「切模式丢注入」。本方案 light/dark 各自独立 style 常驻，
 *     切模式只 toggle html 的 .dark class（setMode），绝不重写 style。
 *   - C2：现有 darkContext 切回浅色时若无对应数据会把 #theme-vars 清空成
 *     `:root{}`，丢失已注入色。本方案两套 style 独立常驻，互不影响。
 *
 * 双 style 按需创建：light/dark style 在首次 applyLight/applyDark 时才插入 DOM，
 *   用户未进主题页前两 style 均不存在（仅 bootstrap 单 #theme-vars 在线）。
 *   阶段3 bootstrap 改造时统一在 index.html 初始化 DEFAULT 内容的双 style，
 *   消除「React 挂载前 dark 模式无 #theme-vars-dark 在线」的过渡期。
 *
 * C5 diff：applyLight/applyDark 写入前先 diff（style.innerHTML === newContent 则 return）。
 *   当前覆盖范围：仅 applyLight/applyDark 自身的重复调用（如 debounce / 多处触发同一 comp 时），
 *   第二次相同 comp 写入直接 return，避免 innerHTML 重置 → 浏览器重算规则 → 闪烁。
 *   未覆盖 bootstrap：index.html bootstrap 写单 `#theme-vars`（不同 DOM 节点），与 light/dark
 *   双 style 各写各的，不存在同节点双写。阶段3 改 index.html bootstrap 改写 light/dark id 后，
 *   C5 才真正覆盖 bootstrap 与运行时的同节点重复写入。
 *
 * 预览态覆盖：applyPreview 把 light+dark 写进 head 末尾的 #theme-vars-preview，
 *   利用 CSS source order（后者优先）覆盖线上 light/dark style；clearPreview 删除。
 *
 * 制式约定：CompTheme 中 h∈[0,360]，s/l 为 0-1 制（与 themeConfig 对齐）。
 * 拼接时 s/l ×100 得百分数（与现有 applyThemeComp 的 `s*100+'%'` 一致）。
 */
import type { CompTheme } from './themeConfig';

/** 线上 light style 的 DOM id（:root 选择器，常驻）。 */
const LIGHT_STYLE_ID = 'theme-vars-light';
/** 线上 dark style 的 DOM id（.dark 选择器，常驻）。 */
const DARK_STYLE_ID = 'theme-vars-dark';
/** 预览态 style 的 DOM id（head 末尾，临时覆盖线上）。 */
const PREVIEW_STYLE_ID = 'theme-vars-preview';

/** html 标记深色模式的 class（与 darkContext / tailwind darkMode:['class'] 对齐）。 */
const DARK_CLASS = 'dark';

/**
 * CSS 变量 key 白名单：允许 `--` 起首，后跟小写字母、数字、连字符，首字符必须为字母。
 *
 * 正则：`^--[a-z][a-z0-9-]*$`
 *   - 允许字母 + 数字 + 连字符：阶段3 品牌色派生会产色阶键（如 `--brand-50` /
 *     `--brand-500` / `--brand-900`），需放行数字。
 *   - 首字符必须字母：拒绝 `--123` 这类纯数字起首键（非合法 CSS 变量名习惯）。
 *   - 禁止大写字母 / 下划线 / 特殊字符：与 Tailwind / shadcn 体系小写连字符约定一致，
 *     并阻断可能的 CSS 注入向量（如 `--;` / `--x;}` / `--<script>` 等无效或危险序列）。
 */
const KEY_RE = /^--[a-z][a-z0-9-]*$/;

/**
 * 把 CompTheme 拼成 CSS 规则体（不含选择器与花括号）。
 *
 * S1 安全校验（复用自现有 applyThemeComp）：
 *   - key 必须匹配 KEY_RE（^--[a-z][a-z0-9-]*$，见上方白名单注释），否则跳过
 *   - h/s/l 必须都是 number，否则跳过
 *   - h∈[0,360]、s∈[0,1]、l∈[0,1]，任一越界跳过
 *
 * 通过校验的项拼成 `--key:h s% l%;`（s/l 是 0-1 制，×100 转百分数）。
 * 不合法项静默跳过（上层 normLegacy 已做制式归一，此处只兜底防恶意/脏数据）。
 */
export function formatCssRules(comp: CompTheme): string {
    let rules = '';
    for (const key of Object.keys(comp)) {
        if (!KEY_RE.test(key)) continue;
        const hsl = comp[key];
        if (hsl == null) continue;
        if (typeof hsl.h !== 'number' || typeof hsl.s !== 'number' || typeof hsl.l !== 'number') continue;
        if (!(hsl.h >= 0 && hsl.h <= 360)) continue;
        if (!(hsl.s >= 0 && hsl.s <= 1)) continue;
        if (!(hsl.l >= 0 && hsl.l <= 1)) continue;
        rules += `${key}:${hsl.h} ${hsl.s * 100}% ${hsl.l * 100}%;`;
    }
    return rules;
}

/**
 * 取得或创建指定 id 的 <style> 标签。已存在则返回现有元素（更新其内容）。
 */
function getOrCreateStyle(id: string): HTMLStyleElement {
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
        style = document.createElement('style');
        style.id = id;
        document.head.appendChild(style);
    }
    return style;
}

/**
 * 拼出某选择器下 comp 对应的完整 style 内容：`selector{...formatCssRules(comp)...}`。
 *
 * 抽此函数是为 C5 diff：applyLight/applyDark 写入前先用同样规则算出 newContent，
 * 与现有 style.innerHTML 比对，相同则不重写（消除 applyLight/applyDark 自身重复调用同一 comp
 * 触发的双写闪烁 —— 第二次相同 comp 写入直接 return，避免 innerHTML 重置导致的样式重算）。
 * 注：当前 C5 未覆盖 bootstrap（bootstrap 写单 #theme-vars，与 light/dark 双 style 不同节点，
 * 不存在同节点双写）；阶段3 改 index.html bootstrap 写 light/dark id 后 C5 才覆盖该场景。
 */
export function buildStyleContent(selector: string, comp: CompTheme): string {
    return `${selector}{${formatCssRules(comp)}}`;
}

/**
 * 构造作用域化 CSS：`.scopeClass{formatCssRules(comp)}`。
 *
 * 用途：ThemePreview 同屏 split 场景。两套品牌色预览需要各自独立的 CSS 变量作用域，
 * 不能依赖全局 html 的 .dark class（切 dark 模式会同时影响两套）。给每个预览容器
 * 挂一个唯一 scopeClass，CSS 变量写在 `.scopeClass{...}` 下，作用域内覆盖全局。
 *
 * 与 buildStyleContent 的区别：buildStyleContent 用 :root 或 .dark 等全局选择器
 * （走线上注入）；buildScopedCss 用传入的任意 scopeClass（走预览隔离）。
 * 两者都复用 formatCssRules（含 KEY_RE 白名单 + hsl 校验），非法项静默跳过。
 */
export function buildScopedCss(scopeClass: string, comp: CompTheme): string {
    return `.${scopeClass}{${formatCssRules(comp)}}`;
}

/**
 * 写入线上浅色主题：`<style id="theme-vars-light">:root{...}</style>`。
 * style 不存在则创建；已存在则 **diff 后**原位更新内容（C5：内容相同则跳过，不重写 innerHTML）。
 */
export function applyLight(comp: CompTheme): void {
    const style = getOrCreateStyle(LIGHT_STYLE_ID);
    const newContent = buildStyleContent(':root', comp);
    if (style.innerHTML === newContent) return;
    style.innerHTML = newContent;
}

/**
 * 写入线上深色主题：`<style id="theme-vars-dark">.dark{...}</style>`。
 * 选择器是 .dark，仅当 html 带 dark class 时生效（由 setMode 控制）。
 * **diff 后**原位更新内容（C5：内容相同则跳过，不重写 innerHTML）。
 */
export function applyDark(comp: CompTheme): void {
    const style = getOrCreateStyle(DARK_STYLE_ID);
    const newContent = buildStyleContent(`.${DARK_CLASS}`, comp);
    if (style.innerHTML === newContent) return;
    style.innerHTML = newContent;
}

/**
 * 写入预览主题：`<style id="theme-vars-preview">` 置于 head 末尾，
 * 内含 `:root{...light...} .dark{...dark...}`。利用 CSS source order
 * （后出现的同名规则优先）覆盖线上 light/dark style，实现所见即所得预览。
 *
 * 若已存在 preview style，先删除再重建，确保它始终位于 head 末尾（source order 最末）。
 */
export function applyPreview(light: CompTheme, dark: CompTheme): void {
    // 幂等：先清理旧 preview，保证新节点落在 head 末尾（覆盖优先级最高）。
    clearPreview();
    const style = document.createElement('style');
    style.id = PREVIEW_STYLE_ID;
    style.innerHTML = `:root{${formatCssRules(light)}} .${DARK_CLASS}{${formatCssRules(dark)}}`;
    document.head.appendChild(style);
}

/**
 * 删除预览 style（#theme-vars-preview）。幂等：不存在时不报错。
 * 删除后线上 light/dark style 重新生效。
 */
export function clearPreview(): void {
    document.getElementById(PREVIEW_STYLE_ID)?.remove();
}

/**
 * 切换深/浅色模式：toggle html 元素的 .dark class。
 *
 * 设计要点：**只 toggle class，绝不重写 style**。双 style（light :root + dark .dark）
 * 常驻 DOM，切模式靠 class 增减决定哪套生效，消除现有单 #theme-vars 整体替换
 * 导致的切模式丢注入（A4）与切回丢色（C2）。
 */
export function setMode(mode: 'light' | 'dark'): void {
    document.documentElement.classList.toggle(DARK_CLASS, mode === 'dark');
}

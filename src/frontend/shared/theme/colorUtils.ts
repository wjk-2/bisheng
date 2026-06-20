/**
 * colorUtils —— 通用颜色数学工具（纯 TS，零第三方依赖）。
 *
 * 用途：3B.3 品牌色派生算法（brand → 21 个 HSL 令牌）所需的底层
 * 颜色空间换算与 WCAG 对比度计算在此实现。本模块只提供标准 sRGB
 * 数学，不包含任何主题特定数据（Radix 灰阶常量在 themeConfig.ts）。
 *
 * 约束：shared 层严禁引入任何第三方 bare import（rollup 按物理路径
 * 向上找 node_modules，shared 无独立 package.json）。本文件所有
 * 算法纯手写，仅使用 TS 内置类型。
 *
 * 参考：
 *   - sRGB 通道线性化：WCAG 2.x 规范
 *   - HSL ↔ RGB：标准 Foley & van Dam 算法
 */

/** RGB 三元组（0-255 整数或浮点皆可，单字段）。 */
export interface Rgb {
    r: number;
    g: number;
    b: number;
}

/** HSL 三元组：h 为 0-360 度，s/l 为 0-100 百分比。 */
export interface Hsl {
    h: number;
    s: number;
    l: number;
}

/**
 * hex 字符串 → RGB。接受 `#rrggbb` 或 `rrggbb`（大小写皆可）。
 * 不接受 #rgb 短形式（派生场景只用 6 位 hex）。非法输入抛错而非静默兜底，
 * 因为派生算法的输入来自内部品牌色常量，不应容忍格式错误。
 */
export function hexToRgb(hex: string): Rgb {
    let normalized = hex.trim();
    if (normalized.startsWith('#')) {
        normalized = normalized.slice(1);
    }
    if (normalized.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(normalized)) {
        throw new Error(`hexToRgb: invalid hex "${hex}", expected #rrggbb or rrggbb`);
    }
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return { r, g, b };
}

/**
 * RGB → hex 字符串，返回 `#rrggbb` 小写。
 * 输入值会被 clamp 到 [0, 255] 并取整，避免浮点误差污染 hex（如 255.9999998）。
 */
export function rgbToHex(r: number, g: number, b: number): string {
    const clamp = (v: number): number => {
        const rounded = Math.round(v);
        if (rounded < 0) return 0;
        if (rounded > 255) return 255;
        return rounded;
    };
    const toHex2 = (v: number): string => clamp(v).toString(16).padStart(2, '0');
    return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

/**
 * RGB（0-255）→ HSL。
 * 返回 h ∈ [0, 360)、s ∈ [0, 100]、l ∈ [0, 100]。
 * 灰度图（r=g=b）时 h 定义为 0、s 为 0。
 */
export function rgbToHsl(r: number, g: number, b: number): Hsl {
    const rN = r / 255;
    const gN = g / 255;
    const bN = b / 255;
    const max = Math.max(rN, gN, bN);
    const min = Math.min(rN, gN, bN);
    const delta = max - min;
    const l = (max + min) / 2;

    let h = 0;
    let s = 0;

    if (delta !== 0) {
        // saturation
        s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
        // hue
        switch (max) {
            case rN:
                h = (gN - bN) / delta + (gN < bN ? 6 : 0);
                break;
            case gN:
                h = (bN - rN) / delta + 2;
                break;
            default:
                h = (rN - gN) / delta + 4;
                break;
        }
        h *= 60;
    }

    return { h, s: s * 100, l: l * 100 };
}

/**
 * HSL（h 0-360, s/l 0-100）→ RGB（0-255）。
 * h 会归一到 [0, 360)，s/l clamp 到 [0, 100]。
 */
export function hslToRgb(h: number, s: number, l: number): Rgb {
    // 归一
    const hN = ((h % 360) + 360) % 360 / 360;
    const sN = Math.min(100, Math.max(0, s)) / 100;
    const lN = Math.min(100, Math.max(0, l)) / 100;

    let r: number;
    let g: number;
    let b: number;

    if (sN === 0) {
        // 纯灰度
        r = g = b = lN;
    } else {
        const hue2rgb = (p: number, q: number, t: number): number => {
            let tN = t;
            if (tN < 0) tN += 1;
            if (tN > 1) tN -= 1;
            if (tN < 1 / 6) return p + (q - p) * 6 * tN;
            if (tN < 1 / 2) return q;
            if (tN < 2 / 3) return p + (q - p) * (2 / 3 - tN) * 6;
            return p;
        };

        const q = lN < 0.5 ? lN * (1 + sN) : lN + sN - lN * sN;
        const p = 2 * lN - q;
        r = hue2rgb(p, q, hN + 1 / 3);
        g = hue2rgb(p, q, hN);
        b = hue2rgb(p, q, hN - 1 / 3);
    }

    return { r: r * 255, g: g * 255, b: b * 255 };
}

/**
 * 单通道 sRGB → 线性光（WCAG 2.x 规范）。
 * 阈值 0.03928 是规范原文（实际 0.04045 的近似历史值，规范明文采用 0.03928）。
 */
function channelToLinear(c: number): number {
    const cSrgb = c / 255;
    return cSrgb <= 0.03928 ? cSrgb / 12.92 : Math.pow((cSrgb + 0.055) / 1.055, 2.4);
}

/**
 * 相对亮度 Y（WCAG 2.x），返回 [0, 1]。
 * 白为 1、黑为 0。系数固定：0.2126 R + 0.7152 G + 0.0722 B。
 */
export function relativeLuminance(r: number, g: number, b: number): number {
    return (
        0.2126 * channelToLinear(r) +
        0.7152 * channelToLinear(g) +
        0.0722 * channelToLinear(b)
    );
}

/**
 * WCAG 对比比，返回 [1, 21]。
 * 公式：(L_亮 + 0.05) / (L_暗 + 0.05)。同色 = 1.0、黑白 = 21。
 * 接受 Rgb 对象（0-255）。
 */
export function contrastRatio(rgb1: Rgb, rgb2: Rgb): number {
    const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 给定背景色，返回对比比更高的前景色（#000000 或 #ffffff）。
 * 用于 primary-foreground 等「背景已知、前景黑白二选一」的派生场景。
 * 对比比相等时默认返回黑（极少出现，仅理论上可能）。
 */
export function pickForeground(bgHex: string): '#000000' | '#ffffff' {
    const bg = hexToRgb(bgHex);
    const ratioBlack = contrastRatio(bg, { r: 0, g: 0, b: 0 });
    const ratioWhite = contrastRatio(bg, { r: 255, g: 255, b: 255 });
    return ratioBlack >= ratioWhite ? '#000000' : '#ffffff';
}

/// <reference types="vite/client" />

export {};

declare global {
    /**
     * Vite 构建时注入的全局环境变量
     * @see vite.config.ts define: { __APP_ENV__: JSON.stringify(app_env) }
     */
    const __APP_ENV__: {
        /** 应用基础路径 - workspace 前端使用 /workspace */
        BASE_URL: string;
        /** E-Agent Platform 主机路径 - 用于跨前端跳转 */
        EAGENT_HOST: string;
    };

    interface Window {
        /** 是否为移动端 */
        isMobile?: boolean;
        /** 是否为微信浏览器 */
        isWechat?: boolean;
    }
}

// ============ CSS 模块声明 ============

/** 全局 CSS 文件导入声明（无模块） */
declare module "*.css" {
    const content: string;
    export default content;
}

/** CSS 模块声明（有作用域） */
declare module "*.module.css" {
    const classes: { [className: string]: string };
    export default classes;
}

// ============ 静态资源声明 ============

declare module "*.png" {
    const content: string;
    export default content;
}

declare module "*.jpg" {
    const content: string;
    export default content;
}

declare module "*.jpeg" {
    const content: string;
    export default content;
}

declare module "*.gif" {
    const content: string;
    export default content;
}

declare module "*.svg" {
    const content: string;
    export default content;
}

declare module "*.webp" {
    const content: string;
    export default content;
}

declare module "*.ico" {
    const content: string;
    export default content;
}

// ============ 字体文件声明 ============

declare module "*.woff" {
    const content: string;
    export default content;
}

declare module "*.woff2" {
    const content: string;
    export default content;
}

declare module "*.ttf" {
    const content: string;
    export default content;
}

declare module "*.eot" {
    const content: string;
    export default content;
}

// ============ 其他资源声明 ============

declare module "*.json" {
    const content: unknown;
    export default content;
}

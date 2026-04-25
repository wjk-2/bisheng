export { };

declare global {
    interface Window {
        SearchSkillsPage: unknown;
        errorAlerts: (errorList: string[]) => void;
        _flow: {
            id: string;
            name: string;
            description?: string;
            data?: Record<string, unknown>;
        } | null;
        /** 知识库名称临时传参（页面间通信） */
        libname?: [string, string] | null;
        /** 助手创建标记 */
        assistantCreate?: boolean;
    }

    /**
     * Vite 构建时注入的全局环境变量
     * @see vite.config.mts define: { __APP_ENV__: JSON.stringify(app_env) }
     */
    const __APP_ENV__: {
        /** 应用基础路径，用于子路由部署场景 */
        BASE_URL: string;
    };
}

// ============ CSS 模块声明 ============

/** 全局 CSS 文件导入声明 */
declare module "*.css" {
    const content: { [className: string]: string };
    export default content;
}

/** 全局 CSS 文件（无模块） */
declare module "*.css";

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

/** SVG 作为 React 组件导入（vite-plugin-svgr ?react 语法） */
declare module "*.svg?react" {
    import type { ComponentType, SVGProps } from "react";
    const content: ComponentType<SVGProps<SVGSVGElement>>;
    export default content;
}

/** SVG 作为 React 组件导入（vite-plugin-svgr） */
declare module "*.svg?react" {
    import type { ComponentType, SVGProps } from "react";
    const content: ComponentType<SVGProps<SVGSVGElement>>;
    export default content;
}

/** SVG 作为 React 组件导入（svgr 另一种语法） */
declare module "*.svg?component" {
    import type { ComponentType, SVGProps } from "react";
    const content: ComponentType<SVGProps<SVGSVGElement>>;
    export default content;
}

/** 使用 ?inline 后缀导入 SVG 源码字符串 */
declare module "*.svg?inline" {
    const content: string;
    export default content;
}

/** 使用 ?url 后缀明确导入为 URL */
declare module "*.svg?url" {
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

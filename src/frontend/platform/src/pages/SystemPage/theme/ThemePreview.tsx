/**
 * ThemePreview —— 3B.5 步骤 2.2 业务 mock 预览组件。
 *
 * 职责：light/dark 同屏 split 展示，靠 scope class 隔离 CSS 变量
 * （不依赖全局 html.dark class，预览态两套独立并存）。
 *
 * 关键设计：
 *   - 每容器注入一个 <style>{buildScopedCss(scopeClass, comp)}</style>，
 *     CSS 变量写在 .scopeClass{...} 下，作用域内覆盖全局
 *   - mock 元件只用无 dark: 前缀的 utility（bg-primary 等），靠 scope CSS 变量隔离
 *   - 不引 reactflow：工作流用纯 div + SVG 模拟节点连线
 *
 * 纯展示层：无 onChange（数据由上层 deriveTheme 产出）。
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/bs-ui/button';
import { Badge } from '@/components/bs-ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/bs-ui/card';
import { buildScopedCss } from '@shared/theme/themeRuntime';
import type { CompTheme } from '@shared/theme/themeConfig';

export interface ThemePreviewProps {
    light: CompTheme;
    dark: CompTheme;
}

/**
 * 工作流 mock：3 个节点 + SVG 连线，纯 div + SVG，不引 reactflow。
 * 节点用 bg-card/border，连线用 stroke。
 */
const WorkflowMock: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className="relative h-40 w-full border border-border rounded bg-background p-2">
            <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none">
                <line x1="80" y1="40" x2="180" y2="40" stroke="currentColor" strokeWidth="2" className="text-muted-foreground" />
                <line x1="220" y1="40" x2="320" y2="40" stroke="currentColor" strokeWidth="2" className="text-muted-foreground" />
                <polygon points="320,40 312,36 312,44" fill="currentColor" className="text-muted-foreground" />
            </svg>
            <div className="absolute left-2 top-4 w-20 rounded border border-border bg-card p-1 text-[10px]">
                {t('theme.preview.nodeStart')}
            </div>
            <div className="absolute left-44 top-4 w-20 rounded border border-border bg-card p-1 text-[10px]">
                {t('theme.preview.nodeProcess')}
            </div>
            <div className="absolute right-2 top-4 w-20 rounded border border-border bg-primary text-primary-foreground p-1 text-[10px]">
                {t('theme.preview.nodeEnd')}
            </div>
        </div>
    );
};

/**
 * 对话 mock：用户气泡（bg-primary）+ 助手气泡（bg-card）。
 */
const ChatMock: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-2">
            <div className="self-end max-w-[70%] rounded bg-primary text-primary-foreground px-2 py-1 text-xs">
                {t('theme.preview.chatUser')}
            </div>
            <div className="self-start max-w-[70%] rounded bg-card border border-border text-card-foreground px-2 py-1 text-xs">
                {t('theme.preview.chatAssistant')}
            </div>
        </div>
    );
};

/**
 * 单容器：scope class + style + 业务 mock。
 * style 注入到当前容器内（DOM 顺序天然保证 scope 优先级）。
 */
const PreviewPane: React.FC<{
    mode: 'light' | 'dark';
    scopeClass: string;
    comp: CompTheme;
    children: React.ReactNode;
}> = ({ mode, scopeClass, comp, children }) => {
    const { t } = useTranslation();
    return (
        <div className="flex-1">
            <style>{buildScopedCss(scopeClass, comp)}</style>
            <div
                data-testid={`theme-preview-${mode}`}
                className={scopeClass}
            >
                <div className="mb-2 text-sm font-medium">
                    {mode === 'light' ? t('theme.preview.lightTitle') : t('theme.preview.darkTitle')}
                </div>
                <div className="flex flex-col gap-3 rounded border border-border bg-background p-3">
                    {children}
                </div>
            </div>
        </div>
    );
};

/**
 * 单容器内业务 mock 组合：按钮/徽章/卡片/工作流/对话。
 * 所有元件只用无 dark: 前缀的 utility，靠 scope CSS 变量隔离。
 */
const MockSuite: React.FC = () => {
    const { t } = useTranslation();
    return (
        <>
            <div className="flex gap-2 flex-wrap">
                <Button variant="default">{t('theme.preview.button')}</Button>
                <Button variant="outline">{t('theme.preview.outline')}</Button>
                <Button variant="secondary">{t('theme.preview.secondary')}</Button>
            </div>
            <div className="flex gap-2 flex-wrap">
                <Badge>{t('theme.preview.badge')}</Badge>
                <Badge variant="secondary">{t('theme.preview.badgeSecondary')}</Badge>
            </div>
            <Card className="bg-card text-card-foreground">
                <CardHeader>
                    <CardTitle className="text-sm">{t('theme.preview.cardTitle')}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs">
                    {t('theme.preview.cardContent')}
                </CardContent>
            </Card>
            <WorkflowMock />
            <ChatMock />
        </>
    );
};

const ThemePreview: React.FC<ThemePreviewProps> = ({ light, dark }) => {
    return (
        <div className="flex gap-4">
            <PreviewPane mode="light" scopeClass="theme-preview-light" comp={light}>
                <MockSuite />
            </PreviewPane>
            <PreviewPane mode="dark" scopeClass="theme-preview-dark" comp={dark}>
                <MockSuite />
            </PreviewPane>
        </div>
    );
};

export default ThemePreview;

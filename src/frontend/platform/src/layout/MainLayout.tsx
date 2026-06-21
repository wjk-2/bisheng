import {
    ApplicationIcon,
    EvaluatingIcon,
    KnowledgeIcon,
    LabelIcon,
    LogIcon,
    ModelIcon,
    QuitIcon,
    SystemIcon,
    TechnologyIcon
} from "@/components/bs-icons";
import { DatasetIcon } from "@/components/bs-icons/menu/dataset";
import { bsConfirm } from "@/components/bs-ui/alertDialog/useConfirm";
import { SelectHover, SelectHoverItem } from "@/components/bs-ui/select/hover";
import { locationContext } from "@/contexts/locationContext";
import { resolveWorkspaceUrl } from "@/util/workspace";
import i18next from "i18next";
import { Activity, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, GraduationCap, Lock, MoonStar, Settings, Sun, Users } from "lucide-react";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import CrashErrorComponent from "../components/CrashErrorComponent";
import { Separator } from "../components/bs-ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/bs-ui/tooltip";
import { darkContext } from "../contexts/darkContext";
import { userContext } from "../contexts/userContext";
import { logoutApi } from "../controllers/API/user";
import { captureAndAlertRequestErrorHoc } from "../controllers/request";
import { User } from "../types/api/user";
import HeaderMenu from "./HeaderMenu";

type MenuItem = {
    key: string;
    label: string;
    icon: JSX.Element;
    to?: string;
    href?: string;
    target?: string;
    onClick?: (e: React.MouseEvent) => void;
};

type MenuGroup = {
    key: string;
    title: string;
    items: MenuItem[];
};

export default function MainLayout() {
    const { dark, setDark } = useContext(darkContext);
    const { appConfig } = useContext(locationContext)
    // 角色
    const { user, userLoading, setUser } = useContext(userContext);
    // auth 未完成前不渲染受保护内容，避免权限检查竞态
    if (userLoading) return null;
    const { language, languageNames, options, changLanguage, t } = useLanguage(user)
    // 收起态持久化（对齐 client navVisible localStorage），刷新后保持用户偏好
    const [collapsed, setCollapsed] = useState(() => {
      try {
        const saved = localStorage.getItem('platform-sidebar-collapsed');
        return saved !== null ? JSON.parse(saved) : false;
      } catch {
        return false;
      }
    })
    // 优化后的侧边栏样式
    const sidebarWidthClass = collapsed ? "w-[72px] min-w-[72px] px-2" : "w-[200px] min-w-[200px] px-3"
    const navBaseClass = "navlink group inline-flex items-center rounded-lg w-full h-9 transition-all duration-200 hover:translate-x-0.5"
    const navPaddingClass = collapsed ? "justify-center px-2" : "gap-2.5 px-3"
    const navTextClass = collapsed ? "hidden" : "text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis"
    const navHoverClass = "hover:bg-muted text-muted-foreground hover:text-foreground"
    const toggleSidebar = () => setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('platform-sidebar-collapsed', JSON.stringify(next));
      } catch {
        /* localStorage 不可用时静默降级（内存态仍生效） */
      }
      return next;
    })
    const toggleLabel = collapsed ? t('menu.expandSidebar') : t('menu.collapseSidebar')

    const handleLogout = () => {
        bsConfirm({
            title: `${t('prompt')}!`,
            desc: `${t('menu.logoutContent')}？`,
            okTxt: t('system.confirm'),
            onOk(next) {
                captureAndAlertRequestErrorHoc(logoutApi()).then(() => {
                    setUser(null)
                    localStorage.removeItem('isLogin')
                    // S-4: Clear WebSocket token and related auth data from localStorage on logout
                    localStorage.removeItem('ws_token')
                    localStorage.removeItem('token')
                    localStorage.removeItem('userInfo')
                })
                next()
            }
        })
    }

    // 重置密码
    const navigator = useNavigate()
    const JumpResetPage = () => {
        localStorage.setItem('account', user.user_name)
        navigator('/reset')
    }

    // 系统管理员(简化后只有超管)
    const isAdmin = useMemo(() => {
        return user.role === 'admin'
    }, [user])

    const getInitialExpandedState = () => {
        const defaults: Record<string, boolean> = {
            workspace: true,
            square: true,
            application: true,
            model: true,
            settings: true
        };

        if (typeof window === 'undefined') {
            return defaults;
        }

        try {
            const stored = localStorage.getItem('platform-sidebar-groups');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && typeof parsed === 'object') {
                    return { ...defaults, ...parsed };
                }
            }
        } catch (error) {
            // 忽略解析异常，采用默认展开状态
        }

        return defaults;
    };

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => getInitialExpandedState());
    const workspaceLink = useMemo(() => resolveWorkspaceUrl(appConfig.workspaceUrl), [appConfig.workspaceUrl]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        localStorage.setItem('platform-sidebar-groups', JSON.stringify(expandedGroups));
    }, [expandedGroups]);

    const handleToggleGroup = (key: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const menuGroups = useMemo<MenuGroup[]>(() => {
        const webMenu = user.web_menu ?? [];
        const groups: MenuGroup[] = [];

        const applicationItems: MenuItem[] = [];
        applicationItems.push({
            key: 'build',
            label: t('menu.agentBuild'),
            icon: <TechnologyIcon className="h-5 w-5" />,
            to: '/build'
        });

        // 知识库、数据集、标注功能都移到智能体应用分组
        applicationItems.push({
            key: 'knowledge',
            label: t('menu.knowledge'),
            icon: <KnowledgeIcon className="h-5 w-5" />,
            to: '/filelib'
        });

        applicationItems.push({
            key: 'dataset',
            label: t('menu.dataset'),
            icon: <DatasetIcon className="h-5 w-5" />,
            to: '/dataset'
        });

        applicationItems.push({
            key: 'label',
            label: t('menu.annotation'),
            icon: <LabelIcon className="h-5 w-5" />,
            to: '/label'
        });

        if (applicationItems.length) {
            groups.push({
                key: 'application',
                title: t('menu.groupApplication'),
                items: applicationItems
            });
        }

        const modelItems: MenuItem[] = [];
        modelItems.push({
            key: 'model',
            label: t('menu.models'),
            icon: <ModelIcon className="h-5 w-5" />,
            to: '/model'
        });
        modelItems.push({
            key: 'evaluation',
            label: t('menu.evaluation'),
            icon: <EvaluatingIcon className="h-5 w-5" />,
            to: '/evaluation'
        });
        if (modelItems.length) {
            groups.push({
                key: 'model',
                title: t('menu.groupModel'),
                items: modelItems
            });
        }

        const educationItems: MenuItem[] = [];
        if (webMenu.includes('education_student')) {
            educationItems.push({
                key: 'education-courses',
                label: t('menu.educationCourses'),
                icon: <BookOpen className="h-5 w-5" />,
                to: '/education/courses'
            });
            educationItems.push({
                key: 'education-portfolio',
                label: t('menu.educationPortfolio'),
                icon: <GraduationCap className="h-5 w-5" />,
                to: '/education/portfolio'
            });
        }
        if (webMenu.includes('education_teacher')) {
            educationItems.push({
                key: 'education-classes',
                label: t('menu.educationClasses'),
                icon: <Users className="h-5 w-5" />,
                to: '/education/classes'
            });
        }
        if (educationItems.length) {
            groups.push({
                key: 'education',
                title: t('menu.groupEducation'),
                items: educationItems
            });
        }

        const settingItems: MenuItem[] = [];
        if (isAdmin) {
            // 工作台配置（从智能体构建移入）
            settingItems.push({
                key: 'workbench-config',
                label: t('build.workbench'),
                icon: <Settings className="h-5 w-5" />,
                to: '/build/client'
            });
            // 系统模型配置（从模型管理移入）
            settingItems.push({
                key: 'system-model-config',
                label: t('model.modelSystemConfig'),
                icon: <Settings className="h-5 w-5" />,
                to: '/model/system-config'
            });
            settingItems.push({
                key: 'monitor',
                label: t('menu.monitor'),
                icon: <Activity className="h-5 w-5" />,
                to: '/monitor'
            });
        }
        if (isAdmin) {
            settingItems.push({
                key: 'log',
                label: t('menu.log'),
                icon: <LogIcon className="h-5 w-5" />,
                to: '/log'
            });
            settingItems.push({
                key: 'user-management',
                label: t('menu.system'),
                icon: <Users className="h-5 w-5" />,
                to: '/sys'
            });
            settingItems.push({
                key: 'system-settings',
                label: t('menu.systemSettings'),
                icon: <SystemIcon className="h-5 w-5" />,
                to: '/sys/settings'
            });
        }
        if (settingItems.length) {
            groups.push({
                key: 'settings',
                title: t('menu.groupSettings'),
                items: settingItems
            });
        }

        return groups;
    }, [appConfig, isAdmin, user.web_menu, t]);

    return <div className="flex">
        <div className="bg-background-main w-full h-screen">
            <div className="flex justify-between items-center h-14 bg-card border-b border-border px-6 relative z-[21]">
                <div className="flex items-center">
                    <a className="inline-flex items-center gap-2 min-w-0 text-sm font-semibold text-foreground no-underline" href='/workspace'>
                        {appConfig.sidebarIcon?.image && (
                            <img className="w-8 h-8 flex-shrink-0 object-contain" src={__APP_ENV__.BASE_URL + appConfig.sidebarIcon.image} alt="logo" />
                        )}
                        <span className="truncate">{appConfig.sidebarSlogan || 'E-Agent'}</span>
                    </a>
                </div>
                <div>
                    <HeaderMenu />
                </div>
                <div className="flex items-center gap-3">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger
                                className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-accent transition-colors cursor-pointer"
                                onClick={() => setDark(!dark)}
                            >
                                {dark ? (
                                    <Sun className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                    <MoonStar className="w-4 h-4 text-muted-foreground" />
                                )}
                            </TooltipTrigger>
                            <TooltipContent><p>{t('menu.themeSwitch')}</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <Separator className="mx-[4px]" orientation="vertical" />
                    <div className="flex items-center gap-2 ml-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">{user.user_name?.charAt(0)?.toUpperCase() || 'U'}</span>
                        </div>
                        <SelectHover
                            trigger={
                                <span className="text-sm text-foreground cursor-pointer flex items-center gap-1 max-w-32 truncate">
                                    {user.user_name} <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                </span>
                            }>
                            <SelectHoverItem onClick={JumpResetPage}><Lock className="w-4 h-4 mr-1" /><span>{t('menu.changePwd')}</span></SelectHoverItem>
                            <SelectHoverItem onClick={handleLogout}><QuitIcon className="w-4 h-4 mr-1" /><span>{t('menu.logout')}</span></SelectHoverItem>
                        </SelectHover>
                    </div>
                </div>
            </div>
            <div className="flex" style={{ height: "calc(100vh - 56px)" }}>
                <div className={`relative z-10 bg-background/80 h-full ${sidebarWidthClass} border-r border-border flex flex-col transition-all duration-300`}>
                    <nav className="flex-1 overflow-y-auto py-4">
                        {/* 进入工作台 - 独立入口 */}
                        <div className="mb-3 px-1">
                            <a
                                href="/workspace/"
                                className={`${navBaseClass} ${navPaddingClass} ${navHoverClass}`}
                            >
                                <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                                    <ApplicationIcon className="h-5 w-5" />
                                </div>
                                {!collapsed && (
                                    <>
                                        <span className={navTextClass} title={t('menu.workspace')}>{t('menu.workspace')}</span>
                                        <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 ml-auto" />
                                    </>
                                )}
                            </a>
                            <div className="mt-3 border-b border-border"></div>
                        </div>
                        {menuGroups.map(group => {
                            const isExpanded = collapsed ? true : expandedGroups[group.key] ?? true;
                            return (
                                <div className="mb-5" key={group.key}>
                                    {!collapsed ? (
                                        <button
                                            type="button"
                                            className="flex items-center justify-between w-full px-2 mb-2 group/title"
                                            onClick={() => handleToggleGroup(group.key)}
                                        >
                                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{group.title}</span>
                                            <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                                        </button>
                                    ) : (
                                        <div className="w-8 h-px bg-gradient-to-r from-border to-transparent mx-auto mb-3"></div>
                                    )}
                                    {isExpanded && (
                                        <div className="space-y-1">
                                            {group.items.map(item => {
                                                const iconElement = <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">{item.icon}</div>;
                                                const content = (
                                                    <>
                                                        {iconElement}
                                                        <span className={navTextClass} title={item.label}>{item.label}</span>
                                                    </>
                                                );

                                                if (item.href) {
                                                    return (
                                                        <a
                                                            key={item.key}
                                                            href={item.href}
                                                            target={item.target}
                                                            rel={item.target === '_blank' ? "noopener noreferrer" : undefined}
                                                            className={`${navBaseClass} ${navPaddingClass} ${navHoverClass}`}
                                                            onClick={item.onClick}
                                                        >
                                                            {content}
                                                        </a>
                                                    );
                                                }

                                                return (
                                                    <NavLink
                                                        key={item.key}
                                                        to={item.to!}
                                                        end
                                                        className={({ isActive }) =>
                                                            `${navBaseClass} ${navPaddingClass} ${isActive
                                                                ? 'bg-primary/10 text-primary font-semibold rounded-lg'
                                                                : navHoverClass}`
                                                        }
                                                    >
                                                        {content}
                                                    </NavLink>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </nav>
                    <div className="p-3 border-t border-border">
                        <button
                            onClick={toggleSidebar}
                            aria-label={toggleLabel}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                        >
                            {collapsed ? (
                                <ChevronRight className="w-4 h-4 transition-transform" />
                            ) : (
                                <>
                                    <ChevronLeft className="w-4 h-4 transition-transform" />
                                    <span className="text-xs">{toggleLabel}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
                <div className="flex-1 bg-background-main min-w-0 overflow-y-auto">
                    <ErrorBoundary
                        onReset={() => window.location.href = window.location.href}
                        FallbackComponent={CrashErrorComponent}
                    >
                        <Outlet />
                    </ErrorBoundary>
                </div>
            </div>
        </div>

        {/* // mobile */}
        <div className="fixed w-full h-full top-0 left-0 bg-[rgba(0,0,0,0.4)] sm:hidden text-sm z-50">
            <div className="w-10/12 bg-gray-50 mx-auto mt-[30%] rounded-xl px-4 py-10">
                <p className=" text-sm text-center">{t('menu.forBestExperience')}</p>
            </div>
        </div>
    </div >
};

const useLanguage = (user: User) => {
    const [language, setLanguage] = useState('zh-Hans')
    useEffect(() => {
        const lang = user.user_id ? localStorage.getItem('i18nextLng') : null
        if (lang) {
            setLanguage(lang === 'zh' ? 'zh-Hans' : lang)
        }
    }, [user])

    const { t } = useTranslation()
    const changLanguage = (ln: string) => {
        setLanguage(ln)
        localStorage.setItem('i18nextLng', ln)
        // workspace
        localStorage.removeItem('lang')
        document.cookie = `lang=${ln}; path=/; expires=${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()}`;
        i18next.changeLanguage(ln)
    }
    return {
        language,
        languageNames: { "zh-Hans": '中文', "en-US": 'English' } as Record<string, string>,
        options: { "zh-Hans": '中文', "en-US": 'English' } as Record<string, string>,
        changLanguage,
        t
    }
}

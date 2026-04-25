import { useContext, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import * as Menu from '@ariakit/react/menu';
import { ChevronDown, LogOut, Moon, Settings as SettingsIcon, Sun } from 'lucide-react';
import { getEagentConfigApi } from '~/api/apps';
import type { ContextType } from '~/common';
import { Banner } from '~/components/Banners';
import { MobileNav, Nav } from '~/components/Nav';
import Settings from '~/components/Nav/Settings';
import { DropdownPopup } from '~/components/ui';
import { useGetBsConfig } from '~/data-provider';
import { ThemeContext, isDark, useAgentsMap, useAssistantsMap, useAuthContext, useFileMap, useSearch } from '~/hooks';
import { eagentConfState } from '~/pages/appChat/store/atoms';
import {
  AgentsMapContext,
  AssistantsMapContext,
  FileMapContext,
  SearchContext,
  SetConvoProvider,
} from '~/Providers';

export default function Root() {
  const [bannerHeight, setBannerHeight] = useState(0);
  const [navVisible, setNavVisible] = useState(() => {
    const savedNavVisible = localStorage.getItem('navVisible');
    return savedNavVisible !== null ? JSON.parse(savedNavVisible) : true;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { isAuthenticated, isLoading, isError, user, logout } = useAuthContext();
  const { data: bsConfig } = useGetBsConfig();
  const { theme, setTheme } = useContext(ThemeContext);
  const darkMode = isDark(theme);
  const toggleTheme = () => setTheme(darkMode ? 'light' : 'dark');
  const displayName = user?.name ?? user?.username ?? '';

  const userMenuItems = [
    {
      label: '设置',
      icon: <SettingsIcon className="icon-md" />,
      onClick: () => setShowSettings(true),
    },
    {
      label: '退出登录',
      icon: <LogOut className="icon-md" />,
      onClick: logout,
    },
  ];
  const assistantsMap = useAssistantsMap({ isAuthenticated });
  const agentsMap = useAgentsMap({ isAuthenticated });
  const fileMap = useFileMap({ isAuthenticated });
  const search = useSearch({ isAuthenticated });

  useConfig()

  // 等待加载完成
  if (isLoading) {
    return null;
  }

  // isLoading=false 但 isAuthenticated 尚未稳定（user 数据在传播中）
  // 只有明确失败（isError=true）才能确认未认证
  if (!isAuthenticated && !isError) {
    return null;
  }

  if (!isAuthenticated) {
    // R-06: 未认证时重定向到根路径（nginx 智能分流：无 cookie → Platform 登录页）
    // 使用 location.href 硬跳转，与 401 拦截器和 AuthContext logout 保持一致
    location.href = location.origin + '/';
    return null;
  }


  return (
    <SetConvoProvider>
      <SearchContext.Provider value={search}>
        <FileMapContext.Provider value={fileMap}>
          <AssistantsMapContext.Provider value={assistantsMap}>
            <AgentsMapContext.Provider value={agentsMap}>
              {/* 页面头部黑色banner */}
              <Banner onHeightChange={setBannerHeight} />
              <div className="flex flex-col" style={{ height: `calc(100dvh - ${bannerHeight}px)` }}>
                {/* 全宽 Header */}
                <header className="flex-shrink-0 flex justify-between items-center h-14 bg-white dark:bg-gray-900 border-b border-[#E5EAF4] dark:border-gray-800 px-6 relative z-[21]">
                  {/* 左：Logo + Slogan */}
                  <div className="flex items-center gap-2 min-w-0">
                    {bsConfig?.sidebarIcon?.image && (
                      <img
                        className="w-8 h-8 flex-shrink-0 object-contain"
                        src={__APP_ENV__.BASE_URL + bsConfig.sidebarIcon.image}
                        alt="logo"
                      />
                    )}
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {bsConfig?.sidebarSlogan || 'E-Agent'}
                    </span>
                  </div>
                  {/* 右：主题切换 + 用户菜单 */}
                  <div className="flex items-center gap-3">
                    <button
                      className="w-8 h-8 flex-shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      onClick={toggleTheme}
                    >
                      {darkMode ? (
                        <Sun className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      ) : (
                        <Moon className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                    <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
                    <DropdownPopup
                      menuId="root-user-menu"
                      trigger={
                        <Menu.MenuButton className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                          <div className="w-8 h-8 min-w-8 text-white bg-primary rounded-full flex justify-center items-center text-xs flex-shrink-0">
                            {displayName.substring(0, 2).toUpperCase() || 'U'}
                          </div>
                          <span className="text-sm text-gray-700 dark:text-gray-300 max-w-32 truncate">
                            {displayName}
                          </span>
                          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </Menu.MenuButton>
                      }
                      items={userMenuItems}
                      isOpen={userMenuOpen}
                      setIsOpen={setUserMenuOpen}
                      className="w-[180px]"
                    />
                  </div>
                </header>
                {/* 下方主体：侧栏 + 内容区 */}
                <div className="relative z-0 flex flex-1 overflow-hidden">
                  {/* 会话列表 */}
                  <Nav navVisible={navVisible} setNavVisible={setNavVisible} />
                  {/* 会话消息面板区(路由) */}
                  <div className="relative flex h-full max-w-full flex-1 flex-col overflow-hidden">
                    <MobileNav setNavVisible={setNavVisible} />
                    <Outlet context={{ navVisible, setNavVisible } satisfies ContextType} />
                  </div>
                </div>
              </div>
              {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
            </AgentsMapContext.Provider>
          </AssistantsMapContext.Provider>
        </FileMapContext.Provider>
      </SearchContext.Provider>
    </SetConvoProvider>
  );
}



const useConfig = () => {
  const [_, setConfig] = useRecoilState(eagentConfState)

  useEffect(() => {
    getEagentConfigApi().then(res => {
      setConfig(res.data)
    })
  }, [])
}
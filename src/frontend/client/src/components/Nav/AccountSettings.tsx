import { LogOut, Settings as SettingsIcon } from 'lucide-react';
import { memo, useState } from 'react';
import { useLocalize } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';
import { cn } from '~/utils';
import Settings from './Settings';

function AccountSettings({ collapsed = false }: { collapsed?: boolean }) {
  const localize = useLocalize();
  const { logout } = useAuthContext();
  const [showSettings, setShowSettings] = useState(false);

  // 收起态（对齐 platform 图标栏）：图标居中、文字隐藏
  const itemClass = cn(
    'flex cursor-pointer items-center rounded-xl text-sm text-text-primary transition-all duration-200 ease-in-out hover:bg-surface-hover',
    collapsed ? 'justify-center p-2' : 'w-full gap-2 p-2',
  );
  const textClass = cn(collapsed && 'hidden');

  return (
    <div className={cn('h-auto rounded-xl p-2 text-sm', collapsed ? 'w-auto' : 'w-full')}>
      {/* 设置 */}
      <div
        className={itemClass}
        title={collapsed ? localize('com_nav_settings') : undefined}
        onClick={() => setShowSettings(true)}
      >
        <SettingsIcon className="icon-md flex-shrink-0" />
        <span className={textClass}>{localize('com_nav_settings')}</span>
      </div>
      {/* 退出登录 */}
      <div
        className={itemClass}
        title={collapsed ? localize('com_nav_log_out') : undefined}
        onClick={logout}
      >
        <LogOut className="icon-md flex-shrink-0" />
        <span className={textClass}>{localize('com_nav_log_out')}</span>
      </div>
      {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
    </div>
  );
}

export default memo(AccountSettings);

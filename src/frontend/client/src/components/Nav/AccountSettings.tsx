import { LogOut, Settings as SettingsIcon } from 'lucide-react';
import { memo, useState } from 'react';
import { useLocalize } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';
import Settings from './Settings';

function AccountSettings() {
  const localize = useLocalize();
  const { logout } = useAuthContext();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="h-auto w-full rounded-xl p-2 text-sm">
      {/* 设置 */}
      <div
        className="flex w-full cursor-pointer items-center gap-2 rounded-xl p-2 text-sm text-text-primary transition-all duration-200 ease-in-out hover:bg-surface-hover"
        onClick={() => setShowSettings(true)}
      >
        <SettingsIcon className="icon-md" />
        {localize('com_nav_settings')}
      </div>
      {/* 退出登录 */}
      <div
        className="flex w-full cursor-pointer items-center gap-2 rounded-xl p-2 text-sm text-text-primary transition-all duration-200 ease-in-out hover:bg-surface-hover"
        onClick={logout}
      >
        <LogOut className="icon-md" />
        {localize('com_nav_log_out')}
      </div>
      {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
    </div>
  );
}

export default memo(AccountSettings);

import { userContext } from "@/contexts/userContext";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "../../components/bs-ui/tabs";
import Config from "./components/Config";
import Theme from "./theme";
import UserGroups from "./components/UserGroup";
import Users from "./components/Users";

export default function index() {
    const { user } = useContext(userContext);
    const { t } = useTranslation()
    const location = useLocation();

    // 根据路由区分显示：/sys → 用户管理, /sys/settings → 系统设置
    // F3: 精确匹配避免 pathname.includes 子串误命中（任何含 /sys/settings 的路径会错误进入系统设置）
    const isSettingsMode = location.pathname === '/sys/settings';

    if (isSettingsMode) {
        return <div className="w-full h-full px-2 pt-4">
            <Tabs defaultValue="system" className="w-full">
                <TabsList className="">
                    <TabsTrigger value="system">{t('system.systemConfiguration')}</TabsTrigger>
                    <TabsTrigger value="theme">{t('system.themeColor')}</TabsTrigger>
                </TabsList>
                <TabsContent value="system">
                    <Config></Config>
                </TabsContent>
                <TabsContent value="theme">
                    <Theme></Theme>
                </TabsContent>
            </Tabs>
        </div>
    }

    return <div className="w-full h-full px-2 pt-4">
        <Tabs defaultValue="user" className="w-full">
            <TabsList className="">
                <TabsTrigger value="user">{t('system.userManagement')}</TabsTrigger>
                {user.role === 'admin' && <TabsTrigger value="userGroup">{t('system.userGroupsM')}</TabsTrigger>}
            </TabsList>
            <TabsContent value="user">
                <Users></Users>
            </TabsContent>
            <TabsContent value="userGroup">
                <UserGroups></UserGroups>
            </TabsContent>
        </Tabs>
    </div>
};

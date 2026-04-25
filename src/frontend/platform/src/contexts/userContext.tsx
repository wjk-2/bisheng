import { toast } from "@/components/bs-ui/toast/use-toast";
import { ReactNode, createContext, useLayoutEffect, useState } from "react";
import { delComponentApi, getComponents, overridComponent, saveComponent } from "../controllers/API";
import { getUserInfo, logoutApi } from "../controllers/API/user";
import { captureAndAlertRequestErrorHoc, requestInterceptor } from "../controllers/request";
import { User } from "../types/api/user";

type userContextType = {
    user: any; // {} loading null login
    userLoading: boolean; // true 表示正在获取用户信息，避免权限检查竞态
    setUser: (newState: User) => void;
    savedComponents: any;
    addSavedComponent: (newCom: any, overrid: boolean, rename?: boolean) => Promise<any>;
    checkComponentsName: (name: string) => boolean;
    delComponent: (name: string) => void;
}

// const userInfoLocalStr = localStorage.getItem('UUR_INFO')
const initialValue = {
    user: {}, // userInfoLocalStr ? JSON.parse(atob(userInfoLocalStr)) : null,
    userLoading: true,
    setUser: () => { },
    savedComponents: [],
    addSavedComponent: () => null,
    checkComponentsName: () => false,
    delComponent: () => { }
}

export const userContext = createContext<userContextType>(initialValue);

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<any>(initialValue.user);
    const [userLoading, setUserLoading] = useState(true);
    const [savedComponents, setSavedComponents] = useState([]);

    const loadComponents = async () => {
        const res = await getComponents()
        setSavedComponents(res)
    }

    // 重名校验
    const checkComponentsName = (name: string) => {
        return savedComponents.some(item => item.name === name)
    }

    const addSavedComponent = (component: any, overrid: boolean, rename: boolean = true) => {
        // return delComponent(component.type)
        const nodeName = component.node.display_name
        const newNode = {
            ...component, node: { ...component.node, official: false }
        }

        const data = {
            name: nodeName,
            data: newNode,
            description: ''
        }
        // 覆盖
        if (overrid) {
            return captureAndAlertRequestErrorHoc(overridComponent(data)).then(res => {
                setSavedComponents((comps =>
                    comps.map(comp =>
                        comp.name === data.name ? data : comp
                    )
                ))
            })
        } else {
            // 重命名
            if (rename) {
                const regex = /\((\d+)\)$/;
                do {
                    const match = data.name.match(regex);
                    if (match) {
                        // 如果找到匹配项，将数字提取出来，转换成数字类型，并加1
                        const num = parseInt(match[1], 10) + 1;
                        data.name = data.name.replace(regex, `(${num})`);
                    } else {
                        data.name += "(1)";
                    }
                } while (savedComponents.some(item => item.name === data.name))
            }
            return captureAndAlertRequestErrorHoc(saveComponent(data)).then(sucess => {
                sucess && setSavedComponents([...savedComponents, data])
            })
        }
    }

    // del
    const delComponent = (name) => {
        delComponentApi(name).then(res => {
            setSavedComponents(comps => comps.filter(item => item.name !== name))
        })
    }

    
    useLayoutEffect(() => {
        // 链接参数存cookie（免登录接口）— 仅接受合法JWT格式
        const tokenMatch = location.search.match(/(?<=token=)[^&]+/g)?.[0]
        if (tokenMatch) {
            const token = decodeURIComponent(tokenMatch)
            // Validate JWT format: three base64url segments separated by dots
            if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
                document.cookie = `access_token_cookie=${token}; path=/`;
                localStorage.setItem('isLogin', '1')
            }
            location.href = location.origin + location.pathname;
            return
        }
        // record workspace auth
        const search = location.search;
        const params = new URLSearchParams(search);
        const error = params.get('error');
        if (error) {
            window.url_error = error;
        }

        // 异地登录强制退出
        requestInterceptor.remoteLoginFuc = (msg) => {
            logoutApi().then(_ => {
                setUser(null)
                localStorage.removeItem('isLogin')
                // S-4: Clear WebSocket token on forced logout (remote login)
                localStorage.removeItem('ws_token')
                localStorage.removeItem('token')
                localStorage.removeItem('userInfo')
            })

            toast({
                description: msg.split(`\n`),
                variant: 'error'
            })
        }
        // 获取用户信息
        getUserInfo().then(res => {
            setUserLoading(false)
            setUser(res.user_id ? res : null)
            const { user_id, web_menu = [] } = res;

            localStorage.setItem('UUR_INFO', user_id ? String(user_id) : '');
            if (user_id) loadComponents();
            // 是否有访问后台权限
            if (/^(\/\w+)?\/chat/.test(location.pathname)) return // 排除免登陆

            // 恢复权限检查 - 使用 web_menu 判断是否有后台权限
            if (!web_menu || web_menu.length === 0) {
                location.href = `${location.origin}/workspace/c/new`;
                return;
            }

            const BASE_URL = __APP_ENV__.BASE_URL
            const pathName = location.pathname.replace(BASE_URL, '');

            // /platform 入口：跳转到默认页面
            if (pathName === '/platform') {
                location.replace(BASE_URL + '/build');
                return;
            }

            // 管理员专属页面拦截（唯一有效的前端权限检查）
            const ADMIN_ONLY_PATHS = ['/sys', '/monitor', '/log', '/model/system-config', '/build/client'];
            if (res.role !== 'admin' && ADMIN_ONLY_PATHS.some(p => pathName === p || pathName.startsWith(p + '/'))) {
                location.href = BASE_URL + '/403';
                return;
            }
        }).catch(e => {
            setUserLoading(false)
            setUser(null)
        })
    }, [])

    return (
        <userContext.Provider
            value={{
                user, userLoading, setUser, savedComponents, checkComponentsName, delComponent, addSavedComponent
            }}
        >
            {children}
        </userContext.Provider>
    );
}
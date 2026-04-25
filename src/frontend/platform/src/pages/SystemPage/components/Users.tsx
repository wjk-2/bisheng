import { FilterIcon } from "@/components/bs-icons/filter";
import { bsConfirm } from "@/components/bs-ui/alertDialog/useConfirm";
import { Button } from "@/components/bs-ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/bs-ui/popover";
import FilterUserGroup from "@/components/bs-ui/select/filter";
import { useToast } from "@/components/bs-ui/toast/use-toast";
import { getUserGroupsApi } from "@/controllers/API/user";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchInput } from "../../../components/bs-ui/input";
import AutoPagination from "../../../components/bs-ui/pagination/autoPagination";
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow
} from "../../../components/bs-ui/table";
import { userContext } from "../../../contexts/userContext";
import { disableUserApi, getUsersApi } from "../../../controllers/API/user";
import { captureAndAlertRequestErrorHoc } from "../../../controllers/request";
import { useTable } from "../../../util/hook";
import UserPwdModal from "@/pages/LoginPage/UserPwdModal";
import { PlusIcon } from "@/components/bs-icons";
import CreateUser from "./CreateUser";
import EditUser from "./EditUser";

function UsersFilter({ options, onChecked, nameKey, placeholder, onFilter }) {
    const [open, setOpen] = useState(false)
    const [_value, setValue] = useState<any[]>([])
    const [searchKey, setSearchKey] = useState('')
    // 点击 checkbox — BUG5 修复：先计算新值，再 setState，避免闭包读旧 state
    const handlerChecked = (id) => {
        const index = _value.indexOf(id)
        const newValue = index === -1 ? [..._value, id] : _value.filter((_, i) => i !== index)
        setValue(newValue)
        // 已选项上浮（基于 newValue，不读旧 _value）
        const checked = options.filter(o => newValue.includes(o.id))
        const uncheck = options.filter(o => !newValue.includes(o.id))
        onChecked([...checked, ...uncheck])
    }

    const filterData = () => {
        onFilter(_value)
        setOpen(false)
    }
    // 搜索
    const _options = useMemo(() => {
        if (!searchKey) return options
        return options.filter(a => a[nameKey].toUpperCase().includes(searchKey.toUpperCase()))
    }, [searchKey, options])
    // 重置
    const reset = () => {
        setValue([])
        setSearchKey('')
    }

    return <Popover open={open} onOpenChange={(bln) => { setOpen(bln); setSearchKey('') }}>
        <PopoverTrigger>
            {/* @ts-ignore */}
            <FilterIcon onClick={() => setOpen(!open)} className={_value.length ? 'text-primary ml-3' : 'text-gray-400 ml-3'} />
        </PopoverTrigger>
        <PopoverContent>
            <FilterUserGroup
                value={_value}
                options={_options}
                nameKey={nameKey}
                placeholder={placeholder}
                onChecked={handlerChecked}
                search={(e) => setSearchKey(e.target.value)}
                onClearChecked={reset}
                onOk={filterData}
            />
        </PopoverContent>
    </Popover>

}


export default function Users(params) {
    const { user } = useContext(userContext);
    const { t } = useTranslation()
    const { message } = useToast()

    const { page, pageSize, data: users, total, setPage, search, reload, filterData } = useTable({ pageSize: 20 }, (param) =>
        getUsersApi({
            ...param,
            name: param.keyword
        })
    )

    // 禁用确认 — BUG4 修复：next() 移入 .then()，请求成功后再关闭对话框
    const handleDelete = (user) => {
        bsConfirm({
            title: `${t('prompt')}!`,
            desc: t('system.confirmDisable'),
            okTxt: t('disable'),
            onOk(next) {
                captureAndAlertRequestErrorHoc(disableUserApi(user.user_id, 1).then(() => {
                    next()
                    reload()
                }))
            }
        })
    }
    const handleEnableUser = (user) => {
        captureAndAlertRequestErrorHoc(disableUserApi(user.user_id, 0).then(res => {
            reload()
        }))
    }

    // 编辑
    const [currentUser, setCurrentUser] = useState(null)
    const userPwdModalRef = useRef<{ open: (userId: string) => void }>(null)
    const handleRoleChange = () => {
        setCurrentUser(null)
        reload()
    }

    // 获取用户组类型数据 — BUG8 修复：统一在父组件管理，添加错误处理
    const [userGroups, setUserGroups] = useState([])
    const getUserGoups = async () => {
        try {
            const res: any = await getUserGroupsApi()
            setUserGroups(res.records || [])
        } catch {
            message({ title: t('prompt'), description: t('system.loadGroupsFailed') || '用户组加载失败，请刷新重试', variant: 'error' })
        }
    }
    // 获取角色类型数据 - 简化后只有固定的两种角色
    const [roles, setRoles] = useState([
        { id: 1, role_name: '超级管理员' },
        { id: 2, role_name: '普通用户' }
    ])
    // 已选项上浮
    const handleGroupChecked = (values) => {
        setUserGroups(values)
    }
    // 角色筛选处理（角色列表现在是固定的）
    const handleRoleChecked = (values) => {
        setRoles(values)
    }

    const [openCreate, setOpenCreate] = useState(false)

    useEffect(() => {
        // 只有管理员才能调用 getUserGroupsApi
        if (user.role === 'admin') {
            getUserGoups()
        }
        // getRoles() - 移除，使用固定角色列表
        return () => { setUserGroups([]) }
    }, [user.role])

    const operations = (el) => {
        const isTargetAdmin = el.roles && el.roles.some(role => role.id === 1)
        const isCurrentUserAdmin = user.role === 'admin'

        // 非管理员用户看不到任何操作按钮
        if (!isCurrentUserAdmin) {
            return null
        }

        // 管理员可以操作所有用户，但admin账号本身有特殊保护
        if (isTargetAdmin) {
            // 对admin账号的操作有限制（不能编辑和禁用，但可以重置密码）
            return <div>
                <Button variant="link" disabled className="px-0">{t('edit')}</Button>
                <Button variant="link" className="px-0 pl-4" onClick={() => userPwdModalRef.current?.open(el.user_id)}>{t('system.resetPwd')}</Button>
                <Button variant="link" disabled className="text-red-500 px-0 pl-4">{t('disable')}</Button>
            </div>
        }

        // 对普通用户的操作（管理员可以完全操作）
        return <div>
            {/* 编辑 */}
            <Button variant="link" onClick={() => setCurrentUser(el)} className="px-0">{t('edit')}</Button>
            {/* 重置密码 */}
            <Button variant="link" className="px-0 pl-4" onClick={() => userPwdModalRef.current?.open(el.user_id)}>{t('system.resetPwd')}</Button>
            {/* 禁用/启用 */}
            {
                el.delete === 1 ?
                <Button variant="link" onClick={() => handleEnableUser(el)} className="text-green-500 px-0 pl-4">{t('enable')}</Button> :
                <Button variant="link" onClick={() => handleDelete(el)} className="text-red-500 px-0 pl-4">{t('disable')}</Button>
            }
        </div>
    }

    return <div className="relative">
        <div className="h-[calc(100vh-128px)] overflow-y-auto pb-10">
            <div className="flex justify-end gap-6">
                <div className="w-[180px] relative">
                    <SearchInput placeholder={t('system.username')} onChange={(e) => search(e.target.value)}></SearchInput>
                </div>
                {user.role === 'admin' && <Button className="flex justify-around" onClick={() => setOpenCreate(true)}>
                    <PlusIcon className="text-primary" />
                    <span className="text-[#fff] mx-4">{t('create')}</span>
                </Button>}
            </div>
            <Table className="mb-[50px]">
                {/* <TableCaption>用户列表.</TableCaption> */}
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[200px]">{t('system.username')}</TableHead>
                        <TableHead className="w-[160px]">{t('system.nickname') || '姓名'}</TableHead>
                        <TableHead>
                            {/* BUG11 修复：非管理员不渲染筛选器（数据为空时展示无意义） */}
                            <div className="flex items-center">
                                {t('system.userGroup')}
                                {user.role === 'admin' && <UsersFilter
                                    options={userGroups}
                                    nameKey='group_name'
                                    onChecked={handleGroupChecked}
                                    placeholder={t('system.searchUserGroups')}
                                    onFilter={(ids) => filterData({ groupId: ids })}
                                ></UsersFilter>}
                            </div>
                        </TableHead>
                        <TableHead>
                            <div className="flex items-center">
                                {t('system.role')}
                                {user.role === 'admin' && <UsersFilter
                                    options={roles}
                                    nameKey='role_name'
                                    onChecked={handleRoleChecked}
                                    placeholder={t('system.searchRoles')}
                                    onFilter={(ids) => filterData({ roleId: ids })}
                                ></UsersFilter>}
                            </div>
                        </TableHead>
                        <TableHead>{t('system.changeTime')}</TableHead>
                        <TableHead className="text-right w-[164px]">{t('operations')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((el: any) => (
                        // BUG2 修复：key 改为 el.user_id，el.id 不存在会导致 key 全为 undefined
                        <TableRow key={el.user_id}>
                            <TableCell className="font-medium max-w-md truncate">{el.user_name}</TableCell>
                            <TableCell>{el.nickname ?? '-'}</TableCell>
                            <TableCell className="break-all">{(el.groups || []).map(el => el.name).join(',')}</TableCell>
                            <TableCell className="break-all">{(el.roles || []).map(el => el.name).join(',')}</TableCell>
                            {/* BUG1 修复：update_time 可能为 null，加可选链和默认值防崩溃 */}
                            <TableCell>{el.update_time?.replace('T', ' ') ?? '-'}</TableCell>
                            <TableCell 
                                className="text-right" 
                                style={{ 
                                    whiteSpace: 'nowrap',
                                }}
                                >
                                {operations(el)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    {!users.length && <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-400">{t('build.empty')}</TableCell>
                    </TableRow>}
                </TableFooter>
            </Table>
        </div>
        {/* 分页 */}
        {/* <Pagination count={10}></Pagination> */}
        <div className="eagent-table-footer bg-background-login">
            <p className="desc">{t('system.userList')}</p>
            <AutoPagination
                className="float-right justify-end w-full mr-6"
                page={page}
                pageSize={pageSize}
                total={total}
                onChange={(newPage) => setPage(newPage)}
            />
        </div>

        {/* BUG6 修复：onClose 只关弹窗，onSave 才刷新；BUG8/12：传 userGroups 避免子组件重复请求 */}
        <CreateUser open={openCreate} userGroups={userGroups} onClose={() => setOpenCreate(false)} onSave={reload} />
        <EditUser user={currentUser} userGroups={userGroups} onClose={() => setCurrentUser(null)} onChange={handleRoleChange} />
        <UserPwdModal ref={userPwdModalRef} />
    </div>
};

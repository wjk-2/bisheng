import { Button } from "@/components/bs-ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/bs-ui/dialog"
import { Input, PasswordInput } from "@/components/bs-ui/input"
import { Label } from "@/components/bs-ui/label"
import { useToast } from "@/components/bs-ui/toast/use-toast"
import { createUserApi } from "@/controllers/API/user"
import { captureAndAlertRequestErrorHoc } from "@/controllers/request"
import { handleEncrypt, PWD_RULE } from "@/pages/LoginPage/utils"
import { copyText } from "@/utils"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/bs-ui/select"

// BUG8/10 修复：用户组数据由父组件统一管理，通过 prop 传入，避免重复请求和传参不一致
export default function CreateUser({ open, userGroups, onClose, onSave }) {
    const { t } = useTranslation()
    const { message } = useToast()
    const [form, setForm] = useState({
        user_name: '',
        nickname: '',
        password: '',
        group_id: ''
    })

    const handleCancel = () => {
        onClose()
        setForm({ user_name: '', nickname: '', password: '', group_id: '' })
    }

    const handleConfirm = async () => {
        const errors: string[] = []
        if (form.user_name === '') errors.push(t('system.usernameRequired'))
        if (form.user_name.length > 30) errors.push(t('system.usernameMaxLength'))
        // BUG7 修复：nickname 标注必填，补充对应校验
        if (!form.nickname.trim()) errors.push(t('system.nicknameRequired') || '请输入姓名')
        if (!PWD_RULE.test(form.password)) errors.push(t('system.passwordRequirements'))
        if (!form.group_id) errors.push(t('system.selectGroup') || '请选择用户组')
        if (errors.length > 0) return message({ title: t('prompt'), description: errors, variant: 'warning' })

        const encryptPwd = await handleEncrypt(form.password)
        const group_roles = [{
            group_id: Number(form.group_id),
            role_ids: [2]  // 新用户默认普通用户角色
        }]

        captureAndAlertRequestErrorHoc(createUserApi(form.user_name, encryptPwd, group_roles, form.nickname.trim()).then(() => {
            // BUG9 修复：copyText 是 clipboard 操作，尽力而为（fire-and-forget）
            // toast 不依赖 clipboard 结果，无条件显示，保证用户感知到成功
            copyText(`${t('system.username')}: ${form.user_name}，${t('system.initialPassword')}: ${form.password}`)
            message({ title: t('prompt'), description: t('system.userCreationSuccess'), variant: 'success' })
            onClose()
            setForm({ user_name: '', nickname: '', password: '', group_id: '' })
            onSave()
        }))
    }

    return <Dialog open={open} onOpenChange={b => !b && handleCancel()}>
        <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
                <DialogTitle>{t('system.createUser')}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 mb-4">
                <div>
                    <Label htmlFor="user" className="eagent-label">{t('system.username')} <span className="text-red-500">*</span></Label>
                    <Input id="user" value={form.user_name} onChange={(e) => setForm({ ...form, user_name: e.target.value })}
                        placeholder={t('system.usernamePlaceholder')} className="h-[48px]" />
                </div>
                <div>
                    <Label htmlFor="nickname" className="eagent-label">{t('system.nickname') || '姓名'} <span className="text-red-500">*</span></Label>
                    <Input id="nickname" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                        placeholder={t('system.nicknamePlaceholder') || '请输入姓名'} className="h-[48px]" maxLength={50} />
                </div>
                <div>
                    <Label htmlFor="password" className="eagent-label">{t('system.initialPassword')} <span className="text-red-500">*</span></Label>
                    <PasswordInput id="password" value={form.password} placeholder={t('system.passwordPlaceholder')}
                        onChange={(e) => setForm({ ...form, password: e.target.value })} inputClassName="h-[48px]" />
                </div>
                <div>
                    <Label className="eagent-label">{t('system.userGroup') || '用户组'} <span className="text-red-500">*</span></Label>
                    <Select value={form.group_id} onValueChange={(value) => setForm({ ...form, group_id: value })}>
                        <SelectTrigger>
                            <SelectValue placeholder={t('system.selectGroup') || '请选择用户组'} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {userGroups.map(group => (
                                    <SelectItem key={group.id} value={String(group.id)}>
                                        {group.group_name}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
                <div className="text-sm text-muted-foreground">
                    {t('system.newUserDefaultRole') || '新用户默认为普通用户角色'}
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" className="h-10 w-[120px] px-16" onClick={handleCancel}>{t('cancel')}</Button>
                <Button className="px-16 h-10 w-[120px]" onClick={handleConfirm}>{t('confirm')}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
}

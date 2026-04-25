import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/bs-ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/bs-ui/dialog'
import { Input } from '@/components/bs-ui/input'
import { Label } from '@/components/bs-ui/label'
import { updateUserRolesAndGroups } from '@/controllers/API/user'
import { captureAndAlertRequestErrorHoc } from '@/controllers/request'

// BUG8/10/12 修复：userGroups 由父组件统一管理传入，移除内部 fetchUserGroups，
// 消除每次打开弹窗的重复请求和竞态条件
interface EditUserProps {
  user: any
  userGroups: any[]
  onClose: () => void
  onChange: () => void
}

export default function EditUser({ user, userGroups, onClose, onChange }: EditUserProps) {
  const { t } = useTranslation()
  const [nickname, setNickname] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<number[]>([])
  const [selectedRole, setSelectedRole] = useState<number>(2)
  const [loading, setLoading] = useState(false)

  // 固定的角色列表
  const roles = [
    { id: 1, role_name: '超级管理员' },
    { id: 2, role_name: '普通用户' }
  ]

  useEffect(() => {
    if (user) {
      setNickname(user.nickname || '')
      setSelectedGroups(user.groups?.map((g: any) => g.id) || [])
      const userRole = user.roles?.[0]
      setSelectedRole(userRole?.id || 2)
    }
  }, [user])

  const handleGroupToggle = (groupId: number) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  // BUG3 修复：检查 captureAndAlertRequestErrorHoc 返回值
  // 该函数内部静默 catch 后返回 false，不会 throw，
  // 所以必须主动判断 result === false，否则失败时仍会执行 onChange/onClose
  const handleSave = async () => {
    if (!user) return
    setLoading(true)
    try {
      const result = await captureAndAlertRequestErrorHoc(
        updateUserRolesAndGroups(
          user.user_id,
          [selectedRole],
          selectedGroups,
          nickname.trim() || undefined
        )
      )
      if (result === false) return  // 请求失败，保持弹窗打开，错误 toast 已由 hoc 处理
      onChange()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={!!user} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('system.editUser')} - {user.user_name}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 账号（只读） */}
          <div className="grid gap-2">
            <Label className="text-sm font-medium">{t('system.username')}</Label>
            <Input value={user.user_name} disabled className="bg-gray-100" />
          </div>

          {/* 姓名编辑 */}
          <div className="grid gap-2">
            <Label className="text-sm font-medium">{t('system.nickname') || '姓名'}</Label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t('system.nicknamePlaceholder') || '请输入姓名'}
              maxLength={50}
            />
          </div>

          {/* 角色选择 */}
          <div className="grid gap-2">
            <Label className="text-sm font-medium">{t('system.role')}</Label>
            <div className="flex gap-4">
              {roles.map(role => (
                <label key={role.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    checked={selectedRole === role.id}
                    onChange={() => setSelectedRole(role.id)}
                    className="w-4 h-4"
                  />
                  <span>{role.role_name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 用户组选择 */}
          <div className="grid gap-2">
            <Label className="text-sm font-medium">{t('system.userGroup')}</Label>
            <div className="max-h-[200px] overflow-y-auto border rounded p-2">
              {userGroups.length === 0 ? (
                <p className="text-gray-400 text-sm">{t('system.noUserGroups')}</p>
              ) : (
                userGroups.map(group => (
                  <label
                    key={group.id}
                    className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 px-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(group.id)}
                      onChange={() => handleGroupToggle(group.id)}
                      className="w-4 h-4"
                    />
                    <span>{group.group_name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? t('saving') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

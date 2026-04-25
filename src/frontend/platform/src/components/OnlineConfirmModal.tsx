import React, { useState } from 'react';
import { Button } from './bs-ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './bs-ui/dialog';
import { RadioGroup, RadioGroupItem } from './bs-ui/radio-group';
import { Label } from './bs-ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from './bs-ui/select';
import { AlertCircle, Globe, Users, Lock, BookOpen, GraduationCap, FlaskConical, Settings, ClipboardCheck, HelpCircle } from 'lucide-react';

// 固定分类选项
const CATEGORIES = [
  { value: '助教', label: '助教', icon: BookOpen, description: '教学辅助类智能体' },
  { value: '助学', label: '助学', icon: GraduationCap, description: '学习辅助类智能体' },
  { value: '助研', label: '助研', icon: FlaskConical, description: '科研辅助类智能体' },
  { value: '助管', label: '助管', icon: Settings, description: '管理辅助类智能体' },
  { value: '助评', label: '助评', icon: ClipboardCheck, description: '评估辅助类智能体' },
  { value: '其他', label: '其他', icon: HelpCircle, description: '未分类或归为其他类别' },
] as const;

interface OnlineConfirmModalProps {
  visible: boolean;
  loading?: boolean;
  onConfirm: (isPublic: number, category: string) => void;  // 0=仅自己, 1=组内, 2=全部
  onCancel: () => void;
}

const OnlineConfirmModal: React.FC<OnlineConfirmModalProps> = ({
  visible,
  loading = false,
  onConfirm,
  onCancel
}) => {
  const [selectedOption, setSelectedOption] = useState<'self' | 'group' | 'public'>('self');
  const [selectedCategory, setSelectedCategory] = useState<string>('其他');

  const handleConfirm = () => {
    // 转换为数字：self=0, group=1, public=2
    const publicValue = selectedOption === 'self' ? 0 : selectedOption === 'group' ? 1 : 2;
    onConfirm(publicValue, selectedCategory);
  };

  // 获取选中分类的图标
  const getCategoryIcon = (categoryValue: string) => {
    const category = CATEGORIES.find(c => c.value === categoryValue);
    return category ? category.icon : HelpCircle;
  };

  return (
    <Dialog open={visible} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            发布到智能体广场
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* 分类选择 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">选择分类</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择分类">
                  {selectedCategory && (() => {
                    const cat = CATEGORIES.find(c => c.value === selectedCategory);
                    if (!cat) return null;
                    const IconComponent = cat.icon;
                    return (
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4" />
                        <span>{cat.label}</span>
                      </div>
                    );
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {CATEGORIES.map((category) => {
                    const IconComponent = category.icon;
                    return (
                      <SelectItem key={category.value} value={category.value} customContent>
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{category.label}</div>
                            <div className="text-xs text-muted-foreground">{category.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* 可见范围选择 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">选择可见范围</Label>
            <p className="text-sm text-muted-foreground">
              智能体将发布到智能体广场，请选择谁可以看到：
            </p>

            <RadioGroup
              value={selectedOption}
              onValueChange={(value: 'self' | 'group' | 'public') => setSelectedOption(value)}
            >
              <div className="space-y-3">
                {/* 仅自己可见 */}
                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-secondary/50 transition-colors">
                  <RadioGroupItem value="self" id="self" className="mt-1" />
                  <Label htmlFor="self" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Lock className="h-4 w-4 text-gray-600" />
                      <span className="font-medium">仅自己可用</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      发布到广场，但只有自己可以看到并使用此智能体。
                    </p>
                  </Label>
                </div>

                {/* 组内可见选项 */}
                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-secondary/50 transition-colors">
                  <RadioGroupItem value="group" id="group" className="mt-1" />
                  <Label htmlFor="group" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">组内可用</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      发布到广场，同组成员可以看到并使用此智能体。
                    </p>
                  </Label>
                </div>

                {/* 全部可用选项 */}
                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-secondary/50 transition-colors">
                  <RadioGroupItem value="public" id="public" className="mt-1" />
                  <Label htmlFor="public" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="h-4 w-4 text-green-600" />
                      <span className="font-medium">全部可用</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      发布到广场，所有用户都可以看到并使用此智能体。
                    </p>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* 提示信息 */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">提示：</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>上线后可以随时下线或更改可见范围</li>
                  <li>其他用户只能使用智能体，不能编辑</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            loading={loading}
          >
            {loading ? '发布中...' : '确认发布'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OnlineConfirmModal;

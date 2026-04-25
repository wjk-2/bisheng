import { Button } from '@/components/bs-ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/bs-ui/card';
import { Input } from '@/components/bs-ui/input';
import { Label } from '@/components/bs-ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/bs-ui/select';
import { useToast } from '@/components/bs-ui/toast/use-toast';
import { copyText } from '@/utils';
import { Check, Clipboard, Link } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import request from '@/controllers/request';

const EXPIRE_OPTIONS = [
    { label: '24 小时', value: 1 },
    { label: '3 天', value: 3 },
    { label: '7 天', value: 7 },
    { label: '30 天', value: 30 },
    { label: '永久有效', value: 0 },
];

const RESOURCE_TYPE_MAP: Record<string, string> = {
    assistant: 'assistant',
    skill: 'skill',
    flow: 'workflow',
};

interface WebPublishProps {
    type?: string;
}

export default function WebPublish({ type = 'assistant' }: WebPublishProps) {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const { toast } = useToast();

    const [password, setPassword] = useState('');
    const [expireDays, setExpireDays] = useState<number>(1);
    const [generatedUrl, setGeneratedUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const passwordValid = password.length === 0 || password.length === 6;

    const handleGenerate = async () => {
        if (password.length > 0 && password.length !== 6) {
            toast({ title: '密码必须为6位字符', variant: 'error' });
            return;
        }

        setLoading(true);
        try {
            const resourceType = RESOURCE_TYPE_MAP[type] ?? type;
            const res: any = await request.post('/api/v1/share-link/generate_share_link', {
                resource_type: resourceType,
                resource_id: id,
                share_mode: 'read_only',
                expire_days: expireDays,
                meta_data: { flowId: id },
                password: password.length === 6 ? password : null,
            });

            const token = res?.share_token;
            if (!token) throw new Error('未获取到 share_token');

            const url = `${location.origin}/workspace/share/${token}`;
            setGeneratedUrl(url);
        } catch (e) {
            toast({ title: '生成失败，请重试', variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        copyText(generatedUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <section className="pb-20 max-w-2xl pt-4">
            <p className="text-sm text-muted-foreground mb-6">
                生成一个网页访问链接，访客无需登录账号，输入密码即可直接使用该智能体。
            </p>

            {/* 密码设置 */}
            <div className="mb-6">
                <Label className="mb-2 block font-medium">
                    访问密码
                    <span className="text-muted-foreground font-normal ml-2 text-xs">（6位任意字符，留空则无需密码）</span>
                </Label>
                <Input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="请输入6位密码，留空则不设置"
                    maxLength={6}
                    className={`w-64 ${!passwordValid ? 'border-red-400' : ''}`}
                />
                {!passwordValid && (
                    <p className="text-red-400 text-xs mt-1">密码长度必须为6位</p>
                )}
            </div>

            {/* 有效期设置 */}
            <div className="mb-8">
                <Label className="mb-2 block font-medium">链接有效期</Label>
                <Select
                    value={String(expireDays)}
                    onValueChange={v => setExpireDays(Number(v))}
                >
                    <SelectTrigger className="w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {EXPIRE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={String(opt.value)}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* 生成按钮 */}
            <Button onClick={handleGenerate} disabled={loading || !passwordValid} className="mb-6">
                {loading ? '生成中...' : '生成链接'}
            </Button>

            {/* 生成结果 */}
            {generatedUrl && (
                <Card>
                    <CardHeader className="pt-3 pb-1">
                        <CardTitle className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5">
                                <Link size={15} />
                                访问链接
                            </span>
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                                {copied ? <Check size={14} /> : <Clipboard size={14} />}
                                {copied ? '已复制' : '复制'}
                            </button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs break-all text-muted-foreground bg-muted rounded p-2">
                            {generatedUrl}
                        </p>
                        <div className="mt-3 text-xs text-muted-foreground space-y-1">
                            {password.length === 6 && <p>密码：<span className="font-mono font-medium text-foreground">{password}</span></p>}
                            <p>有效期：{EXPIRE_OPTIONS.find(o => o.value === expireDays)?.label}</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </section>
    );
}

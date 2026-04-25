import { Card, CardContent, CardHeader, CardTitle } from '@/components/bs-ui/card';
import { Button } from '@/components/bs-ui/button';
import { CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CreationSuccess() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <CheckCircle className="w-5 h-5 text-green-500" />
            构建完成
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>你的智能体已经完成构建，可以回到教学首页继续学习，或进入构建页面进行优化。</p>
          <div className="flex gap-3">
            <Button onClick={() => navigate('/education')}>返回教学首页</Button>
            <Button variant="outline" onClick={() => navigate('/build')}>前往智能体构建</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

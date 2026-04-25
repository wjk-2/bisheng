import { Card, CardContent, CardHeader, CardTitle } from '@/components/bs-ui/card';
import { Button } from '@/components/bs-ui/button';
import { useNavigate } from 'react-router-dom';

export default function PracticeEnvironment() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">实践环境</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>在平台内完成实践任务，操作与智能体构建保持一致。</p>
          <p>当前实践画布将逐步迁移到平台内实现（流程节点、调试日志、版本回滚）。</p>
          <div className="flex gap-3">
            <Button onClick={() => navigate('/education')}>返回教学首页</Button>
            <Button variant="outline" onClick={() => navigate('/build')}>前往智能体构建</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Button } from '@/components/bs-ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/bs-ui/card';

type ActionProps = {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline';
};

type BaseProps = {
  title?: string;
  message?: string;
  action?: ActionProps;
};

export function EducationLoading({ message = '正在加载内容...' }: { message?: string }) {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <div className="text-sm text-muted-foreground">{message}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export function EducationError({ title = '加载失败', message, action }: BaseProps) {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {message ? <div>{message}</div> : null}
          {action ? (
            <Button variant={action.variant ?? 'default'} onClick={action.onClick}>
              {action.label}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function EducationEmpty({ title = '暂无内容', message, action }: BaseProps) {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {message ? <div>{message}</div> : null}
          {action ? (
            <Button variant={action.variant ?? 'outline'} onClick={action.onClick}>
              {action.label}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/bs-ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/bs-ui/card';
import { Button } from '@/components/bs-ui/button';
import { educationAPI } from '@/controllers/API/education';
import type { GuidedStep } from './types';
import { useNavigate } from 'react-router-dom';
import { EducationEmpty, EducationError, EducationLoading } from './components/StateCard';

export default function GuidedBuilder() {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<GuidedStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<string | undefined>();

  useEffect(() => {
    const loadSteps = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await educationAPI.guidedBuilder.getSteps();
        setSteps(data?.steps ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载引导步骤失败');
      } finally {
        setLoading(false);
      }
    };

    loadSteps();
  }, []);

  if (loading) {
    return <EducationLoading message="正在加载引导步骤..." />;
  }

  if (error) {
    return (
      <EducationError
        title="引导步骤加载失败"
        message={error}
        action={{ label: '返回教学首页', onClick: () => navigate('/education') }}
      />
    );
  }

  if (steps.length === 0) {
    return (
      <EducationEmpty
        title="暂无引导步骤"
        message="请稍后刷新或联系管理员配置教学内容。"
        action={{ label: '返回教学首页', onClick: () => navigate('/education') }}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">工作流引导</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-xs text-muted-foreground">
            按步骤完成工作流构建流程，点击每个步骤可展开查看详细说明与操作提示。
          </div>
          <div className="flex gap-3">
            <Button onClick={() => navigate('/education')}>返回教学首页</Button>
            <Button
              variant="outline"
              onClick={() => {
                sessionStorage.setItem('flowGuidedStepIndex', '0');
                navigate('/build/apps');
              }}
            >
              开始工作流引导
            </Button>
          </div>
          <Accordion
            type="single"
            collapsible
            value={activeStep}
            onValueChange={(value) => setActiveStep(value || undefined)}
            className="space-y-2"
          >
            {steps.map((step, index) => {
              const instructionLines = (step.instructions ?? '')
                .split(/\n+/)
                .map((line) => line.trim())
                .filter(Boolean);
              return (
                <AccordionItem key={step.id} value={`step-${step.id}`} className="rounded-lg border border-border bg-background px-3">
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex items-start gap-3 text-left">
                      <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {index + 1}
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-foreground">{step.title}</div>
                        <div className="text-xs text-muted-foreground">{step.description}</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pl-9 pr-2 text-xs text-muted-foreground">
                    {instructionLines.length ? (
                      <div className="space-y-2">
                        <div className="font-medium text-foreground">详细说明</div>
                        <ul className="list-disc space-y-1 pl-4">
                          {instructionLines.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                        <div className="pt-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              sessionStorage.setItem('flowGuidedStepIndex', String(index));
                              navigate('/build/apps');
                            }}
                          >
                            跳转到此步骤
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">暂无详细说明，可先按步骤标题进行配置。</div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

import React from 'react';
import { BookOpen, Clock, Rocket } from 'lucide-react';
import { Badge } from '@/components/bs-ui/badge';
import { Card, CardContent } from '@/components/bs-ui/card';

export default function EducationPage() {
  return (
    <div className="education-page h-full overflow-y-auto">
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <Card className="max-w-md w-full text-center border-0 shadow-lg">
          <CardContent className="pt-10 pb-8 px-6">
            {/* 图标 */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Rocket className="w-8 h-8" />
            </div>

            {/* 标题 */}
            <h1 className="text-2xl font-semibold text-foreground mb-3">
              课程管理
            </h1>

            {/* 徽章 */}
            <Badge variant="secondary" className="mb-4 text-xs px-3 py-1">
              <Clock className="w-3 h-3 mr-1" />
              即将上线
            </Badge>

            {/* 说明 */}
            <p className="text-muted-foreground text-sm leading-relaxed">
              我们正在对课程管理模块进行全面重构升级，
              <br />
              敬请期待全新体验！
            </p>

            {/* 装饰元素 */}
            <div className="mt-8 flex justify-center gap-4 text-muted-foreground/40">
              <BookOpen className="w-5 h-5" />
              <span className="text-xs">智能体教学中心</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { BookOpen } from 'lucide-react';
import { Outlet } from 'react-router-dom';

// 隐藏所有 Tab（课程管理功能即将重构上线）

export default function EducationLayout() {
  return (
    <div className="min-h-full">
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* 标题区域 */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <BookOpen className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">教学中心</h1>
              <p className="text-[11px] text-muted-foreground">
                智能体教学与应用
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <Outlet />
      </div>
    </div>
  );
}

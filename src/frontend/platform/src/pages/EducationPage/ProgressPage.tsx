import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/bs-ui/card';
import { Progress } from '@/components/bs-ui/progress';
import { Button } from '@/components/bs-ui/button';
import { educationAPI } from '@/controllers/API/education';
import type { UserProgressStats } from './types';
import { useNavigate } from 'react-router-dom';
import { EducationError, EducationLoading } from './components/StateCard';

const defaultStats: UserProgressStats = {
  total_courses: 0,
  completed_courses: 0,
  total_learning_time: 0,
  courses_progress: [],
};

export default function ProgressPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserProgressStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProgress = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await educationAPI.progress.getUserProgress();
        setStats(data ?? defaultStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载学习进度失败');
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, []);

  const completionRate = useMemo(() => {
    if (!stats.total_courses) return 0;
    return Math.round((stats.completed_courses / stats.total_courses) * 100);
  }, [stats.completed_courses, stats.total_courses]);

  if (loading) {
    return <EducationLoading message="正在加载学习进度..." />;
  }

  if (error) {
    return (
      <EducationError
        title="学习进度加载失败"
        message={error}
        action={{ label: '返回教学首页', onClick: () => navigate('/education') }}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">学习概览</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <div>
              <div className="text-2xl font-semibold text-foreground">{stats.total_courses}</div>
              <div>总课程数</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-foreground">{stats.completed_courses}</div>
              <div>已完成</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-foreground">{stats.total_learning_time}</div>
              <div>累计学习时长(分钟)</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>整体完成率</span>
              <span className="font-medium text-primary">{completionRate}%</span>
            </div>
            <Progress value={completionRate} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">课程进度</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats.courses_progress.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无课程进度记录</div>
          ) : (
            <div className="space-y-4">
              {stats.courses_progress.map((course) => (
                <div key={course.course_id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>课程 {course.course_id}</span>
                    <span>{course.completed_chapters}/{course.total_chapters} 章节</span>
                  </div>
                  <Progress value={course.progress} />
                  <div className="text-xs text-muted-foreground">完成度 {course.progress}%</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

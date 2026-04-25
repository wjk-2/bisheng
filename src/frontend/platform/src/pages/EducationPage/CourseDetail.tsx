import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/bs-ui/badge';
import { Button } from '@/components/bs-ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/bs-ui/card';
import { Progress } from '@/components/bs-ui/progress';
import { BookOpen, Clock, Users, Star } from 'lucide-react';
import { educationAPI } from '@/controllers/API/education';
import type { Course } from './types';
import { EducationError, EducationLoading } from './components/StateCard';

const levelLabelMap = {
  beginner: '入门课程',
  intermediate: '进阶课程',
  advanced: '实战项目',
};

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCourse = async () => {
      if (!courseId) {
        setError('未找到课程编号');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await educationAPI.course.getCourseDetail(courseId);
        setCourse(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载课程详情失败');
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [courseId]);

  const progressValue = useMemo(() => {
    if (!course?.progress) return 0;
    return Math.min(100, Math.max(0, course.progress));
  }, [course?.progress]);

  if (loading) {
    return <EducationLoading message="正在加载课程详情..." />;
  }

  if (error || !course) {
    return (
      <EducationError
        title="课程加载失败"
        message={error ?? '课程不存在或已删除'}
        action={{ label: '返回教学首页', onClick: () => navigate('/education') }}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3">
            <span className="text-2xl font-semibold text-foreground">{course.title}</span>
            <Badge variant="secondary">{levelLabelMap[course.level]}</Badge>
            <Badge variant="outline">{course.category === 'theory' ? '理论课程' : '实践项目'}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-sm text-muted-foreground">{course.description}</div>

          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {course.duration} 分钟
            </span>
            {course.studentsCount ? (
              <span className="inline-flex items-center gap-2">
                <Users className="w-4 h-4" />
                {course.studentsCount.toLocaleString()} 学员
              </span>
            ) : null}
            {course.rating ? (
              <span className="inline-flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                {course.rating} 评分
              </span>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>课程进度</span>
              <span className="font-medium text-primary">{progressValue}%</span>
            </div>
            <Progress value={progressValue} />
          </div>

          <div className="flex flex-wrap gap-2">
            {(course.tags ?? []).map((tag) => (
              <Badge key={tag} variant="gray">
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            课程章节
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(course.chapters ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无章节内容</div>
          ) : (
            <div className="space-y-3">
              {(course.chapters ?? []).map((chapter, index) => (
                <div
                  key={chapter.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border bg-background p-4"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {index + 1}. {chapter.title}
                    </div>
                    {chapter.description ? (
                      <div className="text-xs text-muted-foreground mt-1">{chapter.description}</div>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/education/courses/${course.id}/chapters/${chapter.id}`)}
                  >
                    开始学习
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

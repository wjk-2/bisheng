import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/bs-ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/bs-ui/card';
import { Progress } from '@/components/bs-ui/progress';
import { educationAPI } from '@/controllers/API/education';
import type { Chapter, Course } from './types';
import { EducationError, EducationLoading } from './components/StateCard';

export default function ChapterLearning() {
  const { courseId, chapterId } = useParams<{ courseId: string; chapterId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [videoInfo, setVideoInfo] = useState<{ video_url: string; duration: number; last_position: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!courseId || !chapterId) {
        setError('缺少课程或章节参数');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [courseData, videoData] = await Promise.all([
          educationAPI.course.getCourseDetail(courseId),
          educationAPI.video.getVideoInfo(chapterId),
        ]);
        setCourse(courseData);
        const matchedChapter = courseData.chapters?.find(
          (item) => String(item.id) === String(chapterId)
        ) ?? null;
        setChapter(matchedChapter);
        setVideoInfo(videoData ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载章节内容失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [courseId, chapterId]);

  const progressValue = useMemo(() => {
    if (!chapter?.progress) return 0;
    return Math.min(100, Math.max(0, chapter.progress));
  }, [chapter?.progress]);

  const handleComplete = async () => {
    if (!chapterId) return;
    setIsCompleting(true);
    try {
      await educationAPI.progress.completeChapter(chapterId);
      navigate(`/education/courses/${courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交完成状态失败');
    } finally {
      setIsCompleting(false);
    }
  };

  if (loading) {
    return <EducationLoading message="正在加载章节内容..." />;
  }

  if (error) {
    return (
      <EducationError
        title="章节加载失败"
        message={error}
        action={{
          label: '返回课程详情',
          onClick: () => navigate(`/education/courses/${courseId}`),
        }}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">
            {course?.title ? `${course.title} · ${chapter?.title ?? '章节学习'}` : (chapter?.title ?? '章节学习')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {chapter?.description ? (
            <div className="text-sm text-muted-foreground">{chapter.description}</div>
          ) : null}
          {videoInfo?.video_url ? (
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <video
                className="w-full h-full"
                controls
                src={videoInfo.video_url}
                poster=""
              />
            </div>
          ) : (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">
              暂无视频资源
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">学习进度</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>完成度</span>
            <span className="font-medium text-primary">{progressValue}%</span>
          </div>
          <Progress value={progressValue} />
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => navigate(`/education/courses/${courseId}`)}>
              返回课程详情
            </Button>
            <Button onClick={handleComplete} disabled={isCompleting}>
              {isCompleting ? '提交中...' : '完成本章节'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

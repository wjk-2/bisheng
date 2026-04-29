import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { educationApi, PathDetailOut } from './api/educationApi';

export default function PathDetailPage() {
  const { pathId } = useParams<{ pathId: string }>();
  const [data, setData] = useState<PathDetailOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pathId) return;
    setLoading(true);
    educationApi.getPathDetail(Number(pathId))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [pathId]);

  if (loading) return <div className="p-8 text-[#9498AC]">加载中...</div>;
  if (!data) return <div className="p-8 text-[#9498AC]">学习路径不存在</div>;

  const { path, stages } = data;
  const totalCourses = stages.reduce((sum, s) => sum + s.courses.length, 0);

  return (
    <div className="min-h-full bg-[#F7F9FF] p-6">
      {/* Breadcrumb */}
      <div className="text-xs text-[#9498AC] mb-4 flex items-center gap-1">
        <Link to="/education/courses" className="hover:text-[#4658FF]">课程学习</Link>
        <span>/</span>
        <span className="text-[#140E35]">{path.title}</span>
      </div>

      {/* Path Header */}
      <div className="bg-white rounded-xl border border-[#E5EAF4] p-6 mb-6">
        <h1 className="text-xl font-semibold text-[#140E35] mb-2">{path.title}</h1>
        {path.description && (
          <p className="text-sm text-[#565772] mb-3">{path.description}</p>
        )}
        <div className="text-xs text-[#9498AC]">共 {totalCourses} 门课程</div>
      </div>

      {/* Stages */}
      <div className="space-y-6">
        {stages.map((group, gi) => (
          <div key={gi}>
            <h2 className="text-base font-semibold text-[#140E35] mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-[#4658FF] rounded-full" />
              {group.stage}
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {group.courses.map(course => (
                <Link
                  key={course.id}
                  to={`/education/paths/${pathId}/courses/${course.id}`}
                  className="group bg-white rounded-xl border border-[#E5EAF4] overflow-hidden hover:shadow-md hover:border-[#4658FF] transition-all"
                >
                  <div className="h-28 bg-gradient-to-br from-[#4658FF]/10 to-[#6B7FFF]/10 flex items-center justify-center">
                    <span className="text-[#4658FF]/40 text-3xl">📚</span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-[#140E35] mb-2 line-clamp-2 group-hover:text-[#4658FF]">
                      {course.title}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-[#9498AC]">
                      <span>
                        {course.estimated_minutes > 0
                          ? `${Math.ceil(course.estimated_minutes / 60)} 学时`
                          : '--'}
                      </span>
                      <span>{course.total_units || 0} 单元</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

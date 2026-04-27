import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { educationApi, CourseDetailOut } from './api/educationApi';

const TYPE_LABEL: Record<string, string> = {
  general: '通识课',
  professional: '专业课',
  project: '项目案例课',
};

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [data, setData] = useState<CourseDetailOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    educationApi.getCourseDetail(Number(courseId))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return <div className="p-8 text-[#9498AC]">加载中...</div>;
  if (!data) return <div className="p-8 text-[#9498AC]">课程不存在</div>;

  const { course, units } = data;
  const totalMinutes = units.reduce((sum, u) => sum + u.estimated_minutes, 0);

  return (
    <div className="min-h-full bg-[#F7F9FF] p-6">
      {/* Breadcrumb */}
      <div className="text-xs text-[#9498AC] mb-4 flex items-center gap-1">
        <Link to="/education/courses" className="hover:text-[#4658FF]">课程学习</Link>
        <span>/</span>
        <span className="text-[#140E35]">{course.title}</span>
      </div>

      {/* Course Header */}
      <div className="bg-white rounded-xl border border-[#E5EAF4] p-6 mb-6">
        <div className="flex gap-6">
          <div className="w-40 h-28 bg-gradient-to-br from-[#4658FF]/10 to-[#6B7FFF]/10 rounded-lg flex-shrink-0 flex items-center justify-center">
            {course.cover ? (
              <img src={course.cover} alt={course.title} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <span className="text-[#4658FF]/40 text-3xl">📚</span>
            )}
          </div>
          <div className="flex-1">
            <div className="text-xs text-[#4658FF] bg-[#F1F5FF] rounded px-2 py-0.5 inline-block mb-2">
              {TYPE_LABEL[course.type] || course.type}
            </div>
            <h1 className="text-xl font-semibold text-[#140E35] mb-2">{course.title}</h1>
            <div className="flex gap-4 text-sm text-[#9498AC]">
              <span>{course.total_units} 个单元</span>
              <span>{Math.ceil(totalMinutes / 60)} 学时</span>
              <span>{course.completed_units}/{course.total_units} 已完成</span>
            </div>
            {course.description && (
              <p className="mt-2 text-sm text-[#565772]">{course.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Unit List */}
      <div className="bg-white rounded-xl border border-[#E5EAF4] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5EAF4]">
          <h2 className="text-base font-semibold text-[#140E35]">课程单元</h2>
        </div>
        <div className="divide-y divide-[#E5EAF4]">
          {units.map((unit, idx) => (
            <Link
              key={unit.id}
              to={`/education/courses/${courseId}/${unit.id}`}
              className="flex items-center gap-4 px-6 py-4 hover:bg-[#F7F9FF] transition-colors group"
            >
              <div className="w-7 h-7 rounded-full border-2 border-[#E5EAF4] flex items-center justify-center text-xs text-[#9498AC] flex-shrink-0 group-hover:border-[#4658FF]">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#140E35] truncate">{unit.title}</div>
                <div className="text-xs text-[#9498AC] mt-0.5">{unit.estimated_minutes} 分钟</div>
              </div>
              <div className="flex-shrink-0">
                {unit.is_completed ? (
                  <span className="text-xs text-[#4658FF] bg-[#F1F5FF] rounded-full px-2 py-0.5">已完成</span>
                ) : (
                  <span className="text-xs text-[#9498AC]">未完成</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

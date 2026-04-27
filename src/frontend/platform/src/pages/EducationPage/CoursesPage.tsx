import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { educationApi, CourseOut } from './api/educationApi';

const TABS = [
  { key: '', label: '全部' },
  { key: 'general', label: '通识课' },
  { key: 'professional', label: '专业课' },
  { key: 'project', label: '项目案例课' },
];

export default function CoursesPage() {
  const [searchParams] = useSearchParams();
  const classId = searchParams.get('class_id') ? Number(searchParams.get('class_id')) : undefined;
  const [activeTab, setActiveTab] = useState('');
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    educationApi.listCourses(activeTab || undefined)
      .then(setCourses)
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div className="min-h-full bg-[#F7F9FF] p-6">
      <h1 className="text-2xl font-semibold text-[#140E35] mb-6">课程学习</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[#E5EAF4]">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#4658FF] text-[#4658FF]'
                : 'border-transparent text-[#9498AC] hover:text-[#140E35]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Course Grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 bg-white rounded-xl border border-[#E5EAF4] animate-pulse" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center text-[#9498AC] py-16">暂无课程</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {courses.map(course => (
            <Link
              key={course.id}
              to={`/education/courses/${course.id}${classId ? `?class_id=${classId}` : ''}`}
              className="group bg-white rounded-xl border border-[#E5EAF4] overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Cover */}
              <div className="h-32 bg-gradient-to-br from-[#4658FF]/10 to-[#6B7FFF]/10 flex items-center justify-center">
                {course.cover ? (
                  <img src={course.cover} alt={course.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#4658FF]/40 text-4xl">📚</span>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="text-xs text-[#4658FF] bg-[#F1F5FF] rounded px-2 py-0.5 inline-block mb-2">
                  {course.type === 'general' ? '通识课' : course.type === 'professional' ? '专业课' : '项目案例课'}
                </div>
                <h3 className="text-sm font-semibold text-[#140E35] mb-2 line-clamp-2">{course.title}</h3>
                <div className="flex items-center justify-between text-xs text-[#9498AC]">
                  <span>{course.total_units} 个单元</span>
                  <span>{course.completed_units}/{course.total_units} 已完成</span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1 bg-[#E5EAF4] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#4658FF] rounded-full"
                    style={{ width: course.total_units > 0 ? `${(course.completed_units / course.total_units) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

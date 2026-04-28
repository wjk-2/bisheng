import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { educationApi, PathOut, CourseOut } from './api/educationApi';

export default function CoursesPage() {
  const [paths, setPaths] = useState<PathOut[]>([]);
  const [activePathId, setActivePathId] = useState<number | null>(null);
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [loadingPaths, setLoadingPaths] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);

  useEffect(() => {
    educationApi.listPaths()
      .then(data => {
        setPaths(data);
        if (data.length > 0) setActivePathId(data[0].id);
      })
      .finally(() => setLoadingPaths(false));
  }, []);

  useEffect(() => {
    if (activePathId === null) return;
    setLoadingCourses(true);
    educationApi.listCourses({ pathId: activePathId })
      .then(setCourses)
      .finally(() => setLoadingCourses(false));
  }, [activePathId]);

  const PATH_TYPE_LABEL: Record<string, string> = {
    general: '通识',
    professional: '专业核心',
    project: '项目实操',
  };

  const INDUSTRY_LABEL: Record<string, string> = {
    logistics: '物流',
    ecommerce: '电商',
  };

  const getTabLabel = (path: PathOut) => {
    if (path.industry) {
      const industryLabel = INDUSTRY_LABEL[path.industry] ?? path.industry;
      return `${PATH_TYPE_LABEL[path.type] ?? path.type}·${industryLabel}`;
    }
    return PATH_TYPE_LABEL[path.type] ?? path.title;
  };

  return (
    <div className="min-h-full p-6">
      <h1 className="text-2xl font-semibold text-[#140E35] mb-6">课程学习</h1>

      {/* Path Tabs */}
      {!loadingPaths && (
        <div className="flex gap-2 mb-6 border-b border-[#E5EAF4]">
          {paths.map(path => (
            <button
              key={path.id}
              onClick={() => setActivePathId(path.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activePathId === path.id
                  ? 'border-[#4658FF] text-[#4658FF]'
                  : 'border-transparent text-[#9498AC] hover:text-[#140E35]'
              }`}
            >
              {getTabLabel(path)}
            </button>
          ))}
        </div>
      )}

      {/* Course Grid */}
      {loadingPaths || loadingCourses ? (
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
              to={`/education/courses/${course.id}`}
              className="group bg-white rounded-xl border border-[#E5EAF4] overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="h-32 bg-gradient-to-br from-[#4658FF]/10 to-[#6B7FFF]/10 flex items-center justify-center">
                {course.cover ? (
                  <img src={course.cover} alt={course.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#4658FF]/40 text-4xl">📚</span>
                )}
              </div>
              <div className="p-4">
                {course.stage && (
                  <div className="text-xs text-[#9498AC] mb-1">{course.stage}</div>
                )}
                <h3 className="text-sm font-semibold text-[#140E35] mb-2 line-clamp-2">{course.title}</h3>
                <div className="flex items-center justify-between text-xs text-[#9498AC]">
                  <span>{Math.ceil(course.estimated_minutes / 60)} 学时</span>
                  <span>{course.completed_units}/{course.total_units} 已完成</span>
                </div>
                <div className="mt-2 h-1 bg-[#E5EAF4] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#4658FF] rounded-full"
                    style={{
                      width: course.total_units > 0
                        ? `${(course.completed_units / course.total_units) * 100}%`
                        : '0%',
                    }}
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

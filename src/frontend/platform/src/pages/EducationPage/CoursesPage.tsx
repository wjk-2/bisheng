import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { educationApi, PathOut } from './api/educationApi';

const PATH_TYPE_LABEL: Record<string, string> = {
  general: '通识',
  professional: '专业核心',
  project: '项目实操',
};

const INDUSTRY_LABEL: Record<string, string> = {
  logistics: '物流',
  ecommerce: '电商',
};

export default function CoursesPage() {
  const [paths, setPaths] = useState<PathOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    educationApi.listPaths()
      .then(setPaths)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const getBadge = (p: PathOut) => {
    if (p.industry) {
      return `${PATH_TYPE_LABEL[p.type] ?? p.type}·${INDUSTRY_LABEL[p.industry] ?? p.industry}`;
    }
    return PATH_TYPE_LABEL[p.type] ?? p.type;
  };

  return (
    <div className="min-h-full p-6">
      <h1 className="text-2xl font-semibold text-[#140E35] mb-2">课程学习</h1>
      <p className="text-sm text-[#9498AC] mb-6">选择一条学习路径开启你的 AI 学习旅程</p>

      {loading ? (
        <div className="grid grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 bg-white rounded-xl border border-[#E5EAF4] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center text-red-500 py-16 text-sm">学习路径加载失败，请刷新页面重试</div>
      ) : paths.length === 0 ? (
        <div className="text-center text-[#9498AC] py-16">暂无学习路径</div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {paths.map(path => (
            <Link
              key={path.id}
              to={`/education/paths/${path.id}`}
              className="group bg-white rounded-xl border border-[#E5EAF4] overflow-hidden hover:shadow-md hover:border-[#4658FF] transition-all"
            >
              <div className="h-32 bg-gradient-to-br from-[#4658FF]/10 to-[#6B7FFF]/10 flex items-center justify-center">
                {path.cover ? (
                  <img src={path.cover} alt={path.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#4658FF]/40 text-5xl">🎓</span>
                )}
              </div>
              <div className="p-5">
                <div className="inline-block text-xs text-[#4658FF] bg-[#F1F5FF] rounded px-2 py-0.5 mb-2">
                  {getBadge(path)}
                </div>
                <h3 className="text-base font-semibold text-[#140E35] mb-2 group-hover:text-[#4658FF]">
                  {path.title}
                </h3>
                {path.description && (
                  <p className="text-sm text-[#9498AC] line-clamp-2 mb-3">{path.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-[#9498AC]">
                  <span>{path.total_courses} 门课程</span>
                  <span className="text-[#4658FF]">进入路径 →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

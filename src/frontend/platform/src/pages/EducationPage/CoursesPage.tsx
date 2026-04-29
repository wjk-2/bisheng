import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { educationApi, PathOut } from './api/educationApi';
import EduAvatar from './components/EduAvatar';

const PATH_TYPE_LABEL: Record<string, string> = {
  general: '通识',
  professional: '专业核心',
  project: '项目实操',
};

const INDUSTRY_LABEL: Record<string, string> = {
  logistics: '物流',
  ecommerce: '电商',
};

function getBadgeClass(path: PathOut): string {
  if (path.type === 'general') {
    return 'text-[#4658FF] bg-[#F1F5FF]';
  }
  if (path.type === 'professional') {
    return 'text-[#7C3AED] bg-[#F3EEFF]';
  }
  if (path.type === 'project') {
    if (path.industry === 'logistics') {
      return 'text-[#F59E0B] bg-[#FFFBEB]';
    }
    return 'text-[#10B981] bg-[#ECFDF5]';
  }
  return 'text-[#4658FF] bg-[#F1F5FF]';
}

function getBadgeLabel(path: PathOut): string {
  if (path.industry) {
    return `${PATH_TYPE_LABEL[path.type] ?? path.type}·${INDUSTRY_LABEL[path.industry] ?? path.industry}`;
  }
  return PATH_TYPE_LABEL[path.type] ?? path.type;
}

export default function CoursesPage() {
  const [paths, setPaths] = useState<PathOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    setError(false);
    educationApi.listPaths()
      .then(setPaths)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const hoveredStyle = {
    background: 'linear-gradient(179deg, rgba(70,88,255,0.06) -8.26%, transparent 44.84%), #fff',
    boxShadow: '0 4px 16px rgba(70,88,255,0.12)',
  };
  const normalStyle = {
    background: '#fff',
  };

  return (
    <div className="min-h-full p-6">
      <h1 className="text-2xl font-semibold text-[#140E35] mb-2">课程学习</h1>
      <p className="text-sm text-[#9498AC] mb-6">选择一条学习路径开启你的 AI 学习旅程</p>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 bg-white rounded-xl border border-[#E5EAF4] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center text-red-500 py-16 text-sm">学习路径加载失败，请刷新页面重试</div>
      ) : paths.length === 0 ? (
        <div className="text-center text-[#9498AC] py-16">暂无学习路径</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
          {paths.map(path => {
            const cardId = path.id.toString();
            const isHovered = hoveredId === cardId;
            return (
              <Link
                key={path.id}
                to={`/education/paths/${path.id}`}
                className="rounded-xl border border-[#E5EAF4] overflow-hidden transition-all duration-200"
                style={isHovered ? hoveredStyle : normalStyle}
                onMouseEnter={() => setHoveredId(cardId)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="p-5 flex flex-col h-full">
                  <div className="flex items-start gap-3 mb-3">
                    <EduAvatar
                      id={cardId}
                      type={`path_${path.type}`}
                      url={path.cover}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block text-xs rounded px-2 py-0.5 mb-1 ${getBadgeClass(path)}`}>
                        {getBadgeLabel(path)}
                      </span>
                      <h3 className="text-sm font-semibold text-[#140E35] line-clamp-2 leading-snug">
                        {path.title}
                      </h3>
                    </div>
                  </div>
                  <p className="text-xs text-[#9498AC] line-clamp-2 flex-1 mb-3">
                    {path.description ?? ''}
                  </p>
                  <div className="border-t border-[#E5EAF4] pt-3 flex items-center justify-between text-xs text-[#9498AC]">
                    <span>{path.total_courses} 门课程</span>
                    <span className="text-[#4658FF]">进入 →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

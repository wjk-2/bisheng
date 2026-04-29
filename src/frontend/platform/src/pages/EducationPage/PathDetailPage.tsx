import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { educationApi, PathDetailOut } from './api/educationApi';
import EduAvatar from './components/EduAvatar';

const TYPE_BADGE: Record<string, string> = {
  general:      'text-[#4658FF] bg-[#F1F5FF]',
  professional: 'text-[#7C3AED] bg-[#F3EEFF]',
  project:      'text-[#F59E0B] bg-[#FFFBEB]',
};

const TYPE_LABEL: Record<string, string> = {
  general:      '通用',
  professional: '专业',
  project:      '项目',
};

const INDUSTRY_BADGE: Record<string, string> = {
  logistics:  'text-[#F59E0B] bg-[#FFFBEB]',
  ecommerce:  'text-[#10B981] bg-[#ECFDF5]',
};

const INDUSTRY_LABEL: Record<string, string> = {
  logistics: '物流',
  ecommerce: '电商',
};

const hoveredStyle = {
  background: 'linear-gradient(179deg, rgba(70,88,255,0.06) -8.26%, transparent 44.84%), #fff',
  boxShadow: '0 4px 16px rgba(70,88,255,0.12)',
};
const normalStyle = { background: '#fff' };

export default function PathDetailPage() {
  const { pathId } = useParams<{ pathId: string }>();
  const [data, setData] = useState<PathDetailOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  const typeBadgeCls = TYPE_BADGE[path.type] ?? TYPE_BADGE.general;
  const typeLabel    = TYPE_LABEL[path.type]  ?? path.type;
  const industryBadgeCls = path.industry
    ? (INDUSTRY_BADGE[path.industry] ?? TYPE_BADGE.general)
    : '';
  const industryLabel = path.industry
    ? (INDUSTRY_LABEL[path.industry] ?? path.industry)
    : '';

  return (
    <div className="min-h-full p-6">
      {/* Breadcrumb */}
      <div className="text-xs text-[#9498AC] mb-4 flex items-center gap-1">
        <Link to="/education/courses" className="hover:text-[#4658FF]">课程学习</Link>
        <span>/</span>
        <span className="text-[#140E35]">{path.title}</span>
      </div>

      {/* Path Header */}
      <div className="bg-white rounded-xl border border-[#E5EAF4] p-6 mb-6">
        <div className="flex gap-4 items-start">
          <EduAvatar id={path.id.toString()} type={`path_${path.type}`} url={path.cover} size="lg" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-semibold text-[#140E35]">{path.title}</h1>
              <span className={`text-xs px-2 py-0.5 rounded ${typeBadgeCls}`}>{typeLabel}</span>
              {path.industry && (
                <span className={`text-xs px-2 py-0.5 rounded ${industryBadgeCls}`}>{industryLabel}</span>
              )}
            </div>
            {path.description && (
              <p className="text-sm text-[#565772] mb-3">{path.description}</p>
            )}
            {/* 阶段路线图 */}
            {stages.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-[#9498AC]">
                {stages.map((s, i) => (
                  <React.Fragment key={s.stage}>
                    <span className="px-2 py-0.5 bg-[#F1F5FF] text-[#4658FF] rounded">{s.stage}</span>
                    {i < stages.length - 1 && <span>→</span>}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="text-xs text-[#9498AC] mt-3">共 {totalCourses} 门课程</div>
      </div>

      {/* Stages */}
      <div className="space-y-6">
        {stages.map((group) => (
          <div key={group.stage}>
            <h2 className="text-base font-semibold text-[#140E35] mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-[#4658FF] rounded-full" />
              {group.stage}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-stretch">
              {group.courses.map(course => (
                <Link
                  key={course.id}
                  to={`/education/paths/${pathId}/courses/${course.id}`}
                  className="block rounded-xl border border-[#E5EAF4] overflow-hidden transition-all duration-200"
                  style={hoveredId === course.id.toString() ? hoveredStyle : normalStyle}
                  onMouseEnter={() => setHoveredId(course.id.toString())}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="p-4 flex flex-col h-full">
                    <div className="flex items-start gap-2 mb-2">
                      <EduAvatar id={course.id.toString()} type="course" url={course.cover} size="md" />
                      <h3 className="text-sm font-semibold text-[#140E35] line-clamp-2 flex-1">{course.title}</h3>
                    </div>
                    <div className="flex-1" />
                    <div className="border-t border-[#E5EAF4] pt-2 flex justify-between text-xs text-[#9498AC]">
                      <span>
                        {course.estimated_minutes > 0
                          ? `${Math.ceil(course.estimated_minutes / 60)} 学时`
                          : '--'}
                        · {course.total_units || 0} 单元
                      </span>
                      <span className="text-[#4658FF]">开始 →</span>
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

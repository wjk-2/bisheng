import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { educationApi, UnitLearningOut } from './api/educationApi';
import DialogPanel from './panels/DialogPanel';
import TextSubmitPanel from './panels/TextSubmitPanel';

const PANEL_LABEL: Record<string, string> = {
  dialog: '对话练习',
  prompt_debugger: 'Prompt 调试',
  knowledge_upload: '知识库上传',
  agent_form: '智能体配置',
  knowledge_bind: '知识库绑定',
  text_submit: '提交作品',
};

function RightPanel({ type, config, unitId, classId, onMarkComplete }: {
  type: string;
  config: Record<string, unknown> | null;
  unitId: number;
  classId?: number;
  onMarkComplete?: () => void;
}) {
  switch (type) {
    case 'dialog':
      return <DialogPanel config={config} />;
    case 'text_submit':
      return <TextSubmitPanel unitId={unitId} classId={classId} onSubmitted={onMarkComplete} />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-[#9498AC] text-sm">
          {PANEL_LABEL[type] || type} — 即将开放
        </div>
      );
  }
}

export default function UnitLearningPage() {
  const { courseId, unitId } = useParams<{ courseId: string; unitId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const classId = searchParams.get('class_id') ? Number(searchParams.get('class_id')) : undefined;
  const [data, setData] = useState<UnitLearningOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!unitId) return;
    setLoading(true);
    educationApi.getUnitLearning(Number(unitId), classId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [unitId, classId]);

  const handleMarkComplete = async () => {
    if (!data || !classId || !unitId) return;
    setMarking(true);
    try {
      await educationApi.markUnitComplete(Number(unitId), classId);
      setData(prev => prev ? { ...prev, unit: { ...prev.unit, is_completed: true } } : prev);
    } finally {
      setMarking(false);
    }
  };

  if (loading) return <div className="p-8 text-[#9498AC]">加载中...</div>;
  if (!data) return <div className="p-8 text-[#9498AC]">单元不存在</div>;

  const { unit, prev_unit_id, next_unit_id } = data;

  return (
    <div className="flex flex-col h-screen bg-[#F7F9FF]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#E5EAF4] flex-shrink-0">
        <div className="text-xs text-[#9498AC] flex items-center gap-1">
          <Link to={`/education/courses${classId ? `?class_id=${classId}` : ''}`} className="hover:text-[#4658FF]">课程学习</Link>
          <span>/</span>
          <Link to={`/education/courses/${courseId}${classId ? `?class_id=${classId}` : ''}`} className="hover:text-[#4658FF]">课程详情</Link>
          <span>/</span>
          <span className="text-[#140E35]">{unit.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {prev_unit_id && (
            <button
              onClick={() => navigate(`/education/courses/${courseId}/${prev_unit_id}${classId ? `?class_id=${classId}` : ''}`)}
              className="text-xs text-[#9498AC] hover:text-[#4658FF] px-2 py-1"
            >
              ← 上一单元
            </button>
          )}
          {next_unit_id && (
            <button
              onClick={() => navigate(`/education/courses/${courseId}/${next_unit_id}${classId ? `?class_id=${classId}` : ''}`)}
              className="text-xs text-[#9498AC] hover:text-[#4658FF] px-2 py-1"
            >
              下一单元 →
            </button>
          )}
        </div>
      </div>

      {/* Dual Column */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Markdown Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-white border-r border-[#E5EAF4]">
          <h1 className="text-xl font-semibold text-[#140E35] mb-6">{unit.title}</h1>
          {unit.content ? (
            <div className="prose prose-sm max-w-none text-[#565772]">
              <ReactMarkdown>{unit.content}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-[#9498AC]">本单元内容待更新</div>
          )}

          {/* Mark Complete Button */}
          <div className="mt-10 pt-6 border-t border-[#E5EAF4]">
            <div className="flex items-center gap-3">
              {unit.is_completed ? (
                <div className="flex items-center gap-2 text-sm text-[#4658FF]">
                  <span>✅</span>
                  <span>已完成</span>
                </div>
              ) : (
                <button
                  onClick={handleMarkComplete}
                  disabled={marking || !classId}
                  className="px-6 py-2 bg-[#4658FF] text-white text-sm rounded-lg disabled:opacity-50 hover:bg-[#3748EF]"
                >
                  {marking ? '标记中...' : '标记本单元已完成'}
                </button>
              )}
              <button
                onClick={() => navigate(`/education/portfolio?unit_id=${unit.id}${classId ? `&class_id=${classId}` : ''}`)}
                className="px-4 py-2 border border-[#4658FF] text-[#4658FF] text-sm rounded-lg hover:bg-[#F1F5FF]"
              >
                提交作品
              </button>
            </div>
            {!classId && (
              <p className="text-xs text-[#9498AC] mt-2">加入班级后可记录进度</p>
            )}
          </div>
        </div>

        {/* Right — Operation Panel */}
        <div className="w-96 flex-shrink-0 flex flex-col bg-white">
          <div className="px-4 py-3 border-b border-[#E5EAF4]">
            <span className="text-sm font-medium text-[#140E35]">
              {PANEL_LABEL[unit.right_panel_type] || '操作区'}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <RightPanel
              type={unit.right_panel_type}
              config={unit.right_panel_config}
              unitId={unit.id}
              classId={classId}
              onMarkComplete={handleMarkComplete}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

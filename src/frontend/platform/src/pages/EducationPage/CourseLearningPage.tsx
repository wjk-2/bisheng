import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { educationApi, CourseDetailOut, UnitDetailOut } from './api/educationApi';
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
      return (
        <TextSubmitPanel
          unitId={unitId}
          classId={classId}
          onSubmitted={() => onMarkComplete?.()}
        />
      );
    default:
      return (
        <div className="flex items-center justify-center h-full text-[#9498AC] text-sm">
          {PANEL_LABEL[type] || type} — 即将开放
        </div>
      );
  }
}

export default function CourseLearningPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const classId = searchParams.get('class_id') ? Number(searchParams.get('class_id')) : undefined;

  const [data, setData] = useState<CourseDetailOut | null>(null);
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState('');

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    educationApi.getCourseDetail(Number(courseId), classId)
      .then(d => { setData(d); setActiveUnitIndex(0); })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [courseId, classId]);

  const handleMarkComplete = async () => {
    if (!data || !classId) return;
    const unit = data.units[activeUnitIndex];
    if (!unit) return;
    setMarking(true);
    setMarkError('');
    try {
      await educationApi.markUnitComplete(unit.id, classId);
      setData(prev => {
        if (!prev) return prev;
        const units = prev.units.map((u, i) =>
          i === activeUnitIndex ? { ...u, is_completed: true } : u
        );
        const completed = units.filter(u => u.is_completed).length;
        return { ...prev, units, course: { ...prev.course, completed_units: completed } };
      });
    } catch {
      setMarkError('标记失败，请稍后重试');
    } finally {
      setMarking(false);
    }
  };

  if (loading) return <div className="p-8 text-[#9498AC]">加载中...</div>;
  if (!data) return <div className="p-8 text-[#9498AC]">课程不存在</div>;

  const { course, units } = data;
  const activeUnit = units[activeUnitIndex] as UnitDetailOut | undefined;
  const hasMultipleUnits = units.length > 1;

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#E5EAF4] flex-shrink-0">
        <div className="text-xs text-[#9498AC] flex items-center gap-1">
          <Link to="/education/courses" className="hover:text-[#4658FF]">课程学习</Link>
          <span>/</span>
          <span className="text-[#140E35]">{course.title}</span>
          {hasMultipleUnits && activeUnit && (
            <>
              <span>/</span>
              <span className="text-[#140E35]">{activeUnit.title}</span>
            </>
          )}
        </div>
        {hasMultipleUnits && (
          <div className="flex items-center gap-2">
            {activeUnitIndex > 0 && (
              <button
                onClick={() => setActiveUnitIndex(i => i - 1)}
                className="text-xs text-[#9498AC] hover:text-[#4658FF] px-2 py-1"
              >
                ← 上一章节
              </button>
            )}
            {activeUnitIndex < units.length - 1 && (
              <button
                onClick={() => setActiveUnitIndex(i => i + 1)}
                className="text-xs text-[#9498AC] hover:text-[#4658FF] px-2 py-1"
              >
                下一章节 →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dual Column */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Markdown Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-white border-r border-[#E5EAF4]">
          {/* Unit tabs（多章节时显示） */}
          {hasMultipleUnits && (
            <div className="flex gap-2 mb-6 border-b border-[#E5EAF4]">
              {units.map((u, i) => (
                <button
                  key={u.id}
                  onClick={() => setActiveUnitIndex(i)}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                    i === activeUnitIndex
                      ? 'border-[#4658FF] text-[#4658FF]'
                      : 'border-transparent text-[#9498AC] hover:text-[#140E35]'
                  }`}
                >
                  {i + 1}. {u.title}
                  {u.is_completed && <span className="ml-1 text-[#4658FF]">✓</span>}
                </button>
              ))}
            </div>
          )}

          <h1 className="text-xl font-semibold text-[#140E35] mb-6">
            {activeUnit?.title || course.title}
          </h1>

          {activeUnit?.content ? (
            <div className="prose prose-sm max-w-none text-[#565772]">
              <ReactMarkdown>{activeUnit.content}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-[#9498AC]">本章节内容待更新</div>
          )}

          {/* Mark Complete */}
          {activeUnit && (
            <div className="mt-10 pt-6 border-t border-[#E5EAF4]">
              <div className="flex items-center gap-3">
                {activeUnit.is_completed ? (
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
                    {marking ? '标记中...' : '标记本章节已完成'}
                  </button>
                )}
              </div>
              {markError && (
                <p className="text-xs text-red-500 mt-2">{markError}</p>
              )}
              {!classId && (
                <p className="text-xs text-[#9498AC] mt-2">加入班级后可记录进度</p>
              )}
            </div>
          )}
        </div>

        {/* Right — Operation Panel */}
        {activeUnit && (
          <div className="w-96 flex-shrink-0 flex flex-col bg-white">
            <div className="px-4 py-3 border-b border-[#E5EAF4]">
              <span className="text-sm font-medium text-[#140E35]">
                {PANEL_LABEL[activeUnit.right_panel_type] || '操作区'}
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <RightPanel
                type={activeUnit.right_panel_type}
                config={activeUnit.right_panel_config}
                unitId={activeUnit.id}
                classId={classId}
                onMarkComplete={handleMarkComplete}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

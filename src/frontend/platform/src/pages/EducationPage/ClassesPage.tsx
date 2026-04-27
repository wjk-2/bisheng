import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { educationApi, ClassOut, ClassDetailOut } from './api/educationApi';

// ─── 列表视图 ────────────────────────────────────────────────────────────────

function ClassList() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassOut[]>([]);
  const [loading, setLoading] = useState(true);

  // 创建表单状态
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSemester, setFormSemester] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    educationApi.listClasses()
      .then(setClasses)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = () => {
    if (!formName.trim() || !formSemester.trim()) return;
    setCreating(true);
    educationApi.createClass(formName.trim(), formSemester.trim())
      .then(() => {
        setShowForm(false);
        setFormName('');
        setFormSemester('');
        load();
      })
      .finally(() => setCreating(false));
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormName('');
    setFormSemester('');
  };

  return (
    <div className="min-h-full bg-[#F7F9FF] p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[#140E35]">班级管理</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-[#4658FF] text-white text-sm rounded-lg hover:bg-[#3547EE] transition-colors"
        >
          创建班级
        </button>
      </div>

      {/* 内联创建表单 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-[#E5EAF4] p-5 mb-5">
          <h2 className="text-sm font-medium text-[#140E35] mb-4">新建班级</h2>
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs text-[#9498AC] mb-1">班级名称</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="例：计算机科学2班"
                className="w-full border border-[#E5EAF4] rounded-lg px-3 py-2 text-sm text-[#140E35] outline-none focus:border-[#4658FF] transition-colors"
              />
            </div>
            <div className="w-40">
              <label className="block text-xs text-[#9498AC] mb-1">学期</label>
              <input
                type="text"
                value={formSemester}
                onChange={e => setFormSemester(e.target.value)}
                placeholder="例：2025-1"
                className="w-full border border-[#E5EAF4] rounded-lg px-3 py-2 text-sm text-[#140E35] outline-none focus:border-[#4658FF] transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-[#9498AC] border border-[#E5EAF4] rounded-lg hover:border-[#C4C8D8] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !formName.trim() || !formSemester.trim()}
              className="px-4 py-2 bg-[#4658FF] text-white text-sm rounded-lg hover:bg-[#3547EE] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? '创建中...' : '确认'}
            </button>
          </div>
        </div>
      )}

      {/* 班级列表 */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-[#E5EAF4] animate-pulse" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center text-[#9498AC] py-16">
          暂无班级，点击右上角创建
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {classes.map(cls => (
            <div
              key={cls.id}
              onClick={() => navigate(`/education/classes/${cls.id}`)}
              className="bg-white rounded-xl border border-[#E5EAF4] p-5 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#140E35] line-clamp-2 leading-snug">
                  {cls.name}
                </h3>
                <span className="ml-2 shrink-0 text-xs text-[#4658FF] bg-[#F1F5FF] rounded px-2 py-0.5">
                  {cls.semester}
                </span>
              </div>
              <p className="text-xs text-[#9498AC]">{cls.member_count} 名学生</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 详情视图 ────────────────────────────────────────────────────────────────

function ClassDetail({ classId }: { classId: number }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ClassDetailOut | null>(null);
  const [loading, setLoading] = useState(true);

  // 添加学生状态
  const [addInput, setAddInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    educationApi.getClassDetail(classId)
      .then(setDetail)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [classId]);

  const handleAdd = () => {
    const sid = Number(addInput.trim());
    if (!sid) return;
    setAdding(true);
    educationApi.addMember(classId, sid)
      .then(() => {
        setAddInput('');
        setError(null);
        load();
      })
      .catch(() => setError('添加失败，请确认学生 ID 是否正确'))
      .finally(() => setAdding(false));
  };

  const handleRemove = (studentId: number) => {
    educationApi.removeMember(classId, studentId)
      .then(() => { setError(null); load(); })
      .catch(() => setError('移除失败，请稍后重试'));
  };

  if (loading) {
    return (
      <div className="min-h-full bg-[#F7F9FF] p-6">
        <div className="h-8 w-48 bg-white rounded animate-pulse mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-white rounded-xl border border-[#E5EAF4] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-full bg-[#F7F9FF] p-6">
        <div className="text-center text-[#9498AC] py-16">加载失败，请刷新重试</div>
      </div>
    );
  }

  const { class_info, members } = detail;

  return (
    <div className="min-h-full bg-[#F7F9FF] p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/education/classes')}
            className="text-[#9498AC] hover:text-[#140E35] transition-colors text-sm flex items-center gap-1"
          >
            ← 返回
          </button>
          <span className="text-[#E5EAF4]">|</span>
          <h1 className="text-xl font-semibold text-[#140E35]">{class_info.name}</h1>
          <span className="text-xs text-[#4658FF] bg-[#F1F5FF] rounded px-2 py-0.5">
            {class_info.semester}
          </span>
        </div>
        <button
          onClick={() => navigate(`/education/courses?class_id=${classId}`)}
          className="px-4 py-2 bg-[#4658FF] text-white text-sm rounded-lg hover:bg-[#3547EE] transition-colors"
        >
          进入课程
        </button>
      </div>

      {/* 添加学生 */}
      <div className="bg-white rounded-xl border border-[#E5EAF4] p-4 mb-5 flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs text-[#9498AC] mb-1">添加学生（输入学号）</label>
          <input
            type="number"
            value={addInput}
            onChange={e => setAddInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="输入学生 ID"
            className="w-full border border-[#E5EAF4] rounded-lg px-3 py-2 text-sm text-[#140E35] outline-none focus:border-[#4658FF] transition-colors"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={adding || !addInput.trim()}
          className="px-4 py-2 bg-[#4658FF] text-white text-sm rounded-lg hover:bg-[#3547EE] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {adding ? '添加中...' : '添加'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}

      {/* 成员列表 */}
      <div className="bg-white rounded-xl border border-[#E5EAF4] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E5EAF4]">
          <span className="text-sm font-medium text-[#140E35]">成员列表</span>
          <span className="text-xs text-[#9498AC]">{members.length} 名学生</span>
        </div>

        {members.length === 0 ? (
          <div className="text-center text-[#9498AC] py-12 text-sm">暂无学生</div>
        ) : (
          <ul className="divide-y divide-[#E5EAF4]">
            {members.map(m => (
              <li key={m.student_id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="text-sm text-[#140E35] font-medium">{m.username}</span>
                  <span className="ml-3 text-xs text-[#9498AC]">ID: {m.student_id}</span>
                </div>
                <div className="flex items-center gap-4">
                  {m.join_time && (
                    <span className="text-xs text-[#9498AC]">
                      加入于 {m.join_time.slice(0, 10)}
                    </span>
                  )}
                  <button
                    onClick={() => handleRemove(m.student_id)}
                    className="text-red-500 hover:text-red-700 text-xs transition-colors"
                  >
                    移除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── 路由分发入口 ─────────────────────────────────────────────────────────────

export default function ClassesPage() {
  const { classId } = useParams<{ classId?: string }>();
  const numClassId = classId ? Number(classId) : undefined;

  if (numClassId) {
    return <ClassDetail classId={numClassId} />;
  }
  return <ClassList />;
}

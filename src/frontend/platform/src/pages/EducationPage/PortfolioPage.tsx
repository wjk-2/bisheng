import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { educationApi, PortfolioOut } from './api/educationApi';

export default function PortfolioPage() {
  const [searchParams] = useSearchParams();
  const unitId = searchParams.get('unit_id') ? Number(searchParams.get('unit_id')) : undefined;
  const classId = searchParams.get('class_id') ? Number(searchParams.get('class_id')) : undefined;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [list, setList] = useState<PortfolioOut[]>([]);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    if (!unitId) return;
    setListLoading(true);
    educationApi.listPortfolioByUnit(unitId)
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setListLoading(false));
  }, [unitId]);

  const handleSubmit = async () => {
    if (!unitId || !title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      const newItem = await educationApi.submitPortfolio({
        unit_id: unitId,
        class_id: classId,
        title: title.trim(),
        text_content: content.trim(),
      });
      setList(prev => [newItem, ...prev]);
      setTitle('');
      setContent('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#F7F9FF] p-6 min-h-screen">
      <h1 className="text-lg font-semibold text-[#140E35] mb-6">作品集</h1>

      {/* 提交表单 */}
      {unitId && (
        <div className="bg-white rounded-xl border border-[#E5EAF4] p-5 mb-6">
          <h2 className="text-sm font-medium text-[#140E35] mb-4">提交新作品</h2>
          <div className="mb-3">
            <label className="block text-xs text-[#9498AC] mb-1">标题</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="请输入作品标题"
              className="w-full border border-[#E5EAF4] rounded-lg px-3 py-2 text-sm text-[#140E35] outline-none focus:border-[#4658FF]"
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs text-[#9498AC] mb-1">内容</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="请输入作品内容"
              className="w-full h-32 border border-[#E5EAF4] rounded-lg px-3 py-2 text-sm text-[#140E35] outline-none focus:border-[#4658FF] resize-none"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !content.trim()}
            className="px-5 py-2 bg-[#4658FF] text-white text-sm rounded-lg hover:bg-[#3547EE] disabled:opacity-50"
          >
            {submitting ? '提交中...' : '提交作品'}
          </button>
        </div>
      )}

      {/* 历史作品列表 */}
      <div className="bg-white rounded-xl border border-[#E5EAF4] p-5">
        <h2 className="text-sm font-medium text-[#140E35] mb-4">历史作品</h2>
        {listLoading ? (
          <div className="text-sm text-[#9498AC]">加载中...</div>
        ) : list.length === 0 ? (
          <div className="text-sm text-[#9498AC]">暂无作品记录</div>
        ) : (
          <div className="flex flex-col gap-4">
            {list.map(item => (
              <div key={item.id} className="border border-[#E5EAF4] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#140E35]">{item.title}</span>
                  {item.submit_time && (
                    <span className="text-xs text-[#9498AC]">
                      {new Date(item.submit_time).toLocaleDateString('zh-CN')}
                    </span>
                  )}
                </div>
                {item.text_content && (
                  <p className="text-sm text-[#565772] whitespace-pre-wrap">{item.text_content}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { educationApi } from '../api/educationApi';

interface Props {
  unitId: number;
  classId?: number;
  onSubmitted?: (content: string) => void;
}

export default function TextSubmitPanel({ unitId, classId, onSubmitted }: Props) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!content.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      await educationApi.submitPortfolio({
        unit_id: unitId,
        class_id: classId,
        title: '作品提交',
        text_content: content,
      });
      setSubmitted(true);
      onSubmitted?.(content);
    } catch {
      setError('提交失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-4xl mb-3">✅</div>
        <div className="text-[#140E35] font-medium mb-1">提交成功</div>
        <div className="text-[#9498AC] text-sm">你的分析已记录到作品集</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="text-sm text-[#565772]">请完成以下分析并提交：</div>
      <textarea
        className="flex-1 border border-[#E5EAF4] rounded-lg p-3 text-sm outline-none focus:border-[#4658FF] resize-none"
        placeholder="在此输入你的分析讨论内容..."
        value={content}
        onChange={e => setContent(e.target.value)}
      />
      {error && <div className="text-sm text-red-500">{error}</div>}
      <button
        onClick={submit}
        disabled={!content.trim() || loading}
        className="py-2 bg-[#4658FF] text-white text-sm rounded-lg disabled:opacity-50 hover:bg-[#3748EF]"
      >
        {loading ? '提交中...' : '提交作品'}
      </button>
    </div>
  );
}

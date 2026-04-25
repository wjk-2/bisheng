import { useState } from 'react';

interface Props {
  unitId: number;
  classId?: number;
  onSubmitted?: (content: string) => void;
}

export default function TextSubmitPanel({ unitId, classId, onSubmitted }: Props) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!content.trim() || loading) return;
    setLoading(true);
    try {
      // Milestone 2 实现 portfolio 提交 API，此处用 mock
      await new Promise(r => setTimeout(r, 500));
      setSubmitted(true);
      onSubmitted?.(content);
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

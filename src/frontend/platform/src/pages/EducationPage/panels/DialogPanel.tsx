import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  config: Record<string, unknown> | null;
}

export default function DialogPanel({ config }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // Milestone 2 接入真实 chat API，此处用 mock
      await new Promise(r => setTimeout(r, 800));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `[AI 回复占位] 你说的是：${userMsg}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-[#9498AC] text-sm py-8">开始和 AI 对话吧</div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-[#4658FF] text-white'
                  : 'bg-white border border-[#E5EAF4] text-[#140E35]'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-[#E5EAF4] rounded-lg px-3 py-2 text-[#9498AC] text-sm">
              思考中...
            </div>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-[#E5EAF4] flex gap-2">
        <input
          className="flex-1 border border-[#E5EAF4] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4658FF]"
          placeholder="输入消息..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
        />
        <button
          onClick={send}
          disabled={loading}
          className="px-4 py-2 bg-[#4658FF] text-white text-sm rounded-lg disabled:opacity-50 hover:bg-[#3748EF]"
        >
          发送
        </button>
      </div>
    </div>
  );
}

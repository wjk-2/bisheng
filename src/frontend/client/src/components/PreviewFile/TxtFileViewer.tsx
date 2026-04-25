import { useEffect, useState } from 'react';
import Markdown from '../Chat/Messages/Content/Markdown';

const TxtFileViewer = ({ html = false, markdown = false, filePath }) => {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTextFile = async () => {
            try {
                setLoading(true);
                const response = await fetch(filePath.replace(/https?:\/\/[^\/]+/, __APP_ENV__.BASE_URL));

                if (!response.ok) {
                    throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
                }

                const text = await response.text();
                setContent(text);
                setError(null);
            } catch (err) {
                setError(err.message);
                setContent('');
            } finally {
                setLoading(false);
            }
        };

        fetchTextFile();
    }, [filePath]);

    if (loading) {
        return (
            <div className="p-4 text-sm text-gray-500">
                Loading text file...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-sm text-red-500">
                Error loading file: {error}
            </div>
        );
    }

    if (markdown) return <div className='bs-mkdown'>
        <Markdown content={content} isLatestMessage={false} webContent={undefined} />
    </div>

    if (html) return <iframe
        className="w-full h-full border"
        srcDoc={content}  // 使用srcdoc直接嵌入HTML内容
        sandbox="" // ⚠️ 安全关键：空字符串=最严格沙箱，禁止脚本/表单/弹窗/同源访问，防止 srcDoc 内 XSS。勿删，勿加 allow-*
    />

    return (
        <div className="p-4 text-sm whitespace-pre-wrap bg-gray-50 rounded border border-gray-200 h-full overflow-y-auto">
            {content || <span className="text-gray-400">(Empty file)</span>}
        </div>
    );
};

export default TxtFileViewer;
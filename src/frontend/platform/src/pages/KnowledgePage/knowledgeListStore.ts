// knowledgeListStore.ts — H1 移除 window.LibPage 全局变量反模式
// 跨页分页缓存改用 Zustand store（进详情页前写，返回时读 + 清）
import { create } from 'zustand';

interface KnowledgeListPageState {
    type: 'file' | 'qa';
    page: number;
}

interface KnowledgeListStore extends KnowledgeListPageState {
    _cached: boolean; // 是否有缓存（区分初始状态与显式缓存）
    /** 进详情页前缓存当前 tab + 分页 */
    cachePage: (type: 'file' | 'qa', page: number) => void;
    /** 返回列表时读取缓存（有则返回并清，无则返回 null） */
    consumeCachedPage: () => KnowledgeListPageState | null;
}

const INITIAL = { type: 'file' as const, page: 1, _cached: false };

export const useKnowledgeListStore = create<KnowledgeListStore>((set, get) => ({
    ...INITIAL,
    cachePage: (type, page) => set({ type, page, _cached: true }),
    consumeCachedPage: () => {
        const { _cached, type, page } = get();
        if (!_cached) return null;
        set(INITIAL);
        return { type, page };
    },
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { useKnowledgeListStore } from '../knowledgeListStore';

describe('H1 knowledgeListStore（替代 window.LibPage）', () => {
  beforeEach(() => {
    useKnowledgeListStore.getState()._cached = false;
    useKnowledgeListStore.getState().type = 'file';
    useKnowledgeListStore.getState().page = 1;
  });

  it('初始无缓存，consume 返回 null', () => {
    expect(useKnowledgeListStore.getState().consumeCachedPage()).toBeNull();
  });

  it('cachePage 后 consume 返回缓存并清空', () => {
    useKnowledgeListStore.getState().cachePage('qa', 3);
    const cached = useKnowledgeListStore.getState().consumeCachedPage();
    expect(cached).toEqual({ type: 'qa', page: 3 });
    // 二次 consume 已清
    expect(useKnowledgeListStore.getState().consumeCachedPage()).toBeNull();
  });

  it('cachePage file 类型', () => {
    useKnowledgeListStore.getState().cachePage('file', 5);
    expect(useKnowledgeListStore.getState().consumeCachedPage()).toEqual({ type: 'file', page: 5 });
  });
});

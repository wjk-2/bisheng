import { useMemo } from 'react';
import type { NavLink } from '~/common';

/**
 * 左侧导航栏的手风琴链接
 *
 * v2 暂时隐藏 Prompts 和 Bookmarks：
 * - 放在左侧操作不便，弹出内容也在左侧而非右侧
 * - 计划第二版重新设计交互后再恢复
 *
 * Parameters 不放左侧导航：它依赖 useChatContext()，
 * 而左侧 Nav 不在 ChatContext.Provider 内，会导致运行时崩溃。
 */
export default function useLeftNavLinks() {
  const Links = useMemo(() => {
    const links: NavLink[] = [];
    return links;
  }, []);

  return Links;
}

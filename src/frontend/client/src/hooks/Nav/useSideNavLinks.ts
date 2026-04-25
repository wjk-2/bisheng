import { useMemo } from 'react';
import type { TConfig, TInterfaceConfig } from '~/data-provider/data-provider/src';
import type { EModelEndpoint } from '~/data-provider/data-provider/src';
import type { NavLink } from '~/common';

/**
 * 右侧面板导航链接
 *
 * v2 暂时全部隐藏：
 * - Parameters 已移至 ChatView 内的左侧抽屉（Sheet），仅 admin 可见
 * - Prompts、Bookmarks、Assistants、Agents 均暂不启用
 * - SidePanelGroup 未集成到组件树，此 hook 返回空数组
 */
export default function useSideNavLinks({
  hidePanel,
  assistants,
  agents,
  keyProvided,
  endpoint,
  endpointType,
  interfaceConfig,
}: {
  hidePanel: () => void;
  assistants?: TConfig | null;
  agents?: TConfig | null;
  keyProvided: boolean;
  endpoint?: EModelEndpoint | null;
  endpointType?: EModelEndpoint | null;
  interfaceConfig: Partial<TInterfaceConfig>;
}) {
  const Links = useMemo(() => {
    const links: NavLink[] = [];
    return links;
  }, []);

  return Links;
}

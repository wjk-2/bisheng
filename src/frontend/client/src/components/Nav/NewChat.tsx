import { useQueryClient } from '@tanstack/react-query';
import { FileText, GraduationCap, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { icons } from '~/components/Chat/Menus/Endpoints/Icons';
import ConvoIconURL from '~/components/Endpoints/ConvoIconURL';
import { useGetBsConfig, useGetEndpointsQuery } from '~/data-provider';
import type { TConversation, TMessage } from '~/data-provider/data-provider/src';
import { Constants, QueryKeys } from '~/data-provider/data-provider/src';
import { useLocalize, useNewConvo } from '~/hooks';
import store from '~/store';
import { cn, getEndpointField, getIconEndpoint, getIconKey } from '~/utils';

import AppsIcon from '../ui/icon/Apps';

const NewChatButtonIcon = ({ conversation }: { conversation: TConversation | null }) => {
  const searchQuery = useRecoilValue(store.searchQuery);
  const { data: endpointsConfig } = useGetEndpointsQuery();

  if (searchQuery) {
    return (
      <div className="shadow-stroke relative flex h-7 w-7 items-center justify-center rounded-full bg-card text-card-foreground">
        <Search className="h-5 w-5" />
      </div>
    );
  }

  let { endpoint = '' } = conversation ?? {};
  const iconURL = conversation?.iconURL ?? '';
  endpoint = getIconEndpoint({ endpointsConfig, iconURL, endpoint });

  const endpointType = getEndpointField(endpointsConfig, endpoint, 'type');
  const endpointIconURL = getEndpointField(endpointsConfig, endpoint, 'iconURL');
  const iconKey = getIconKey({ endpoint, endpointsConfig, endpointType, endpointIconURL });
  const Icon = icons[iconKey];

  return (
    <div className="h-7 w-7 flex-shrink-0">
      {iconURL && iconURL.includes('http') ? (
        <ConvoIconURL
          iconURL={iconURL}
          modelLabel={conversation?.chatGptLabel ?? conversation?.modelLabel ?? ''}
          endpointIconURL={iconURL}
          context="nav"
        />
      ) : (
        <div className="shadow-stroke relative flex h-full items-center justify-center rounded-full bg-card text-card-foreground">
          {endpoint && Icon != null && (
            <Icon
              size={41}
              context="nav"
              className="h-2/3 w-2/3"
              endpoint={endpoint}
              endpointType={endpointType}
              iconURL={endpointIconURL}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default function NewChat({
  index = 0,
  toggleNav,
  subHeaders,
  isSmallScreen,
  collapsed = false,
}: {
  index?: number;
  toggleNav: () => void;
  subHeaders?: React.ReactNode;
  isSmallScreen: boolean;
  collapsed?: boolean;
}) {
  const queryClient = useQueryClient();
  /** Note: this component needs an explicit index passed if using more than one */
  const { newConversation: newConvo } = useNewConvo(index);

  const navigate = useNavigate();
  const localize = useLocalize();

  const { conversation } = store.useCreateConversationAtom(index);
  const [showKnowledge, setShowKnowledge] = useRecoilState(store.showKnowledge);

  const clickHandler = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button === 0 && !(event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      newConvo();
      navigate('/c/new');
      toggleNav();
      queryClient.setQueryData<TMessage[]>(
        [QueryKeys.messages, conversation?.conversationId ?? Constants.NEW_CONVO],
        [],
      );
    }
  };

  // 收起态（对齐 platform 图标栏）：图标居中、文字隐藏
  const itemClass = cn(
    'flex items-center h-10 rounded-xl cursor-pointer hover:bg-muted transition-colors',
    collapsed ? 'justify-center px-2' : 'gap-1.5 px-3',
  );
  const textClass = cn(
    'text-sm font-medium whitespace-nowrap ml-0.5 text-muted-foreground',
    collapsed && 'hidden',
  );

  return (
    <div className="sticky left-0 right-0 top-0 z-50 bg-card">
      <div className="pb-0.5 last:pb-0" style={{ transform: 'none' }}>
        <div className='flex flex-col w-full'>
          {/* 智能体广场 */}
          <div
            className={itemClass}
            title={collapsed ? localize('com_nav_app_center') : undefined}
            onClick={() => {
              navigate('/apps');
            }}
          >
            <AppsIcon />
            <span className={textClass}>{localize('com_nav_app_center')}</span>
          </div>
          {/* 教学及开发平台 */}
          <a
            href="/build"
            className={cn(itemClass, 'no-underline text-inherit')}
            title={collapsed ? localize('com_nav_dev_center') : undefined}
          >
            <GraduationCap className="icon-md flex-shrink-0" />
            <span className={textClass}>{localize('com_nav_dev_center')}</span>
          </a>
          {/* 个人知识库 */}
          <div
            className={itemClass}
            title={collapsed ? localize('com_nav_personal_knowledge') : undefined}
            onClick={() => setShowKnowledge(true)}
          >
            <FileText className="icon-md flex-shrink-0" />
            <span className={textClass}>{localize('com_nav_personal_knowledge')}</span>
          </div>
          {/* 开始新对话 */}
          <div
            className={itemClass}
            aria-label={localize('com_ui_new_chat')}
            title={collapsed ? localize('com_nav_start_new_chat') : undefined}
            onClick={() => {
              document.getElementById("create-convo-btn")?.click();
              // hack
              setTimeout(() => {
                document.getElementById("create-convo-btn")?.click();
              }, 300);
            }}
          >
            <img className='size-[18px] grayscale' src={__APP_ENV__.BASE_URL + '/assets/chat2.png'} alt="" />
            <span className={textClass}>{localize('com_nav_start_new_chat')}</span>
          </div>
        </div>
      </div>
      <div id="create-convo-btn" className='opacity-0' onClick={clickHandler}></div>
      {subHeaders != null ? subHeaders : null}
    </div>
  );
}

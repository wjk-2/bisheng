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
import { getEndpointField, getIconEndpoint, getIconKey } from '~/utils';

import AppsIcon from '../ui/icon/Apps';

const NewChatButtonIcon = ({ conversation }: { conversation: TConversation | null }) => {
  const searchQuery = useRecoilValue(store.searchQuery);
  const { data: endpointsConfig } = useGetEndpointsQuery();

  if (searchQuery) {
    return (
      <div className="shadow-stroke relative flex h-7 w-7 items-center justify-center rounded-full bg-white text-black dark:bg-white">
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
        <div className="shadow-stroke relative flex h-full items-center justify-center rounded-full bg-white text-black">
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
}: {
  index?: number;
  toggleNav: () => void;
  subHeaders?: React.ReactNode;
  isSmallScreen: boolean;
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

  return (
    <div className="sticky left-0 right-0 top-0 z-50 bg-white dark:bg-gray-900">
      <div className="pb-0.5 last:pb-0" style={{ transform: 'none' }}>
        <div className='flex flex-col w-full'>
          {/* 智能体广场 */}
          <div
            className="flex items-center gap-1.5 h-10 rounded-xl px-3 cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => {
              navigate('/apps');
            }}
          >
            <AppsIcon />
            <span className="text-sm font-medium whitespace-nowrap ml-0.5 text-gray-600 dark:text-gray-300">{localize('com_nav_app_center')}</span>
          </div>
          {/* 教学及开发平台 */}
          <a
            href="/build"
            className="flex items-center gap-1.5 h-10 rounded-xl px-3 cursor-pointer hover:bg-gray-100 transition-colors no-underline text-inherit"
          >
            <GraduationCap className="icon-md flex-shrink-0" />
            <span className="text-sm font-medium whitespace-nowrap ml-0.5 text-gray-600 dark:text-gray-300">{localize('com_nav_dev_center')}</span>
          </a>
          {/* 个人知识库 */}
          <div
            className="flex items-center gap-1.5 h-10 rounded-xl px-3 cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => setShowKnowledge(true)}
          >
            <FileText className="icon-md flex-shrink-0" />
            <span className="text-sm font-medium whitespace-nowrap ml-0.5 text-gray-600 dark:text-gray-300">{localize('com_nav_personal_knowledge')}</span>
          </div>
          {/* 开始新对话 */}
          <div
            className="flex items-center gap-1.5 h-10 rounded-xl px-3 cursor-pointer hover:bg-gray-100 transition-colors"
            aria-label={localize('com_ui_new_chat')}
            onClick={() => {
              document.getElementById("create-convo-btn")?.click();
              // hack
              setTimeout(() => {
                document.getElementById("create-convo-btn")?.click();
              }, 300);
            }}
          >
            <img className='size-[18px] grayscale' src={__APP_ENV__.BASE_URL + '/assets/chat2.png'} alt="" />
            <span className="text-sm font-medium whitespace-nowrap ml-0.5 text-gray-600 dark:text-gray-300">{localize('com_nav_start_new_chat')}</span>
          </div>
        </div>
      </div>
      <div id="create-convo-btn" className='opacity-0' onClick={clickHandler}></div>
      {subHeaders != null ? subHeaders : null}
    </div>
  );
}

import { useEffect } from 'react';
import { useRecoilState } from 'recoil';
import store from '~/store';

export default function LoginLayout() {
  const [queriesEnabled, setQueriesEnabled] = useRecoilState<boolean>(store.queriesEnabled);
  
  useEffect(() => {
    if (queriesEnabled) {
      return;
    }
    const timeout: NodeJS.Timeout = setTimeout(() => {
      setQueriesEnabled(true);
    }, 500);
    
    return () => {
      clearTimeout(timeout);
    };
  }, [queriesEnabled, setQueriesEnabled]);
  return null; // 禁用登录页
}

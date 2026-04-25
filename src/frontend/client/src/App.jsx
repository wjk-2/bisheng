import * as RadixToast from '@radix-ui/react-toast';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { RouterProvider } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import { LiveAnnouncer } from '~/a11y';
import Toast from './components/ui/Toast';
import { ScreenshotProvider, ThemeProvider, useApiErrorBoundary } from './hooks';
import { ToastProvider } from './Providers';
import { router } from './routes';

// P-08: 模块作用域单例 — 避免组件 re-render 时重建导致缓存丢失
let _setErrorRef = null;
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error?.response?.status === 401 && _setErrorRef) {
        _setErrorRef(error);
      }
    },
  }),
});

const App = () => {
  const { setError } = useApiErrorBoundary();

  useEffect(() => {
    _setErrorRef = setError;
    return () => { _setErrorRef = null; };
  }, [setError]);

  return (
    <QueryClientProvider client={queryClient}>
      <RecoilRoot>
        <LiveAnnouncer>
          <ThemeProvider>
            <RadixToast.Provider>
              <ToastProvider>
                <DndProvider backend={HTML5Backend}>
                  <RouterProvider router={router} />
                  {/* <ReactQueryDevtools initialIsOpen={false} position="top-right" /> */}
                  <Toast />
                  <RadixToast.Viewport className="pointer-events-none fixed inset-0 z-[1000] mx-auto my-2 flex max-w-[560px] flex-col items-stretch justify-start md:pb-5" />
                </DndProvider>
              </ToastProvider>
            </RadixToast.Provider>
          </ThemeProvider>
        </LiveAnnouncer>
      </RecoilRoot>
    </QueryClientProvider>
  );
};

export default () => (
  <ScreenshotProvider>
    <App />
  </ScreenshotProvider>
);

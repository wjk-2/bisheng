import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import {
  ApiErrorWatcher,
  Login,
  Registration,
  RequestPasswordReset,
  ResetPassword,
  TwoFactorScreen,
  VerifyEmail,
} from '~/components/Auth';
import { Spinner } from '~/components/svg';
import { AuthContextProvider } from '~/hooks/AuthContext';
import LoginLayout from './Layouts/Login';
import StartupLayout from './Layouts/Startup';
import Root from './Root';
import RouteErrorBoundary from './RouteErrorBoundary';
import Page404 from '~/pages/Page404';

// P-09: 路由级懒加载 — 减少首屏 JS 体积
const ChatRoute = lazy(() => import('./ChatRoute'));
const Sop = lazy(() => import('~/components/Sop'));
const AppChat = lazy(() => import('~/pages/appChat'));
const AgentCenter = lazy(() => import('~/pages/apps'));
const Share = lazy(() => import('~/pages/share'));
const WebView = lazy(() => import('~/components/WebView'));

const LazyFallback = () => (
  <div className="flex h-full w-full items-center justify-center">
    <Spinner className="text-black dark:text-white" />
  </div>
);

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LazyFallback />}>{children}</Suspense>
);

const AuthLayout = () => (
  <AuthContextProvider>
    <Outlet />
    <ApiErrorWatcher />
  </AuthContextProvider>
);

const baseConfig = {
  basename: __APP_ENV__.BASE_URL
}

export const router = createBrowserRouter([
  // 分享链接：独立顶层路由，有 AuthContextProvider 但不经过 Root
  // AuthContextProvider 支持未登录状态，ChatView 等子组件依赖它读取 user（可为 null）
  {
    element: <AuthContextProvider><Outlet /></AuthContextProvider>,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: 'share/:token',
        element: <SuspenseWrapper><Share /></SuspenseWrapper>,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'share/:token/:vid',
        element: <SuspenseWrapper><Share /></SuspenseWrapper>,
        errorElement: <RouteErrorBoundary />,
      },
    ],
  },
  {
    path: '/',
    element: <StartupLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: 'register',
        element: <Registration />,
      },
      {
        path: 'forgot-password',
        element: <RequestPasswordReset />,
      },
      {
        path: 'reset-password',
        element: <ResetPassword />,
      },
    ],
  },
  {
    path: 'verify',
    element: <VerifyEmail />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    element: <AuthLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: __APP_ENV__.EAGENT_HOST,
        element: <LoginLayout />,
        children: [
          {
            path: 'login',
            element: <Login />,
          },
          {
            path: 'login/2fa',
            element: <TwoFactorScreen />,
          },
        ],
      },
      // 提示词管理
      // dashboardRoutes,
      {
        path: '/',
        element: <Root />, // 包含会话列表
        children: [
          {
            index: true,
            element: <Navigate to="/apps" replace={true} />,
          },
          {
            path: 'c/:conversationId?',
            element: <SuspenseWrapper><ChatRoute /></SuspenseWrapper>,
          },
          {
            path: 'linsight/:conversationId?',
            element: <SuspenseWrapper><Sop /></SuspenseWrapper>,
          },
          {
            path: 'linsight/case/:sopId',
            element: <SuspenseWrapper><Sop /></SuspenseWrapper>,
          },
          {
            path: 'apps',
            element: <SuspenseWrapper><AgentCenter /></SuspenseWrapper>,
          },
          {
            path: 'chat/:conversationId/:fid/:type',
            element: <SuspenseWrapper><AppChat /></SuspenseWrapper>,
          },
        ],
      },
    ],
  },
  {
    path: '/html',
    element: <SuspenseWrapper><WebView /></SuspenseWrapper>,
  },
  {
    path: '/404',
    element: <Page404 />,
    errorElement: <RouteErrorBoundary />,
  },
  { path: "*", element: <Navigate to="/404" replace /> }
], baseConfig);

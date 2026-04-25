import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// 内联样式提取为模块级常量（fallback 不依赖 Tailwind/CSS 加载）
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '24px',
    backgroundColor: '#f9fafb',
    color: '#111827',
  },
  content: {
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center' as const,
  },
  title: { fontSize: '20px', fontWeight: 600, marginBottom: '12px' },
  message: { fontSize: '14px', color: '#6b7280', marginBottom: '8px' },
  hint: { fontSize: '13px', color: '#9ca3af', marginBottom: '24px' },
  button: {
    padding: '8px 24px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#fff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};

/**
 * E-05: 全局 React ErrorBoundary — 兜底 Provider 层和路由树之外的运行时错误
 *
 * 路由内部的错误由各路由的 errorElement（RouteErrorBoundary）处理，
 * 本组件仅捕获 Provider 层（RecoilRoot、ThemeProvider、QueryClientProvider 等）
 * 初始化或运行时的未预期错误，防止整页白屏。
 */
export default class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.content}>
            <h1 style={styles.title}>应用加载失败</h1>
            <p style={styles.message}>
              {this.state.error?.message || '发生了未预期的错误'}
            </p>
            <p style={styles.hint}>请刷新页面重试，如问题持续请联系管理员</p>
            <button onClick={this.handleReload} style={styles.button}>
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

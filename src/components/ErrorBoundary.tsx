import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Phase 4：全域錯誤邊界，捕獲未處理的渲染錯誤並顯示友善訊息 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="app" style={{ padding: '2rem', maxWidth: 600 }}>
          <div className="card" style={{ borderColor: '#c00' }}>
            <h2>發生錯誤</h2>
            <p style={{ color: '#666' }}>
              頁面操作時發生未預期的錯誤，請重新整理後再試。若持續發生，請聯絡管理員。
            </p>
            <details style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
              <summary>錯誤詳情</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '0.5rem' }}>
                {this.state.error.message}
              </pre>
            </details>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              重試
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

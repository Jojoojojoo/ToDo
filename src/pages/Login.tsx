import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/** 從錯誤物件取出可顯示的詳細訊息（含 fetch 的 cause） */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown })?.cause;
    if (cause instanceof Error) return `${err.message} (${cause.message})`;
    if (cause != null) return `${err.message} (${String(cause)})`;
    return err.message;
  }
  return String(err);
}

export default function Login() {
  const { user, loading, signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  if (loading) return <div className="app">載入中…</div>;
  if (user) return <Navigate to="/" replace />;

  /** 以實際 HTTP 請求測試是否真的能連到 Supabase（getSession 在無 session 時可能不發請求） */
  async function testConnection() {
    setDiagnostic('測試中…');
    setError('');
    const base = (import.meta.env.VITE_SUPABASE_URL as string)?.replace(/\/$/, '') || '';
    const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';
    if (!base) {
      setDiagnostic('錯誤：VITE_SUPABASE_URL 未設定。');
      return;
    }
    try {
      // 實際打 API，確認網路可達（登入會打同網域下的 /auth/v1/token）
      const res = await fetch(`${base}/auth/v1/health`, {
        method: 'GET',
        headers: key ? { apikey: key } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDiagnostic('連線成功：已能連到 Supabase。若登入仍失敗，請確認該使用者已設定密碼（後台 Authentication → Users → 編輯使用者）。');
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setDiagnostic(`連線失敗：${msg}。請檢查 URL、網路或防火牆。`);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setDiagnostic(null);
    setBusy(true);
    try {
      if (isSignUp) {
        await signUp(email, password, displayName || undefined);
      } else {
        await signIn(email, password);
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      if (msg.startsWith('Failed to fetch')) {
        setError(`無法連線至 Supabase。詳細：${msg}。可點「測試連線」再試一次以取得更多資訊。`);
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="card" style={{ maxWidth: 400, margin: '2rem auto' }}>
        <h2>{isSignUp ? '註冊' : '登入'}</h2>
        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="form-group">
              <label>顯示名稱</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="選填"
              />
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {error && <div className="error">{error}</div>}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {isSignUp ? '註冊' : '登入'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setIsSignUp((v) => !v);
                setError('');
                setDiagnostic(null);
              }}
            >
              {isSignUp ? '改為登入' : '改為註冊'}
            </button>
          </div>
        </form>
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
          <button type="button" className="btn" onClick={testConnection}>
            測試連線
          </button>
          {diagnostic != null && (
            <div
              style={{
                marginTop: '0.5rem',
                fontSize: '0.85rem',
                color: diagnostic.startsWith('連線成功') ? '#2e7d32' : '#c62828',
                wordBreak: 'break-all',
              }}
            >
              {diagnostic}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

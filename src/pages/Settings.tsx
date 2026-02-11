import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function Settings() {
  const navigate = useNavigate();
  const { user, profile, refetchProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [bindingCode, setBindingCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [bindingLoading, setBindingLoading] = useState(false);
  const [unbindLoading, setUnbindLoading] = useState(false);

  useEffect(() => {
    if (profile?.display_name !== undefined) setDisplayName(profile.display_name ?? '');
  }, [profile?.display_name]);

  async function handleSaveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id) return;
    setSavingName(true);
    setNameError('');
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName || null })
      .eq('id', user.id);
    setSavingName(false);
    if (error) {
      setNameError(error.message);
      return;
    }
    await refetchProfile();
  }

  async function handleStartBinding() {
    if (!user?.id) return;
    setBindingLoading(true);
    setBindingCode(null);
    const { data, error } = await supabase.rpc('create_line_binding_request');
    setBindingLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    const result = data as { code: string; expires_at: string } | null;
    if (result?.code) setBindingCode(result);
  }

  async function handleUnbindLine() {
    if (!user?.id || !window.confirm('確定要解除 LINE 綁定？之後將不會收到 LINE 截止日提醒。')) return;
    setUnbindLoading(true);
    const { error } = await supabase.from('profiles').update({ line_user_id: null }).eq('id', user.id);
    setUnbindLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    await refetchProfile();
  }

  async function handleCheckBinding() {
    await refetchProfile();
  }

  if (!user || !profile) {
    return (
      <div className="app">
        <p>載入中…</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn" onClick={() => navigate('/')}>
          ← 回專案列表
        </button>
      </div>

      <div className="card">
        <h2>個人設定</h2>
      </div>

      <div className="card">
        <h3>基本資料</h3>
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
          登入帳號（Email）由系統綁定，僅供顯示。可編輯顯示名稱。
        </p>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Email（登入帳號）</label>
          <input type="text" value={profile.email ?? ''} readOnly style={{ background: '#f5f5f5' }} />
        </div>
        <form onSubmit={handleSaveDisplayName}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>顯示名稱</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="選填"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingName}>
            {savingName ? '儲存中…' : '儲存顯示名稱'}
          </button>
          {nameError && <div className="error" style={{ marginTop: '0.5rem' }}>{nameError}</div>}
        </form>
      </div>

      <div className="card">
        <h3>LINE 綁定</h3>
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
          綁定後，當您擔任截止日負責人時，可收到 LINE 截止日提醒。
        </p>
        {profile.line_user_id ? (
          <div>
            <p style={{ marginBottom: '1rem' }}>已綁定 LINE</p>
            <button
              type="button"
              className="btn btn-danger"
              disabled={unbindLoading}
              onClick={handleUnbindLine}
            >
              {unbindLoading ? '處理中…' : '解除綁定'}
            </button>
          </div>
        ) : bindingCode ? (
          <div>
            <p style={{ marginBottom: '0.5rem' }}>
              請加 Bot 為好友，並在對話中傳送以下驗證碼：
            </p>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', letterSpacing: '0.1em' }}>
              {bindingCode.code}
            </p>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
              驗證碼 5 分鐘內有效。傳送後可點「檢查綁定狀態」更新畫面。
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCheckBinding}
            >
              檢查綁定狀態
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={bindingLoading}
            onClick={handleStartBinding}
          >
            {bindingLoading ? '取得中…' : '綁定 LINE'}
          </button>
        )}
      </div>
    </>
  );
}

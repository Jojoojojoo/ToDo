import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '@/hooks/useProject';
import {
  useDeadlines,
  useCreateDeadline,
  useUpdateDeadline,
  useDeleteDeadline,
} from '@/hooks/useDeadlines';
import { useExtractDeadlinesFromText, useConfirmSuggestedDeadlines } from '@/hooks/useDocumentExtract';
import { useProjectMembers, useAddProjectMember, useRemoveProjectMember, useInviteProfiles } from '@/hooks/useProjectMembers';
import { useNotificationRule, useUpsertNotificationRule, getDefaultRule } from '@/hooks/useNotificationRules';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { extractTextFromFile } from '@/lib/extractFileText';
import type { Deadline, SuggestedDeadline } from '@/types/database';

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** Phase 4：專案通知規則表單（僅 owner 顯示） */
function NotificationRuleForm({
  rule,
  defaultRule,
  onSave,
  isPending,
  error,
}: {
  projectId: string;
  rule: { days_before: number; notify_line: boolean; notify_email: boolean } | null;
  defaultRule: { days_before: number; notify_line: boolean; notify_email: boolean };
  onSave: (v: { days_before: number; notify_line: boolean; notify_email: boolean }) => Promise<unknown>;
  isPending: boolean;
  error: Error | null;
}) {
  const [days, setDays] = useState(rule?.days_before ?? defaultRule.days_before);
  const [notifyLine, setNotifyLine] = useState(rule?.notify_line ?? defaultRule.notify_line);
  const [notifyEmail, setNotifyEmail] = useState(rule?.notify_email ?? defaultRule.notify_email);

  useEffect(() => {
    if (rule !== null) {
      setDays(rule.days_before);
      setNotifyLine(rule.notify_line);
      setNotifyEmail(rule.notify_email);
    } else {
      setDays(defaultRule.days_before);
      setNotifyLine(defaultRule.notify_line);
      setNotifyEmail(defaultRule.notify_email);
    }
  }, [rule, defaultRule.days_before, defaultRule.notify_line, defaultRule.notify_email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({ days_before: days, notify_line: notifyLine, notify_email: notifyEmail });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>幾天內到期時提醒</label>
        <input
          type="number"
          min={0}
          max={365}
          value={days}
          onChange={(e) => setDays(Number(e.target.value) || 0)}
        />
      </div>
      <div className="form-group" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={notifyLine}
            onChange={(e) => setNotifyLine(e.target.checked)}
          />
          LINE
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.checked)}
          />
          Email
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? '儲存中…' : '儲存規則'}
        </button>
      </div>
      {error && (
        <div className="error" style={{ marginTop: '0.5rem' }}>
          {error instanceof Error ? error.message : '儲存失敗'}
        </div>
      )}
    </form>
  );
}

function DeadlineForm({
  projectId,
  deadline,
  onSuccess,
  onCancel,
}: {
  projectId: string;
  deadline?: Deadline | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(deadline?.title ?? '');
  const [due_date, setDueDate] = useState(
    deadline?.due_date ? deadline.due_date.slice(0, 10) : ''
  );
  const [description, setDescription] = useState(deadline?.description ?? '');
  const create = useCreateDeadline();
  const update = useUpdateDeadline();
  const isEdit = !!deadline?.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (isEdit) {
        await update.mutateAsync({
          id: deadline.id,
          project_id: projectId,
          title,
          due_date,
          description: description || undefined,
        });
      } else {
        await create.mutateAsync({
          project_id: projectId,
          title,
          due_date,
          description: description || undefined,
        });
      }
      onSuccess();
    } catch {
      // handled below
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>標題 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label>截止日 *</label>
        <input
          type="date"
          value={due_date}
          onChange={(e) => setDueDate(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label>說明</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={create.isPending || update.isPending}>
          {isEdit ? '儲存' : '新增截止日'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          取消
        </button>
      </div>
      {(create.error || update.error) && (
        <div className="error">
          {(create.error || update.error) instanceof Error
            ? (create.error || update.error)!.message
            : '操作失敗'}
        </div>
      )}
    </form>
  );
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId);
  const { data: deadlines, isLoading: deadlinesLoading } = useDeadlines(projectId);
  const { data: members } = useProjectMembers(projectId);
  const deleteDeadline = useDeleteDeadline();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();

  const [showDeadlineForm, setShowDeadlineForm] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const { data: inviteProfiles, isLoading: inviteProfilesLoading } = useInviteProfiles(projectId, showInvitePicker);
  // Phase 3：從文件擷取
  const [extractText, setExtractText] = useState('');
  const [extractFileName, setExtractFileName] = useState<string | null>(null);
  const [suggestedDeadlines, setSuggestedDeadlines] = useState<SuggestedDeadline[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const extractFromText = useExtractDeadlinesFromText();
  const confirmSuggested = useConfirmSuggestedDeadlines();
  const { data: notificationRule } = useNotificationRule(projectId);
  const upsertRule = useUpsertNotificationRule(projectId);
  const defaultRule = getDefaultRule();

  if (projectLoading || !projectId) {
    return <div>載入中…</div>;
  }
  if (projectError || !project) {
    return (
      <div className="error">
        專案不存在或無權限。
        <button type="button" className="btn" onClick={() => navigate('/')}>
          回專案列表
        </button>
      </div>
    );
  }

  const isOwner = user?.id === project.owner_id;

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;
    const { data: uid, error: rpcError } = await supabase.rpc('get_user_id_by_email', {
      user_email: newMemberEmail.trim(),
    });
    if (rpcError || !uid) {
      alert('找不到該 Email 的使用者，請確認對方已註冊');
      return;
    }
    try {
      await addMember.mutateAsync({ projectId: projectId!, userId: uid });
      setNewMemberEmail('');
    } catch (err) {
      alert(err instanceof Error ? err.message : '新增成員失敗');
    }
  }

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn" onClick={() => navigate('/')}>
          ← 回專案列表
        </button>
      </div>
      <div className="card">
        <h2>{project.name}</h2>
        {project.description && <p style={{ color: '#666' }}>{project.description}</p>}
      </div>

      {/* 截止日區塊 */}
      <div className="card">
        <h3>截止日</h3>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginBottom: '1rem' }}
          onClick={() => {
            setEditingDeadline(null);
            setShowDeadlineForm(true);
          }}
        >
          新增截止日
        </button>

        {showDeadlineForm && !editingDeadline && (
          <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f9f9f9', borderRadius: 8 }}>
            <DeadlineForm
              projectId={projectId}
              onSuccess={() => setShowDeadlineForm(false)}
              onCancel={() => setShowDeadlineForm(false)}
            />
          </div>
        )}

        {editingDeadline && (
          <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f9f9f9', borderRadius: 8 }}>
            <DeadlineForm
              projectId={projectId}
              deadline={editingDeadline}
              onSuccess={() => setEditingDeadline(null)}
              onCancel={() => setEditingDeadline(null)}
            />
          </div>
        )}

        {deadlinesLoading ? (
          <p>載入中…</p>
        ) : deadlines?.length === 0 ? (
          <p>尚無截止日。</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {deadlines?.map((d) => (
              <li key={d.id} className="list-item">
                <div>
                  <strong>{d.title}</strong>
                  <span style={{ marginLeft: '0.5rem' }} className="badge">
                    {formatDate(d.due_date)}
                  </span>
                  {d.description && (
                    <span style={{ display: 'block', fontSize: '0.9rem', color: '#666' }}>
                      {d.description}
                    </span>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setShowDeadlineForm(false);
                      setEditingDeadline(d);
                    }}
                  >
                    編輯
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={async () => {
                      if (window.confirm('確定刪除此截止日？')) {
                        await deleteDeadline.mutateAsync({ id: d.id, project_id: projectId });
                      }
                    }}
                  >
                    刪除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Phase 3：從文件擷取截止日 */}
      <div className="card">
        <h3>從文件擷取截止日</h3>
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
          貼上文字或上傳 .txt / .pdf / .xlsx，由 AI 辨識專案／里程碑／截止日後，可勾選並寫入上方截止日列表。
        </p>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>文字或選擇檔案</label>
          <textarea
            value={extractText}
            onChange={(e) => setExtractText(e.target.value)}
            placeholder="貼上文件內容，或選擇 .txt / .pdf / .xlsx 檔案後會自動填入"
            rows={5}
            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
          />
          <input
            type="file"
            accept=".txt,.pdf,.xlsx,.xls"
            style={{ marginTop: '0.5rem' }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setExtractFileName(f.name);
              try {
                const text = await extractTextFromFile(f);
                setExtractText(text);
              } catch (err) {
                alert(err instanceof Error ? err.message : '讀取檔案失敗');
              }
              e.target.value = '';
            }}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!extractText.trim() || extractFromText.isPending}
          onClick={async () => {
            setSuggestedDeadlines([]);
            setSelectedSuggestions(new Set());
            try {
              const list = await extractFromText.mutateAsync(extractText.trim());
              setSuggestedDeadlines(list);
              setSelectedSuggestions(new Set(list.map((_, i) => i)));
            } catch (err) {
              alert(err instanceof Error ? err.message : '擷取失敗');
            }
          }}
        >
          {extractFromText.isPending ? '擷取中…' : '開始擷取'}
        </button>
        {extractFromText.error && (
          <div className="error" style={{ marginTop: '0.5rem' }}>
            {extractFromText.error instanceof Error ? extractFromText.error.message : '擷取失敗'}
          </div>
        )}

        {suggestedDeadlines.length > 0 && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>建議截止日（可勾選後一併寫入）</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {suggestedDeadlines.map((s, i) => (
                <li key={i} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <label style={{ display: 'flex', gap: '0.5rem', flex: 1, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedSuggestions.has(i)}
                      onChange={() => {
                        setSelectedSuggestions((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i);
                          else next.add(i);
                          return next;
                        });
                      }}
                    />
                    <span>
                      <strong>{s.title}</strong>
                      <span style={{ marginLeft: '0.5rem' }} className="badge">{s.due_date}</span>
                      {s.description && (
                        <span style={{ display: 'block', fontSize: '0.9rem', color: '#666' }}>
                          {s.description}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedSuggestions.size === 0 || confirmSuggested.isPending || !user?.id}
                onClick={async () => {
                  const selected = suggestedDeadlines.filter((_, i) => selectedSuggestions.has(i));
                  if (selected.length === 0) return;
                  try {
                    await confirmSuggested.mutateAsync({
                      project_id: projectId!,
                      file_name: extractFileName ?? undefined,
                      suggestions: selected,
                      created_by: user!.id,
                    });
                    setSuggestedDeadlines([]);
                    setSelectedSuggestions(new Set());
                    setExtractText('');
                    setExtractFileName(null);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : '寫入失敗');
                  }
                }}
              >
                {confirmSuggested.isPending ? '寫入中…' : `確認寫入選取（${selectedSuggestions.size} 筆）`}
              </button>
            </div>
            {confirmSuggested.error && (
              <div className="error" style={{ marginTop: '0.5rem' }}>
                {confirmSuggested.error instanceof Error ? confirmSuggested.error.message : '寫入失敗'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phase 4：通知規則（僅 owner 可編輯） */}
      {isOwner && (
        <div className="card">
          <h3>通知規則</h3>
          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
            排程檢查時，依此設定「幾天內到期」發送 LINE／Email 提醒負責人。未設定時使用系統預設（3 天、雙管道）。
          </p>
          <NotificationRuleForm
            projectId={projectId!}
            rule={notificationRule ?? null}
            defaultRule={defaultRule}
            onSave={upsertRule.mutateAsync}
            isPending={upsertRule.isPending}
            error={upsertRule.error}
          />
        </div>
      )}

      {/* 成員區塊（僅 owner 可管理） */}
      {isOwner && (
        <div className="card">
          <h3>專案成員</h3>
          <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input
              type="email"
              placeholder="成員 Email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              className="form-group"
              style={{ flex: 1, minWidth: '12rem', padding: '0.5rem' }}
            />
            <button type="submit" className="btn btn-primary" disabled={addMember.isPending}>
              新增成員
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setShowInvitePicker(true)}
              disabled={addMember.isPending}
            >
              從名單選擇
            </button>
          </form>
          {showInvitePicker && (
            <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-secondary, #f5f5f5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <strong>選擇要加入的成員</strong>
                <button type="button" className="btn" onClick={() => setShowInvitePicker(false)}>
                  關閉
                </button>
              </div>
              {inviteProfilesLoading ? (
                <p style={{ color: '#666' }}>載入名單中…</p>
              ) : !inviteProfiles?.length ? (
                <p style={{ color: '#666' }}>沒有可邀請的成員（所有人已在專案內或尚未註冊）。</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '12rem', overflowY: 'auto' }}>
                  {inviteProfiles.map((p) => (
                    <li
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem 0',
                        borderBottom: '1px solid #eee',
                        gap: '0.5rem',
                      }}
                    >
                      <span>
                        {p.display_name || p.email || p.id}
                        {p.has_line && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#06c755' }} title="已綁定 LINE">
                            LINE
                          </span>
                        )}
                        {p.email && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#666' }}>{p.email}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={addMember.isPending}
                        onClick={async () => {
                          try {
                            await addMember.mutateAsync({ projectId: projectId!, userId: p.id });
                            setShowInvitePicker(false);
                          } catch (err) {
                            alert(err instanceof Error ? err.message : '新增成員失敗');
                          }
                        }}
                      >
                        加入
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li className="list-item">
              <span>建立者（您）</span>
            </li>
            {members?.map((m) => (
              <li key={m.user_id} className="list-item">
                <span>
                  {m.profile?.display_name || m.profile?.email || m.user_id}
                  {m.profile?.line_user_id && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#06c755' }} title="此帳號已綁定 LINE，可收到 LINE 截止日提醒">
                      LINE
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => removeMember.mutate({ projectId: projectId!, userId: m.user_id })}
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

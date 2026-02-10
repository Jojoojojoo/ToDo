import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '@/hooks/useProject';
import {
  useDeadlines,
  useCreateDeadline,
  useUpdateDeadline,
  useDeleteDeadline,
} from '@/hooks/useDeadlines';
import { useProjectMembers, useAddProjectMember, useRemoveProjectMember } from '@/hooks/useProjectMembers';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Deadline } from '@/types/database';

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
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

      {/* 成員區塊（僅 owner 可管理） */}
      {isOwner && (
        <div className="card">
          <h3>專案成員</h3>
          <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="email"
              placeholder="成員 Email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              className="form-group"
              style={{ flex: 1, padding: '0.5rem' }}
            />
            <button type="submit" className="btn btn-primary" disabled={addMember.isPending}>
              新增成員
            </button>
          </form>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li className="list-item">
              <span>建立者（您）</span>
            </li>
            {members?.map((m) => (
              <li key={m.user_id} className="list-item">
                <span>{m.profile?.display_name || m.profile?.email || m.user_id}</span>
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

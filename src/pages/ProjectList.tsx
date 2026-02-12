import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '@/hooks/useProjects';
import type { Project } from '@/types/database';

/** 從 mutation error 取出可顯示訊息（型別為 unknown 以通過 TS 檢查） */
function getMutationErrorMessage(err: unknown): string {
  if (err == null) return '操作失敗';
  if (err instanceof Error) return err.message || '操作失敗';
  if (typeof err === 'object' && 'message' in err) return String((err as { message?: unknown }).message) || '操作失敗';
  return String(err);
}

function ProjectForm({
  project,
  onSuccess,
  onCancel,
}: {
  project?: Project | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const create = useCreateProject();
  const update = useUpdateProject();
  const isEdit = !!project?.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (isEdit) {
        await update.mutateAsync({ id: project.id, name, description });
      } else {
        await create.mutateAsync({ name, description });
      }
      onSuccess();
    } catch {
      // error 由 mutation 顯示
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>專案名稱 *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
          {isEdit ? '儲存' : '新增專案'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          取消
        </button>
      </div>
      {(create.error || update.error) && (
        <div className="error">
          {getMutationErrorMessage(create.error || update.error)}
        </div>
      )}
    </form>
  );
}

export default function ProjectList() {
  const { data: projects, isLoading, error } = useProjects();
  const deleteProject = useDeleteProject();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  if (isLoading) return <div>載入專案中…</div>;
  if (error) return <div className="error">載入失敗：{String(error)}</div>;

  const list = Array.isArray(projects) ? projects : [];
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>專案列表</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          新增專案
        </button>
      </div>

      {showForm && !editing && (
        <div className="card">
          <h3>新增專案</h3>
          <ProjectForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {editing && (
        <div className="card">
          <h3>編輯專案</h3>
          <ProjectForm
            project={editing}
            onSuccess={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {list.length === 0 && !showForm && (
        <div className="card">
          <p>尚無專案，請點「新增專案」建立。</p>
        </div>
      )}

      {list.map((p) => (
        <div key={p.id} className="card list-item">
          <div>
            <Link to={`/projects/${p.id}`} style={{ fontWeight: 600, marginRight: '0.5rem' }}>
              {p.name}
            </Link>
            {p.description && (
              <span style={{ color: '#666', fontSize: '0.9rem' }}>{p.description}</span>
            )}
          </div>
          <div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setShowForm(false);
                setEditing(p);
              }}
            >
              編輯
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                if (window.confirm(`確定要刪除專案「${p.name}`)) {
                  await deleteProject.mutateAsync(p.id);
                }
              }}
            >
              刪除
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { useNotificationLogs, useUpcomingDeadlines } from '@/hooks/useReports';

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(s: string) {
  return new Date(s).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Reports() {
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const projectIds = projects?.map((p) => p.id) ?? [];
  const { data: upcoming, isLoading: upcomingLoading } = useUpcomingDeadlines(projectIds, 14);
  const { data: logs, isLoading: logsLoading } = useNotificationLogs(50);

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn" onClick={() => navigate('/')}>
          ← 回專案列表
        </button>
      </div>

      <div className="card">
        <h2>報表</h2>
        <p style={{ color: '#666', marginBottom: '1rem' }}>
          即將到期一覽（14 天內）與近期通知紀錄。
        </p>
      </div>

      <div className="card">
        <h3>即將到期（14 天內）</h3>
        {upcomingLoading ? (
          <p>載入中…</p>
        ) : !upcoming?.length ? (
          <p>目前無即將到期的截止日。</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {upcoming.map((d) => (
              <li key={d.id} className="list-item">
                <div>
                  <strong>{d.title}</strong>
                  <span style={{ marginLeft: '0.5rem' }} className="badge">
                    {formatDate(d.due_date)}
                  </span>
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                    {d.projects?.name ?? ''}
                  </span>
                  {d.description && (
                    <span style={{ display: 'block', fontSize: '0.9rem', color: '#666' }}>
                      {d.description}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate(`/projects/${d.project_id}`)}
                >
                  前往專案
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>近期通知紀錄</h3>
        {logsLoading ? (
          <p>載入中…</p>
        ) : !logs?.length ? (
          <p>尚無通知紀錄。</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {logs.map((log) => (
              <li key={log.id} className="list-item" style={{ flexWrap: 'wrap' }}>
                <div>
                  <span className="badge" style={{ marginRight: '0.5rem' }}>
                    {log.channel}
                  </span>
                  <span style={{ fontSize: '0.9rem' }}>
                    {log.deadlines?.title ?? '—'}（{log.deadlines?.projects?.name ?? '—'}）
                  </span>
                  <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '0.85rem' }}>
                    {formatDateTime(log.sent_at)} → {log.recipient}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

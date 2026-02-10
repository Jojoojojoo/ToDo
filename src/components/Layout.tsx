import { Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

export default function Layout() {
  const { profile, signOut } = useAuth();

  return (
    <div className="app">
      <nav className="nav">
        <div>
          <Link to="/">專案列表</Link>
        </div>
        <div>
          <span style={{ marginRight: '1rem' }}>
            {profile?.display_name || profile?.email || '使用者'}
          </span>
          <button type="button" className="btn" onClick={() => signOut()}>
            登出
          </button>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}

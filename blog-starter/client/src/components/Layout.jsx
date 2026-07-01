import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearToken, getToken } from '../lib/api';

export function Layout() {
  const navigate = useNavigate();
  const isLoggedIn = Boolean(getToken());

  function logout() {
    clearToken();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link to="/" className="brand">NovaBlog</Link>
        <nav>
          <NavLink to="/">Blog</NavLink>
          {isLoggedIn && <NavLink to="/dashboard">Panel</NavLink>}
          {!isLoggedIn ? <NavLink to="/login">Giriş</NavLink> : <button onClick={logout}>Çıkış</button>}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">Custom backend ile geliştirilen blog sistemi.</footer>
    </div>
  );
}

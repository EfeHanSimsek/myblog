import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearToken, getToken } from '../lib/api';

export function Layout() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(getToken()));

  useEffect(() => {
    function syncAuth() {
      setIsLoggedIn(Boolean(getToken()));
    }

    window.addEventListener('auth-change', syncAuth);
    window.addEventListener('storage', syncAuth);
    return () => {
      window.removeEventListener('auth-change', syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  function logout() {
    clearToken();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">İçeriğe geç</a>
      <header className="site-header">
        <Link to="/" className="brand">NovaBlog</Link>
        <nav aria-label="Ana menü">
          <NavLink to="/">Blog</NavLink>
          {isLoggedIn && <NavLink to="/dashboard">Panel</NavLink>}
          {!isLoggedIn ? <NavLink to="/login">Giriş</NavLink> : <button onClick={logout}>Çıkış</button>}
        </nav>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
      <footer className="site-footer">Custom backend ile geliştirilen blog sistemi.</footer>
    </div>
  );
}

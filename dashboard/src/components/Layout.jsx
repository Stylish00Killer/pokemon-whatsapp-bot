import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Users, Settings, Wrench, LogOut } from 'lucide-react';
import { useAuth } from '../App.jsx';
import { api } from '../services/api.js';

const NAV = [
  { to: '/',         label: 'Overview', Icon: LayoutDashboard, end: true },
  { to: '/commands', label: 'Commands', Icon: BookOpen },
  { to: '/groups',   label: 'Groups',   Icon: Users },
  { to: '/config',   label: 'Config',   Icon: Settings },
  { to: '/devtools', label: 'Dev Tools',Icon: Wrench },
];

export default function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(null);

  useEffect(() => {
    const check = async () => {
      try {
        const s = await api.getStats();
        setConnected(s?.connected ?? false);
      } catch { setConnected(false); }
    };
    check();
    const id = setInterval(check, 8000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⚡</div>
          <div>
            <div className="sidebar-logo-text">EVE BOT</div>
            <div className="sidebar-logo-sub">Dashboard</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-status">
            <span className={`dot ${connected === null ? '' : connected ? 'online' : 'offline'}`} />
            {connected === null ? 'Checking…' : connected ? 'Connected' : 'Offline'}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Logout">
            <LogOut size={13} />
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

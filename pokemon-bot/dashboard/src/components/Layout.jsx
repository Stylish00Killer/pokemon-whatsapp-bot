import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Swords, Terminal } from 'lucide-react';
import { api } from '../services/api.js';

const NAV = [
  { to: '/',        label: 'Overview', Icon: LayoutDashboard, end: true },
  { to: '/players', label: 'Players',  Icon: Users },
  { to: '/battles', label: 'Battles',  Icon: Swords },
  { to: '/logs',    label: 'Live Logs',Icon: Terminal },
];

export default function Layout() {
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

  const statusLabel = connected === null ? 'Checking…' : connected ? 'Connected' : 'Offline';
  const dotClass    = connected === null ? 'checking' : connected ? 'online' : 'offline';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⚡</div>
          <div>
            <div className="sidebar-logo-text">Pokémon Bot</div>
            <div className="sidebar-logo-sub">Dashboard</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Monitor</div>
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
            <span className={`dot ${dotClass}`} />
            {statusLabel}
          </div>
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

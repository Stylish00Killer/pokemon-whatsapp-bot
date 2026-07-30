import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../services/api.js';

function Badge({ children, color }) {
  const colors = {
    green:  { background: 'var(--green-dim,  #1a3a1a)', color: 'var(--green-light,  #4ade80)' },
    yellow: { background: 'var(--yellow-dim, #3a3a1a)', color: 'var(--yellow-light, #facc15)' },
    red:    { background: 'var(--red-dim,    #3a1a1a)', color: 'var(--red-light,    #f87171)' },
    muted:  { background: 'var(--surface2,   #1e1e1e)', color: 'var(--muted,        #888)'    },
  };
  const s = colors[color] || colors.muted;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      ...s,
    }}>
      {children}
    </span>
  );
}

export default function Groups() {
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.getGroups();
      setGroups(d.groups || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Groups</h1>
          <p className="page-subtitle">WhatsApp groups using the Pokémon bot</p>
        </div>
        <div className="page-actions">
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{groups.length} group{groups.length !== 1 ? 's' : ''}</span>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading} title="Refresh">
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: 'var(--red-dim, #3a1a1a)', color: 'var(--red-light, #f87171)', fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {!loading && groups.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          color: 'var(--muted)', fontSize: 14,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🌐</div>
          No groups found yet. Groups appear here once wild spawning is enabled
          (<code>!pg</code>) or a battle starts in a group chat.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Wild Spawns</th>
                <th>Active Wild</th>
                <th>Active Battle</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.jid}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {g.shortId}
                    </span>
                  </td>
                  <td>
                    {g.wildEnabled
                      ? <Badge color="green">✓ Enabled</Badge>
                      : <Badge color="muted">Disabled</Badge>}
                  </td>
                  <td>
                    {g.activeWild
                      ? <Badge color="yellow">⚡ {g.wildPokemon ? capitalize(g.wildPokemon) : 'Active'}</Badge>
                      : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                  </td>
                  <td>
                    {g.activeBattle
                      ? <Badge color="red">⚔ Fighting</Badge>
                      : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {g.battleInfo
                      ? `${g.battleInfo.p1} vs ${g.battleInfo.p2} · turn ${g.battleInfo.turn}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

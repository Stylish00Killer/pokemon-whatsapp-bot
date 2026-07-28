import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { api } from '../services/api.js';

export default function Players() {
  const [players, setPlayers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const d = await api.getPlayers();
      setPlayers(d.players || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(), 10000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Trainers</h1>
          <p className="page-subtitle">All registered players and their active party</p>
        </div>
        <div className="page-actions">
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            <span className="badge badge-yellow" style={{ marginRight: 6 }}>{players.length}</span>
            registered
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={13} style={refreshing ? { animation: 'spin .6s linear infinite' } : undefined} />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert alert-warn">⚠ {error}</div>}

      {loading ? (
        <div className="loading-center"><span className="spinner spinner-lg" /><span>Loading trainers…</span></div>
      ) : players.length === 0 ? (
        <div className="empty-state">
          <div className="icon">👤</div>
          <div>No trainers registered yet</div>
          <div style={{ fontSize: 12 }}>Players appear here after using <code>!start</code></div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Users size={14} /> Trainer Roster</div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Trainer ID</th>
                  <th>Lead Pokémon</th>
                  <th>Level</th>
                  <th>Party Size</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={p.jid}>
                    <td style={{ color: 'var(--muted)', width: 40 }}>{i + 1}</td>
                    <td><span className="player-id">{p.displayId}</span></td>
                    <td>
                      {p.lead
                        ? <span style={{ fontWeight: 600 }}>
                            {p.lead.name.charAt(0).toUpperCase() + p.lead.name.slice(1)}
                          </span>
                        : <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>—</span>}
                    </td>
                    <td>
                      {p.lead
                        ? <span className="badge badge-yellow">Lv.{p.lead.level}</span>
                        : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <div
                            key={j}
                            style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: j < p.partySize ? 'var(--red-light)' : 'rgba(255,255,255,.1)',
                            }}
                          />
                        ))}
                        <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--muted)' }}>
                          {p.partySize}/6
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

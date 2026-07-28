import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Swords } from 'lucide-react';
import { api } from '../services/api.js';

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

export default function Battles() {
  const [battles, setBattles]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const d = await api.getBattles();
      setBattles(d.battles || []);
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
    const id = setInterval(() => load(), 5000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Active Battles</h1>
          <p className="page-subtitle">Live PVP battles happening right now</p>
        </div>
        <div className="page-actions">
          {battles.length > 0 && (
            <span className="badge badge-red">{battles.length} live</span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={13} style={refreshing ? { animation: 'spin .6s linear infinite' } : undefined} />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert alert-warn">⚠ {error}</div>}

      {loading ? (
        <div className="loading-center"><span className="spinner spinner-lg" /><span>Loading battles…</span></div>
      ) : battles.length === 0 ? (
        <div className="empty-state">
          <div className="icon">⚔️</div>
          <div>No active battles</div>
          <div style={{ fontSize: 12 }}>Battles appear here when players use <code>!challenge</code></div>
        </div>
      ) : (
        <div className="battle-list">
          {battles.map((b, i) => (
            <div key={b.group + i} className="battle-card">
              <div className="battle-vs">
                {/* Player 1 */}
                <div className="battle-trainer">
                  <span className="battle-trainer-name">@{b.p1}</span>
                  <span className="battle-trainer-poke">🔴 {cap(b.p1poke)}</span>
                  {b.turn === 'player1' && (
                    <span className="badge badge-yellow" style={{ fontSize: 10, marginTop: 2 }}>YOUR TURN</span>
                  )}
                </div>

                <div className="battle-vs-label">VS</div>

                {/* Player 2 */}
                <div className="battle-trainer">
                  <span className="battle-trainer-name">@{b.p2}</span>
                  <span className="battle-trainer-poke">🔵 {cap(b.p2poke)}</span>
                  {b.turn === 'player2' && (
                    <span className="badge badge-yellow" style={{ fontSize: 10, marginTop: 2 }}>YOUR TURN</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span className="badge badge-red">
                  <Swords size={10} style={{ marginRight: 4 }} />
                  LIVE
                </span>
                <span className="battle-group">{b.group}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

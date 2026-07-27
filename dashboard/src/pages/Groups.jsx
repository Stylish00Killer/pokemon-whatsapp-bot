import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Users, Search } from 'lucide-react';
import { api } from '../services/api.js';

const FEATURES = [
  { key: 'wild',   label: '🌿 Wild',   hint: 'Wild Pokémon spawns every 5 min' },
  { key: 'cards',  label: '🃏 Cards',  hint: 'Anime card game spawns'          },
  { key: 'mod',    label: '🛡️ Mod',    hint: 'Anti-link moderation'            },
  { key: 'events', label: '🎉 Events', hint: 'Join/leave welcome messages'     },
];

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      className={`toggle${on ? ' toggle-on' : ''}`}
      onClick={onChange}
      disabled={disabled}
      title={on ? 'Enabled — click to disable' : 'Disabled — click to enable'}
    >
      <span className="toggle-thumb" />
    </button>
  );
}

function GroupCard({ group, onToggle, pending }) {
  return (
    <div className="card" style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg,var(--purple-dim),var(--cyan-dim))',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>👥</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {group.name || group.id}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 8 }}>
            <span>{group.memberCount} members</span>
            <span>·</span>
            <span>{group.adminCount} admins</span>
          </div>
        </div>
      </div>

      {/* Feature toggles */}
      <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {FEATURES.map(({ key, label, hint }) => {
          const isOn    = group[`${key}Enabled`] ?? false;
          const isPending = pending === `${group.id}:${key}`;
          return (
            <div
              key={key}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: key !== 'events' ? '1px solid rgba(255,255,255,.04)' : 'none',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{hint}</div>
              </div>
              {isPending
                ? <span className="spinner" style={{ width: 20, height: 20 }} />
                : <Toggle on={isOn} onChange={() => onToggle(group.id, key, !isOn)} />
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Groups() {
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [query,   setQuery]   = useState('');
  const [pending, setPending] = useState('');   // "jid:feature" while toggling
  const [toast,   setToast]   = useState(null);

  const showToast = (text, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getGroups();
      setGroups(Array.isArray(data) ? data.sort((a, b) => (a.name || '').localeCompare(b.name || '')) : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (jid, feature, enabled) => {
    const key = `${jid}:${feature}`;
    setPending(key);
    try {
      await api.toggleGroupFeature(jid, feature, enabled);
      setGroups(gs => gs.map(g =>
        g.id === jid ? { ...g, [`${feature}Enabled`]: enabled } : g
      ));
      const label = FEATURES.find(f => f.key === feature)?.label ?? feature;
      const name  = groups.find(g => g.id === jid)?.name || jid;
      const note  = (feature === 'wild' || feature === 'cards')
        ? ' — restart the bot to apply spawn changes'
        : '';
      showToast(`${label} ${enabled ? 'enabled' : 'disabled'} for ${name}${note}`, true);
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setPending('');
    }
  };

  const filtered = groups.filter(g =>
    !query || (g.name || g.id).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      {toast && (
        <div
          className={`alert ${toast.ok ? 'alert-ok' : 'alert-err'}`}
          style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,.5)' }}
        >
          {toast.text}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Groups</h1>
          <p className="page-subtitle">
            Toggle features per group. Wild &amp; card spawn changes require a bot restart.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && !error && (
        <div style={{
          display: 'flex', gap: 16, marginBottom: 20,
          padding: '12px 18px',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            <Users size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            <strong style={{ color: 'var(--text)' }}>{groups.length}</strong> groups
          </span>
          {FEATURES.map(({ key, label }) => {
            const count = groups.filter(g => g[`${key}Enabled`]).length;
            return count > 0 ? (
              <span key={key} style={{ fontSize: 13, color: 'var(--muted)' }}>
                {label} <strong style={{ color: 'var(--emerald)' }}>{count}</strong>
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* Search */}
      {!loading && !error && groups.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            className="cmd-search"
            style={{ paddingLeft: 34, marginBottom: 0 }}
            placeholder="Search groups…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      )}

      {error && (
        <div className="alert alert-err">
          {error === 'Bot not connected'
            ? '⚡ Bot is not connected to WhatsApp yet — groups will appear once it connects.'
            : error}
        </div>
      )}

      {loading ? (
        <div className="loading-center"><span className="spinner spinner-lg" /><span>Loading groups…</span></div>
      ) : !error && filtered.length === 0 ? (
        <div className="loading-center" style={{ flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 28 }}>👥</span>
          <span>{query ? 'No groups match your search.' : 'The bot has not joined any groups yet.'}</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {filtered.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              onToggle={handleToggle}
              pending={pending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

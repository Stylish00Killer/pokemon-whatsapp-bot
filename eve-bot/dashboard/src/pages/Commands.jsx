import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { api } from '../services/api.js';

const CAT_LABEL = {
  cards:    '🃏 Cards',
  pokemon:  '⚡ Pokémon',
  pokemons: '⚡ Pokémon',
  owner:    '🔧 Dev / Owner',
};

const CAT_BADGE = {
  cards:    'badge-cyan',
  pokemon:  'badge-emerald',
  pokemons: 'badge-emerald',
  owner:    'badge-purple',
};

function Toggle({ enabled, onChange, loading }) {
  return (
    <button
      className={`toggle${enabled ? ' toggle-on' : ''}`}
      onClick={onChange}
      disabled={loading}
      title={enabled ? 'Click to disable' : 'Click to enable'}
      aria-label={enabled ? 'Disable command' : 'Enable command'}
    >
      <span className="toggle-thumb" />
    </button>
  );
}

export default function Commands() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  // Map of cmdName → 'enabling' | 'disabling' | null  (optimistic pending state)
  const [pending, setPending]   = useState({});
  // Local override map: cmdName → boolean (isEnabled)  — tracks optimistic flips
  const [overrides, setOverrides] = useState({});
  const [toast, setToast]       = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api.getCommands();
      setData(d);
      setError('');
      // Clear overrides on fresh load so they re-sync with server state
      setOverrides({});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (text, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const toggle = async (cmdName, currentlyEnabled) => {
    const action = currentlyEnabled ? 'disable' : 'enable';
    setPending(p => ({ ...p, [cmdName]: action }));
    // Optimistic flip
    setOverrides(o => ({ ...o, [cmdName]: !currentlyEnabled }));
    try {
      await api.toggleCommand(cmdName, action);
      showToast(`${cmdName} ${action}d`, true);
    } catch (e) {
      // Revert optimistic flip on failure
      setOverrides(o => ({ ...o, [cmdName]: currentlyEnabled }));
      showToast(e.message, false);
    } finally {
      setPending(p => { const n = { ...p }; delete n[cmdName]; return n; });
    }
  };

  if (loading) return <div className="loading-center"><span className="spinner spinner-lg" /></div>;
  if (error && !data) return <div className="alert alert-err">{error}</div>;

  const prefix = data?.prefix || '-';
  const categories = data?.categories || {};
  const q = search.toLowerCase();

  const totalCmds = Object.values(categories).reduce((n, c) => n + c.length, 0);
  const disabledCount = Object.values(categories)
    .flat()
    .filter(c => {
      const key = c.name;
      return key in overrides ? !overrides[key] : c.isDisabled;
    }).length;

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div
          className={`alert ${toast.ok ? 'alert-ok' : 'alert-err'}`}
          style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, minWidth: 220, boxShadow: '0 4px 20px rgba(0,0,0,.4)' }}
        >
          {toast.text}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Commands</h1>
          <p className="page-subtitle">
            {totalCmds} commands · prefix <code>{prefix}</code>
            {disabledCount > 0 && (
              <span style={{ marginLeft: 8 }} className="badge badge-red">{disabledCount} disabled</span>
            )}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input
          className="cmd-search"
          style={{ paddingLeft: 34 }}
          placeholder="Search commands…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {Object.entries(categories).map(([cat, cmds]) => {
        const visible = cmds.filter(c =>
          !q ||
          c.name?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.aliases?.some(a => a.toLowerCase().includes(q))
        );
        if (!visible.length) return null;

        return (
          <div key={cat} className="cmd-cat">
            <div className="cmd-cat-title">{CAT_LABEL[cat] || cat} ({visible.length})</div>
            <div className="cmd-grid">
              {visible.map(cmd => {
                const isEnabled = cmd.name in overrides ? overrides[cmd.name] : !cmd.isDisabled;
                const isPending = !!pending[cmd.name];

                return (
                  <div key={cmd.name} className={`cmd-card${!isEnabled ? ' cmd-disabled' : ''}`}>
                    <div className="cmd-card-header">
                      <div className="cmd-name">
                        <span className={`badge ${CAT_BADGE[cat] || 'badge-muted'}`} style={!isEnabled ? { opacity: .5 } : {}}>
                          {prefix}{cmd.name}
                        </span>
                        {!isEnabled && <span className="badge badge-red" style={{ fontSize: 10 }}>off</span>}
                      </div>
                      <Toggle
                        enabled={isEnabled}
                        loading={isPending}
                        onChange={() => toggle(cmd.name, isEnabled)}
                      />
                    </div>
                    {cmd.description && (
                      <div className="cmd-desc" style={!isEnabled ? { opacity: .45 } : {}}>{cmd.description}</div>
                    )}
                    {cmd.aliases?.length > 0 && (
                      <div className="cmd-aliases" style={!isEnabled ? { opacity: .4 } : {}}>
                        also: {cmd.aliases.map(a => `${prefix}${a}`).join(', ')}
                      </div>
                    )}
                    <div className="cmd-meta">
                      {cmd.cool != null && <span className="badge badge-muted">⏱ {cmd.cool}s</span>}
                      {cmd.exp > 0 && <span className="badge badge-amber">+{cmd.exp} XP</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {Object.keys(categories).length === 0 && (
        <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>
          No commands loaded yet — bot may still be connecting.
        </div>
      )}
    </div>
  );
}

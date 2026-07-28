import React, { useState, useEffect } from 'react';
import { RefreshCw, Power, RotateCcw, Cpu, MemoryStick, Terminal } from 'lucide-react';
import { api } from '../services/api.js';

export default function DevTools() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  const loadInfo = async () => {
    try {
      const d = await api.getDevInfo();
      setInfo(d);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadInfo();
    const id = setInterval(loadInfo, 5000);
    return () => clearInterval(id);
  }, []);

  const act = async (key, fn, label) => {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fn();
      setMsg({ ok: true, text: res?.message || `${label} triggered.` });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dev Tools</h1>
          <p className="page-subtitle">Bot management and diagnostics</p>
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.ok ? 'alert-ok' : 'alert-err'}`} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      <div className="two-col">
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><div className="card-title">⚙️ Actions</div></div>
            <div className="card-body">
              <div className="dev-actions">
                <div className="dev-action-row">
                  <div className="dev-action-info">
                    <h3>Reload Commands</h3>
                    <p>Hot-reload all command files without restarting the bot</p>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={busy === 'reload'}
                    onClick={() => act('reload', api.devReload, 'Reload')}
                  >
                    {busy === 'reload' ? <span className="spinner" /> : <RefreshCw size={13} />}
                    Reload
                  </button>
                </div>

                <div className="dev-action-row">
                  <div className="dev-action-info">
                    <h3>Restart Bot</h3>
                    <p>Gracefully restart the bot process (reconnects to WhatsApp)</p>
                  </div>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={busy === 'restart'}
                    onClick={() => act('restart', api.devRestart, 'Restart')}
                  >
                    {busy === 'restart' ? <span className="spinner" /> : <Power size={13} />}
                    Restart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title"><Cpu size={14} /> Process Info</div>
            <button className="btn btn-ghost btn-sm" onClick={loadInfo}><RefreshCw size={12} /></button>
          </div>
          {loading ? (
            <div className="loading-center" style={{ padding: 30 }}><span className="spinner" /></div>
          ) : !info ? (
            <div className="card-body" style={{ color: 'var(--muted)', fontSize: 13 }}>Could not load process info.</div>
          ) : (
            <div className="info-rows">
              <div className="info-row"><span>PID</span><code>{info.pid}</code></div>
              <div className="info-row"><span>Node.js</span><span>{info.nodeVersion}</span></div>
              <div className="info-row"><span>Platform</span><span>{info.platform} / {info.arch}</span></div>
              <div className="info-row"><span>Uptime</span><span>{Math.floor(info.uptime)}s</span></div>
              <div className="info-row"><span>CPU</span><span>{info.cpuPercent}%</span></div>
              <div className="info-row">
                <span>Heap</span>
                <span>{Math.round(info.heapUsed/1048576)} / {Math.round(info.heapTotal/1048576)} MB</span>
              </div>
              <div className="info-row"><span>RSS</span><span>{Math.round(info.rss/1048576)} MB</span></div>
              <div className="info-row"><span>Commands loaded</span><code>{info.cmdCount}</code></div>
              <div className="info-row"><span>Session cmds</span><span>{info.sessionCmds}</span></div>
              <div className="info-row">
                <span>Errors</span>
                <span style={{ color: info.sessionErrors > 0 ? 'var(--red)' : undefined }}>
                  {info.sessionErrors}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trash2, Pause, Play } from 'lucide-react';
import { api } from '../services/api.js';

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function Logs() {
  const [logs, setLogs]       = useState([]);
  const [paused, setPaused]   = useState(false);
  const [filter, setFilter]   = useState('');
  const [errOnly, setErrOnly] = useState(false);
  const bottomRef = useRef(null);
  const pausedRef = useRef(false);

  pausedRef.current = paused;

  // Seed with existing log buffer
  useEffect(() => {
    api.getLogs()
      .then(d => setLogs(d.logs || []))
      .catch(() => {});
  }, []);

  // SSE live stream
  useEffect(() => {
    const es = api.logsStream();
    es.onmessage = (e) => {
      if (pausedRef.current) return;
      try {
        const entry = JSON.parse(e.data);
        setLogs(prev => {
          const next = [...prev, entry];
          return next.length > 500 ? next.slice(-500) : next;
        });
      } catch {}
    };
    return () => es.close();
  }, []);

  // Auto-scroll to bottom unless paused
  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, paused]);

  const visible = logs.filter(l => {
    if (errOnly && !l.error) return false;
    if (filter && !l.line.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Live Logs</h1>
          <p className="page-subtitle">Real-time bot console output via SSE</p>
        </div>
        <div className="page-actions">
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{visible.length} lines</span>
          <button
            className={`btn btn-ghost btn-sm`}
            onClick={() => setPaused(p => !p)}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setLogs([])} title="Clear">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="log-controls">
        <input
          className="cmd-search"
          style={{ maxWidth: 280, marginBottom: 0 }}
          placeholder="Filter logs…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={errOnly}
            onChange={e => setErrOnly(e.target.checked)}
            style={{ accentColor: 'var(--red-light)' }}
          />
          Errors only
        </label>
        {paused && (
          <span className="badge badge-yellow">⏸ Paused — scroll back to live</span>
        )}
      </div>

      <div className="log-terminal">
        {visible.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontStyle: 'italic', padding: '8px 0' }}>
            No log entries yet…
          </div>
        ) : visible.map((l, i) => (
          <div key={i} className="log-line">
            <span className="log-ts">{fmtTime(l.ts)}</span>
            <span className={`log-text${l.error ? ' err' : ''}`}>{l.line}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

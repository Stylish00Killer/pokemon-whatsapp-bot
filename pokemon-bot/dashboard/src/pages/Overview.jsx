import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, Users, Cpu, Clock, Zap, Swords,
  AlertTriangle, Server, MemoryStick, Globe,
} from 'lucide-react';
import { api } from '../services/api.js';

function fmtUptime(s) {
  s = Math.floor(s || 0);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function UptimeCounter({ initialSec }) {
  const [sec, setSec] = useState(initialSec || 0);
  useEffect(() => {
    setSec(initialSec || 0);
    const id = setInterval(() => setSec(v => v + 1), 1000);
    return () => clearInterval(id);
  }, [initialSec]);
  return <>{fmtUptime(sec)}</>;
}

function StatCard({ color, Icon, value, label }) {
  return (
    <div className={`stat-card ${color}`}>
      <Icon size={16} className="icon" />
      <div className="val">{value}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

function QRSection() {
  const [qr, setQr] = useState(null);
  const [ts, setTs] = useState(Date.now());

  useEffect(() => {
    const check = async () => { try { setQr(await api.getQR()); } catch {} };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!qr?.hasQR) return;
    setTs(Date.now());
    const id = setInterval(() => setTs(Date.now()), 5000);
    return () => clearInterval(id);
  }, [qr?.hasQR]);

  if (!qr || qr.connected) return null;

  return (
    <div className="card" style={{ maxWidth: 440, marginBottom: 20 }}>
      <div className="card-header">
        <div className="card-title">📱 Link WhatsApp</div>
      </div>
      <div className="card-body">
        {qr.hasQR ? (
          <div className="qr-wrap">
            <img
              key={ts}
              src={`/qr?t=${ts}`}
              className="qr-img"
              alt="WhatsApp QR"
              onError={() => setTimeout(() => setTs(Date.now()), 3000)}
            />
            <p className="qr-hint">WhatsApp → Linked Devices → Link a Device</p>
          </div>
        ) : (
          <div className="qr-waiting">
            <span className="spinner" />
            <span>Waiting for QR code…</span>
          </div>
        )}
      </div>
    </div>
  );
}

function HourlyChart({ data }) {
  if (!data?.length) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="hourly-bars">
      {data.map((v, i) => (
        <div
          key={i}
          className="hourly-bar"
          title={`${i}:00 — ${v} cmds`}
          style={{
            height: `${Math.max(4, (v / max) * 66)}px`,
            background: v > 0 ? 'var(--red-light)' : 'var(--subtle)',
            opacity: v > 0 ? 1 : .45,
          }}
        />
      ))}
    </div>
  );
}

export default function Overview() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const s = await api.getStats();
      if (mounted.current) { setStats(s); setError(''); setLastUpdated(Date.now()); }
    } catch (err) {
      if (mounted.current) setError(err.message);
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(), 6000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div><h1 className="page-title">Overview</h1><p className="page-subtitle">Live bot status</p></div>
        </div>
        <div className="loading-center"><span className="spinner spinner-lg" /><span>Loading stats…</span></div>
      </div>
    );
  }

  const s = stats || {};

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">
            Live bot status
            {lastUpdated && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--muted)' }}>
                · {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="page-actions">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span className={`dot ${s.connected ? 'online' : 'offline'}`} />
            {s.connected ? 'Connected' : 'Offline'}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={13} style={refreshing ? { animation: 'spin .6s linear infinite' } : undefined} />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert alert-warn">⚠ Could not refresh: {error}</div>}

      {/* Status banner */}
      <div className={`alert ${s.connected ? 'alert-ok' : 'alert-err'}`} style={{ marginBottom: 20 }}>
        {s.connected
          ? '✅ Bot is online and connected to WhatsApp'
          : '⚠ Bot is not connected to WhatsApp. Scan the QR code below.'}
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <StatCard color="red"     Icon={Users}         value={s.totalPlayers  ?? 0}  label="Trainers" />
        <StatCard color="yellow"  Icon={Globe}         value={s.totalPokemon  ?? 0}  label="Pokémon Caught" />
        <StatCard color="blue"    Icon={Swords}        value={s.activeBattles ?? 0}  label="Active Battles" />
        <StatCard color="emerald" Icon={Clock}         value={<UptimeCounter initialSec={s.uptimeSec} />} label="Uptime" />
        <StatCard color="amber"   Icon={Zap}           value={s.cmdRun        ?? 0}  label="Cmds Run" />
        <StatCard color="cyan"    Icon={Cpu}           value={`${s.cpuPercent ?? 0}%`} label="CPU" />
        <StatCard color="purple"  Icon={MemoryStick}   value={`${s.memMB ?? 0}MB`}   label="Heap" />
        <StatCard color="pink"    Icon={AlertTriangle} value={s.errors        ?? 0}  label="Errors" />
      </div>

      <QRSection />

      <div className="two-col">
        {/* System info */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Server size={14} /> System Info</div>
          </div>
          <div className="info-rows">
            <div className="info-row"><span>Bot</span><code>Pokémon Bot</code></div>
            <div className="info-row"><span>Prefix</span><code>!</code></div>
            <div className="info-row"><span>Node.js</span><span>{s.nodeVersion}</span></div>
            <div className="info-row"><span>Platform</span><span>{s.platform}</span></div>
            <div className="info-row"><span>Heap</span><span>{s.memMB} / {s.heapTotalMB} MB</span></div>
            <div className="info-row"><span>RSS</span><span>{s.rssMB} MB</span></div>
            <div className="info-row"><span>PID</span><span>{s.pid}</span></div>
          </div>
        </div>

        {/* Hourly activity */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📊 Hourly Commands</div>
          </div>
          <div className="card-body">
            <HourlyChart data={s.hourlyData} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>12am</span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>12pm</span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>11pm</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

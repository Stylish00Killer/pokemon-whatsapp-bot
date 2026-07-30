import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ShieldCheck, Zap, Coins, Heart, Send, Plus } from 'lucide-react';
import { api } from '../services/api.js';

// ── Toast system ──────────────────────────────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((type, msg) => {
    const id = Date.now() + Math.random();
    setToasts(ts => [...ts, { id, type, msg }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 4500);
  }, []);
  const remove = useCallback((id) => setToasts(ts => ts.filter(t => t.id !== id)), []);
  return { toasts, success: m => add('ok', m), error: m => add('err', m), remove };
}

function ToastStack({ toasts, remove }) {
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => remove(t.id)}>
          <span>{t.type === 'ok' ? '✅' : '❌'}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ── Shared form primitives ────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div className="admin-field">
      <label className="admin-label">{label}</label>
      {hint && <span className="admin-hint">{hint}</span>}
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', disabled }) {
  return (
    <input
      className="admin-input"
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

function PanelCard({ icon, title, subtitle, children }) {
  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <span className="admin-panel-icon">{icon}</span>
        <div>
          <div className="admin-panel-title">{title}</div>
          <div className="admin-panel-sub">{subtitle}</div>
        </div>
      </div>
      <div className="admin-panel-body">{children}</div>
    </div>
  );
}

function Divider({ label }) {
  return (
    <div className="admin-divider">
      <span>{label}</span>
    </div>
  );
}

// ── Panel 1: Force Wild Spawn ─────────────────────────────────────────────────
function SpawnPanel({ toast }) {
  const [groupJid, setGroupJid] = useState('');
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    try {
      const d = await api.adminSpawn({ groupJid: groupJid.trim() || undefined });
      if (d.ok) toast.success(`Spawned ${d.pokemon} (Lv.${d.level}) → ${d.sent} group(s)`);
      else toast.error(d.error || 'Spawn failed');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <PanelCard icon="⚡" title="Force Wild Spawn" subtitle="Immediately push a wild Pokémon to one or all active groups">
      <Field label="Target Group JID" hint="Optional — leave blank to spawn in all wild-enabled groups">
        <Input
          value={groupJid}
          onChange={setGroupJid}
          placeholder="120363xxxxxxxxx@g.us  (optional)"
          disabled={busy}
        />
      </Field>
      <button className="btn btn-primary admin-btn" onClick={handle} disabled={busy}>
        {busy ? <span className="spinner" /> : <Zap size={14} />}
        {busy ? 'Spawning…' : 'Spawn Now'}
      </button>
    </PanelCard>
  );
}

// ── Panel 2: Grant Economy & Items ────────────────────────────────────────────
function GrantPanel({ toast }) {
  const [jid,      setJid]      = useState('');
  const [coins,    setCoins]    = useState('');
  const [itemId,   setItemId]   = useState('pokeball');
  const [qty,      setQty]      = useState('');
  const [busyC,    setBusyC]    = useState(false);
  const [busyI,    setBusyI]    = useState(false);

  const grantCoins = async () => {
    const n = parseInt(coins, 10);
    if (!jid.trim() || isNaN(n)) return toast.error('Enter a trainer JID and a coin amount');
    setBusyC(true);
    try {
      const d = await api.adminGiveCoins({ jid: jid.trim(), coins: n });
      if (d.ok) { toast.success(`Granted ${n} gems → balance now ${d.newBalance}`); setCoins(''); }
      else toast.error(d.error || 'Failed');
    } catch (e) { toast.error(e.message); }
    finally { setBusyC(false); }
  };

  const grantItem = async () => {
    const n = parseInt(qty, 10);
    if (!jid.trim() || !itemId.trim() || isNaN(n)) return toast.error('Fill in JID, item type, and quantity');
    setBusyI(true);
    try {
      const d = await api.adminGiveItem({ jid: jid.trim(), itemId: itemId.trim(), quantity: n });
      if (d.ok) { toast.success(`Granted ${n}× ${itemId} → new qty ${d.newQty}`); setQty(''); }
      else toast.error(d.error || 'Failed');
    } catch (e) { toast.error(e.message); }
    finally { setBusyI(false); }
  };

  const busy = busyC || busyI;

  return (
    <PanelCard icon="💰" title="Grant Economy & Items" subtitle="Add gems or items to a trainer's account">
      <Field label="Trainer JID / Phone" hint="Phone number or full JID — e.g. 919123456789">
        <Input value={jid} onChange={setJid} placeholder="919123456789 or ...@s.whatsapp.net" disabled={busy} />
      </Field>

      <Divider label="Gems / Coins" />
      <div className="admin-row">
        <Input value={coins} onChange={setCoins} type="number" placeholder="Amount" disabled={busyC} />
        <button className="btn btn-primary admin-btn-inline" onClick={grantCoins} disabled={busyC}>
          {busyC ? <span className="spinner" /> : <Coins size={13} />}
          Grant Gems
        </button>
      </div>

      <Divider label="Items" />
      <div className="admin-row">
        <select
          className="admin-input admin-select"
          value={itemId}
          onChange={e => setItemId(e.target.value)}
          disabled={busyI}
        >
          <option value="pokeball">Pokéball</option>
          <option value="greatball">Great Ball</option>
          <option value="ultraball">Ultra Ball</option>
          <option value="potion">Potion</option>
          <option value="superpotion">Super Potion</option>
          <option value="hyperpotion">Hyper Potion</option>
          <option value="fullrestore">Full Restore</option>
        </select>
        <Input value={qty} onChange={setQty} type="number" placeholder="Qty" disabled={busyI} />
        <button className="btn btn-primary admin-btn-inline" onClick={grantItem} disabled={busyI}>
          {busyI ? <span className="spinner" /> : <Plus size={13} />}
          Grant
        </button>
      </div>
    </PanelCard>
  );
}

// ── Panel 3: Trainer Quick-Actions ────────────────────────────────────────────
function TrainerPanel({ toast }) {
  const [jid,   setJid]   = useState('');
  const [busyH, setBusyH] = useState(false);

  const healParty = async () => {
    if (!jid.trim()) return toast.error('Enter a trainer JID');
    setBusyH(true);
    try {
      const d = await api.adminHealParty({ jid: jid.trim() });
      if (d.ok) toast.success(`Healed ${d.count} Pokémon for ${d.jid.split('@')[0]}`);
      else toast.error(d.error || 'Failed');
    } catch (e) { toast.error(e.message); }
    finally { setBusyH(false); }
  };

  return (
    <PanelCard icon="🏥" title="Trainer Quick-Actions" subtitle="Heal or manage a trainer's party instantly">
      <Field label="Trainer JID / Phone" hint="Phone number or full JID">
        <Input value={jid} onChange={setJid} placeholder="919123456789 or ...@s.whatsapp.net" disabled={busyH} />
      </Field>

      <div className="admin-action-row">
        <button className="btn btn-primary admin-btn" onClick={healParty} disabled={busyH}>
          {busyH ? <span className="spinner" /> : <Heart size={14} />}
          {busyH ? 'Healing…' : 'Full Party Heal'}
        </button>
        <span className="admin-action-note">
          Restores HP and PP for all Pokémon in the trainer's active party
        </span>
      </div>
    </PanelCard>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Admin() {
  const toast = useToasts();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={20} style={{ color: 'var(--red-light)' }} />
            Admin Controls
          </h1>
          <p className="page-subtitle">Direct bot actions — spawn wilds, grant items, manage trainers</p>
        </div>
        {import.meta.env.MODE !== 'production' && (
          <span className="badge badge-yellow">⚙ Dev Mode</span>
        )}
      </div>

      <div className="admin-grid">
        <SpawnPanel  toast={toast} />
        <GrantPanel  toast={toast} />
        <TrainerPanel toast={toast} />
      </div>

      <ToastStack toasts={toast.toasts} remove={toast.remove} />
    </div>
  );
}

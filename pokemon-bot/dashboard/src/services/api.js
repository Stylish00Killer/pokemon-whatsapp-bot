const BASE = '';

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function post(path, body = {}) {
  const adminKey = typeof localStorage !== 'undefined'
    ? (localStorage.getItem('adminKey') || '')
    : '';
  return req(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: adminKey ? { 'x-admin-key': adminKey } : {},
  });
}

export const api = {
  // ── Read endpoints ──────────────────────────────────────────────────────
  getStats:   () => req('/api/stats'),
  getQR:      () => req('/api/qr'),
  getPlayers: () => req('/api/players'),
  getBattles: () => req('/api/battles'),
  getGroups:  () => req('/api/groups'),

  // ── Admin write endpoints ───────────────────────────────────────────────
  adminSpawn:     (body) => post('/api/admin/spawn',       body),
  adminGiveCoins: (body) => post('/api/admin/give-coins',  body),
  adminGiveItem:  (body) => post('/api/admin/give-item',   body),
  adminHealParty: (body) => post('/api/admin/heal-party',  body),
};

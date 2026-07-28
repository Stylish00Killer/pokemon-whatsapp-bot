const BASE = '';

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export const api = {
  getStats:   () => req('/api/stats'),
  getQR:      () => req('/api/qr'),
  getLogs:    () => req('/api/logs'),
  getPlayers: () => req('/api/players'),
  getBattles: () => req('/api/battles'),

  /** Returns an EventSource for the live log SSE stream. */
  logsStream: () => new EventSource('/api/logs'),
};

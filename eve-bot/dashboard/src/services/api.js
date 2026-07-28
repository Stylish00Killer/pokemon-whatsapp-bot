const BASE = '/api';

async function request(path, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...opts,
    });
    if (res.status === 401) { window.location.href = '/login'; return null; }
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      let msg = body || res.statusText;
      try { const j = JSON.parse(body); if (j?.error) msg = j.error; } catch {}
      throw new Error(msg);
    }
    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  // Auth
  getAuth:        ()                => request('/auth'),
  login:          (password)        => request('/login',  { method: 'POST', body: JSON.stringify({ password }) }),
  logout:         ()                => request('/logout', { method: 'POST' }),

  // Stats & QR
  getStats:       ()                => request('/stats'),
  getQR:          ()                => request('/qr'),

  // Commands + toggle
  getCommands:    ()                => request('/commands'),
  toggleCommand:  (command, action) => request('/commands/toggle', { method: 'POST', body: JSON.stringify({ command, action }) }),

  // Config (replaces env)
  getConfig:      ()                => request('/config'),
  saveConfig:     (data)            => request('/config', { method: 'POST', body: JSON.stringify(data) }),

  // Groups
  getGroups:          ()                        => request('/groups'),
  toggleGroupFeature: (jid, feature, enabled)   => request(`/groups/${encodeURIComponent(jid)}/features`, { method: 'POST', body: JSON.stringify({ feature, enabled }) }),

  // Dev tools
  getDevInfo:     ()                => request('/dev/info'),
  devRestart:     ()                => request('/dev/restart', { method: 'POST' }),
  devReload:      ()                => request('/dev/reload',  { method: 'POST' }),
};

import React, { useState, useEffect, useCallback } from 'react';
import { Save, RefreshCw, RotateCcw } from 'lucide-react';
import { api } from '../services/api.js';

// Field schema — drives the form
const FIELDS = [
  {
    section: 'Bot Identity',
    fields: [
      { key: 'BOT_NAME', label: 'Bot Name',       type: 'text', placeholder: 'EVE',
        hint: 'Display name used in bot messages and the dashboard.' },
      { key: 'PREFIX',   label: 'Command Prefix', type: 'text', placeholder: '-', maxLen: 5,
        hint: 'Character(s) that trigger commands. Keep it short (1–2 chars).' },
    ],
  },
];

function Field({ def, value, onChange }) {
  return (
    <div className="cfg-field">
      <label className="cfg-label">{def.label}</label>
      <input
        className="form-input cfg-input"
        type="text"
        value={value ?? ''}
        onChange={e => onChange(def.key, e.target.value)}
        placeholder={def.placeholder}
        maxLength={def.maxLen}
        autoComplete="off"
        spellCheck={false}
      />
      {def.hint && <p className="cfg-hint">{def.hint}</p>}
    </div>
  );
}

export default function Config() {
  const [original, setOriginal] = useState(null);
  const [values, setValues]     = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [toast, setToast]       = useState(null);

  const showToast = (text, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getConfig();
      setOriginal(d);
      setValues({ ...d });
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (key, val) => setValues(v => ({ ...v, [key]: val }));

  const reset = () => {
    if (original) setValues({ ...original });
  };

  const isDirty = original && Object.keys(values).some(k => String(values[k]) !== String(original[k] ?? ''));

  const save = async () => {
    setSaving(true);
    try {
      await api.saveConfig(values);
      setOriginal({ ...values });
      showToast('Config saved.', true);
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div
          className={`alert ${toast.ok ? 'alert-ok' : 'alert-err'}`}
          style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, maxWidth: 380, boxShadow: '0 4px 24px rgba(0,0,0,.5)' }}
        >
          {toast.text}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Config</h1>
          <p className="page-subtitle">
            Bot name and prefix live in <code>config.js</code> — edit here or directly in the file.
            Owner is auto-assigned from the connected WhatsApp account.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} /> Reload
          </button>
        </div>
      </div>

      {error && <div className="alert alert-err" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div className="loading-center"><span className="spinner spinner-lg" /></div>
      ) : (
        <>
          {FIELDS.map(({ section, fields }) => (
            <div key={section} className="cfg-section">
              <div className="cfg-section-title">{section}</div>
              <div className="card">
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {fields.map(def => (
                    <Field
                      key={def.key}
                      def={def}
                      value={values[def.key]}
                      onChange={set}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Save bar */}
          <div className={`cfg-save-bar${isDirty ? ' cfg-save-bar-visible' : ''}`}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>You have unsaved changes</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={reset}>
                <RotateCcw size={13} /> Discard
              </button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="spinner" /> : <Save size={13} />}
                Save to config.js
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

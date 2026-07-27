import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Incorrect password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <div className="login-logo-icon">⚡</div>
          <h1>EVE BOT</h1>
          <p>Sign in to the dashboard</p>
        </div>
        {error && <div className="alert alert-err" style={{ marginBottom: 16 }}>{error}</div>}
        <form onSubmit={submit} className="login-form">
          <input
            type="password"
            className="form-input"
            placeholder="Dashboard password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            required
          />
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

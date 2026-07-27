import React, { createContext, useContext, useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from './services/api.js';
import Layout from './components/Layout.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.getAuth()
      .then(d => setAuthed(d?.authed ?? false))
      .catch(() => setAuthed(false))
      .finally(() => setChecking(false));
  }, []);

  const login = async (password) => {
    const d = await api.login(password);
    if (d?.ok) setAuthed(true);
    return d;
  };

  const logout = async () => {
    await api.logout().catch(() => {});
    setAuthed(false);
  };

  return <AuthCtx.Provider value={{ authed, checking, login, logout }}>{children}</AuthCtx.Provider>;
}

const Login     = lazy(() => import('./pages/Login.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Commands  = lazy(() => import('./pages/Commands.jsx'));
const Groups    = lazy(() => import('./pages/Groups.jsx'));
const Config    = lazy(() => import('./pages/Config.jsx'));
const DevTools  = lazy(() => import('./pages/DevTools.jsx'));

function Guard({ children }) {
  const { authed, checking } = useAuth();
  if (checking) return <div className="loading-center"><span className="spinner spinner-lg" /></div>;
  if (!authed) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="loading-center"><span className="spinner spinner-lg" /></div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Guard><Layout /></Guard>}>
            <Route index           element={<Dashboard />} />
            <Route path="commands" element={<Commands />} />
            <Route path="groups"   element={<Groups />} />
            <Route path="config"   element={<Config />} />
            <Route path="devtools" element={<DevTools />} />
            <Route path="*"        element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

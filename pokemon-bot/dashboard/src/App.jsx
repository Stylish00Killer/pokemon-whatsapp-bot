import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';

const Overview = lazy(() => import('./pages/Overview.jsx'));
const Players  = lazy(() => import('./pages/Players.jsx'));
const Battles  = lazy(() => import('./pages/Battles.jsx'));
const Groups   = lazy(() => import('./pages/Groups.jsx'));
const Admin    = lazy(() => import('./pages/Admin.jsx'));

const Spinner = () => (
  <div className="loading-center">
    <span className="spinner spinner-lg" />
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index           element={<Overview />} />
          <Route path="players"  element={<Players />} />
          <Route path="battles"  element={<Battles />} />
          <Route path="groups"   element={<Groups />} />
          <Route path="admin"    element={<Admin />} />
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Setup from './pages/Setup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AppCreate from './pages/AppCreate';
import AppDetail from './pages/AppDetail';
import AuditLog from './pages/AuditLog';

function App() {
  const { isAuthenticated, isLoading, setupRequired, login, setup, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (setupRequired) return <Setup onSetup={setup} />;
  if (!isAuthenticated) return <Login onLogin={login} />;

  return (
    <Routes>
      <Route element={<Layout onLogout={logout} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/apps/new" element={<AppCreate />} />
        <Route path="/apps/:id" element={<AppDetail />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;

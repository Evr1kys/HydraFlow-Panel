import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './components/AuthProvider';
import { AppShellLayout } from './components/AppShell';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { UsersPage } from './pages/Users';
import { NodesPage } from './pages/Nodes';
import { SettingsPage } from './pages/Settings';
import { IntelligencePage } from './pages/Intelligence';
import { BillingPage } from './pages/Billing';
import { PluginsPage } from './pages/Plugins';
import { SessionsPage } from './pages/Sessions';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShellLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/nodes" element={<NodesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/intelligence" element={<IntelligencePage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/plugins" element={<PluginsPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

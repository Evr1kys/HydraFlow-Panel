import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './components/AuthProvider';
import { AppShellLayout } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { UsersPage } from './pages/Users';
import { NodesPage } from './pages/Nodes';
import { SettingsPage } from './pages/Settings';
import { IntelligencePage } from './pages/Intelligence';
import { BillingPage } from './pages/Billing';
import { UserBillingPage } from './pages/UserBilling';
import { PluginsPage } from './pages/Plugins';
import { SessionsPage } from './pages/Sessions';
import { ConfigEditorPage } from './pages/ConfigEditor';
import { MigrationPage } from './pages/Migration';
import { SquadsPage } from './pages/Squads';
import { ConfigProfilesPage } from './pages/ConfigProfiles';
import { DevicesPage } from './pages/Devices';
import { TrafficHistoryPage } from './pages/TrafficHistory';
import { BackupPage } from './pages/Backup';
import { AuditLogPage } from './pages/AuditLog';
import { AdminsPage } from './pages/Admins';
import { ApiKeysPage } from './pages/ApiKeys';
import { BotPage } from './pages/Bot';
import { BotUsersPage } from './pages/BotUsers';
import { BotPlansPage } from './pages/BotPlans';
import { BotPromosPage } from './pages/BotPromos';
import { BotButtonsPage } from './pages/BotButtons';
import { BotTransactionsPage } from './pages/BotTransactions';
import { BotBroadcastPage } from './pages/BotBroadcast';

function BoundaryRoute({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <BoundaryRoute>
                <LoginPage />
              </BoundaryRoute>
            }
          />
          <Route
            element={
              <RequireAuth>
                <AppShellLayout />
              </RequireAuth>
            }
          >
            <Route
              path="/"
              element={
                <BoundaryRoute>
                  <DashboardPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/users"
              element={
                <BoundaryRoute>
                  <UsersPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/nodes"
              element={
                <BoundaryRoute>
                  <NodesPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/squads"
              element={
                <BoundaryRoute>
                  <SquadsPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <BoundaryRoute>
                  <SettingsPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/intelligence"
              element={
                <BoundaryRoute>
                  <IntelligencePage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <BoundaryRoute>
                  <BillingPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/user-billing"
              element={
                <BoundaryRoute>
                  <UserBillingPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/plugins"
              element={
                <BoundaryRoute>
                  <PluginsPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/sessions"
              element={
                <BoundaryRoute>
                  <SessionsPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/config-editor"
              element={
                <BoundaryRoute>
                  <ConfigEditorPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/migration"
              element={
                <BoundaryRoute>
                  <MigrationPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/config-profiles"
              element={
                <BoundaryRoute>
                  <ConfigProfilesPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/devices"
              element={
                <BoundaryRoute>
                  <DevicesPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/traffic-history"
              element={
                <BoundaryRoute>
                  <TrafficHistoryPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/backup"
              element={
                <BoundaryRoute>
                  <BackupPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/audit-log"
              element={
                <BoundaryRoute>
                  <AuditLogPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/admins"
              element={
                <BoundaryRoute>
                  <AdminsPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/api-keys"
              element={
                <BoundaryRoute>
                  <ApiKeysPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/bot"
              element={
                <BoundaryRoute>
                  <BotPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/bot/users"
              element={
                <BoundaryRoute>
                  <BotUsersPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/bot/plans"
              element={
                <BoundaryRoute>
                  <BotPlansPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/bot/promos"
              element={
                <BoundaryRoute>
                  <BotPromosPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/bot/buttons"
              element={
                <BoundaryRoute>
                  <BotButtonsPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/bot/transactions"
              element={
                <BoundaryRoute>
                  <BotTransactionsPage />
                </BoundaryRoute>
              }
            />
            <Route
              path="/bot/broadcast"
              element={
                <BoundaryRoute>
                  <BotBroadcastPage />
                </BoundaryRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
}

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './components/AuthProvider';
import { AppShellLayout } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingPage } from './components/LoadingPage';

const LoginPage = lazy(() => import('./pages/Login'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const UsersPage = lazy(() => import('./pages/Users'));
const NodesPage = lazy(() => import('./pages/Nodes'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const IntelligencePage = lazy(() => import('./pages/Intelligence'));
const BillingPage = lazy(() => import('./pages/Billing'));
const UserBillingPage = lazy(() => import('./pages/UserBilling'));
const PluginsPage = lazy(() => import('./pages/Plugins'));
const SessionsPage = lazy(() => import('./pages/Sessions'));
const ConfigEditorPage = lazy(() => import('./pages/ConfigEditor'));
const MigrationPage = lazy(() => import('./pages/Migration'));
const SquadsPage = lazy(() => import('./pages/Squads'));
const ConfigProfilesPage = lazy(() => import('./pages/ConfigProfiles'));
const DevicesPage = lazy(() => import('./pages/Devices'));
const TrafficHistoryPage = lazy(() => import('./pages/TrafficHistory'));
const BackupPage = lazy(() => import('./pages/Backup'));
const AuditLogPage = lazy(() => import('./pages/AuditLog'));
const AdminsPage = lazy(() => import('./pages/Admins'));
const ApiKeysPage = lazy(() => import('./pages/ApiKeys'));
const BotPage = lazy(() => import('./pages/Bot'));
const BotUsersPage = lazy(() => import('./pages/BotUsers'));
const BotPlansPage = lazy(() => import('./pages/BotPlans'));
const BotPromosPage = lazy(() => import('./pages/BotPromos'));
const BotButtonsPage = lazy(() => import('./pages/BotButtons'));
const BotTransactionsPage = lazy(() => import('./pages/BotTransactions'));
const BotBroadcastPage = lazy(() => import('./pages/BotBroadcast'));
const HostsPage = lazy(() => import('./pages/Hosts'));
const SubscriptionTemplatesPage = lazy(() => import('./pages/SubscriptionTemplates'));

function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingPage />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <LazyRoute>
                <LoginPage />
              </LazyRoute>
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
                <LazyRoute>
                  <DashboardPage />
                </LazyRoute>
              }
            />
            <Route
              path="/users"
              element={
                <LazyRoute>
                  <UsersPage />
                </LazyRoute>
              }
            />
            <Route
              path="/nodes"
              element={
                <LazyRoute>
                  <NodesPage />
                </LazyRoute>
              }
            />
            <Route
              path="/squads"
              element={
                <LazyRoute>
                  <SquadsPage />
                </LazyRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <LazyRoute>
                  <SettingsPage />
                </LazyRoute>
              }
            />
            <Route
              path="/intelligence"
              element={
                <LazyRoute>
                  <IntelligencePage />
                </LazyRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <LazyRoute>
                  <BillingPage />
                </LazyRoute>
              }
            />
            <Route
              path="/user-billing"
              element={
                <LazyRoute>
                  <UserBillingPage />
                </LazyRoute>
              }
            />
            <Route
              path="/plugins"
              element={
                <LazyRoute>
                  <PluginsPage />
                </LazyRoute>
              }
            />
            <Route
              path="/sessions"
              element={
                <LazyRoute>
                  <SessionsPage />
                </LazyRoute>
              }
            />
            <Route
              path="/config-editor"
              element={
                <LazyRoute>
                  <ConfigEditorPage />
                </LazyRoute>
              }
            />
            <Route
              path="/migration"
              element={
                <LazyRoute>
                  <MigrationPage />
                </LazyRoute>
              }
            />
            <Route
              path="/config-profiles"
              element={
                <LazyRoute>
                  <ConfigProfilesPage />
                </LazyRoute>
              }
            />
            <Route
              path="/devices"
              element={
                <LazyRoute>
                  <DevicesPage />
                </LazyRoute>
              }
            />
            <Route
              path="/traffic-history"
              element={
                <LazyRoute>
                  <TrafficHistoryPage />
                </LazyRoute>
              }
            />
            <Route
              path="/backup"
              element={
                <LazyRoute>
                  <BackupPage />
                </LazyRoute>
              }
            />
            <Route
              path="/audit-log"
              element={
                <LazyRoute>
                  <AuditLogPage />
                </LazyRoute>
              }
            />
            <Route
              path="/admins"
              element={
                <LazyRoute>
                  <AdminsPage />
                </LazyRoute>
              }
            />
            <Route
              path="/api-keys"
              element={
                <LazyRoute>
                  <ApiKeysPage />
                </LazyRoute>
              }
            />
            <Route
              path="/bot"
              element={
                <LazyRoute>
                  <BotPage />
                </LazyRoute>
              }
            />
            <Route
              path="/bot/users"
              element={
                <LazyRoute>
                  <BotUsersPage />
                </LazyRoute>
              }
            />
            <Route
              path="/bot/plans"
              element={
                <LazyRoute>
                  <BotPlansPage />
                </LazyRoute>
              }
            />
            <Route
              path="/bot/promos"
              element={
                <LazyRoute>
                  <BotPromosPage />
                </LazyRoute>
              }
            />
            <Route
              path="/bot/buttons"
              element={
                <LazyRoute>
                  <BotButtonsPage />
                </LazyRoute>
              }
            />
            <Route
              path="/bot/transactions"
              element={
                <LazyRoute>
                  <BotTransactionsPage />
                </LazyRoute>
              }
            />
            <Route
              path="/bot/broadcast"
              element={
                <LazyRoute>
                  <BotBroadcastPage />
                </LazyRoute>
              }
            />
            <Route
              path="/hosts"
              element={
                <LazyRoute>
                  <HostsPage />
                </LazyRoute>
              }
            />
            <Route
              path="/subscription-templates"
              element={
                <LazyRoute>
                  <SubscriptionTemplatesPage />
                </LazyRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
}

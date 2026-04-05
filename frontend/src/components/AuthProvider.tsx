import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export type UserRole = 'superadmin' | 'admin' | 'operator' | 'readonly';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  enabled: boolean;
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  setToken: (token: string | null) => void;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  setToken: () => {},
  logout: () => {},
  isAuthenticated: false,
  hasRole: () => false,
});

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}

function decodeJwt(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadB64 = parts[1];
    if (!payloadB64) return null;
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as {
      sub?: string;
      email?: string;
      role?: UserRole;
      enabled?: boolean;
    };
    if (!payload.sub || !payload.email) return null;
    return {
      id: payload.sub,
      email: payload.email,
      role: (payload.role ?? 'admin') as UserRole,
      enabled: payload.enabled ?? true,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem('hydraflow_token'),
  );

  const setToken = useCallback((newToken: string | null) => {
    if (newToken) {
      localStorage.setItem('hydraflow_token', newToken);
    } else {
      localStorage.removeItem('hydraflow_token');
    }
    setTokenState(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hydraflow_token');
    setTokenState(null);
  }, []);

  const user = useMemo<AuthUser | null>(
    () => (token ? decodeJwt(token) : null),
    [token],
  );

  const hasRole = useCallback(
    (...roles: UserRole[]): boolean => {
      if (!user) return false;
      if (user.role === 'superadmin') return true;
      return roles.includes(user.role);
    },
    [user],
  );

  const value = useMemo(
    () => ({
      token,
      user,
      setToken,
      logout,
      isAuthenticated: !!token,
      hasRole,
    }),
    [token, user, setToken, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

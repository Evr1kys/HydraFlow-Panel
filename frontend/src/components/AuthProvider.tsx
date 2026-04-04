import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { login as apiLogin, LoginResponse } from '../api/auth';

interface AuthContextType {
  token: string | null;
  admin: { id: string; email: string } | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ token: null, admin: null, login: async () => {}, logout: () => {} });

export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('hydraflow_token'));
  const [admin, setAdmin] = useState<{ id: string; email: string } | null>(() => {
    const stored = localStorage.getItem('hydraflow_admin');
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    const data: LoginResponse = await apiLogin(email, password);
    localStorage.setItem('hydraflow_token', data.accessToken);
    localStorage.setItem('hydraflow_refresh', data.refreshToken);
    localStorage.setItem('hydraflow_admin', JSON.stringify(data.admin));
    setToken(data.accessToken);
    setAdmin(data.admin);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hydraflow_token');
    localStorage.removeItem('hydraflow_refresh');
    localStorage.removeItem('hydraflow_admin');
    setToken(null);
    setAdmin(null);
  }, []);

  return <AuthContext.Provider value={{ token, admin, login, logout }}>{children}</AuthContext.Provider>;
}

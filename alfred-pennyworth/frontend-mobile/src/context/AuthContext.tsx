import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getToken, clearSession } from '../lib/auth/tokenStore';
import { registerLogout } from './AppContext';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  onLoginSuccess: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getToken()
      .then(token => setIsAuthenticated(!!token))
      .catch(() => {/* no token readable — treat as logged out */})
      .finally(() => setIsLoading(false));
  }, []);

  const logout = async () => {
    await clearSession();
    setIsAuthenticated(false);
  };

  // Register our logout handler with AppContext so 401s trigger it
  useEffect(() => {
    registerLogout(logout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLoginSuccess = () => setIsAuthenticated(true);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, onLoginSuccess, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

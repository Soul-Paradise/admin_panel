import { createContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type User, type ApiError } from '../lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = useMemo(() => !!user, [user]);

  const checkAuth = useCallback(async () => {
    try {
      if (!api.isAuthenticated()) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      const currentUser = await api.getCurrentUser();

      // Only allow ADMIN users in the admin panel
      if (currentUser.role !== 'ADMIN') {
        api.clearTokens();
        setUser(null);
        setIsLoading(false);
        return;
      }

      setUser(currentUser);
    } catch {
      api.clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await api.login(email, password);

      // Enforce admin-only access
      if (response.user.role !== 'ADMIN') {
        api.clearTokens();
        setError('Access denied. Admin privileges required.');
        setIsLoading(false);
        return;
      }

      const fullUser = await api.getCurrentUser();
      setUser(fullUser);
      navigate('/');
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      navigate('/login');
    }
  }, [navigate]);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const value = useMemo<AuthContextType>(
    () => ({ user, isAuthenticated, isLoading, error, login, logout, clearError }),
    [user, isAuthenticated, isLoading, error, login, logout, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

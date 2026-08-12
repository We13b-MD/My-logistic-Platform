import { createContext, useContext, useState, ReactNode } from 'react';
import { AuthUser } from '@/types';
import { storage } from '@/utils/storage';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(storage.getUser());
  const [token, setToken] = useState<string | null>(storage.getToken());

  const login = (userData: AuthUser, authToken: string) => {
    storage.setUser(userData);
    storage.setToken(authToken);
    setUser(userData);
    setToken(authToken);
  };

  const logout = () => {
    storage.clear();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      isAuthenticated: !!token && !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

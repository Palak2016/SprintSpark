import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: {
    full_name: string;
    email: string;
    phone_number: string;
    password: string;
    role: 'EMPLOYEE' | 'MANAGER';
    otp_code: string;
    manager_invite_code?: string;
  }) => Promise<void>;
  logout: () => void;
  isManager: boolean;
  isEmployee: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('workpilot_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('workpilot_token');
      if (savedToken) {
        try {
          const userData = await api.getMe();
          setUser(userData);
        } catch (err) {
          console.error("Auth initialization failed:", err);
          localStorage.removeItem('workpilot_token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      localStorage.setItem('workpilot_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: {
    full_name: string;
    email: string;
    phone_number: string;
    password: string;
    role: 'EMPLOYEE' | 'MANAGER';
    otp_code: string;
    manager_invite_code?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.signup(data);
      localStorage.setItem('workpilot_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);
    } catch (err: any) {
      setError(err.message || "Failed to create account");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('workpilot_token');
    setToken(null);
    setUser(null);
  };

  const isManager = user?.role === 'MANAGER' || user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      error,
      login,
      signup,
      logout,
      isManager,
      isEmployee,
      isAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react';

import { User } from '../types';
import { api } from '../services/api';

interface SignupData {
  full_name: string;
  email: string;
  phone_number?: string;
  password: string;
  role: 'EMPLOYEE' | 'MANAGER';
  otp_code: string;
  company_name?: string;
  designation?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
  isManager: boolean;
  isEmployee: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('workpilot_token')
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore the user's session when the application loads.
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const savedToken = localStorage.getItem('workpilot_token');

      if (!savedToken) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const userData = await api.getMe();

        if (isMounted) {
          setUser(userData);
          setToken(savedToken);
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);

        localStorage.removeItem('workpilot_token');

        if (isMounted) {
          setToken(null);
          setUser(null);
          setError('Your session has expired. Please sign in again.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sign in an existing user.
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.login(email, password);

      localStorage.setItem('workpilot_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to sign in';

      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new user account.
  const signup = async (data: SignupData) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.signup(data);

      localStorage.setItem('workpilot_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create account';

      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out the current user.
  const logout = () => {
    localStorage.removeItem('workpilot_token');
    setToken(null);
    setUser(null);
    setError(null);
  };

  const isManager =
    user?.role === 'MANAGER' || user?.role === 'ADMIN';

  const isEmployee = user?.role === 'EMPLOYEE';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        login,
        signup,
        logout,
        isManager,
        isEmployee,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};


import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react';

import { User } from '../types';
import { api, SESSION_EXPIRED_EVENT } from '../services/api';
import {
  Workspace,
  allowedWorkspaces,
  canOpenWorkspace,
  homePath as resolveHomePath,
} from '../utils/workspace';

interface SignupData {
  full_name: string;
  email: string;
  phone_number?: string;
  password: string;
  role: 'ADMIN' | 'EMPLOYEE' | 'MANAGER';
  otp_code: string;
  also_manager?: boolean;
  company_name?: string;
  company_code?: string;
  invitation_token?: string;
  designation?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
  isManager: boolean;
  isEmployee: boolean;
  isAdmin: boolean;
  /** True only when the account has been approved for its company. */
  isApproved: boolean;
  /** UI hint: the user is the designated Company Admin of >= 1 company.
   * The backend enforces Company Admin authorization on every request. */
  isCompanyAdmin: boolean;
  /** Server-computed workspaces this account may open (empty if unapproved). */
  workspaces: Workspace[];
  canOpen: (workspace: Workspace) => boolean;
  /** Where this user belongs right now (login, pending page or a workspace). */
  homePath: string;
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

  // The API client reports a rejected session (expired or revoked token).
  useEffect(() => {
    const onExpired = () => {
      setToken(null);
      setUser(null);
      setError('Your session has expired. Please sign in again.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
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
  const signup = async (data: SignupData): Promise<User> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.signup(data);

      localStorage.setItem('workpilot_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);
      return res.user;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create account';

      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Re-read the signed-in user (e.g. after approval or an admin transfer).
  const refreshUser = async (): Promise<User | null> => {
    if (!localStorage.getItem('workpilot_token')) return null;
    try {
      const userData = await api.getMe();
      setUser(userData);
      return userData;
    } catch (err) {
      console.error('Could not refresh the signed-in user:', err);
      return null;
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
  // Legacy platform role; it now acts as a manager inside its own company
  // and grants no company administration (that comes from company_admins).
  const isAdmin = user?.role === 'ADMIN';
  const isApproved = user?.approval_status === 'APPROVED';
  const isCompanyAdmin = canOpenWorkspace(user, 'admin');
  const workspaces = allowedWorkspaces(user);
  const canOpen = (workspace: Workspace) => canOpenWorkspace(user, workspace);
  const homePath = resolveHomePath(user);

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
        refreshUser,
        isManager,
        isEmployee,
        isAdmin,
        isApproved,
        isCompanyAdmin,
        workspaces,
        canOpen,
        homePath,
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

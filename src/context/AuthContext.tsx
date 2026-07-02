import { createContext, useContext } from 'react';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  ministries: { ministryId: string; role: string }[];
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({ user: null, loading: true, refresh: async () => {} });

export function useAuth() {
  return useContext(AuthContext);
}
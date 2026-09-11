import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../services/supabase';
import { ensureTenantForUser, getUserTenants } from '../services/mobileData';
import type { Tenant } from '../types';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  activeTenant: Tenant | null;
  tenants: Tenant[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  refreshTenants: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const currentUser = {
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata?.name,
          avatar_url: session.user.user_metadata?.avatar_url,
        };
        setUser(currentUser);
        await loadTenantContext(currentUser);
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTenantContext = async (currentUser: User) => {
    try {
      const tenant = await ensureTenantForUser(currentUser.id, currentUser.name, currentUser.email);
      const userTenants = tenant ? await getUserTenants(currentUser.id) : [];
      setTenants(userTenants);
      setActiveTenant(tenant || userTenants[0] || null);
    } catch (error) {
      console.error('Tenant bootstrap error:', error);
      setTenants([]);
      setActiveTenant(null);
    }
  };

  const refreshTenants = async () => {
    if (!user) return;
    await loadTenantContext(user);
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      const currentUser = {
        id: data.user.id,
        email: data.user.email!,
        name: data.user.user_metadata?.name,
        avatar_url: data.user.user_metadata?.avatar_url,
      };
      setUser(currentUser);
      await loadTenantContext(currentUser);
    }
  };

  const loginWithGoogle = async () => {
    // This will be handled by the webview or redirect flow
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'alphaclone://auth/callback',
      },
    });

    if (error) throw error;
  };

  const register = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) throw error;

    if (data.user) {
      const currentUser = {
        id: data.user.id,
        email: data.user.email!,
        name: data.user.user_metadata?.name,
        avatar_url: data.user.user_metadata?.avatar_url,
      };
      setUser(currentUser);
      await loadTenantContext(currentUser);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTenants([]);
    setActiveTenant(null);
    await SecureStore.deleteItemAsync('session');
  };

  return (
    <AuthContext.Provider value={{
      user,
      activeTenant,
      tenants,
      isLoading,
      login,
      loginWithGoogle,
      logout,
      register,
      refreshTenants,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

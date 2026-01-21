'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { tenantService } from '../services/tenancy/TenantService';
import type { Tenant, SubscriptionPlan } from '../services/tenancy/types';
import { authService } from '../services/authService';
import { User } from '../types';

interface TenantContextType {
  currentTenant: Tenant | null;
  userTenants: Array<Tenant & { role: string }>;
  isLoading: boolean;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshTenants: () => Promise<void>;
  createTenant: (data: CreateTenantData) => Promise<Tenant>;
}

interface CreateTenantData {
  name: string;
  slug: string;
  plan?: SubscriptionPlan;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [userTenants, setUserTenants] = useState<Array<Tenant & { role: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load user's tenants when user logs in
  // Load user's tenants when user logs in
  useEffect(() => {
    // Subscribe to auth changes
    const { data: { subscription } } = authService.onAuthStateChange((u) => {
      setUser(u);
    });

    // Initial check
    authService.getCurrentUser().then(({ user }) => setUser(user));

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadUserTenants();
    } else {
      setCurrentTenant(null);
      setUserTenants([]);
      setIsLoading(false);
    }
  }, [user?.id]);

  const loadUserTenants = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);

      // Get all tenants user belongs to
      const tenants = await tenantService.getUserTenants(user.id);
      setUserTenants(tenants);

      if (tenants.length > 0) {
        // Try to load saved tenant from localStorage
        const savedTenantId = tenantService.getCurrentTenantId();

        // Verify user still has access to saved tenant
        const savedTenant = tenants.find(t => t.id === savedTenantId);

        if (savedTenant) {
          setCurrentTenant(savedTenant);
        } else {
          // Default to first tenant
          const firstTenant = tenants[0];
          setCurrentTenant(firstTenant);
          tenantService.setCurrentTenant(firstTenant.id);
        }
      } else {
        // User has no tenants - auto-create a default one
        console.log('No tenants found for user, creating default tenant...');

        try {
          // Generate a unique tenant name and slug
          const userName = user.name || user.email?.split('@')[0] || 'User';
          const tenantName = `${userName}'s Organization`;
          const tenantSlug = `org-${user.id.substring(0, 8)}`;

          const newTenant = await tenantService.createTenant({
            name: tenantName,
            slug: tenantSlug,
            adminUserId: user.id,
            plan: 'free'
          });

          console.log('Default tenant created:', newTenant.id);

          // Set as current tenant
          setCurrentTenant(newTenant);
          setUserTenants([{ ...newTenant, role: 'admin' }]);
          tenantService.setCurrentTenant(newTenant.id);
        } catch (error: any) {
          console.error('Failed to auto-create default tenant:', error);

          // Fallback: set to null and show error to user
          setCurrentTenant(null);
          tenantService.clearCurrentTenant();

          // Show user-friendly error message
          if (typeof window !== 'undefined') {
            alert('Unable to create your organization. Please contact support or try again later.');
          }
        }
      }
    } catch (error: any) {
      console.error('Failed to load user tenants:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
    } finally {
      setIsLoading(false);
    }
  };

  const switchTenant = async (tenantId: string) => {
    const tenant = userTenants.find(t => t.id === tenantId);

    if (!tenant) {
      throw new Error('Tenant not found or no access');
    }

    // Update context
    setCurrentTenant(tenant);

    // Persist to localStorage
    tenantService.setCurrentTenant(tenantId);

    // Clear any cached queries (if using React Query)
    // queryClient.invalidateQueries();

    // Reload the page to fetch new tenant's data
    window.location.reload();
  };

  const refreshTenants = async () => {
    if (user?.id) {
      await loadUserTenants();
    }
  };

  const createTenant = async (data: CreateTenantData): Promise<Tenant> => {
    if (!user?.id) {
      throw new Error('Must be logged in to create tenant');
    }

    const tenant = await tenantService.createTenant({
      name: data.name,
      slug: data.slug,
      adminUserId: user.id,
      plan: data.plan || 'free'
    });

    // Refresh tenant list
    await refreshTenants();

    // Switch to new tenant
    await switchTenant(tenant.id);

    return tenant;
  };

  const value: TenantContextType = {
    currentTenant,
    userTenants,
    isLoading,
    switchTenant,
    refreshTenants,
    createTenant
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);

  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }

  return context;
}

// Helper hook to get current tenant ID (throws if no tenant)
export function useCurrentTenantId(): string {
  const { currentTenant } = useTenant();

  if (!currentTenant) {
    throw new Error('No active tenant. User must create or join a tenant.');
  }

  return currentTenant.id;
}

// Helper hook to check if user has specific role in current tenant
export function useTenantRole(): string | null {
  const { currentTenant, userTenants } = useTenant();

  if (!currentTenant) return null;

  const tenant = userTenants.find(t => t.id === currentTenant.id);
  return tenant?.role || null;
}

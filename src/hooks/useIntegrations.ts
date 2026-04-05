'use client';

import { useState, useEffect, useCallback } from 'react';
import { integrationService, TenantIntegration, ConnectResult } from '../services/integrationService';
import { useTenant } from '../contexts/TenantContext';
import toast from 'react-hot-toast';

export interface UseIntegrationsReturn {
  integrations: TenantIntegration[];
  loading: boolean;
  connecting: string | null; // id of integration currently being connected
  refresh: () => Promise<void>;
  connect: (integrationId: string) => Promise<void>;
  disconnect: (integrationId: string) => Promise<void>;
  connected: TenantIntegration[];
  available: TenantIntegration[];
}

export function useIntegrations(): UseIntegrationsReturn {
  const { currentTenant } = useTenant();
  const [integrations, setIntegrations] = useState<TenantIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await integrationService.getIntegrationsForTenant(currentTenant?.id ?? '');
      setIntegrations(data);
    } catch (err) {
      console.error('[useIntegrations] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const connect = useCallback(async (integrationId: string) => {
    if (!currentTenant?.id) {
      toast.error('No active workspace found. Please refresh.');
      return;
    }
    setConnecting(integrationId);
    try {
      const result: ConnectResult = await integrationService.connect(
        currentTenant.id,
        integrationId,
        '' // userId not available here; service handles gracefully
      );

      if (!result.success) {
        toast.error(result.error ?? 'Failed to connect integration');
        return;
      }

      if (result.redirectUrl) {
        toast.success('Redirecting to authorization…');
        setTimeout(() => window.open(result.redirectUrl, '_blank'), 800);
        return;
      }

      toast.success('Integration connected successfully');
      await load();
    } finally {
      setConnecting(null);
    }
  }, [currentTenant?.id, load]);

  const disconnect = useCallback(async (integrationId: string) => {
    if (!currentTenant?.id) return;
    const toastId = toast.loading('Disconnecting…');
    try {
      const result = await integrationService.disconnect(currentTenant.id, integrationId);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to disconnect', { id: toastId });
        return;
      }
      toast.success('Integration disconnected', { id: toastId });
      await load();
    } catch {
      toast.error('Disconnect failed', { id: toastId });
    }
  }, [currentTenant?.id, load]);

  return {
    integrations,
    loading,
    connecting,
    refresh: load,
    connect,
    disconnect,
    connected: integrations.filter(i => i.status === 'connected'),
    available: integrations.filter(i => i.status !== 'connected'),
  };
}

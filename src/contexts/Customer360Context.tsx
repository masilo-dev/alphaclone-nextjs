'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { BusinessContextPanel } from '@/components/dashboard/crm/BusinessContextPanel';
import { businessClientService, type BusinessClient } from '@/services/businessClientService';
import { useTenant } from '@/contexts/TenantContext';
import { useRelationship } from '@/contexts/RelationshipContext';
import { Mail, FolderKanban, FileText, Receipt, ExternalLink, Loader2 } from 'lucide-react';

type Customer360ContextValue = {
  openCustomer: (customerId: string) => void;
  closeCustomer: () => void;
  customerId: string | null;
  isOpen: boolean;
};

const Customer360Context = createContext<Customer360ContextValue | null>(null);

export function Customer360Provider({ children }: { children: React.ReactNode }) {
  const { currentTenant } = useTenant();
  const relationship = useRelationship();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [client, setClient] = useState<BusinessClient | null>(null);
  const [loading, setLoading] = useState(false);

  const openCustomer = useCallback((id: string) => {
    if (!id) return;
    setCustomerId(id);
    setClient(null);
    setLoading(true);
    void businessClientService.getClient(id).then(({ client: row }) => setClient(row)).finally(() => setLoading(false));
  }, []);

  const closeCustomer = useCallback(() => setCustomerId(null), []);
  const value = useMemo(() => ({ openCustomer, closeCustomer, customerId, isOpen: Boolean(customerId) }), [openCustomer, closeCustomer, customerId]);

  return (
    <Customer360Context.Provider value={value}>
      {children}
      <DetailDrawer
        open={Boolean(customerId)}
        onOpenChange={(open) => { if (!open) closeCustomer(); }}
        title={client?.name || 'Customer 360'}
        description="Complete relationship context without leaving your current workspace"
        size="workspace"
      >
        <div className="min-h-full bg-[var(--ws-bg)] p-4 md:p-6">
          {loading ? (
            <div className="h-56 flex items-center justify-center text-[var(--ws-text-muted)]"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading customer…</div>
          ) : client && customerId ? (
            <div className="max-w-6xl mx-auto space-y-4">
              <header className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-surface-primary)] p-5">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <p className="type-caption uppercase tracking-wide text-[var(--brand-blue-300)]">Customer 360</p>
                    <h2 className="text-2xl font-bold text-[var(--ws-text-primary)]">{client.name}</h2>
                    <p className="type-ui text-[var(--ws-text-muted)] mt-1">{[client.email, client.phone, client.location].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className="self-start rounded-full border border-[var(--ws-border)] px-3 py-1 type-caption font-bold uppercase text-[var(--ws-text-secondary)]">{client.salesStage}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-5">
                  <a href={relationship.moduleUrl('mail', { to: client.email })} className="rounded-xl border border-[var(--ws-border)] p-3 hover:bg-[var(--ws-hover)]"><Mail className="w-4 h-4 mb-1" />Email</a>
                  <a href={relationship.moduleUrl('projects', { clientId: client.id, create: '1' })} className="rounded-xl border border-[var(--ws-border)] p-3 hover:bg-[var(--ws-hover)]"><FolderKanban className="w-4 h-4 mb-1" />Project</a>
                  <a href={relationship.moduleUrl('contracts', { clientId: client.id })} className="rounded-xl border border-[var(--ws-border)] p-3 hover:bg-[var(--ws-hover)]"><FileText className="w-4 h-4 mb-1" />Contract</a>
                  <a href={relationship.moduleUrl('billing', { clientId: client.id, create: '1' })} className="rounded-xl border border-[var(--ws-border)] p-3 hover:bg-[var(--ws-hover)]"><Receipt className="w-4 h-4 mb-1" />Invoice</a>
                  <a href={relationship.customer360Url(client.id)} className="rounded-xl border border-[var(--ws-border)] p-3 hover:bg-[var(--ws-hover)]"><ExternalLink className="w-4 h-4 mb-1" />Full CRM</a>
                </div>
              </header>
              <BusinessContextPanel tenantId={currentTenant?.id || ''} entityType="client" entityId={customerId} className="w-full" />
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-[var(--ws-text-muted)]">Customer could not be loaded.</div>
          )}
        </div>
      </DetailDrawer>
    </Customer360Context.Provider>
  );
}

export function useCustomer360() {
  const context = useContext(Customer360Context);
  if (!context) throw new Error('useCustomer360 must be used inside Customer360Provider');
  return context;
}

'use client';

import React, { useState } from 'react';
import { RefreshCw, Download, Upload, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTenant } from '@/contexts/TenantContext';
import { UnifiedCRMService } from '@/services/crm/UnifiedCRMService';

export function CrmSyncToolbar({ className = '' }: { className?: string }) {
  const { currentTenant } = useTenant();
  const [pulling, setPulling] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const handlePull = async () => {
    setPulling(true);
    try {
      const result = await UnifiedCRMService.pullDeals();
      if (result?.success) {
        toast.success(`CRM pull complete (${result.syncedCount ?? 0} records)`);
      } else {
        toast.error(result?.error || 'CRM pull failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'CRM pull failed');
    } finally {
      setPulling(false);
    }
  };

  const handleMigrate = async () => {
    if (!currentTenant?.id) return;
    if (!confirm('Sync all legacy leads/deals into unified accounts & opportunities?')) return;
    setMigrating(true);
    try {
      const res = await fetch('/api/crm/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantId: currentTenant.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Migration failed');
      toast.success('Unified CRM migration completed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  const handleReconcile = async () => {
    if (!currentTenant?.id) return;
    if (!confirm('Link all deals, leads, and clients to unified accounts & opportunities?')) return;
    setReconciling(true);
    try {
      const res = await fetch('/api/crm/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantId: currentTenant.id, action: 'reconcile' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reconcile failed');
      toast.success(
        `Reconciled: ${data.dealsSynced ?? 0} deals, ${data.leadsSynced ?? 0} leads, ${data.clientsSynced ?? 0} clients`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reconcile failed');
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => void handlePull()}
        disabled={pulling}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-slate-900 text-xs font-bold text-slate-300 hover:text-white disabled:opacity-50"
      >
        <Download className={`w-3.5 h-3.5 ${pulling ? 'animate-pulse' : ''}`} />
        {pulling ? 'Pulling…' : 'Pull external CRM'}
      </button>
      <button
        type="button"
        onClick={() => void handleMigrate()}
        disabled={migrating || !currentTenant?.id}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-teal-500/30 bg-teal-500/10 text-xs font-bold text-teal-300 hover:text-teal-200 disabled:opacity-50"
      >
        <Database className={`w-3.5 h-3.5 ${migrating ? 'animate-pulse' : ''}`} />
        {migrating ? 'Syncing…' : 'Unify CRM data'}
      </button>
      <button
        type="button"
        onClick={() => void handleReconcile()}
        disabled={reconciling || !currentTenant?.id}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-xs font-bold text-indigo-300 hover:text-indigo-200 disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${reconciling ? 'animate-spin' : ''}`} />
        {reconciling ? 'Reconciling…' : 'Reconcile links'}
      </button>
      <a
        href="/dashboard/crm/follow-ups"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-slate-900 text-xs font-bold text-slate-300 hover:text-white"
      >
        <Upload className="w-3.5 h-3.5" />
        Follow-up queue
      </a>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-slate-900 text-xs font-bold text-slate-300 hover:text-white"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Refresh
      </button>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import { X, Mail, FileText, DollarSign, MessageSquare, Clock, Loader2 } from 'lucide-react';

type ActivityItem = {
  id: string;
  type: 'email' | 'deal' | 'invoice' | 'note';
  title: string;
  detail: string;
  date: string;
};

interface ContactActivityTimelineProps {
  contactId: string;
  contactEmail?: string;
  contactName: string;
  onClose: () => void;
}

const TYPE_CONFIG = {
  email: { icon: Mail, color: 'text-[var(--ac-bonnie)]', bg: 'bg-[color-mix(in_srgb,var(--ac-bonnie)_12%,transparent)]', label: 'Email' },
  deal: { icon: DollarSign, color: 'text-[var(--brand-teal)]', bg: 'bg-[color-mix(in_srgb,var(--brand-teal)_12%,transparent)]', label: 'Deal' },
  invoice: { icon: FileText, color: 'text-[var(--warning)]', bg: 'bg-[color-mix(in_srgb,var(--warning)_12%,transparent)]', label: 'Invoice' },
  note: { icon: MessageSquare, color: 'text-[var(--ws-text-secondary)]', bg: 'bg-[var(--ws-surface-secondary)]', label: 'Note' },
};

export function ContactActivityTimeline({ contactId, contactEmail, contactName, onClose }: ContactActivityTimelineProps) {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!currentTenant) return;
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant, contactId]);

  async function load() {
    if (!currentTenant) return;
    setLoading(true);
    const items: ActivityItem[] = [];
    try {
      const { data: deals } = await supabase
        .from('deals')
        .select('id, name, stage, value, created_at, updated_at')
        .eq('tenant_id', currentTenant.id)
        .eq('contact_id', contactId)
        .limit(20);

      for (const d of deals || []) {
        items.push({
          id: `deal-${d.id}`,
          type: 'deal',
          title: `Deal: ${d.name}`,
          detail: `$${Number(d.value).toLocaleString()} · ${String(d.stage).replace(/_/g, ' ')}`,
          date: d.updated_at || d.created_at,
        });
      }

      if (contactEmail) {
        const { data: clientRow } = await supabase
          .from('business_clients')
          .select('id')
          .eq('tenant_id', currentTenant.id)
          .ilike('email', contactEmail)
          .maybeSingle();

        const invoiceQuery = supabase
          .from('business_invoices')
          .select('id, invoice_number, total, status, lifecycle_status, created_at')
          .eq('tenant_id', currentTenant.id)
          .order('created_at', { ascending: false })
          .limit(20);

        const { data: invoices } = clientRow?.id
          ? await invoiceQuery.eq('client_id', clientRow.id)
          : await invoiceQuery.ilike('client_email', contactEmail);

        for (const inv of invoices || []) {
          items.push({
            id: `inv-${inv.id}`,
            type: 'invoice',
            title: `Invoice #${inv.invoice_number || inv.id.slice(0, 8)}`,
            detail: `$${Number(inv.total).toLocaleString()} · ${String(inv.status || inv.lifecycle_status || 'draft').replace(/_/g, ' ')}`,
            date: inv.created_at,
          });
        }

        const { data: logs } = await supabase
          .from('lead_audit_logs')
          .select('id, action, details, created_at')
          .eq('tenant_id', currentTenant.id)
          .ilike('details', `%${contactEmail}%`)
          .order('created_at', { ascending: false })
          .limit(20);

        for (const log of logs || []) {
          items.push({
            id: `log-${log.id}`,
            type: 'email',
            title: String(log.action || 'Activity').replace(/_/g, ' '),
            detail: typeof log.details === 'string' ? log.details.slice(0, 80) : '',
            date: log.created_at,
          });
        }
      }

      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(items);
    } catch (err) {
      console.error('[ContactActivityTimeline]', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside
      data-sheet
      data-side="right"
      data-state="open"
      aria-label={`${contactName} activity timeline`}
      className="fixed inset-y-0 right-0 z-[1110] flex w-full max-w-sm flex-col border-l border-[var(--ws-border)] bg-[color-mix(in_srgb,var(--ws-panel)_94%,transparent)] shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-[var(--ws-border)] bg-[color-mix(in_srgb,var(--ws-toolbar)_92%,transparent)] px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ws-text-tertiary)]">Activity Timeline</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-[var(--ws-text-primary)]">{contactName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close activity timeline"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--ws-radius-control,8px)] text-[var(--ws-text-secondary)] transition-colors hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="ios-scroll flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16" role="status" aria-label="Loading contact activity">
            <Loader2 className="animate-spin text-[var(--brand-teal)]" size={28} aria-hidden="true" />
          </div>
        ) : activities.length === 0 ? (
          <div className="py-16 text-center">
            <Clock className="mx-auto mb-3 text-[var(--ws-text-tertiary)]" size={36} aria-hidden="true" />
            <p className="font-semibold text-[var(--ws-text-secondary)]">No activity yet</p>
            <p className="mt-1 text-xs leading-5 text-[var(--ws-text-tertiary)]">Deals, emails, and invoices linked to this contact will appear here.</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute bottom-2 left-5 top-2 w-px bg-[var(--ws-border)]" />
            <div className="space-y-4">
              {activities.map(activity => {
                const cfg = TYPE_CONFIG[activity.type];
                const Icon = cfg.icon;
                return (
                  <div key={activity.id} className="relative flex items-start gap-3 pl-2">
                    <div className={`z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ws-radius-control,8px)] ${cfg.bg}`}>
                      <Icon size={14} className={cfg.color} aria-hidden="true" />
                    </div>
                    <div className="ac-workspace-panel min-w-0 flex-1 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold capitalize text-[var(--ws-text-primary)]">{activity.title}</p>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      {activity.detail ? (
                        <p className="mt-0.5 truncate text-[11px] text-[var(--ws-text-secondary)]">{activity.detail}</p>
                      ) : null}
                      <p className="mt-1 text-[10px] text-[var(--ws-text-tertiary)]">
                        {new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

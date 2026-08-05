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
  email: { icon: Mail, color: 'text-indigo-400', bg: 'bg-indigo-500/10', label: 'Email' },
  deal: { icon: DollarSign, color: 'text-teal-400', bg: 'bg-teal-500/10', label: 'Deal' },
  invoice: { icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Invoice' },
  note: { icon: MessageSquare, color: 'text-slate-400', bg: 'bg-white/5', label: 'Note' },
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
      // Deals linked to contact
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

      // Invoices linked by email
      if (contactEmail) {
        const { data: invoices } = await supabase
          .from('invoices')
          .select('id, invoice_number, total_amount, lifecycle_status, created_at')
          .eq('tenant_id', currentTenant.id)
          .ilike('client_email', contactEmail)
          .limit(20);

        for (const inv of invoices || []) {
          items.push({
            id: `inv-${inv.id}`,
            type: 'invoice',
            title: `Invoice #${inv.invoice_number || inv.id.slice(0, 8)}`,
            detail: `$${Number(inv.total_amount).toLocaleString()} · ${String(inv.lifecycle_status || 'draft').replace(/_/g, ' ')}`,
            date: inv.created_at,
          });
        }

        // Emails sent (lead_audit_logs or communications)
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

      // Sort by date descending
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(items);
    } catch (err) {
      console.error('[ContactActivityTimeline]', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-sm bg-[var(--ws-panel,#0f172a)] border-l border-white/10 shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[var(--ws-toolbar,#1e293b)]">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Activity Timeline</p>
          <p className="text-sm font-bold text-white truncate mt-0.5">{contactName}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="text-teal-400 animate-spin" size={28} />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="text-slate-600 mx-auto mb-3" size={36} />
            <p className="text-slate-400 font-semibold">No activity yet</p>
            <p className="text-slate-500 text-xs mt-1">Deals, emails, and invoices linked to this contact will appear here.</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-5 top-2 bottom-2 w-px bg-white/5" />
            <div className="space-y-4">
              {activities.map(activity => {
                const cfg = TYPE_CONFIG[activity.type];
                const Icon = cfg.icon;
                return (
                  <div key={activity.id} className="relative flex items-start gap-3 pl-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg} z-10 mt-0.5`}>
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0 ac-workspace-panel rounded-xl px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-white capitalize truncate">{activity.title}</p>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color} shrink-0`}>
                          {cfg.label}
                        </span>
                      </div>
                      {activity.detail && (
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{activity.detail}</p>
                      )}
                      <p className="text-[10px] text-slate-600 mt-1">
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
    </div>
  );
}

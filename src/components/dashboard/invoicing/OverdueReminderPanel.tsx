'use client';

import React, { useState, useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { Bell, Mail, MessageCircle, CheckCircle2, Send, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

type OverdueItem = {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  total_amount: number;
  due_date: string;
  daysOverdue: number;
  lastReminderSent: string | null;
};

export function OverdueReminderPanel() {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OverdueItem[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTenant) return;
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant]);

  async function load() {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/invoices?tenantId=${encodeURIComponent(currentTenant.id)}&status=overdue,sent&limit=100`,
        { credentials: 'include' }
      );
      const payload = await res.json().catch(() => ({}));
      const raw: any[] = payload.invoices || payload.data || [];
      const today = new Date();
      const parsed: OverdueItem[] = raw
        .filter(inv => inv.due_date && inv.lifecycle_status !== 'paid' && inv.lifecycle_status !== 'void')
        .map(inv => {
          const dueDate = new Date(inv.due_date);
          const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000));
          return {
            id: inv.id,
            invoice_number: inv.invoice_number || 'N/A',
            client_name: inv.client_name || 'Unknown',
            client_email: inv.client_email || inv.contact_email || '',
            total_amount: Number(inv.total_amount || 0),
            due_date: inv.due_date,
            daysOverdue,
            lastReminderSent: inv.last_reminder_sent || null,
          };
        })
        .sort((a, b) => b.daysOverdue - a.daysOverdue);
      setItems(parsed);
    } catch (err) {
      console.error('[OverdueReminderPanel]', err);
    } finally {
      setLoading(false);
    }
  }

  async function sendReminder(item: OverdueItem, channel: 'email' | 'whatsapp') {
    setSending(item.id + channel);
    try {
      if (channel === 'email') {
        const res = await fetch('/api/send-email', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: item.client_email,
            subject: `Payment Reminder – Invoice #${item.invoice_number} (${item.daysOverdue} days overdue)`,
            html: `<p>Dear ${item.client_name},</p><p>Your invoice <strong>#${item.invoice_number}</strong> for <strong>$${item.total_amount.toLocaleString()}</strong> was due on ${new Date(item.due_date).toLocaleDateString()} and is now <strong>${item.daysOverdue} days overdue</strong>.</p><p>Please arrange payment at your earliest convenience.</p>`,
            tenantId: currentTenant?.id,
          }),
        });
        if (!res.ok) throw new Error('Email send failed');
        toast.success(`Reminder sent to ${item.client_email}`);
      } else {
        toast('WhatsApp reminder — connect your WhatsApp integration to send.', { icon: '💬' });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send reminder');
    } finally {
      setSending(null);
    }
  }

  const severityColor = (days: number) =>
    days > 90 ? 'text-red-400' : days > 60 ? 'text-rose-400' : days > 30 ? 'text-orange-400' : 'text-amber-400';

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Bell className="text-orange-400" size={20} /> Overdue Reminders
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Send email or WhatsApp nudges to overdue clients</p>
        </div>
        <button onClick={load} className="text-xs text-slate-400 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 ac-workspace-panel rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="ac-workspace-panel rounded-xl p-10 text-center">
          <CheckCircle2 className="text-emerald-400 mx-auto mb-3" size={36} />
          <p className="text-slate-300 font-semibold">No overdue invoices!</p>
          <p className="text-slate-500 text-sm mt-1">All accounts are current.</p>
        </div>
      ) : (
        <div className="ac-workspace-panel rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 bg-[var(--ws-toolbar)]">
            <p className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
              <AlertTriangle size={14} className="text-orange-400" />
              {items.length} clients need a reminder
            </p>
          </div>
          <div className="divide-y divide-white/5">
            {items.map(item => (
              <div key={item.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-white/[0.02] transition-all">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white truncate">{item.client_name}</p>
                    <span className={`text-[10px] font-black uppercase ${severityColor(item.daysOverdue)}`}>
                      {item.daysOverdue}d overdue
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Invoice #{item.invoice_number} · ${item.total_amount.toLocaleString()} · Due {new Date(item.due_date).toLocaleDateString()}
                  </p>
                  {item.lastReminderSent && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Last reminder: {new Date(item.lastReminderSent).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => sendReminder(item, 'email')}
                    disabled={sending === item.id + 'email' || !item.client_email}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-bold hover:bg-indigo-500/25 disabled:opacity-40 transition-all"
                  >
                    <Mail size={13} />
                    {sending === item.id + 'email' ? 'Sending...' : 'Email'}
                  </button>
                  <button
                    onClick={() => sendReminder(item, 'whatsapp')}
                    disabled={sending === item.id + 'whatsapp'}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold hover:bg-emerald-500/25 disabled:opacity-40 transition-all"
                  >
                    <MessageCircle size={13} />
                    WhatsApp
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

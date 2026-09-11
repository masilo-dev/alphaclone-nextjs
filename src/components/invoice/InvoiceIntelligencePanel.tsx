'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Eye, EyeOff, Shield, Clock, Download, Bell, BellOff,
  Send, CheckCircle2, AlertTriangle, Loader2, FileText, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import InvoiceStatusPipeline, { InvoiceStatus } from './InvoiceStatusPipeline';
import toast from 'react-hot-toast';

interface AuditEvent {
  id: string;
  event_type: string;
  event_data: Record<string, any>;
  performed_by: string;
  created_at: string;
}

interface InvoiceIntelligencePanelProps {
  invoice: any; // full invoice object
  tenantId: string;
  onRefresh?: () => void;
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  created: FileText,
  sent: Send,
  viewed: Eye,
  payment_received: CheckCircle2,
  status_changed: RefreshCw,
  reminder_sent: Bell,
  dispute_raised: AlertTriangle,
  voided: EyeOff,
  delivery_confirmed: CheckCircle2,
  delivery_bounced: AlertTriangle,
  delivery_opened: Eye,
  default: Clock,
};

const EVENT_COLORS: Record<string, string> = {
  created: 'text-slate-400',
  sent: 'text-blue-400',
  viewed: 'text-violet-400',
  payment_received: 'text-teal-400',
  status_changed: 'text-amber-400',
  reminder_sent: 'text-orange-400',
  dispute_raised: 'text-red-400',
  voided: 'text-slate-500',
  delivery_confirmed: 'text-teal-400',
  delivery_bounced: 'text-red-400',
  delivery_opened: 'text-blue-400',
  default: 'text-slate-400',
};

const DELIVERY_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  DELIVERED: { label: 'Delivered', color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/30' },
  BOUNCED: { label: 'Bounced', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  OPENED: { label: 'Opened', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
};

function formatRelativeTime(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  } catch {
    return ts;
  }
}

function formatEventLabel(eventType: string): string {
  return eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function InvoiceIntelligencePanel({
  invoice,
  tenantId,
  onRefresh,
}: InvoiceIntelligencePanelProps) {
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [togglingFollowup, setTogglingFollowup] = useState(false);
  const [autoFollowup, setAutoFollowup] = useState<boolean>(
    invoice?.auto_followup_enabled !== false
  );

  const loadAuditLog = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/audit-log?tenantId=${tenantId}`);
      if (res.ok) {
        const json = await res.json();
        setAuditLog(json.data ?? []);
      }
    } catch (e) {
      console.error('Failed to load audit log:', e);
    } finally {
      setLoadingAudit(false);
    }
  }, [invoice.id, tenantId]);

  useEffect(() => {
    if (invoice?.id) loadAuditLog();
  }, [invoice?.id, loadAuditLog]);

  const handleDownloadCertificate = async () => {
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/delivery-certificate?tenantId=${tenantId}`);
      if (!res.ok) throw new Error('Failed to generate certificate');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Delivery_Certificate_${invoice.invoice_number || invoice.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Delivery certificate downloaded');
    } catch (e: any) {
      toast.error(e.message || 'Failed to download certificate');
    }
  };

  const handleSendReminder = async () => {
    setSendingReminder(true);
    try {
      const res = await fetch(`/api/invoices/reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, invoiceId: invoice.id }),
      });
      if (!res.ok) throw new Error('Failed to send reminder');
      toast.success('Reminder sent successfully');
      await loadAuditLog();
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed to send reminder');
    } finally {
      setSendingReminder(false);
    }
  };

  const handleToggleFollowup = async () => {
    setTogglingFollowup(true);
    const newVal = !autoFollowup;
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/followup-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, autoFollowupEnabled: newVal }),
      });
      if (!res.ok) throw new Error('Failed to update setting');
      setAutoFollowup(newVal);
      toast.success(newVal ? 'Auto follow-up enabled' : 'Auto follow-up disabled');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update setting');
    } finally {
      setTogglingFollowup(false);
    }
  };

  const deliveryStatus = invoice?.delivery_status || 'PENDING';
  const deliveryCfg = DELIVERY_STATUS_CONFIG[deliveryStatus] || DELIVERY_STATUS_CONFIG.PENDING;
  const viewedAt = invoice?.viewed_at;
  const viewCount = invoice?.view_count ?? 0;
  const sentAt = invoice?.sent_at;

  return (
    <div className="space-y-5 text-sm">
      {/* Status Pipeline */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Invoice Lifecycle</p>
        <InvoiceStatusPipeline
          status={(invoice?.status || 'draft') as InvoiceStatus}
          timestamps={{
            created_at: invoice?.created_at,
            sent_at: invoice?.sent_at,
            viewed_at: invoice?.viewed_at,
            paid_at: invoice?.paid_at,
            disputed_at: invoice?.disputed_at,
          }}
        />
      </div>

      {/* Read Receipt Card */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Read Receipt</p>
        {viewedAt ? (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-violet-500/10 border border-violet-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Eye className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="font-semibold text-violet-300">Client opened invoice</p>
              <p className="text-slate-500 text-xs">{formatRelativeTime(viewedAt)}</p>
              {viewCount > 1 && (
                <p className="text-slate-600 text-xs mt-0.5">Viewed {viewCount} times total</p>
              )}
            </div>
          </div>
        ) : sentAt ? (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <EyeOff className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-amber-300">Not yet opened</p>
              <p className="text-slate-500 text-xs">Sent {formatRelativeTime(sentAt)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-600">
            <EyeOff className="w-4 h-4" />
            <span>Invoice not sent yet</span>
          </div>
        )}
      </div>

      {/* Delivery Status */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Email Delivery</p>
        <div className="flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0', deliveryCfg.bg)}>
            <Shield className={cn('w-4 h-4', deliveryCfg.color)} />
          </div>
          <div>
            <span className={cn('font-bold', deliveryCfg.color)}>{deliveryCfg.label}</span>
            {sentAt && <p className="text-slate-500 text-xs">Sent {formatRelativeTime(sentAt)}</p>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Actions</p>

        <button
          onClick={handleDownloadCertificate}
          className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors text-slate-300 hover:text-white"
        >
          <Download className="w-4 h-4 text-teal-400 flex-shrink-0" />
          <span className="text-sm font-medium">Download Delivery Certificate</span>
        </button>

        {['sent', 'viewed', 'overdue'].includes(invoice?.status) && (
          <button
            onClick={handleSendReminder}
            disabled={sendingReminder}
            className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors text-slate-300 hover:text-white disabled:opacity-50"
          >
            {sendingReminder ? (
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 text-orange-400" />
            ) : (
              <Send className="w-4 h-4 text-orange-400 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">Send Manual Reminder</span>
          </button>
        )}

        <button
          onClick={handleToggleFollowup}
          disabled={togglingFollowup}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 border rounded-xl transition-colors disabled:opacity-50',
            autoFollowup
              ? 'bg-teal-500/10 border-teal-500/30 text-teal-300 hover:bg-teal-500/20'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          )}
        >
          {togglingFollowup ? (
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          ) : autoFollowup ? (
            <Bell className="w-4 h-4 flex-shrink-0" />
          ) : (
            <BellOff className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">
            {autoFollowup ? 'Auto Follow-Up: On' : 'Auto Follow-Up: Off'}
          </span>
        </button>
      </div>

      {/* Audit Timeline */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Activity Timeline</p>
          <button
            onClick={loadAuditLog}
            className="p-1 text-slate-600 hover:text-slate-400 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {loadingAudit ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
          </div>
        ) : auditLog.length === 0 ? (
          <p className="text-slate-600 text-xs text-center py-4">No events yet</p>
        ) : (
          <div className="space-y-0 relative">
            <div className="absolute left-4 top-4 bottom-4 w-px bg-slate-800" />
            <AnimatePresence>
              {[...auditLog].reverse().map((event, idx) => {
                const Icon = EVENT_ICONS[event.event_type] || EVENT_ICONS.default;
                const color = EVENT_COLORS[event.event_type] || EVENT_COLORS.default;
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-start gap-4 py-3 relative"
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center flex-shrink-0 relative z-10',
                    )}>
                      <Icon className={cn('w-3.5 h-3.5', color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-300 text-xs leading-tight">
                        {formatEventLabel(event.event_type)}
                      </p>
                      {event.event_data?.status_changed_to && (
                        <p className="text-xs text-slate-600">
                          → {event.event_data.status_changed_to}
                        </p>
                      )}
                      {event.event_data?.source && (
                        <p className="text-xs text-slate-600 capitalize">{event.event_data.source.replace('_', ' ')}</p>
                      )}
                      <p className="text-slate-600 text-[10px] mt-0.5">{formatRelativeTime(event.created_at)}</p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

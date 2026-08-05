'use client';

import React, { useState, useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, Calendar, RefreshCw, CheckCircle2, Bell, ExternalLink } from 'lucide-react';

type ContractAlert = {
  id: string;
  title: string;
  client_name: string;
  end_date: string;
  daysUntilExpiry: number;
  urgency: 'critical' | 'warning' | 'notice';
};

const URGENCY_CONFIG = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Expires Soon', days: 30 },
  warning: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Renew Soon', days: 60 },
  notice: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Upcoming Renewal', days: 90 },
};

interface ContractRenewalAlertsPanelProps {
  onOpenContract?: (id: string) => void;
}

export function ContractRenewalAlertsPanel({ onOpenContract }: ContractRenewalAlertsPanelProps) {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<ContractAlert[]>([]);

  useEffect(() => {
    if (!currentTenant) return;
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant]);

  async function load() {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const today = new Date();
      const ninetyDaysOut = new Date(today);
      ninetyDaysOut.setDate(today.getDate() + 90);

      const { data: contracts, error } = await supabase
        .from('contracts')
        .select('id, title, client_name, end_date, status')
        .eq('tenant_id', currentTenant.id)
        .in('status', ['active', 'signed', 'executed'])
        .not('end_date', 'is', null)
        .gte('end_date', today.toISOString().split('T')[0])
        .lte('end_date', ninetyDaysOut.toISOString().split('T')[0])
        .order('end_date', { ascending: true });

      if (error) throw error;

      const parsed: ContractAlert[] = (contracts || []).map((c: any) => {
        const endDate = new Date(c.end_date);
        const daysUntilExpiry = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / 86_400_000));
        const urgency: ContractAlert['urgency'] =
          daysUntilExpiry <= 30 ? 'critical' : daysUntilExpiry <= 60 ? 'warning' : 'notice';
        return {
          id: c.id,
          title: c.title,
          client_name: c.client_name || 'Unknown Client',
          end_date: c.end_date,
          daysUntilExpiry,
          urgency,
        };
      });

      setAlerts(parsed);
    } catch (err) {
      console.error('[ContractRenewalAlertsPanel]', err);
    } finally {
      setLoading(false);
    }
  }

  const grouped = {
    critical: alerts.filter(a => a.urgency === 'critical'),
    warning: alerts.filter(a => a.urgency === 'warning'),
    notice: alerts.filter(a => a.urgency === 'notice'),
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Bell className="text-amber-400" size={20} /> Contract Renewal Alerts
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Active contracts expiring within 90 days</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 ac-workspace-panel rounded-xl animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="ac-workspace-panel rounded-xl p-10 text-center">
          <CheckCircle2 className="text-emerald-400 mx-auto mb-3" size={36} />
          <p className="text-slate-300 font-semibold">No contracts expiring within 90 days</p>
          <p className="text-slate-500 text-sm mt-1">All active contracts have sufficient time remaining.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(['critical', 'warning', 'notice'] as const).map(urgency => {
            const group = grouped[urgency];
            if (!group.length) return null;
            const cfg = URGENCY_CONFIG[urgency];
            return (
              <div key={urgency}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} className={cfg.color} />
                  <span className={`text-xs font-black uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-xs text-slate-600">({group.length})</span>
                </div>
                <div className="space-y-2">
                  {group.map(alert => (
                    <div
                      key={alert.id}
                      className={`flex items-center justify-between gap-4 px-5 py-4 rounded-xl border ${cfg.bg} ${cfg.border} transition-all`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                          <Calendar size={16} className={cfg.color} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{alert.title}</p>
                          <p className="text-xs text-slate-400">{alert.client_name} · Expires {new Date(alert.end_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className={`text-lg font-black ${cfg.color}`}>{alert.daysUntilExpiry}</p>
                          <p className="text-[10px] text-slate-500">days left</p>
                        </div>
                        {onOpenContract && (
                          <button
                            onClick={() => onOpenContract(alert.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-all"
                          >
                            <ExternalLink size={12} /> Renew
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

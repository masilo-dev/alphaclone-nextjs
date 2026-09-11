'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { StandardStatCard, type CardTheme } from '@/components/ui/design-system';

export default function DeliverabilityPanel() {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sent: 0, bounced: 0, unsubscribed: 0, suppressed: 0 });

  useEffect(() => {
    if (!currentTenant?.id) return;
    (async () => {
      setLoading(true);
      const [{ data: campaigns }, { count: suppressed }] = await Promise.all([
        supabase
          .from('email_campaigns')
          .select('total_sent, total_bounced, total_unsubscribed')
          .eq('tenant_id', currentTenant.id),
        supabase
          .from('email_suppressions')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id),
      ]);
      const rows = campaigns || [];
      setStats({
        sent: rows.reduce((s: number, c: { total_sent?: number }) => s + (c.total_sent || 0), 0),
        bounced: rows.reduce((s: number, c: { total_bounced?: number }) => s + (c.total_bounced || 0), 0),
        unsubscribed: rows.reduce((s: number, c: { total_unsubscribed?: number }) => s + (c.total_unsubscribed || 0), 0),
        suppressed: suppressed ?? 0,
      });
      setLoading(false);
    })();
  }, [currentTenant?.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
      </div>
    );
  }

  const bounceRate = stats.sent ? ((stats.bounced / stats.sent) * 100).toFixed(2) : '0.00';

  return (
    <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-teal-400" />
        <h3 className="text-sm font-bold text-white">Deliverability</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total sent', value: stats.sent, theme: 'teal' as CardTheme },
          { label: 'Bounce rate', value: `${bounceRate}%`, theme: 'rose' as CardTheme },
          { label: 'Unsubscribes', value: stats.unsubscribed, theme: 'orange' as CardTheme },
          { label: 'Suppressed', value: stats.suppressed, theme: 'purple' as CardTheme },
        ].map((s) => (
          <StandardStatCard
            key={s.label}
            label={s.label}
            value={s.value}
            themeColor={s.theme}
            interactive={false}
          />
        ))}
      </div>
      {Number(bounceRate) > 2 && (
        <p className="text-xs text-amber-400">Bounce rate above 2% — review list hygiene and sender domain.</p>
      )}
    </div>
  );
}

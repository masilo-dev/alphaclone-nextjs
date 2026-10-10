'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { PlatformKpiGrid } from '@/components/dashboard/metrics';
import { platformKpiFromNumbers } from '@/lib/metrics/metricPresentation';

export default function DeliverabilityPanel() {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sent: 0, bounced: 0, unsubscribed: 0, suppressed: 0 });

  useEffect(() => {
    if (!currentTenant?.id) return;
    (async () => {
      setLoading(true);
      const [{ data: campaigns }, { data: outreachEvents }, { count: suppressed }] = await Promise.all([
        supabase
          .from('email_campaigns')
          .select('total_sent, total_bounced, total_unsubscribed')
          .eq('tenant_id', currentTenant.id),
        supabase
          .from('outreach_events')
          .select('event_type')
          .eq('tenant_id', currentTenant.id)
          .in('event_type', ['sent', 'delivered', 'bounced', 'unsubscribed']),
        supabase
          .from('email_suppressions')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id),
      ]);
      const campaignRows = campaigns || [];
      const outreachRows = outreachEvents || [];
      const campaignSent = campaignRows.reduce((s: number, c: { total_sent?: number }) => s + (c.total_sent || 0), 0);
      const campaignBounced = campaignRows.reduce((s: number, c: { total_bounced?: number }) => s + (c.total_bounced || 0), 0);
      const campaignUnsub = campaignRows.reduce((s: number, c: { total_unsubscribed?: number }) => s + (c.total_unsubscribed || 0), 0);

      const outreachSent = outreachRows.filter((r: { event_type?: string }) => r.event_type === 'sent' || r.event_type === 'delivered').length;
      const outreachBounced = outreachRows.filter((r: { event_type?: string }) => r.event_type === 'bounced').length;
      const outreachUnsub = outreachRows.filter((r: { event_type?: string }) => r.event_type === 'unsubscribed').length;

      setStats({
        sent: campaignSent + outreachSent,
        bounced: campaignBounced + outreachBounced,
        unsubscribed: campaignUnsub + outreachUnsub,
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

  const bounceRate = stats.sent ? ((stats.bounced / stats.sent) * 100) : 0;

  const kpiItems = [
    platformKpiFromNumbers({ label: 'Total sent', current: stats.sent }),
    platformKpiFromNumbers({
      label: 'Bounce rate',
      current: bounceRate,
      isPercentage: true,
      isBetterHigher: false,
    }),
    platformKpiFromNumbers({
      label: 'Unsubscribes',
      current: stats.unsubscribed,
      isBetterHigher: false,
    }),
    platformKpiFromNumbers({
      label: 'Suppressed',
      current: stats.suppressed,
      isBetterHigher: false,
    }),
  ];

  return (
    <div className="bg-[var(--ws-panel)] border border-[var(--ws-border)] rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-teal-400" />
        <h3 className="type-ui font-bold text-[var(--ws-text-primary)]">Deliverability</h3>
      </div>
      <PlatformKpiGrid items={kpiItems} skeletonCount={4} />
      {bounceRate > 2 && (
        <p className="type-card-description text-amber-400">Bounce rate above 2% — review list hygiene and sender domain.</p>
      )}
    </div>
  );
}

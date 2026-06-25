'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  emailCampaignService,
  type EmailCampaign,
  type CampaignRecipient,
} from '@/services/emailCampaignService';

interface EmailCampaignAnalyticsProps {
  campaign: EmailCampaign;
  onClose?: () => void;
  embedded?: boolean;
}

const EmailCampaignAnalytics: React.FC<EmailCampaignAnalyticsProps> = ({
  campaign,
  onClose,
  embedded = false,
}) => {
  const [rates, setRates] = useState<{
    openRate: number;
    clickRate: number;
    bounceRate: number;
    unsubscribeRate: number;
  } | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [aRes, rRes] = await Promise.all([
        emailCampaignService.getCampaignAnalytics(campaign.id),
        emailCampaignService.getCampaignRecipients(campaign.id),
      ]);
      if (aRes.analytics) setRates(aRes.analytics);
      if (!rRes.error) setRecipients(rRes.recipients);
      setLoading(false);
    };
    load();
  }, [campaign.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
      </div>
    );
  }

  const statusCounts = {
    bounced: recipients.filter((r) => r.status === 'bounced').length,
    failed: recipients.filter((r) => r.status === 'failed').length,
  };

  const abMeta = (campaign.metadata as Record<string, unknown>)?.abTest as Record<string, unknown> | undefined;
  const abEnabled = abMeta?.enabled === true;
  const variantStats = abEnabled
    ? {
        A: { sent: 0, opened: 0, clicked: 0 },
        B: { sent: 0, opened: 0, clicked: 0 },
      }
    : null;

  if (variantStats) {
    for (const r of recipients) {
      const variant = String((r.metadata as Record<string, unknown>)?.abVariant || 'A');
      const bucket = variant === 'B' ? variantStats.B : variantStats.A;
      if (['sent', 'delivered', 'opened', 'clicked'].includes(r.status)) bucket.sent += 1;
      if (['opened', 'clicked'].includes(r.status)) bucket.opened += 1;
      if (r.status === 'clicked') bucket.clicked += 1;
    }
  }

  const statCards = [
    { label: 'Sent', value: campaign.totalSent, color: 'text-teal-400' },
    { label: 'Delivered', value: campaign.totalDelivered, color: 'text-cyan-400' },
    { label: 'Opened', value: campaign.totalOpened, color: 'text-violet-400' },
    { label: 'Clicked', value: campaign.totalClicked, color: 'text-teal-300' },
  ];

  const rateCards = [
    { label: 'Open Rate', value: `${(rates?.openRate ?? 0).toFixed(1)}%`, color: 'text-violet-400' },
    { label: 'Click Rate', value: `${(rates?.clickRate ?? 0).toFixed(1)}%`, color: 'text-teal-400' },
    { label: 'Bounce Rate', value: `${(rates?.bounceRate ?? 0).toFixed(1)}%`, color: 'text-red-400' },
  ];

  return (
    <div className={`space-y-4 ${embedded ? '' : 'p-4'}`}>
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{campaign.name}</h2>
            <p className="text-sm text-slate-400">Subject: {campaign.subject}</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-xs font-bold text-teal-400 hover:text-teal-300">
              Close
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="bg-slate-900 border border-white/5 rounded-2xl p-4">
            <div className="text-xs text-slate-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {rateCards.map((s) => (
          <div key={s.label} className="bg-slate-900 border border-white/5 rounded-2xl p-4 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {variantStats && (
        <div className="grid grid-cols-2 gap-3">
          {(['A', 'B'] as const).map((variant) => {
            const bucket = variantStats[variant];
            const openRate = bucket.sent ? ((bucket.opened / bucket.sent) * 100).toFixed(1) : '0.0';
            const clickRate = bucket.sent ? ((bucket.clicked / bucket.sent) * 100).toFixed(1) : '0.0';
            return (
              <div key={variant} className="bg-slate-900 border border-violet-500/20 rounded-2xl p-4">
                <div className="text-xs font-bold text-violet-400 mb-2">Variant {variant}</div>
                <div className="text-sm text-white">Sent: {bucket.sent}</div>
                <div className="text-sm text-slate-400">Open rate: {openRate}% · Click rate: {clickRate}%</div>
              </div>
            );
          })}
        </div>
      )}

      {(statusCounts.bounced > 0 || statusCounts.failed > 0) && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-bold text-red-400">Delivery Issues</span>
          </div>
          <div className="flex gap-4 text-sm text-red-300">
            {statusCounts.bounced > 0 && <span>{statusCounts.bounced} bounced</span>}
            {statusCounts.failed > 0 && <span>{statusCounts.failed} failed</span>}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-bold text-white mb-3">Recipients ({recipients.length})</h3>
        <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
          <div className="divide-y divide-white/5 max-h-48 overflow-y-auto">
            {recipients.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500 text-center">No recipients yet</div>
            ) : (
              recipients.map((r) => {
                const abVariant = String((r.metadata as Record<string, unknown>)?.abVariant || '');
                return (
                <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-white truncate">{r.email}</span>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {abVariant ? (
                      <span className="text-[10px] font-bold text-violet-400">{abVariant}</span>
                    ) : null}
                    <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                      ['delivered', 'opened', 'clicked', 'sent'].includes(r.status)
                        ? 'bg-teal-500/10 text-teal-400'
                        : r.status === 'bounced' || r.status === 'failed'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-slate-500/10 text-slate-400'
                    }`}
                  >
                    {r.status}
                    </span>
                  </div>
                </div>
              );})
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailCampaignAnalytics;

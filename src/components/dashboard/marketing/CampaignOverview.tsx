'use client';

import { useMemo, useState } from 'react';
import { Search, ArrowRight, CalendarClock, Mail } from 'lucide-react';
import type { EmailCampaign } from '@/services/emailCampaignService';

export default function CampaignOverview({ campaigns, onOpen, onDuplicate, onDelete }: { campaigns: EmailCampaign[]; onOpen: (campaign: EmailCampaign) => void; onDuplicate?: (campaign: EmailCampaign) => void; onDelete?: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const visible = useMemo(() => campaigns.filter(campaign => (status === 'all' || campaign.status === status) && `${campaign.name} ${campaign.subject} ${campaign.fromEmail}`.toLowerCase().includes(query.toLowerCase())), [campaigns, query, status]);
  const totals = campaigns.reduce((sum, campaign) => ({ recipients: sum.recipients + Number(campaign.totalRecipients || 0), sent: sum.sent + Number(campaign.totalSent || 0), delivered: sum.delivered + Number(campaign.totalDelivered || 0), bounced: sum.bounced + Number(campaign.totalBounced || 0) }), { recipients: 0, sent: 0, delivered: 0, bounced: 0 });
  const statuses = [...new Set(campaigns.map(campaign => campaign.status))];
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {[['Campaigns', campaigns.length], ['Recipients', totals.recipients], ['Sent', totals.sent], ['Delivered', totals.delivered]].map(([label, count]) => <div key={label} className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] p-3"><p className="type-caption text-[var(--ws-text-secondary)]">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-[var(--ws-text-primary)]">{Number(count).toLocaleString()}</p></div>)}
    </div>
    <div className="flex flex-col gap-2 sm:flex-row">
      <label className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-panel)] px-3"><Search className="h-4 w-4 text-[var(--ws-text-muted)]" /><input aria-label="Search campaigns" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search campaign or subject" className="min-w-0 w-full bg-transparent py-2 text-[var(--ws-text-primary)] outline-none" /></label>
      <select aria-label="Campaign status" value={status} onChange={event => setStatus(event.target.value)} className="rounded-lg border border-[var(--ws-border)] bg-[var(--ws-panel)] px-3 py-2 text-[var(--ws-text-primary)]"><option value="all">All statuses</option>{statuses.map(value => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select>
    </div>
    <p className="type-caption text-[var(--ws-text-secondary)]">{visible.length} of {campaigns.length} loaded campaigns{totals.bounced ? ` · ${totals.bounced} bounced` : ''}</p>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {visible.map(campaign => {
        const recipients = Number(campaign.totalRecipients || 0), sent = Number(campaign.totalSent || 0);
        const progress = recipients ? Math.min(100, Math.round(sent / recipients * 100)) : 0;
        return <article key={campaign.id} className="overflow-hidden rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)]"><button onClick={() => onOpen(campaign)} className="block w-full p-4 text-left transition-colors hover:bg-[var(--ws-surface-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ac-accent)]">
          <div className="flex items-start justify-between gap-2"><h3 className="min-w-0 font-semibold text-[var(--ws-text-primary)] break-words">{campaign.name}</h3><span className="shrink-0 rounded-md bg-[var(--ws-surface-secondary)] px-2 py-1 type-caption text-[var(--ws-text-secondary)]">{campaign.status.replace(/_/g, ' ')}</span></div>
          <p className="mt-2 line-clamp-2 type-ui text-[var(--ws-text-secondary)]">{campaign.subject || 'No subject yet'}</p>
          <p className="mt-2 flex items-center gap-1.5 type-caption text-[var(--ws-text-secondary)]"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{campaign.fromEmail || 'Sender not set'}</span></p>
          <div className="mt-4 flex justify-between type-caption tabular-nums text-[var(--ws-text-secondary)]"><span>{sent.toLocaleString()} / {recipients.toLocaleString()} sent</span><span>{progress}%</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--ws-surface-secondary)]"><div className="h-full bg-[var(--ac-accent)]" style={{ width: `${progress}%` }} /></div>
          <div className="mt-3 flex items-center justify-between gap-2 type-caption text-[var(--ws-text-secondary)]"><span className="inline-flex items-center gap-1">{campaign.scheduledAt ? <><CalendarClock className="h-3.5 w-3.5" />{new Date(campaign.scheduledAt).toLocaleString()}</> : `${Number(campaign.totalDelivered || 0).toLocaleString()} delivered`}</span><ArrowRight className="h-4 w-4 shrink-0" /></div>
        </button><div className="flex justify-end gap-3 border-t border-[var(--ws-border)] px-4 py-2 type-caption text-[var(--ws-text-secondary)]">{onDuplicate && <button onClick={() => onDuplicate(campaign)}>Duplicate</button>}{onDelete && <button onClick={() => { if (window.confirm(`Delete campaign “${campaign.name}”?`)) onDelete(campaign.id); }}>Delete</button>}</div></article>;
      })}
    </div>
    {!visible.length && <div className="rounded-xl border border-dashed border-[var(--ws-border)] p-8 text-center text-[var(--ws-text-secondary)]">{campaigns.length ? 'No campaigns match these filters.' : 'Create a campaign to choose recipients, prepare a message and set its delivery time.'}</div>}
  </div>;
}

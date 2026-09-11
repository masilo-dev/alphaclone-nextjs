'use client';

import Link from 'next/link';
import { Building2, Loader2, Search, Sparkles, User } from 'lucide-react';
import { useEmailLeadAutoSearch } from '@/hooks/useEmailLeadAutoSearch';
import { useTenant } from '@/contexts/TenantContext';
import type { EmailContextMatch } from '@/lib/scraper/emailLeadAutoSearch';

type EmailLeadInsightPanelProps = {
  from: string | null | undefined;
  subject?: string | null;
  compact?: boolean;
};

function matchLabel(m: EmailContextMatch): string {
  switch (m.type) {
    case 'crm_lead':
      return 'CRM Lead';
    case 'contact':
      return 'Contact';
    case 'scraper_lead':
      return 'Lead Finder';
    case 'account':
      return 'Account';
    default:
      return 'Match';
  }
}

export default function EmailLeadInsightPanel({
  from,
  subject,
  compact = false,
}: EmailLeadInsightPanelProps) {
  const { currentTenant } = useTenant();
  const { result, loading, error } = useEmailLeadAutoSearch(
    from,
    subject,
    currentTenant?.id
  );

  if (!from?.includes('@')) return null;

  return (
    <div
      className={`rounded-xl border border-teal-500/20 bg-teal-500/5 ${
        compact ? 'p-3' : 'p-4 mb-4'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
        <p className="text-xs font-bold uppercase tracking-wide text-teal-300">
          Auto lead search
        </p>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400 ml-auto" />}
      </div>

      {error && <p className="text-xs text-amber-400 mb-2">{error}</p>}

      {!loading && result && (
        <>
          {result.matches.length === 0 ? (
            <p className="text-xs text-slate-400 mb-2">
              No CRM or Lead Finder matches for{' '}
              <span className="text-slate-300">{result.email}</span>
              {result.enrichmentQueued && ' — enrichment queued on Railway'}
            </p>
          ) : (
            <ul className="space-y-1.5 mb-2">
              {result.matches.slice(0, compact ? 3 : 6).map((m) => (
                <li key={`${m.type}-${m.id}`}>
                  <Link
                    href={m.href}
                    className="flex items-center gap-2 text-xs text-slate-200 hover:text-teal-300 transition-colors"
                  >
                    {m.type === 'account' ? (
                      <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )}
                    <span className="font-semibold truncate">
                      {m.name || m.company || m.email}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {matchLabel(m)}
                      {m.score != null ? ` · ${m.score}` : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            {result.suggestedActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="inline-flex items-center gap-1 rounded-lg border border-teal-500/30 px-2.5 py-1 text-[11px] font-semibold text-teal-300 hover:bg-teal-500/10"
              >
                <Search className="w-3 h-3" />
                {action.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Users, Send, Reply } from 'lucide-react';

const WORKFLOW = [
  { label: 'Contacts', href: '/dashboard/clients?view=contacts', Icon: Users },
  { label: 'Outreach', href: '/dashboard/marketing/outreach', Icon: Send },
  { label: 'Replies & follow-up', href: '/dashboard/outreach/inbox', Icon: Reply },
] as const;

type CRMWorkspaceBridgeProps = {
  active?: 'contacts' | 'outreach' | 'replies';
  compact?: boolean;
};

/** Shared handoff language so CRM, outreach, and campaigns feel like one workflow. */
export function CRMWorkspaceBridge({ active, compact = false }: CRMWorkspaceBridgeProps) {
  return (
    <section
      aria-label="CRM workflow"
      className={`rounded-2xl border border-teal-500/20 bg-teal-500/[0.04] ${compact ? 'p-3' : 'p-4'}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-300">One customer workflow</p>
          {!compact ? (
            <p className="mt-1 text-xs text-slate-400">Keep the record, message, and next action connected.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {WORKFLOW.map(({ label, href, Icon }, index) => {
            const isActive = active === (index === 0 ? 'contacts' : index === 1 ? 'outreach' : 'replies');
            return (
              <div key={label} className="flex items-center gap-1.5">
                {index > 0 ? <ArrowRight className="h-3 w-3 text-slate-600" aria-hidden="true" /> : null}
                <Link
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                    isActive
                      ? 'border-teal-400/40 bg-teal-400/15 text-teal-200'
                      : 'border-white/10 bg-slate-950/40 text-slate-300 hover:border-teal-400/30 hover:text-teal-200'
                  }`}
                >
                  {isActive ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                  {label}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default CRMWorkspaceBridge;

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, CheckCircle2, Clock3, Globe2, ShieldCheck } from 'lucide-react';

const sections = [
  ['Overview', '/settings/legal'],
  ['Privacy', '/settings/legal/privacy'],
  ['Terms', '/settings/legal/terms'],
  ['Cookies', '/settings/legal/cookies'],
  ['Email policy', '/settings/legal/email'],
  ['Data processing', '/settings/legal/data-processing'],
  ['Subprocessors', '/settings/legal/subprocessors'],
  ['Retention', '/settings/legal/retention'],
  ['Consent', '/settings/legal/consent'],
  ['Localisation', '/settings/legal/localisation'],
] as const;

const descriptions: Record<string, { title: string; description: string }> = {
  privacy: { title: 'Privacy policies', description: 'Create reviewed, jurisdiction-aware privacy policy versions without overwriting published text.' },
  terms: { title: 'Terms of service', description: 'Manage applicable terms, effective dates, acknowledgement requirements, and publication history.' },
  cookies: { title: 'Cookie policy', description: 'Document cookie categories and connect approved policy versions to consent controls.' },
  email: { title: 'Email communication policy', description: 'Control classifications, required footers, tracking, unsubscribe, and approval rules.' },
  'data-processing': { title: 'Data processing', description: 'Maintain data processing terms, processing activities, and approved regional versions.' },
  subprocessors: { title: 'Subprocessors', description: 'Maintain processor identity, processing location, purpose, and change history.' },
  retention: { title: 'Retention rules', description: 'Set approved retention, archive, deletion, and legal-hold behavior by data type.' },
  consent: { title: 'Consent governance', description: 'Review evidence, withdrawals, suppression state, consent wording, and policy lineage.' },
  localisation: { title: 'Localisation', description: 'Approve languages and jurisdiction variants; binding legal translations remain human-reviewed.' },
};

export function LegalGovernanceWorkspace({ section = 'overview' }: { section?: string }) {
  const pathname = usePathname();
  const copy = descriptions[section] || {
    title: 'Legal and privacy governance',
    description: 'Shared policy, consent, retention, localisation, and communication rules for every tenant module.',
  };
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-xl bg-teal-400/10 p-3 text-teal-300"><ShieldCheck aria-hidden className="h-6 w-6" /></div>
          <div><p className="text-sm text-teal-300">Settings</p><h1 className="text-3xl font-semibold">{copy.title}</h1><p className="mt-2 max-w-3xl text-slate-400">{copy.description}</p></div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Legal settings" className="rounded-2xl border border-white/10 bg-slate-900 p-2">
            {sections.map(([label, href]) => <Link key={href} href={href} className={`block rounded-xl px-3 py-2.5 text-sm ${pathname === href ? 'bg-teal-400/10 text-teal-300' : 'text-slate-300 hover:bg-white/5'}`}>{label}</Link>)}
          </nav>
          <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {[['Published versions', 'Versioned and immutable', BookOpen], ['Review gate', 'Approval required', CheckCircle2], ['Localisation', 'Approved fallbacks', Globe2]].map(([label, detail, Icon]) => (
                <div key={String(label)} className="rounded-2xl border border-white/10 bg-slate-900 p-4"><Icon aria-hidden className="mb-3 h-5 w-5 text-teal-300" /><p className="font-medium">{String(label)}</p><p className="text-sm text-slate-400">{String(detail)}</p></div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900">
              <div className="flex items-center justify-between border-b border-white/10 p-5"><div><h2 className="font-semibold">Governed records</h2><p className="text-sm text-slate-400">Content is tenant-isolated and retains full version lineage.</p></div><button type="button" className="rounded-xl bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950">Create draft</button></div>
              <div className="p-8 text-center"><Clock3 aria-hidden className="mx-auto mb-3 h-8 w-8 text-slate-500" /><p className="font-medium">No records loaded</p><p className="mt-1 text-sm text-slate-400">Connect this workspace to a tenant to view and edit governed records.</p></div>
            </div>
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">Creating a policy does not establish legal compliance. Obtain qualified legal review before publication.</div>
          </section>
        </div>
      </div>
    </main>
  );
}

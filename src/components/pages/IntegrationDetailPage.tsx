'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, CircleAlert, LockKeyhole, ShieldCheck } from 'lucide-react';
import { PUBLIC_INTEGRATIONS, type PublicIntegration } from '@/config/integrations';
import IntegrationBrandIcon from '@/components/marketing/system/IntegrationBrandIcon';

const SPECIFIC_DETAILS: Record<string, { summary: string; auth: string; access: string; capabilities: string[]; boundary: string }> = {
  gmail: {
    summary: 'Connect business email context so approved replies and follow-ups stay linked to the right customer record.',
    auth: 'Google authorization flow',
    access: 'Inbox and message permissions required for connected mail actions',
    capabilities: ['Read connected inbox context', 'Compose and reply where enabled', 'Keep activity linked to the business record'],
    boundary: 'AlphaClone prepares and routes work; external sends remain subject to the connected account and approval policy.',
  },
  linkedin: {
    summary: 'Connect LinkedIn publishing and lead workflows while keeping the selected identity and approval step visible.',
    auth: 'LinkedIn OAuth',
    access: 'Profile, page, publishing, or lead permissions depending on the selected account',
    capabilities: ['Connect a LinkedIn identity or organization page', 'Prepare and publish approved posts where enabled', 'Capture supported lead-form activity'],
    boundary: 'Publishing availability depends on the connected LinkedIn identity, permissions, and provider approval.',
  },
  facebook: {
    summary: 'Connect Facebook Pages for approved publishing, page context, and supported lead capture workflows.',
    auth: 'Facebook OAuth',
    access: 'Page and lead permissions for the selected Facebook Page',
    capabilities: ['Select the Page to connect', 'Prepare and publish approved Page content where enabled', 'Receive supported Page lead activity'],
    boundary: 'A Facebook Page connection does not automatically grant access to every profile, Page, or business asset.',
  },
  instagram: {
    summary: 'Business publishing and inbox connection for Instagram. Availability depends on the required Meta business setup.',
    auth: 'Meta business authorization',
    access: 'Business account, Page relationship, and publishing permissions when released',
    capabilities: ['Prepare business posts', 'Route content through approval', 'Track publishing and inbox outcomes when available'],
    boundary: 'Publishing depends on the connected Instagram business identity and the permissions granted to it.',
  },
};

const CATEGORY_FLOW: Record<string, string[]> = {
  communication: ['Choose the business account', 'Authorize the requested access', 'Review the prepared message or reply', 'Verify provider delivery and record activity'],
  crm: ['Choose the workspace or account', 'Authorize customer-data access', 'Review the record or sync action', 'Verify the result in the connected system'],
  social: ['Choose the profile, Page, or organization', 'Authorize publishing or lead access', 'Approve the content or capture action', 'Verify the provider result and record it'],
  payments: ['Choose the connected payment account', 'Authorize billing access', 'Review the payment or invoice action', 'Verify the provider status'],
  scheduling: ['Choose the calendar or booking account', 'Authorize availability and event access', 'Review the proposed booking action', 'Verify the event or booking record'],
  ai: ['Choose the provider or API configuration', 'Authorize the model access', 'Review the planned workflow', 'Record the resulting action history'],
  productivity: ['Choose the connected workspace', 'Authorize the requested context', 'Review the proposed task or calendar action', 'Verify and record the result'],
};

function statusClass(status: PublicIntegration['status']) {
  if (status === 'AVAILABLE') return 'border-emerald-300 bg-emerald-50 text-emerald-800';
  if (status === 'BETA') return 'border-amber-300 bg-amber-50 text-amber-800';
  return 'border-slate-300 bg-slate-100 text-slate-700';
}

export default function IntegrationDetailPage({ integration }: { integration: PublicIntegration }) {
  const specific = SPECIFIC_DETAILS[integration.id];
  const flow = CATEGORY_FLOW[integration.category] ?? ['Choose the account or workspace', 'Authorize the requested access', 'Review the proposed action', 'Verify and record the result'];
  const summary = specific?.summary ?? integration.description;
  const capabilities = specific?.capabilities ?? [integration.description, 'Use the connected context in supported workflows', 'Keep relevant activity and outcomes visible'];
  const isAvailable = integration.status === 'AVAILABLE' || integration.status === 'BETA';

  return (
    <main className="min-h-screen bg-white px-4 py-24 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/ecosystem" className="inline-flex items-center gap-2 type-ui font-semibold text-blue-700 hover:text-blue-900"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to integrations</Link>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
          <section>
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                <IntegrationBrandIcon id={integration.id} className="h-7 w-7" />
              </div>
              <div>
                <p className="type-caption font-bold uppercase tracking-caps text-blue-700">{integration.category.replace('_', ' ')}</p>
                <h1 className="mt-1 font-marketing-heading text-3xl font-extrabold sm:text-5xl">{integration.name}</h1>
              </div>
              <span className={`rounded-full border px-3 py-1.5 type-caption font-bold ${statusClass(integration.status)}`}>{integration.statusLabel}</span>
            </div>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">{summary}</p>
            <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="type-caption font-black uppercase tracking-caps text-blue-800">What connecting means</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {capabilities.map((capability) => <div key={capability} className="flex gap-2 type-ui leading-6 text-slate-800"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />{capability}</div>)}
              </div>
            </div>
          </section>
          <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-lg">
            <p className="type-caption font-black uppercase tracking-caps text-slate-600">Connection readiness</p>
            <dl className="mt-4 space-y-4 type-ui">
              <div><dt className="type-caption text-slate-600">Authentication</dt><dd className="mt-1 text-slate-800">{specific?.auth ?? 'Provider-supported authorization or configuration flow'}</dd></div>
              <div><dt className="type-caption text-slate-600">Access</dt><dd className="mt-1 text-slate-800">{specific?.access ?? 'The permissions required depend on the supported workflow and provider account.'}</dd></div>
              <div><dt className="type-caption text-slate-600">Approval boundary</dt><dd className="mt-1 text-slate-800">Human review remains available before consequential external actions.</dd></div>
            </dl>
            <div className="mt-5 flex gap-3 rounded-xl border border-slate-200 bg-white p-3 type-caption leading-5 text-slate-700"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />Connect only the account and permissions required for the workflow.</div>
            {specific?.boundary ? <p className="mt-4 type-card-description leading-5 text-amber-900"><CircleAlert className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{specific.boundary}</p> : null}
            <Link href={isAvailable ? '/dashboard/marketplace' : '/contact'} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-3 type-ui font-bold text-slate-950 transition hover:bg-teal-300">{isAvailable ? 'Open connection settings' : 'Ask about availability'}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </aside>
        </div>
        <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-7">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-700" aria-hidden="true" /><h2 className="text-lg font-bold">How the workflow moves</h2></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {flow.map((step, index) => <div key={step} className="rounded-xl border border-slate-200 bg-white p-4"><span className="type-caption font-black tracking-caps text-blue-700">0{index + 1}</span><p className="mt-2 type-ui leading-6 text-slate-800">{step}</p></div>)}
          </div>
        </section>
        <section className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Before you connect</h2>
            <ul className="mt-4 space-y-3 type-ui leading-6 text-slate-700">
              <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />Confirm which business account or identity should own the connection.</li>
              <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />Grant only the permissions required for the workflows you plan to use.</li>
              <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />Run a small test and verify the result before enabling routine work.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">What AlphaClone records</h2>
            <p className="mt-4 type-ui leading-6 text-slate-700">The workspace keeps the selected account, requested action, approval state, provider outcome, and relevant business record together. Failed or unavailable actions remain visible instead of being presented as completed.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

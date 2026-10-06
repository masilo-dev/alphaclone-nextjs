'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  Globe2,
  ShieldCheck,
  Sliders,
  ExternalLink,
  FileText,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { CONSENT_CHANGE_EVENT, OPEN_PREFERENCES_EVENT, readConsentState, UserConsentState } from '@/lib/consent/consentManager';
import { useAuth } from '@/contexts/AuthContext';

const sections = [
  ['Overview', '/settings/legal'],
  ['Platform Agreements', '/settings/legal/agreements'],
  ['Cookie & Privacy Controls', '/settings/legal/cookies'],
  ['Data Requests (DSAR)', '/settings/legal/data-requests'],
  ['Tenant Policies', '/settings/legal/privacy'],
  ['Subprocessors Directory', '/settings/legal/subprocessors'],
] as const;

export function LegalGovernanceWorkspace({ section = 'overview' }: { section?: string }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [cookieConsent, setCookieConsent] = useState<UserConsentState | null>(null);
  const [agreements, setAgreements] = useState<{
    currentPolicies?: Record<string, { version: string; effectiveDate: string }>;
    userAcceptances?: Record<string, { version: string; acceptedAt: string }>;
  } | null>(null);
  const [loadingAgreements, setLoadingAgreements] = useState(false);

  useEffect(() => {
    const update = () => setCookieConsent(readConsentState());
    update(); window.addEventListener(CONSENT_CHANGE_EVENT, update);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, update);
  }, []);

  useEffect(() => {
    async function fetchAgreements() {
      setLoadingAgreements(true);
      try {
        const res = await fetch('/api/legal/acceptance');
        if (res.ok) {
          const data = await res.json();
          setAgreements(data);
        }
      } catch {
        // Non-blocking
      } finally {
        setLoadingAgreements(false);
      }
    }
    fetchAgreements();
  }, [user]);

  const openCookiePreferences = () => {
    window.dispatchEvent(new CustomEvent(OPEN_PREFERENCES_EVENT));
  };

  return (
    <main className="min-h-screen bg-[var(--ws-canvas)] px-4 py-8 text-[var(--ws-text-primary)]">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-xl bg-[var(--brand-blue-400)]/10 p-3 text-[var(--brand-blue-300)]">
            <ShieldCheck aria-hidden className="h-6 w-6" />
          </div>
          <div>
            <p className="type-card-description text-[var(--brand-blue-300)]">Settings</p>
            <h1 className="text-3xl font-semibold">Legal & Compliance Governance</h1>
            <p className="mt-2 max-w-3xl text-[var(--ws-text-muted)]">
              Manage your enterprise platform legal agreements, cookie consent preferences, data subject access requests, and customer-facing policies.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Navigation */}
          <nav aria-label="Legal settings" className="rounded-2xl border border-white/10 bg-[var(--ws-panel)] p-2 space-y-1">
            {sections.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className={`block rounded-xl px-3 py-2.5 type-ui font-medium transition-colors ${
                  pathname === href ? 'bg-[var(--brand-blue-400)]/10 text-[var(--brand-blue-300)] font-semibold' : 'text-[var(--ws-text-secondary)] hover:bg-white/5'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Main Content Area */}
          <section className="space-y-6">
            {/* Quick Metrics */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-[var(--ws-panel)] p-4">
                <BookOpen aria-hidden className="mb-3 h-5 w-5 text-[var(--brand-blue-300)]" />
                <p className="font-semibold text-white">Platform Agreements</p>
                <p className="type-card-description text-[var(--ws-text-muted)]">
                  {agreements?.userAcceptances?.terms_of_service ? 'Active & Accepted' : 'Compliant'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[var(--ws-panel)] p-4">
                <CheckCircle2 aria-hidden className="mb-3 h-5 w-5 text-[var(--brand-blue-300)]" />
                <p className="font-semibold text-white">Cookie Consent</p>
                <p className="type-card-description text-[var(--ws-text-muted)]">
                  {cookieConsent ? `Version ${cookieConsent.version}` : 'Default (Essential)'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[var(--ws-panel)] p-4">
                <Globe2 aria-hidden className="mb-3 h-5 w-5 text-[var(--brand-blue-300)]" />
                <p className="font-semibold text-white">Subprocessors</p>
                <p className="type-card-description text-[var(--ws-text-muted)]">9 Authorized Partners</p>
              </div>
            </div>

            {/* Cookie & Consent Controls Card */}
            <div className="rounded-2xl border border-white/10 bg-[var(--ws-panel)] p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-[var(--brand-blue-300)]" />
                    <span>Cookie & Tracking Preferences</span>
                  </h2>
                  <p className="mt-1 type-ui text-[var(--ws-text-muted)]">
                    Manage real-time browser storage and Cloudflare Zaraz / Google Consent Mode v2 signals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCookiePreferences}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-blue-400)] px-4 py-2 type-ui font-semibold text-slate-950 transition-colors hover:bg-teal-300"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Modify Preferences</span>
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)]/60 p-3">
                  <span className="block text-xs text-[var(--ws-text-muted)]">Essential</span>
                  <span className="font-bold text-[var(--brand-blue-300)]">Always Active</span>
                </div>
                <div className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)]/60 p-3">
                  <span className="block text-xs text-[var(--ws-text-muted)]">Functional</span>
                  <span className={`font-bold ${cookieConsent?.functional ? 'text-[var(--brand-blue-300)]' : 'text-[var(--ws-text-muted)]'}`}>
                    {cookieConsent?.functional ? 'Granted' : 'Denied'}
                  </span>
                </div>
                <div className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)]/60 p-3">
                  <span className="block text-xs text-[var(--ws-text-muted)]">Analytics</span>
                  <span className={`font-bold ${cookieConsent?.analytics ? 'text-[var(--brand-blue-300)]' : 'text-[var(--ws-text-muted)]'}`}>
                    {cookieConsent?.analytics ? 'Granted' : 'Denied'}
                  </span>
                </div>
                <div className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)]/60 p-3">
                  <span className="block text-xs text-[var(--ws-text-muted)]">Marketing</span>
                  <span className={`font-bold ${cookieConsent?.marketing ? 'text-[var(--brand-blue-300)]' : 'text-[var(--ws-text-muted)]'}`}>
                    {cookieConsent?.marketing ? 'Granted' : 'Denied'}
                  </span>
                </div>
              </div>
            </div>

            {/* Platform Legal Agreements Status */}
            <div className="rounded-2xl border border-white/10 bg-[var(--ws-panel)] p-6">
              <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--brand-blue-300)]" />
                <span>AlphaClone Platform Legal Agreements</span>
              </h2>
              <p className="type-ui text-[var(--ws-text-muted)] mb-5">
                Current terms governing your AlphaClone account, cloud hosting, and Bonnie AI usage.
              </p>

              <div className="divide-y divide-slate-800/80 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)]/60 overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Terms of Service</h3>
                    <p className="text-xs text-[var(--ws-text-muted)]">Version: {agreements?.currentPolicies?.terms_of_service?.version || '2026-10'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-teal-500/10 text-[var(--brand-blue-300)] border border-teal-500/20">
                      Active
                    </span>
                    <Link href="/legal/terms" target="_blank" className="text-[var(--ws-text-muted)] hover:text-[var(--brand-blue-300)]">
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Privacy Policy</h3>
                    <p className="text-xs text-[var(--ws-text-muted)]">Version: {agreements?.currentPolicies?.privacy_policy?.version || '2026-10'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-teal-500/10 text-[var(--brand-blue-300)] border border-teal-500/20">
                      Active
                    </span>
                    <Link href="/legal/privacy" target="_blank" className="text-[var(--ws-text-muted)] hover:text-[var(--brand-blue-300)]">
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Data Processing Agreement (DPA)</h3>
                    <p className="text-xs text-[var(--ws-text-muted)]">Standard Contractual Clauses (SCCs) for B2B Clients</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-teal-500/10 text-[var(--brand-blue-300)] border border-teal-500/20">
                      Incorporated
                    </span>
                    <Link href="/legal/dpa" target="_blank" className="text-[var(--ws-text-muted)] hover:text-[var(--brand-blue-300)]">
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Subprocessors Directory</h3>
                    <p className="text-xs text-[var(--ws-text-muted)]">Cloudflare, Supabase, Railway, Anthropic, OpenAI, Stripe, Brevo</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href="/legal/subprocessors" target="_blank" className="text-xs text-[var(--brand-blue-300)] hover:underline flex items-center gap-1">
                      <span>View Directory</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links / DSAR Notice */}
            <div className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/60 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-white">Need a Data Export or Account Deletion?</h4>
                  <p className="text-xs text-[var(--ws-text-muted)] mt-0.5">
                    Submit a formal Data Subject Access Request (DSAR) under GDPR, CCPA, or POPIA.
                  </p>
                </div>
              </div>
              <Link
                href="/legal/data-request"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] px-4 py-2 type-ui font-medium text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-tertiary)] hover:text-white transition-colors text-xs whitespace-nowrap"
              >
                <span>Submit Data Request</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

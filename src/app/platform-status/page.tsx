import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import LiveStatusWidget from '@/components/status/LiveStatusWidget';
import { SITE_URL } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export const metadata: Metadata = {
  title: 'Platform Status | AlphaClone Systems',
  description:
    'Official AlphaClone platform status page with live health checks, system availability, and operational reliability updates.',
  keywords: [
    'AlphaClone status',
    'AlphaClone platform status',
    'AlphaClone uptime',
    'AlphaClone service health',
    'AlphaClone system reliability',
  ],
  alternates: { canonical: `${SITE_URL}/platform-status` },
  openGraph: {
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'Platform Status | AlphaClone Systems',
    description: 'Live service health and operational status for AlphaClone Systems.',
    url: `${SITE_URL}/platform-status`,
    type: 'website',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
};

function normalizeStatus(value: unknown): HealthStatus {
  const s = String(value || '').toLowerCase();
  if (s === 'healthy' || s === 'ok' || s === 'operational') return 'healthy';
  if (s === 'degraded' || s === 'warning') return 'degraded';
  if (s === 'unhealthy' || s === 'failed' || s === 'down') return 'unhealthy';
  return 'unknown';
}

function statusCopy(status: HealthStatus) {
  if (status === 'healthy')
    return {
      label: 'Web Application Responding',
      summary: 'The web application answered its latest liveness check. This check does not verify the database, integrations, or individual workflows.',
    };
  if (status === 'degraded')
    return {
      label: 'Partial Degradation',
      summary: 'The platform health check reports degraded service. Individual workflows may be affected.',
    };
  if (status === 'unhealthy')
    return {
      label: 'Service Disruption',
      summary: 'The platform health check reports a service disruption. Please retry affected workflows later.',
    };
  return {
    label: 'Status Unavailable',
    summary: 'The live health check could not be verified. Please try again shortly.',
  };
}

// Business-friendly service names — zero internal/technical detail exposed
const CORE_SERVICES: Array<{
  name: string;
  category: string;
  detail: string;
}> = [
  {
    name: 'Web Application & Dashboard',
    category: 'Core Platform',
    detail: 'Workspace portal, navigation, and user interface',
  },
  {
    name: 'Account Security & Access Control',
    category: 'Security',
    detail: 'Sign-in, session management, and workspace isolation',
  },
  {
    name: 'Lead Discovery & Prospecting',
    category: 'Growth Engine',
    detail: 'Automated lead sourcing, enrichment, and pipeline updates',
  },
  {
    name: 'Email & Outreach Delivery',
    category: 'Communications',
    detail: 'Outbound campaigns, inbox sync, and reply tracking',
  },
  {
    name: 'Social Media Publishing',
    category: 'Social Engine',
    detail: 'LinkedIn, Facebook scheduling, and autonomous posting',
  },
  {
    name: 'Bonnie AI Business Assistant',
    category: 'AI Intelligence',
    detail: 'Autonomous business workflows and intelligent automation',
  },
  {
    name: 'Data & Real-Time Sync',
    category: 'Infrastructure',
    detail: 'Business data storage, backups, and live updates',
  },
];

async function getStatusReport() {
  let overallStatus: HealthStatus = 'unknown';
  let responseTimeMs: number | null = null;
  let checkedAt = new Date().toISOString();

  try {
    const t0 = Date.now();
    const response = await fetch(`${SITE_URL}/api/health`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });
    responseTimeMs = Date.now() - t0;
    const payload = response.ok ? await response.json().catch(() => null) : null;
    checkedAt = payload?.timestamp || checkedAt;
    overallStatus = normalizeStatus(payload?.status);
  } catch {
    overallStatus = 'unknown';
  }

  const copy = statusCopy(overallStatus);

  return {
    status: overallStatus,
    label: copy.label,
    summary: copy.summary,
    checkedAt,
    responseTimeMs,
    checks: CORE_SERVICES.map((s) => ({
      ...s,
      // The platform endpoint does not report independent service checks.
      status: 'unknown' as HealthStatus,
    })),
  };
}

function StatusDot({ status }: { status: HealthStatus }) {
  const cls =
    status === 'healthy'
      ? 'bg-[var(--success-500)] shadow-[0_0_8px_rgba(52,211,153,0.5)]'
      : status === 'degraded'
        ? 'bg-[var(--warning-500)] shadow-[0_0_8px_rgba(251,191,36,0.5)]'
        : status === 'unhealthy'
          ? 'bg-[var(--error-500)] shadow-[0_0_8px_rgba(251,113,113,0.5)]'
      : 'bg-slate-400';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} />;
}

function statusBadgeClass(status: HealthStatus) {
  if (status === 'degraded') return 'border-amber-500/30 bg-amber-500/10 text-amber-800';
  if (status === 'unhealthy') return 'border-rose-500/30 bg-rose-500/10 text-rose-800';
  return status === 'healthy' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800' : 'border-slate-500/30 bg-slate-500/10 text-[var(--marketing-text-secondary)]';
}

function statusRowBadge(status: HealthStatus) {
  if (status === 'degraded') return 'border-amber-500/30 bg-amber-500/10 text-amber-800';
  if (status === 'unhealthy') return 'border-rose-500/30 bg-rose-500/10 text-rose-800';
  return status === 'healthy' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800' : 'border-slate-500/30 bg-slate-500/10 text-[var(--marketing-text-secondary)]';
}

export default async function PlatformStatusPage() {
  const report = await getStatusReport();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'AlphaClone Systems Platform Status',
    url: `${SITE_URL}/platform-status`,
    dateModified: report.checkedAt,
    description: report.summary,
  };

  return (
    <MarketingLandingShell>
      <div className="min-h-screen bg-[var(--marketing-bg-secondary)] pt-20 text-[var(--marketing-text-secondary)]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">

          {/* ── Status Header Banner ───────────────────────────────── */}
          <div className="mb-10 rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-8 shadow-sm ">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div
                  className={`mb-4 inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 type-caption font-bold uppercase tracking-caps ${statusBadgeClass(report.status)}`}
                >
                  <StatusDot status={report.status} />
                  {report.label}
                </div>
                <h1 className="text-3xl font-black text-[var(--marketing-ink)] sm:text-4xl">
                  System Status & Reliability
                </h1>
                <p className="mt-2 max-w-2xl type-card-description leading-6 text-[var(--marketing-text-secondary)]">
                  {report.summary}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--marketing-border)] bg-[var(--marketing-bg-secondary)] p-4 text-right type-caption text-[var(--marketing-text-secondary)]">
                <div className="font-semibold uppercase tracking-wider text-[var(--marketing-text-secondary)]">
                  Last Health Check
                </div>
                <time dateTime={report.checkedAt} className="mt-1 block font-mono type-caption text-[var(--marketing-text-secondary)]">
                  {new Date(report.checkedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </time>
                <div className="mt-0.5 type-ui text-[var(--marketing-text-secondary)]">Auto-refreshes every 30s</div>
              </div>
            </div>
          </div>

          {/* ── Live Polling Widget ────────────────────────────────── */}
          <div className="mb-8">
            <LiveStatusWidget
              initialStatus={report.status}
              initialLatency={report.responseTimeMs}
              initialCheckedAt={report.checkedAt}
            />
          </div>

          {/* ── Metrics Bar ───────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Activity className="mb-3 h-5 w-5 text-emerald-400" />,
                value: report.status !== 'unknown' && report.responseTimeMs !== null ? `${report.responseTimeMs}ms` : 'Unavailable',
                label: 'Health Check Response Time',
              },
            ].map(({ icon, value, label }) => (
              <div
                key={label}
                className="rounded-xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-5 shadow-sm "
              >
                {icon}
                <div className="text-2xl font-black text-[var(--marketing-ink)]">{value}</div>
                <div className="mt-1 type-caption font-medium text-[var(--marketing-text-secondary)]">{label}</div>
              </div>
            ))}
          </div>

          {/* ── Service Status Grid ───────────────────────────────── */}
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
            <section className="rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-6 shadow-sm ">
              <div className="mb-6 flex items-center justify-between gap-4 border-b border-[var(--marketing-border)] pb-4">
                <div>
                  <h2 className="text-xl font-bold text-[var(--marketing-ink)]">Platform Components</h2>
                  <p className="mt-0.5 type-card-description text-[var(--marketing-text-secondary)]">
                    Platform areas are listed here; the health endpoint does not independently verify each service.
                  </p>
                </div>
                <ShieldCheck className="h-6 w-6 text-[var(--marketing-text-secondary)]" />
              </div>
              <div className="divide-y divide-[var(--marketing-border)]">
                {report.checks.map((check) => (
                  <div
                    key={check.name}
                    className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2.5 type-ui font-semibold text-[var(--marketing-ink)]">
                        <StatusDot status={check.status} />
                        <span>{check.name}</span>
                      </div>
                      <p className="mt-1 pl-5 type-card-description text-[var(--marketing-text-secondary)]">{check.detail}</p>
                    </div>
                    <span
                      className={`w-fit rounded-full border px-3 py-1 type-caption font-bold capitalize ${statusRowBadge(check.status)}`}
                    >
                      {check.status === 'healthy'
                        ? 'Operational'
                        : check.status === 'degraded'
                          ? 'Degraded'
                          : check.status === 'unhealthy' ? 'Disrupted' : 'Not verified'}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <aside className="space-y-6">
              {/* Trust & Security panel — business-friendly only */}
              <section className="rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-6 shadow-sm ">
                <div className="flex items-center gap-2.5 mb-4">
                  <Zap className="h-5 w-5 text-[var(--marketing-link-hover)]" />
                  <h2 className="text-lg font-bold text-[var(--marketing-ink)]">Security & Compliance</h2>
                </div>
                <p className="type-caption text-[var(--marketing-text-secondary)]">The runtime health check does not verify security controls. Review the published documents for policy and support information.</p>
                <div className="mt-4 flex flex-col gap-2 type-ui">
                  <Link href="/security-policy" className="text-[var(--marketing-link-hover)] underline">Security policy</Link>
                  <Link href="/compliance" className="text-[var(--marketing-link-hover)] underline">Compliance overview</Link>
                  <Link href="/sla" className="text-[var(--marketing-link-hover)] underline">Service level agreement</Link>
                </div>
              </section>

              {/* Incident Log */}
              <section className="rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-6 shadow-sm ">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--marketing-link-hover)] shrink-0" />
                  <div>
                    <h2 className="text-base font-bold text-[var(--marketing-ink)]">Incident Log</h2>
                    <p className="mt-1.5 type-card-description leading-5 text-[var(--marketing-text-secondary)]">
                      An incident history is not available on this page. The health check above only reports current web application liveness.
                    </p>
                  </div>
                </div>
              </section>
            </aside>
          </div>

          {/* ── Enterprise Modules ────────────────────────────────── */}
          <section className="mt-8 rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-6 shadow-sm ">
            <h2 className="text-lg font-bold text-[var(--marketing-ink)]">Product Areas</h2>
            <p className="mt-1 type-caption text-[var(--marketing-text-secondary)]">These areas are not independently monitored by this health check.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                'CRM & Lead Pipeline',
                'Invoicing & Payments',
                'Social Media Publishing',
                'Email & Outreach',
                'AI Business Automation',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-xl border border-[var(--marketing-border)] bg-[var(--marketing-bg-secondary)] px-3.5 py-3 type-caption font-semibold text-[var(--marketing-text-secondary)]"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-5 border-t border-[var(--marketing-border)] pt-4 type-caption font-medium text-[var(--marketing-text-secondary)]">
              <Link href="/sla" className="text-[var(--marketing-link-hover)] transition-colors hover:text-[var(--marketing-link-hover)]">
                SLA Agreement
              </Link>
              <Link href="/legal" className="text-[var(--marketing-link-hover)] transition-colors hover:text-[var(--marketing-link-hover)]">
                Legal & Compliance
              </Link>
              <Link href="/security-policy" className="text-[var(--marketing-link-hover)] transition-colors hover:text-[var(--marketing-link-hover)]">
                Security Policy
              </Link>
              <Link href="/contact" className="text-[var(--marketing-link-hover)] transition-colors hover:text-[var(--marketing-link-hover)]">
                Contact Support
              </Link>
            </div>
          </section>

        </section>
      </div>
    </MarketingLandingShell>
  );
}

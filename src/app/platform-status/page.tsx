import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, AlertCircle, CheckCircle2, Clock3, GitCommit, Server, ShieldCheck } from 'lucide-react';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import { SITE_URL } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

type HealthPayload = {
  status?: string;
  timestamp?: string;
  responseTime?: number;
  responseTimeMs?: number;
  version?: string;
  checks?: Record<string, any>;
};

type StatusReport = {
  status: HealthStatus;
  label: string;
  summary: string;
  checkedAt: string;
  responseTimeMs: number | null;
  uptimeSeconds: number | null;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  nodeVersion: string | null;
  deployment: {
    environment: string | null;
    service: string | null;
    commit: string | null;
    deploymentId: string | null;
    region: string | null;
  };
  checks: Array<{ name: string; status: HealthStatus; detail: string }>;
};

export const metadata: Metadata = {
  title: 'Platform Status | AlphaClone Systems',
  description:
    'Official AlphaClone platform status page with live health checks, uptime posture, deployment signals, and operational reliability updates.',
  keywords: [
    'AlphaClone status',
    'AlphaClone platform status',
    'AlphaClone uptime',
    'AlphaClone Railway status',
    'AlphaClone incident status',
  ],
  alternates: { canonical: `${SITE_URL}/platform-status` },
  openGraph: {
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'Platform Status | AlphaClone Systems',
    description: 'Live service health and reliability information for AlphaClone Systems.',
    url: `${SITE_URL}/platform-status`,
    type: 'website',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
};

function normalizeStatus(value: unknown): HealthStatus {
  const status = String(value || '').toLowerCase();
  if (status === 'healthy' || status === 'ok' || status === 'operational') return 'healthy';
  if (status === 'degraded' || status === 'skipped' || status === 'warning') return 'degraded';
  if (status === 'unhealthy' || status === 'failed' || status === 'down') return 'unhealthy';
  return 'unknown';
}

function statusCopy(status: HealthStatus) {
  if (status === 'healthy') return { label: 'Operational', summary: 'All public platform checks are passing.' };
  if (status === 'degraded') return { label: 'Degraded', summary: 'One or more supporting services need attention.' };
  if (status === 'unhealthy') return { label: 'Service Disruption', summary: 'A critical public health check is failing.' };
  return { label: 'Status Pending', summary: 'Live status could not be confirmed from this request.' };
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds < 0) return 'Not reported';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function shortCommit(commit: string | null) {
  return commit ? commit.slice(0, 8) : 'Not exposed';
}

function buildChecks(payload: HealthPayload | null): StatusReport['checks'] {
  const checks = payload?.checks || {};
  const entries = Object.entries(checks);
  if (!entries.length) {
    return [{ name: 'Public health endpoint', status: 'unknown', detail: 'No live health payload was available.' }];
  }

  return entries.slice(0, 12).map(([name, value]) => {
    const status = normalizeStatus(value?.status || (name === 'system' ? 'healthy' : 'unknown'));
    const detail =
      value?.message ||
      value?.error ||
      (value?.services ? `Services: ${Object.keys(value.services).join(', ')}` : null) ||
      (value?.memory ? `Memory ${value.memory.used}/${value.memory.total} ${value.memory.unit || 'MB'}` : null) ||
      'Check returned a live signal.';
    return { name, status, detail: String(detail) };
  });
}

async function getStatusReport(): Promise<StatusReport> {
  let payload: HealthPayload | null = null;

  try {
    const response = await fetch(`${SITE_URL}/api/health?deep=1`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });
    payload = await response.json().catch(() => null);
    if (!response.ok && payload) payload.status = payload.status || 'degraded';
  } catch {
    payload = null;
  }

  const status = normalizeStatus(payload?.status);
  const copy = statusCopy(status);
  const system = payload?.checks?.system || payload?.checks?.runtime || {};
  const memory = system?.memory || payload?.checks?.system?.memory || null;

  return {
    status,
    label: copy.label,
    summary: copy.summary,
    checkedAt: payload?.timestamp || new Date().toISOString(),
    responseTimeMs: Number(payload?.responseTimeMs ?? payload?.responseTime ?? NaN) || null,
    uptimeSeconds: Number(system?.uptime ?? payload?.checks?.system?.uptime ?? NaN) || null,
    memoryUsedMb: Number(memory?.used ?? NaN) || null,
    memoryTotalMb: Number(memory?.total ?? NaN) || null,
    nodeVersion: system?.nodeVersion || payload?.checks?.system?.nodeVersion || null,
    deployment: {
      environment: process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || null,
      service: process.env.RAILWAY_SERVICE_NAME || null,
      commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_RAILWAY_GIT_COMMIT_SHA || null,
      deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || null,
      region: process.env.RAILWAY_REGION || null,
    },
    checks: buildChecks(payload),
  };
}

function StatusDot({ status }: { status: HealthStatus }) {
  const className =
    status === 'healthy'
      ? 'bg-emerald-400'
      : status === 'degraded'
        ? 'bg-amber-400'
        : status === 'unhealthy'
          ? 'bg-rose-400'
          : 'bg-slate-400';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} />;
}

function statusClass(status: HealthStatus) {
  if (status === 'healthy') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
  if (status === 'degraded') return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
  if (status === 'unhealthy') return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
  return 'border-slate-500/30 bg-slate-800 text-slate-200';
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
      <main className="min-h-screen bg-[#040A12] pt-20 text-slate-200">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className={`mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${statusClass(report.status)}`}>
                <StatusDot status={report.status} />
                {report.label}
              </div>
              <h1 className="text-4xl font-black text-white sm:text-5xl">Platform Status</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">{report.summary}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-950 p-4 text-sm text-slate-300">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Last Checked</div>
              <time dateTime={report.checkedAt}>{new Date(report.checkedAt).toLocaleString()}</time>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-slate-950 p-5">
              <Activity className="mb-4 h-5 w-5 text-emerald-300" />
              <div className="text-2xl font-black text-white">{report.responseTimeMs ?? 0}ms</div>
              <div className="mt-1 text-sm text-slate-400">Health response</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-950 p-5">
              <Clock3 className="mb-4 h-5 w-5 text-cyan-300" />
              <div className="text-2xl font-black text-white">{formatDuration(report.uptimeSeconds)}</div>
              <div className="mt-1 text-sm text-slate-400">Runtime uptime</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-950 p-5">
              <Server className="mb-4 h-5 w-5 text-blue-300" />
              <div className="text-2xl font-black text-white">
                {report.memoryUsedMb && report.memoryTotalMb ? `${report.memoryUsedMb}/${report.memoryTotalMb} MB` : 'Not reported'}
              </div>
              <div className="mt-1 text-sm text-slate-400">Memory usage</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-950 p-5">
              <GitCommit className="mb-4 h-5 w-5 text-violet-300" />
              <div className="text-2xl font-black text-white">{shortCommit(report.deployment.commit)}</div>
              <div className="mt-1 text-sm text-slate-400">Railway commit</div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <section className="rounded-lg border border-white/10 bg-slate-950 p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-white">Live Service Checks</h2>
                  <p className="mt-1 text-sm text-slate-400">Public health signals safe for indexing and external monitors.</p>
                </div>
                <ShieldCheck className="h-6 w-6 text-emerald-300" />
              </div>
              <div className="divide-y divide-white/10">
                {report.checks.map((check) => (
                  <div key={check.name} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-white">
                        <StatusDot status={check.status} />
                        <span className="capitalize">{check.name.replaceAll('_', ' ')}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{check.detail}</p>
                    </div>
                    <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusClass(check.status)}`}>
                      {check.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <aside className="space-y-6">
              <section className="rounded-lg border border-white/10 bg-slate-950 p-6">
                <h2 className="text-lg font-black text-white">Railway Deployment</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Environment</dt>
                    <dd className="font-semibold text-slate-200">{report.deployment.environment || 'Not exposed'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Service</dt>
                    <dd className="font-semibold text-slate-200">{report.deployment.service || 'Not exposed'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Deployment</dt>
                    <dd className="break-all font-semibold text-slate-200">{report.deployment.deploymentId || 'Not exposed'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Region</dt>
                    <dd className="font-semibold text-slate-200">{report.deployment.region || 'Not exposed'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Node</dt>
                    <dd className="font-semibold text-slate-200">{report.nodeVersion || 'Not reported'}</dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-lg border border-white/10 bg-slate-950 p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-amber-300" />
                  <div>
                    <h2 className="text-lg font-black text-white">Incident Notes</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      No public incident is currently posted. Private Railway logs remain internal; this page reports safe runtime and deployment signals.
                    </p>
                  </div>
                </div>
              </section>
            </aside>
          </div>

          <section className="mt-8 rounded-lg border border-white/10 bg-slate-950 p-6">
            <h2 className="text-xl font-black text-white">Operational Coverage</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {['Web app', 'Authentication', 'CRM and leads', 'Finance', 'Automation'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-3 text-sm font-semibold text-emerald-100">
                  <CheckCircle2 className="h-4 w-4" />
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              <Link href="/sla" className="text-cyan-300 hover:text-cyan-200">SLA</Link>
              <Link href="/legal" className="text-cyan-300 hover:text-cyan-200">Legal Hub</Link>
              <Link href="/security-policy" className="text-cyan-300 hover:text-cyan-200">Security Policy</Link>
              <Link href="/contact" className="text-cyan-300 hover:text-cyan-200">Contact Support</Link>
            </div>
          </section>
        </section>
      </main>
    </MarketingLandingShell>
  );
}

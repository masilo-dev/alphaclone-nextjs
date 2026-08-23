'use client';

/**
 * Platform Owner Command Center — home for super_admin / platform owner.
 * Oversees tenants, ops logs, pre-customer review, users, and platform health.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Building2,
  ClipboardList,
  CreditCard,
  HeartPulse,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { PlatformEnvStatus } from '@/types/platformSettings';

type HealthPayload = {
  status?: string;
  checks?: {
    config?: {
      services?: Record<string, string>;
    };
    redis?: { status?: string; message?: string };
  };
};

type OpsBrief = {
  brief?: string;
  recent?: Array<{ id?: string; message: string; severity?: string | null; created_at?: string }>;
};

type TenantRow = {
  id: string;
  name: string;
  status?: string;
  subscription?: string;
};

const QUICK_LINKS = [
  {
    href: '/dashboard/admin/tenants',
    label: 'Tenants',
    description: 'Suspend, inspect, and manage every workspace.',
    icon: Building2,
  },
  {
    href: '/dashboard/admin/operations',
    label: 'Ops & logs',
    description: 'Error brief, incident intake, platform signals.',
    icon: ClipboardList,
  },
  {
    href: '/dashboard/admin/users',
    label: 'Platform users',
    description: 'Accounts across all tenants.',
    icon: Users,
  },
  {
    href: '/dashboard/security',
    label: 'Security',
    description: 'Access and security posture.',
    icon: ShieldCheck,
  },
  {
    href: '/dashboard/admin/improvements',
    label: 'Pre-customer review',
    description: 'Product improvements and review queue.',
    icon: Zap,
  },
  {
    href: '/dashboard/admin/settings',
    label: 'Global settings',
    description: 'Platform-wide configuration and integration keys.',
    icon: Activity,
  },
  {
    href: '/dashboard/admin/subscriptions',
    label: 'Subscriptions',
    description: 'Real-time billing, Stripe IDs, MRR, and daily usage per tenant.',
    icon: CreditCard,
  },
];

const ENV_LABELS: Array<{ key: keyof PlatformEnvStatus; label: string }> = [
  { key: 'stripe', label: 'Stripe' },
  { key: 'resend', label: 'Resend' },
  { key: 'anthropic', label: 'Anthropic' },
  { key: 'openai', label: 'OpenAI' },
  { key: 'gemini', label: 'Gemini' },
  { key: 'googleOAuth', label: 'Google OAuth' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'twitter', label: 'X / Twitter' },
  { key: 'microsoft365', label: 'Microsoft 365' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'zoom', label: 'Zoom' },
  { key: 'daily', label: 'Daily.co' },
  { key: 'zoho', label: 'Zoho' },
  { key: 'turnstile', label: 'Cloudflare Turnstile' },
  { key: 'webPush', label: 'Web Push (VAPID)' },
];

export default function PlatformOwnerHome() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [ops, setOps] = useState<OpsBrief | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [envStatus, setEnvStatus] = useState<PlatformEnvStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, opsRes, tenantsRes, settingsRes] = await Promise.all([
        fetch('/api/health?deep=1').then((r) => r.json()).catch(() => null),
        fetch('/api/admin/operations-brief').then((r) => r.json()).catch(() => null),
        fetch('/api/admin/tenants').then((r) => r.json()).catch(() => null),
        fetch('/api/admin/platform-settings').then((r) => r.json()).catch(() => null),
      ]);

      setHealth(healthRes);
      if (opsRes && !opsRes.error) setOps(opsRes);
      const list = Array.isArray(tenantsRes?.tenants)
        ? tenantsRes.tenants
        : Array.isArray(tenantsRes)
          ? tenantsRes
          : [];
      setTenants(list.slice(0, 8));
      if (settingsRes?.envStatus) setEnvStatus(settingsRes.envStatus as PlatformEnvStatus);
    } catch {
      toast.error('Could not refresh platform owner overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const healthStatus = health?.status || 'unknown';
  const recentErrors = ops?.recent?.slice(0, 5) || [];
  const activeTenants = tenants.filter((t) => t.status === 'active' || t.status === 'trial').length;
  const missingKeys = ENV_LABELS.filter((item) => envStatus && !envStatus[item.key]);
  const healthGaps = Object.entries(health?.checks?.config?.services || {})
    .filter(([, value]) => value === 'missing')
    .map(([key]) => key);
  if (health?.checks?.redis?.status === 'skipped' || health?.checks?.redis?.message) {
    if (!healthGaps.includes('redis')) healthGaps.push('redis');
  }

  return (
    <div className="space-y-6 max-w-6xl animate-fade-in px-1 py-2">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-teal-400/80">Platform owner</p>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">Command Center</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Oversee tenants, production health, ops logs, missing service keys, and pre-customer review from one desk.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {(missingKeys.length > 0 || healthGaps.length > 0) && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
              <KeyRound className="h-4 w-4 text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-amber-100 uppercase tracking-widest">
                Missing or optional keys
              </h2>
              <p className="text-xs text-amber-100/70 mt-1">
                These are not silent anymore — configure them in Railway / deployment env, then refresh. Tenant OAuth
                apps still connect per workspace; platform keys power shared services.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {missingKeys.map((item) => (
                  <span
                    key={item.key}
                    className="rounded-lg border border-amber-500/20 bg-slate-950/40 px-2.5 py-1 text-[11px] font-semibold text-amber-100"
                  >
                    {item.label}
                  </span>
                ))}
                {healthGaps.map((gap) => (
                  <span
                    key={gap}
                    className="rounded-lg border border-amber-500/20 bg-slate-950/40 px-2.5 py-1 text-[11px] font-semibold text-amber-100"
                  >
                    {gap}
                  </span>
                ))}
              </div>
              <Link
                href="/dashboard/admin/settings"
                className="inline-block mt-3 text-xs font-bold text-teal-300 hover:text-teal-200"
              >
                Open Global Settings →
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-[11px] font-black uppercase tracking-widest">
            <HeartPulse className="h-3.5 w-3.5" /> Health
          </div>
          <p className={`mt-2 text-xl font-black ${healthStatus === 'healthy' ? 'text-emerald-400' : 'text-amber-300'}`}>
            {healthStatus}
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-[11px] font-black uppercase tracking-widest">
            <Building2 className="h-3.5 w-3.5" /> Active tenants
          </div>
          <p className="mt-2 text-xl font-black text-white">{loading ? '—' : activeTenants || tenants.length}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-[11px] font-black uppercase tracking-widest">
            <AlertTriangle className="h-3.5 w-3.5" /> Recent signals
          </div>
          <p className="mt-2 text-xl font-black text-white">{recentErrors.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {QUICK_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-2xl border border-white/5 bg-slate-900/40 p-4 hover:border-teal-500/30 hover:bg-slate-900/70 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20">
                <item.icon className="h-5 w-5 text-teal-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-white group-hover:text-teal-200">{item.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
          <h2 className="text-sm font-black text-white uppercase tracking-widest mb-3">Latest tenants</h2>
          {tenants.length === 0 ? (
            <p className="text-sm text-slate-500">{loading ? 'Loading…' : 'No tenants loaded.'}</p>
          ) : (
            <ul className="space-y-2">
              {tenants.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-200 font-medium truncate">{t.name}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {t.status || t.subscription || '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/dashboard/admin/tenants" className="inline-block mt-4 text-xs font-bold text-teal-400 hover:text-teal-300">
            Open tenant manager →
          </Link>
        </section>

        <section className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
          <h2 className="text-sm font-black text-white uppercase tracking-widest mb-3">Ops log snapshot</h2>
          {recentErrors.length === 0 ? (
            <p className="text-sm text-slate-500">{loading ? 'Loading…' : 'No recent error signals.'}</p>
          ) : (
            <ul className="space-y-2">
              {recentErrors.map((row, idx) => (
                <li key={row.id || idx} className="text-sm text-slate-300 border-b border-white/5 pb-2 last:border-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/80 mr-2">
                    {row.severity || 'info'}
                  </span>
                  {row.message}
                </li>
              ))}
            </ul>
          )}
          <Link href="/dashboard/admin/operations" className="inline-block mt-4 text-xs font-bold text-teal-400 hover:text-teal-300">
            Open operations console →
          </Link>
        </section>
      </div>
    </div>
  );
}

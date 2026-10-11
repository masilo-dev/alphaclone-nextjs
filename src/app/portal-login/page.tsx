'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  LogIn,
  Sun,
  Moon,
  Clock,
  KeyRound,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { sanitizeInternalRedirect } from '@/lib/security/safeRedirect';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useTheme } from '@/contexts/ThemeContext';
import { Input } from '@/components/ui/input';

export const dynamic = 'force-dynamic';

export default function PortalLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="ac-client-portal-root min-h-screen w-full bg-[var(--ws-canvas)] text-[var(--ws-text-primary)] grid place-items-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-ac-accent)]" />
        </div>
      }
    >
      <PortalLoginContent />
    </Suspense>
  );
}

function PortalLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDark, setThemeMode } = useTheme();

  const rawNext = searchParams?.get('next') || searchParams?.get('returnTo') || searchParams?.get('redirect') || null;
  const safeNext = sanitizeInternalRedirect(rawNext);
  const rawTokenFromNext = (() => {
    if (!safeNext) return null;
    const match = safeNext.match(/^\/portal\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  })();

  const urlError = searchParams?.get('error');
  const isInvitation = searchParams?.get('invitation') === 'true' || Boolean(rawTokenFromNext);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (urlError === 'expired' || urlError === 'link_expired') return 'This invitation link has expired. Please contact your account manager for a fresh link.';
    if (urlError === 'invalid_token') return 'This workspace token is invalid or has been revoked.';
    if (urlError === 'access_denied') return 'Access denied. Please check your credentials or contact support.';
    return null;
  });
  const [rateLimitInfo, setRateLimitInfo] = useState<{ retryAfter: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRecoveryInfo, setShowRecoveryInfo] = useState(false);

  useEffect(() => {
    if (!rateLimitInfo) return;
    const interval = setInterval(() => {
      setRateLimitInfo((prev) => {
        if (!prev) return null;
        const next = prev.retryAfter - 1;
        return next <= 0 ? null : { retryAfter: next };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitInfo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setRateLimitInfo(null);
    setIsSubmitting(true);

    try {
      const payload: { email: string; password: string; token?: string } = {
        email: email.trim(),
        password,
      };
      if (rawTokenFromNext) {
        payload.token = rawTokenFromNext;
      }

      const res = await fetch('/api/client-portal-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setError(data.error || 'Too many login attempts. Please try again later.');
        if (typeof data.retryAfter === 'number') {
          setRateLimitInfo({ retryAfter: data.retryAfter });
        }
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Login failed. Please verify your email and password.');
        return;
      }

      const redirectTarget = data.redirectTo || safeNext || '/';
      router.replace(redirectTarget);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRateLimit = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="relative ac-client-portal-root min-h-screen w-full bg-[var(--ws-canvas)] text-[var(--ws-text-primary)] flex flex-col justify-between p-4 sm:p-6 selection:bg-[var(--color-ac-accent)] selection:text-white">
      {/* Top utility row: Language switcher & Light/Dark Theme toggle */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-2 group transition-opacity hover:opacity-85">
          <div className="w-8 h-8 rounded-lg bg-[var(--ws-panel)] border border-[var(--ws-border)] flex items-center justify-center text-[var(--color-ac-accent)] font-bold text-sm tracking-wider">
            AC
          </div>
          <span className="type-ui font-semibold text-xs tracking-wider uppercase text-[var(--ws-text-secondary)]">
            AlphaClone Systems
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setThemeMode(isDark ? 'light' : 'dark', { skipServer: true })}
            className="w-8 h-8 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-panel)] flex items-center justify-center text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)] transition-colors"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Main Authentication Container - Cloudflare Inspired Restrained Form */}
      <main className="w-full flex-1 flex items-center justify-center my-6">
        <div className="w-full max-w-[400px]">
          {/* Centered Brand Icon & Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--ws-panel)] border border-[var(--ws-border)] shadow-md mb-3 text-[var(--color-ac-accent)]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="type-ui font-bold text-xl tracking-tight text-[var(--ws-text-primary)]">
              Sign in to your client workspace
            </h1>
            <p className="type-caption text-[var(--ws-text-muted)] mt-1 max-w-xs mx-auto">
              {isInvitation
                ? 'Welcome. Enter your credentials to access your shared workspace.'
                : 'Enter your email and password to access your secure documents and projects.'}
            </p>
          </div>

          {/* Restrained Card */}
          <div className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] p-5 sm:p-6 shadow-xl">
            {/* Status alerts */}
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs flex items-start gap-2.5 text-rose-200"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium leading-relaxed">{error}</p>
                  {rateLimitInfo && (
                    <p className="mt-1 font-mono text-[11px] text-rose-300">
                      Retry in {formatRateLimit(rateLimitInfo.retryAfter)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {showRecoveryInfo && (
              <div className="mb-4 rounded-lg border border-teal-500/30 bg-teal-500/10 p-3 text-xs flex items-start gap-2.5 text-teal-200">
                <KeyRound className="w-4 h-4 shrink-0 mt-0.5 text-teal-400" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-teal-100 mb-0.5">Password Recovery</p>
                  <p className="leading-relaxed">
                    Client workspaces use password-protected tokens. If you forgot your password, contact your AlphaClone project owner to receive a fresh magic-link invitation.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowRecoveryInfo(false)}
                    className="mt-2 text-[11px] font-bold text-teal-300 hover:text-teal-100 underline"
                  >
                    Close notice
                  </button>
                </div>
              </div>
            )}

            {/* Compact Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="email"
                  className="block type-caption font-semibold uppercase tracking-wider text-[var(--ws-text-secondary)] mb-1"
                >
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  disabled={isSubmitting || Boolean(rateLimitInfo)}
                  className="w-full h-10 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] px-3 text-sm text-[var(--ws-text-primary)] placeholder:text-[var(--ws-text-disabled)] focus:outline-none focus:border-[var(--color-ac-accent)] focus:ring-1 focus:ring-[var(--color-ac-accent)] transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="password"
                    className="block type-caption font-semibold uppercase tracking-wider text-[var(--ws-text-secondary)]"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowRecoveryInfo(true)}
                    className="type-caption text-xs text-[var(--color-ac-accent)] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    disabled={isSubmitting || Boolean(rateLimitInfo)}
                    className="w-full h-10 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] pl-3 pr-10 text-sm text-[var(--ws-text-primary)] placeholder:text-[var(--ws-text-disabled)] focus:outline-none focus:border-[var(--color-ac-accent)] focus:ring-1 focus:ring-[var(--color-ac-accent)] transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] transition-colors"
                    tabIndex={-1}
                    disabled={isSubmitting || Boolean(rateLimitInfo)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || Boolean(rateLimitInfo)}
                className="w-full h-10 mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-ac-accent)] hover:bg-[var(--color-ac-accent-hover)] active:bg-[var(--color-ac-accent-deep)] text-white text-sm font-semibold tracking-wide transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign in to workspace</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-[var(--ws-border)] text-center">
              <p className="type-caption text-xs text-[var(--ws-text-muted)]">
                Team member?{' '}
                <Link
                  href="/auth/login"
                  className="font-medium text-[var(--ws-text-secondary)] hover:text-[var(--ws-text-primary)] transition-colors inline-flex items-center gap-1"
                >
                  Go to staff login <ArrowRight className="w-3 h-3" />
                </Link>
              </p>
            </div>
          </div>

          {/* Restrained Security Footer */}
          <div className="mt-4 flex items-center justify-center gap-1.5 type-caption text-xs text-[var(--ws-text-muted)]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted 256-bit client workspace</span>
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="w-full max-w-5xl mx-auto py-3 text-center border-t border-[var(--ws-border)]">
        <p className="type-caption text-[11px] text-[var(--ws-text-muted)]">
          © {new Date().getFullYear()} AlphaClone Systems Inc. All rights reserved. · Privacy & Security Certified
        </p>
      </footer>
    </div>
  );
}

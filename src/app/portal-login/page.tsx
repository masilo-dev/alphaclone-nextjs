'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Eye, EyeOff, Loader2, ShieldCheck, LogIn } from 'lucide-react';
import { sanitizeInternalRedirect } from '@/lib/security/safeRedirect';

export const dynamic = 'force-dynamic';

export default function PortalLoginPage() {
    return (
        <Suspense fallback={
            <div className="ac-client-portal-root ac-business-root min-h-screen w-full bg-[color:var(--background-app)] text-[color:var(--text-primary)] grid place-items-center p-6">
                <Loader2 className="h-6 w-6 animate-spin text-[color:var(--brand-teal)]" />
            </div>
        }>
            <PortalLoginContent />
        </Suspense>
    );
}

function PortalLoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const rawNext = searchParams?.get('next') || searchParams?.get('returnTo') || searchParams?.get('redirect') || null;
    const safeNext = sanitizeInternalRedirect(rawNext);
    const rawTokenFromNext = (() => {
        if (!safeNext) return null;
        const match = safeNext.match(/^\/portal\/([^/?#]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    })();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rateLimitInfo, setRateLimitInfo] = useState<{ retryAfter: number } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
                setError(data.error || 'Login failed. Please try again.');
                return;
            }

            const redirectTarget = safeNext || data.redirectTo || '/';
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
        <div className="ac-client-portal-root ac-business-root min-h-screen w-full bg-[color:var(--background-app)] text-[color:var(--text-primary)]">
            <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
                <div className="w-full max-w-md">
                    <div className="mb-8 text-center">
                        <div className="inline-flex items-center gap-2 mb-4">
                            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--brand-teal)_18%,var(--ws-panel))] text-[color:var(--brand-teal)] border border-[color:var(--ws-border)]">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--ws-text-primary)]">
                            Client workspace sign in
                        </h1>
                        <p className="mt-2 type-caption text-[color:var(--ws-text-secondary)]">
                            Enter your credentials to access your secure shared workspace.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] p-5 sm:p-7 shadow-[color:var(--ws-card-shadow)]">
                        {error ? (
                            <div
                                role="alert"
                                className="mb-5 rounded-xl border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,var(--ws-panel))] p-3.5 type-ui"
                            >
                                <div className="flex gap-3">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[color:var(--error)]" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[color:var(--ws-text-primary)] font-medium">{error}</p>
                                        {rateLimitInfo ? (
                                            <p className="mt-1 type-card-description text-[color:var(--ws-text-tertiary)]">
                                                Retry available in <span className="font-semibold text-[color:var(--error)]">{formatRateLimit(rateLimitInfo.retryAfter)}</span>
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block type-label font-medium text-[color:var(--ws-text-primary)] mb-1.5">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    disabled={isSubmitting || !!rateLimitInfo}
                                    className="w-full rounded-lg border border-[color:var(--ws-border)] bg-[color:var(--ws-surface-secondary)] px-3.5 py-2.5 type-caption text-[color:var(--ws-text-primary)] placeholder:text-[color:var(--ws-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-teal)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label htmlFor="password" className="block type-label font-medium text-[color:var(--ws-text-primary)]">
                                        Password
                                    </label>
                                    <Link
                                        href="/auth/reset-password"
                                        className="type-caption font-medium text-[color:var(--brand-teal)] hover:opacity-80 transition-opacity"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        disabled={isSubmitting || !!rateLimitInfo}
                                        className="w-full rounded-lg border border-[color:var(--ws-border)] bg-[color:var(--ws-surface-secondary)] px-3.5 py-2.5 pr-10 type-caption text-[color:var(--ws-text-primary)] placeholder:text-[color:var(--ws-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-teal)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((s) => !s)}
                                        className="absolute inset-y-0 right-0 flex items-center px-3 text-[color:var(--ws-text-tertiary)] hover:text-[color:var(--ws-text-primary)] disabled:opacity-50"
                                        tabIndex={-1}
                                        disabled={isSubmitting || !!rateLimitInfo}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || !!rateLimitInfo}
                                className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--brand-teal)] px-4 py-2.5 type-ui font-semibold text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[color:var(--ws-panel)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Signing in…</span>
                                    </>
                                ) : (
                                    <>
                                        <LogIn className="h-4 w-4" />
                                        <span>Sign in to workspace</span>
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-5 pt-5 border-t border-[color:var(--ws-border)]">
                            <p className="text-center type-card-description text-[color:var(--ws-text-tertiary)]">
                                Need staff access?{' '}
                                <Link
                                    href="/auth/login"
                                    className="font-medium text-[color:var(--ws-text-secondary)] hover:text-[color:var(--ws-text-primary)] transition-colors"
                                >
                                    Go to team login
                                </Link>
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-center gap-1.5 type-ui text-[color:var(--ws-text-tertiary)]">
                        <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--success)]" />
                        <span>Private · encrypted · secure connection</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck, KeyRound } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function SetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="ac-client-portal-root ac-business-root min-h-screen w-full bg-[color:var(--background-app)] text-[color:var(--text-primary)] grid place-items-center p-6">
                <Loader2 className="h-6 w-6 animate-spin text-[color:var(--brand-teal)]" />
            </div>
        }>
            <SetPasswordContent />
        </Suspense>
    );
}

function SetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const token = searchParams?.get('token')?.trim() || null;

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDone, setIsDone] = useState(false);

    useEffect(() => {
        if (!token) {
            setNotice('If you were not just emailed a secure login link, sign in with your existing password below.');
        }
    }, [token]);

    const strengthBars = (() => {
        if (!newPassword) return [false, false, false, false];
        const len8 = newPassword.length >= 8;
        const upCase = /[A-Z]/.test(newPassword);
        const lowCase = /[a-z]/.test(newPassword);
        const digit = /\d/.test(newPassword);
        return [len8, lowCase && upCase, digit || /[^A-Za-z0-9]/.test(newPassword), new Set(newPassword.split('')).size >= 6];
    })();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting || isDone) return;
        setError(null);
        setNotice(null);
        if (newPassword !== confirmPassword) {
            setError('The new password and confirmation do not match.');
            return;
        }
        if (newPassword.length < 8) {
            setError('Use a password at least 8 characters long.');
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/client-portal-auth/set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    newPassword,
                    confirmPassword,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 401) {
                const go = token
                    ? `/portal-login?next=${encodeURIComponent(`/portal/${encodeURIComponent(token)}`)}`
                    : '/portal-login';
                router.replace(go);
                return;
            }
            if (!res.ok) {
                setError(data.error || 'Could not set your password. Please request a new link or try again.');
                return;
            }
            setIsDone(true);
            setTimeout(() => {
                router.replace(data.redirectTo || (token ? `/portal/${encodeURIComponent(token)}` : '/'));
            }, 1100);
        } catch {
            setError('Network error. Please check your connection and try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const portalLoginHref = token
        ? `/portal-login?next=${encodeURIComponent(`/portal/${encodeURIComponent(token)}`)}`
        : '/portal-login';

    return (
        <div className="ac-client-portal-root ac-business-root min-h-screen w-full bg-[color:var(--background-app)] text-[color:var(--text-primary)] grid place-items-center p-4 sm:p-6 lg:p-10">
            <div className="w-full max-w-[460px]">
                <div className="flex flex-col items-center mb-6 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-[color:var(--brand-teal)]/10 text-[color:var(--brand-teal)] grid place-items-center mb-4 border border-[color:var(--border-strong)]">
                        <ShieldCheck className="h-7 w-7" strokeWidth={1.8} />
                    </div>
                    <h1 className="text-2xl leading-tight font-semibold tracking-tight">
                        {isDone ? 'Password set' : 'Set your secure client portal password'}
                    </h1>
                    <p className="type-caption mt-2 text-[color:var(--text-secondary)] max-w-[360px]">
                        {isDone
                            ? 'Signing you into your workspace…'
                            : 'Create a password you only use here. You will use this plus your email each time you sign in.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="rounded-2xl border border-[color:var(--border-medium)] bg-[color:var(--surface-elevated)] p-5 sm:p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                    <div className="mb-4">
                        <label className="block type-ui font-medium mb-2 text-[color:var(--text-primary)]">
                            New password
                        </label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--text-tertiary)]" />
                            <input
                                type={showPasswords ? 'text' : 'password'}
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                disabled={isSubmitting || isDone}
                                className="w-full h-11 rounded-xl border border-[color:var(--border-medium)] bg-[color:var(--surface-base)] pl-9 pr-10 type-ui outline-none focus:border-[color:var(--brand-teal)] focus:ring-2 focus:ring-[color:var(--brand-teal)]/20 disabled:opacity-60"
                                placeholder="Minimum 8 characters"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPasswords((s) => !s)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-lg text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)]"
                                tabIndex={-1}
                                aria-label={showPasswords ? 'Hide password' : 'Show password'}
                            >
                                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {newPassword && (
                            <div className="mt-2 grid grid-cols-4 gap-1.5">
                                {strengthBars.map((on, i) => (
                                    <div
                                        key={i}
                                        className={`h-1.5 rounded-full transition-colors ${
                                            on
                                                ? i < 2
                                                    ? 'bg-amber-400'
                                                    : 'bg-emerald-500'
                                                : 'bg-[color:var(--border-strong)]'
                                        }`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mb-4">
                        <label className="block type-ui font-medium mb-2 text-[color:var(--text-primary)]">
                            Confirm new password
                        </label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--text-tertiary)]" />
                            <input
                                type={showPasswords ? 'text' : 'password'}
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={isSubmitting || isDone}
                                className="w-full h-11 rounded-xl border border-[color:var(--border-medium)] bg-[color:var(--surface-base)] pl-9 pr-3 type-ui outline-none focus:border-[color:var(--brand-teal)] focus:ring-2 focus:ring-[color:var(--brand-teal)]/20 disabled:opacity-60"
                                placeholder="Re-enter password"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3.5 py-2.5 type-ui text-rose-600 dark:text-rose-400 mb-4 flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {notice && (
                        <div className="rounded-xl border border-[color:var(--brand-teal)]/25 bg-[color:var(--brand-teal)]/5 px-3.5 py-2.5 type-ui text-[color:var(--text-secondary)] mb-4">
                            {notice}
                        </div>
                    )}

                    {isDone && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-2.5 type-ui text-emerald-700 dark:text-emerald-400 mb-4 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                            <span>Password saved. Taking you to your workspace…</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting || isDone}
                        className="w-full h-11 rounded-xl bg-[color:var(--brand-teal)] hover:bg-[color:var(--brand-teal)]/90 text-white type-ui font-medium shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_1px_1px_rgba(15,23,42,0.08)] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                    >
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isDone ? 'Signed in' : 'Set password & sign in'}
                    </button>

                    <div className="mt-5 flex items-center justify-between type-ui text-[color:var(--text-secondary)]">
                        <Link href={portalLoginHref} className="hover:text-[color:var(--text-primary)] transition-colors">
                            Already have a password? Sign in
                        </Link>
                        <Link href="/auth/reset-password" className="hover:text-[color:var(--text-primary)] transition-colors">
                            Forgot it?
                        </Link>
                    </div>
                </form>

                <div className="mt-6 text-center type-ui text-[color:var(--text-tertiary)] flex items-center justify-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Session secured with end-to-end server-side verification.</span>
                </div>
            </div>
        </div>
    );
}

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot, Check, X, Loader2, Shield } from 'lucide-react';
import Link from 'next/link';
<<<<<<< HEAD
import { supabase } from '@/lib/supabase';
=======
>>>>>>> origin/main

function AuthorizeContent() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [approving, setApproving] = useState(false);
    const [error, setError] = useState('');

    const clientId            = searchParams?.get('client_id');
    const redirectUri         = searchParams?.get('redirect_uri');
    const state               = searchParams?.get('state');
    const codeChallenge       = searchParams?.get('code_challenge');
    const codeChallengeMethod = searchParams?.get('code_challenge_method') || 'S256';
    const scope               = searchParams?.get('scope') || 'read write';

    useEffect(() => {
        if (!loading && !user) {
            const currentUrl = window.location.pathname + window.location.search;
<<<<<<< HEAD
            router.push(`/auth/login?returnTo=${encodeURIComponent(currentUrl)}`);
=======
            router.push(`/login?returnTo=${encodeURIComponent(currentUrl)}`);
>>>>>>> origin/main
        }
    }, [user, loading, router]);

    const handleApprove = async () => {
        if (!user) {
            setError('Please log in first.');
            return;
        }

        setApproving(true);
        setError('');

        try {
<<<<<<< HEAD
            const normalizedScope = (scope || 'read write')
                .split(/[\s+]+/)
                .map((s) => (s === 'wrie' ? 'write' : s))
                .filter(Boolean)
                .filter((s, i, arr) => arr.indexOf(s) === i)
                .join(' ');

            // Prefer Bearer from the browser session. Cookie-only auth often 401s
            // on /authorize because ChatGPT opens this page with a client session
            // that may not be mirrored into SSR auth cookies yet.
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;
            if (!accessToken) {
                const currentUrl = window.location.pathname + window.location.search;
                router.push(`/auth/login?returnTo=${encodeURIComponent(currentUrl)}`);
                return;
            }

            const res = await fetch('/api/mcp/oauth/approve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                credentials: 'include',
                cache: 'no-store',
                body: JSON.stringify({
=======
            const res = await fetch('/api/mcp/oauth/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
>>>>>>> origin/main
                    client_id: clientId,
                    redirect_uri: redirectUri,
                    state,
                    code_challenge: codeChallenge || undefined,
                    code_challenge_method: codeChallenge ? codeChallengeMethod : undefined,
<<<<<<< HEAD
                    scope: normalizedScope,
                })
            });

            const data = await res.json().catch(() => ({}));

            if (res.status === 401) {
                const currentUrl = window.location.pathname + window.location.search;
                router.push(`/auth/login?returnTo=${encodeURIComponent(currentUrl)}`);
                return;
            }

            if (res.status === 524 || res.status === 502 || res.status === 504) {
                throw new Error(
                    'Authorization timed out. Wait a few seconds and click Authorize Access again.'
                );
            }

            if (!res.ok) {
                throw new Error(
                    data.error_description || data.error || 'Failed to approve authorization'
                );
=======
                    scope,
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to approve authorization');
>>>>>>> origin/main
            }

            if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
            } else {
                throw new Error('No redirect URL returned');
            }
        } catch (err: any) {
            console.error('Approval error:', err);
            setError(err.message || 'An error occurred during approval.');
            setApproving(false);
        }
    };

    const handleDeny = () => {
        if (redirectUri) {
            try {
                const url = new URL(redirectUri);
                url.searchParams.set('error', 'access_denied');
                url.searchParams.set('error_description', 'The user denied access');
                if (state) url.searchParams.set('state', state);
                window.location.href = url.toString();
            } catch {
                router.push('/dashboard');
            }
        } else {
            router.push('/dashboard');
        }
    };

    if (loading || !user) {
        return (
<<<<<<< HEAD
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
                <p className="text-sm">{loading ? 'Checking your session…' : 'Redirecting to sign in…'}</p>
=======
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
>>>>>>> origin/main
            </div>
        );
    }

    if (!redirectUri) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-white text-center">
                <div className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 max-w-md w-full">
                    <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold mb-2">Invalid Request</h1>
                    <p className="text-slate-400 mb-6">Missing redirect_uri parameter.</p>
                    <Link href="/dashboard" className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[20%] left-[30%] w-[40%] h-[40%] bg-teal-500/10 blur-[120px] rounded-full animate-pulse" />
            </div>

            <div className="relative z-10 bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
                <div className="w-20 h-20 bg-teal-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-teal-500/20">
                    <Bot className="w-10 h-10 text-teal-400" />
                </div>

                <h1 className="text-2xl font-bold mb-2">Authorize Connection</h1>
                <p className="text-slate-400 mb-2">
<<<<<<< HEAD
                    An AI assistant (ChatGPT, Claude, or another connector) is requesting access to your AlphaClone workspace.
=======
                    An AI Assistant (Claude) is requesting access to your AlphaClone workspace to perform automated tasks on your behalf.
>>>>>>> origin/main
                </p>

                {codeChallenge && (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-teal-400 mb-6">
                        <Shield className="w-3.5 h-3.5" />
                        <span>PKCE-secured connection</span>
                    </div>
                )}

                <div className="text-left bg-slate-800/40 rounded-xl p-4 mb-6 text-sm space-y-2">
<<<<<<< HEAD
                    <p className="text-slate-300 font-medium">This will allow the connector to:</p>
=======
                    <p className="text-slate-300 font-medium">This will allow Claude to:</p>
>>>>>>> origin/main
                    <ul className="text-slate-400 space-y-1 list-disc list-inside">
                        <li>Read your CRM, deals, and contacts</li>
                        <li>Manage tasks and projects on your behalf</li>
                        <li>Access your workspace tools via MCP</li>
                    </ul>
                    {clientId && (
                        <p className="text-slate-500 text-xs pt-1">Client: {clientId}</p>
                    )}
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <button
                        onClick={handleApprove}
                        disabled={approving}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl font-bold transition-all disabled:opacity-50"
                    >
                        {approving ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Check className="w-5 h-5" />
                        )}
                        {approving ? 'Authorizing...' : 'Authorize Access'}
                    </button>

                    <button
                        onClick={handleDeny}
                        disabled={approving}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-transparent hover:bg-slate-800 text-slate-300 rounded-xl font-medium transition-all disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                        Deny Access
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AuthorizePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
        }>
            <AuthorizeContent />
        </Suspense>
    );
}

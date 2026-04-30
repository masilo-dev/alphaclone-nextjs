'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot, Check, X, Loader2 } from 'lucide-react';
import Link from 'next/link';

function AuthorizeContent() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [approving, setApproving] = useState(false);
    const [error, setError] = useState('');

    const clientId = searchParams?.get('client_id');
    const redirectUri = searchParams?.get('redirect_uri');
    const state = searchParams?.get('state');

    useEffect(() => {
        if (!loading && !user) {
            // Redirect to login if not authenticated
            const currentUrl = window.location.pathname + window.location.search;
            router.push(`/login?returnTo=${encodeURIComponent(currentUrl)}`);
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
            const res = await fetch('/api/mcp/oauth/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    redirect_uri: redirectUri,
                    state,
                    user_id: user.id
                })
            });

            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Failed to approve authorization');
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
            const url = new URL(redirectUri);
            url.searchParams.set('error', 'access_denied');
            if (state) url.searchParams.set('state', state);
            window.location.href = url.toString();
        } else {
            router.push('/dashboard');
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
        );
    }

    if (!clientId || !redirectUri) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-white text-center">
                <div className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 max-w-md w-full">
                    <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold mb-2">Invalid Request</h1>
                    <p className="text-slate-400 mb-6">Missing client_id or redirect_uri parameters.</p>
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
                <div className="absolute top-[20%] left-[30%] w-[40%] h-[40%] bg-teal-500/10 blur-[120px] rounded-full animate-pulse"></div>
            </div>

            <div className="relative z-10 bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
                <div className="w-20 h-20 bg-teal-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-teal-500/20">
                    <Bot className="w-10 h-10 text-teal-400" />
                </div>
                
                <h1 className="text-2xl font-bold mb-2">Authorize Connection</h1>
                <p className="text-slate-400 mb-8">
                    An AI Assistant (Claude) is requesting access to your AlphaClone workspace to perform automated tasks on your behalf.
                </p>

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
                        Cancel and Return
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

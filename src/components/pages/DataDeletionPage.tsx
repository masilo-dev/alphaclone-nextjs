'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Trash2, Shield, AlertTriangle, CheckCircle2, Clock,
    Mail, User, MessageSquare, Loader2, ExternalLink, Info
} from 'lucide-react';

function DataDeletionContent() {
    const searchParams = useSearchParams();
    const codeFromUrl = searchParams?.get('code');

    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; confirmation_code?: string; message?: string; already_exists?: boolean } | null>(null);
    const [statusCheck, setStatusCheck] = useState<{ status: string; source?: string; created_at?: string; processed_at?: string } | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(false);

    const checkStatus = async (code: string) => {
        setLoadingStatus(true);
        const res = await fetch(`/api/data-deletion?code=${code}`);
        const data = await res.json();
        if (data.request) setStatusCheck(data.request);
        setLoadingStatus(false);
    };

    useEffect(() => {
        if (codeFromUrl) {
            checkStatus(codeFromUrl);
        }
    }, [codeFromUrl]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setSubmitting(true);
        const res = await fetch('/api/data-deletion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name, reason }),
        });
        const data = await res.json();
        setResult(data);
        if (data.success && data.confirmation_code) {
            checkStatus(data.confirmation_code);
        }
        setSubmitting(false);
    };

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center">
                            <Trash2 className="w-6 h-6 text-red-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Data Deletion Request</h1>
                            <p className="text-slate-400 text-sm">GDPR, CCPA & Facebook compliant</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Info box */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <div className="flex gap-3">
                        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-300 space-y-2">
                            <p><strong>What data will be deleted?</strong></p>
                            <ul className="list-disc list-inside space-y-1 text-blue-400">
                                <li>Your account profile (name, email, phone)</li>
                                <li>All leads and client records you created</li>
                                <li>All project, task, and campaign data</li>
                                <li>Facebook integrations and page connections</li>
                                <li>All messages, emails, and communication logs</li>
                                <li>Uploaded media assets and documents</li>
                            </ul>
                            <p className="text-blue-500 text-xs mt-2">Processing time: up to 30 days as required by law.</p>
                        </div>
                    </div>
                </div>

                {/* Facebook-specific info */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex gap-3">
                        <Shield className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-slate-300 space-y-2">
                            <p><strong>Connected via Facebook Login?</strong></p>
                            <p className="text-slate-400">If you used Facebook Login, you can also remove your data from Facebook's settings:</p>
                            <a
                                href="https://www.facebook.com/settings?tab=applications"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-teal-400 hover:text-teal-300 text-sm font-medium"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Go to Facebook Settings → Apps
                            </a>
                        </div>
                    </div>
                </div>

                {/* Status display (if code in URL) */}
                {(codeFromUrl || result?.confirmation_code) && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-400" />
                            Request Status
                        </h2>
                        {loadingStatus ? (
                            <div className="flex items-center gap-2 text-slate-400">
                                <Loader2 className="w-4 h-4 animate-spin" /> Checking status...
                            </div>
                        ) : statusCheck ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                        statusCheck.status === 'completed' ? 'bg-green-500/20 text-green-400'
                                        : statusCheck.status === 'processing' ? 'bg-amber-500/20 text-amber-400'
                                        : 'bg-blue-500/20 text-blue-400'
                                    }`}>
                                        {statusCheck.status.toUpperCase()}
                                    </span>
                                    <span className="text-xs text-slate-500 capitalize">Source: {statusCheck.source}</span>
                                </div>
                                <div className="text-sm text-slate-400 space-y-1">
                                    <p>Request submitted: {statusCheck.created_at ? new Date(statusCheck.created_at).toLocaleString() : '—'}</p>
                                    {statusCheck.processed_at && (
                                        <p>Processed: {new Date(statusCheck.processed_at).toLocaleString()}</p>
                                    )}
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-3">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Confirmation Code</p>
                                    <code className="text-sm font-mono text-teal-400">{codeFromUrl || result?.confirmation_code}</code>
                                    <p className="text-xs text-slate-600 mt-1">Save this code to check status later.</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-slate-500">Unable to load status. Please save your confirmation code.</p>
                        )}
                    </div>
                )}

                {/* Form */}
                {!result?.success && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                            <Trash2 className="w-4 h-4 text-red-400" />
                            Submit Deletion Request
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                                    Email Address * <span className="text-slate-600">(associated with your account)</span>
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                                    Full Name <span className="text-slate-600">(optional)</span>
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="John Doe"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                                    Reason for Deletion <span className="text-slate-600">(optional, helps us improve)</span>
                                </label>
                                <div className="relative">
                                    <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                    <textarea
                                        value={reason}
                                        onChange={e => setReason(e.target.value)}
                                        rows={3}
                                        placeholder="Why are you requesting deletion? (e.g. no longer using service, privacy concerns, etc.)"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-300">
                                    <strong>Warning:</strong> This action cannot be undone. Once your data is deleted, it cannot be recovered. Please ensure you have exported any data you wish to keep before submitting this request.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || !email.trim()}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
                            >
                                {submitting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                                ) : (
                                    <><Trash2 className="w-4 h-4" /> Request Data Deletion</>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* Success message */}
                {result?.success && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                            <div>
                                <h3 className="font-semibold text-green-400">Request Received</h3>
                                <p className="text-sm text-green-300 mt-1">{result.message}</p>
                                {result.confirmation_code && (
                                    <div className="mt-4 bg-slate-900 rounded-lg p-4 border border-slate-800">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Your Confirmation Code</p>
                                        <code className="text-lg font-mono text-teal-400">{result.confirmation_code}</code>
                                        <p className="text-xs text-slate-600 mt-2">
                                            Save this code. You can use it to check the status of your request at any time.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Contact support */}
                <div className="text-center py-4 border-t border-slate-800">
                    <p className="text-sm text-slate-500">
                        Questions? Contact us at{' '}
                        <a href="mailto:privacy@alphaclonesystems.com" className="text-teal-400 hover:text-teal-300">
                            privacy@alphaclonesystems.com
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}

// Wrap in Suspense for useSearchParams
export default function DataDeletionPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
            </div>
        }>
            <DataDeletionContent />
        </Suspense>
    );
}

'use client';

import React, { useMemo, useState } from 'react';
import { Gift, Copy, Check, Share2, Mail, MessageSquare } from 'lucide-react';
import { User } from '../../../types';
import toast from 'react-hot-toast';

interface ReferralsPageProps {
    user: User;
    tenant?: any;
}

const ReferralsPage: React.FC<ReferralsPageProps> = ({ user, tenant }) => {
    const [copied, setCopied] = useState(false);

    const referralCode = useMemo(() => {
        const base = (tenant?.slug || user.id || 'ref').toString();
        return base.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 12) || 'ref';
    }, [tenant?.slug, user.id]);

    const referralLink = useMemo(() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return `${origin}/signup?ref=${referralCode}`;
    }, [referralCode]);

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(referralLink);
            setCopied(true);
            toast.success('Referral link copied');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Could not copy link');
        }
    };

    const shareText = `Join me on AlphaClone — the all-in-one AI business OS. Sign up with my link:`;

    const shareTargets = [
        {
            label: 'WhatsApp',
            icon: MessageSquare,
            color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${referralLink}`)}`,
        },
        {
            label: 'Email',
            icon: Mail,
            color: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
            href: `mailto:?subject=${encodeURIComponent('Try AlphaClone')}&body=${encodeURIComponent(`${shareText} ${referralLink}`)}`,
        },
        {
            label: 'X / Twitter',
            icon: Share2,
            color: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
            href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(referralLink)}`,
        },
    ];

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                    <Gift className="w-6 h-6 text-teal-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Refer & Grow</h1>
                    <p className="text-slate-400">Share AlphaClone with other businesses using your personal link.</p>
                </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Your referral link</label>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        readOnly
                        value={referralLink}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 font-mono"
                    />
                    <button
                        onClick={copyLink}
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-500 rounded-xl text-sm font-bold text-white transition-colors"
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                    {shareTargets.map(t => (
                        <a
                            key={t.label}
                            href={t.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-transform active:scale-95 ${t.color}`}
                        >
                            <t.icon className="w-4 h-4" />
                            {t.label}
                        </a>
                    ))}
                </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-3">How it works</h3>
                <ol className="space-y-2 text-sm text-slate-400 list-decimal list-inside">
                    <li>Share your unique link with other business owners.</li>
                    <li>They sign up for AlphaClone using your link.</li>
                    <li>You both unlock rewards once they activate their workspace.</li>
                </ol>
            </div>
        </div>
    );
};

export default ReferralsPage;

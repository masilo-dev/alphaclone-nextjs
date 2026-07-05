'use client';

import React, { Suspense } from 'react';
import { Loader2, Mail } from 'lucide-react';
import UnifiedInboxView from './business/UnifiedInboxView';
import { User } from '../../types';

interface MailTabProps {
    user: User;
}

const MailTab: React.FC<MailTabProps> = () => {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center p-6 min-h-[50vh]">
                    <div className="w-full max-w-md rounded-3xl border border-white/5 bg-slate-900/70 p-8 text-center space-y-5">
                        <div className="relative mx-auto w-16 h-16">
                            <div className="absolute inset-0 rounded-full bg-teal-500/10 blur-xl scale-125" />
                            <div className="relative w-16 h-16 rounded-2xl bg-slate-800 border border-white/5 flex items-center justify-center">
                                <Mail className="w-8 h-8 text-teal-400" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Loader2 className="w-5 h-5 text-teal-500 animate-spin mx-auto" />
                            <p className="text-slate-200 font-semibold">Loading mail…</p>
                            <p className="text-slate-500 text-sm">Bringing in inbox threads, labels, and synced accounts.</p>
                        </div>
                    </div>
                </div>
            }
        >
            <div className="h-full p-3 md:p-5">
                <UnifiedInboxView />
            </div>
        </Suspense>
    );
};

export default MailTab;

'use client';

import React, { Suspense } from 'react';
import UnifiedInboxView from './UnifiedInboxView';
import { User } from '../../../types';
import { Loader2 } from 'lucide-react';

interface MessagesPageProps {
    user?: User;
}

const MessagesPage: React.FC<MessagesPageProps> = () => {
    return (
        <div className="h-full flex flex-col bg-slate-950 p-3 md:p-5">
            <div className="mb-3 shrink-0">
                <h1 className="text-xl font-bold text-white">Mail</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                    Your inbox on the left — read and reply. Use <strong className="text-slate-300 font-medium">Write new email</strong> for one message, or <strong className="text-slate-300 font-medium">Bulk send</strong> for campaigns to many people at once.
                </p>
            </div>
            <div className="flex-1 min-h-0">
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                            <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                            Loading mail…
                        </div>
                    }
                >
                    <UnifiedInboxView />
                </Suspense>
            </div>
        </div>
    );
};

export default MessagesPage;

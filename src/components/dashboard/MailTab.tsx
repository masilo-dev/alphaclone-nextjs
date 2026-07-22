'use client';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import UnifiedInbox from './business/UnifiedInbox';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
import { User } from '../../types';

interface MailTabProps {
    user: User;
}

const MailTab: React.FC<MailTabProps> = () => {
    return (
        <Suspense
            fallback={
                <div className="flex flex-col items-center justify-center p-12 gap-4 h-[50vh]">
                    <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
                    <p className="text-sm text-slate-400">Loading mail…</p>
                </div>
            }
        >
            <ModulePageLayout className="h-full min-h-0">
                <UnifiedInbox />
            </ModulePageLayout>
        </Suspense>
    );
};

export default MailTab;

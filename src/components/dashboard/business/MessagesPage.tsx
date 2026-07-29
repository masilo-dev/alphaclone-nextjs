'use client';

<<<<<<< HEAD
import React, { Suspense } from 'react';
import UnifiedInbox from './UnifiedInbox';
import { Loader2 } from 'lucide-react';

const MessagesPage: React.FC = () => {
    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="flex-1 min-h-0">
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                            <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                            Loading mail…
                        </div>
                    }
                >
                    <UnifiedInbox />
                </Suspense>
            </div>
        </div>
=======
import React from 'react';
import { Mail } from 'lucide-react';
import ComingSoon from '../ComingSoon';
import { User } from '../../../types';

interface MessagesPageProps {
    user: User;
}

const MessagesPage: React.FC<MessagesPageProps> = () => {
    return (
        <ComingSoon 
            title="Gmail & SMTP Mail" 
            subtitle="Secure Gmail inbox synchronization, smart thread routing, and AI email triage assistant are currently under development."
            icon={Mail}
        />
>>>>>>> origin/main
    );
};

export default MessagesPage;

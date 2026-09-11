'use client';

import React, { Suspense } from 'react';
import UnifiedInboxView from './UnifiedInboxView';
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
                    <UnifiedInboxView />
                </Suspense>
            </div>
        </div>
    );
};

export default MessagesPage;

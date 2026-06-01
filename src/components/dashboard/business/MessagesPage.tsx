'use client';

import React from 'react';
import MicrosoftInboxView from './MicrosoftInboxView';
import { User } from '../../../types';

interface MessagesPageProps {
    user: User;
}

const MessagesPage: React.FC<MessagesPageProps> = () => {
    return (
        <div className="h-full bg-slate-950 p-4 md:p-6">
            <div className="mb-4">
                <h1 className="text-2xl font-bold text-white">Unified Inbox</h1>
                <p className="text-sm text-slate-400">
                    Outlook messages now flow into the existing Alphaclone inbox experience with a Microsoft-backed compose view.
                </p>
            </div>
            <MicrosoftInboxView />
        </div>
    );
};

export default MessagesPage;

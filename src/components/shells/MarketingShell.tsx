'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ExitIntentModal from '@/components/ExitIntentModal';

export default function MarketingShell({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();

    // Pass-through shell for standard web users.
    // Exit-intent modal only shows on web (not PWA)
    return (
        <>
            {children}
            <ExitIntentModal user={user} />
        </>
    );
}

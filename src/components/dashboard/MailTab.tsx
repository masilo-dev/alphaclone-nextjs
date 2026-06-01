'use client';

import React from 'react';
import { Mail } from 'lucide-react';
import ComingSoon from './ComingSoon';

interface MailTabProps {
    user: any;
}

const MailTab: React.FC<MailTabProps> = () => {
    return (
        <ComingSoon 
            title="Outlook & Provider Mail" 
            subtitle="Secure Outlook inbox synchronization, smart thread routing, and AI email triage across connected providers are currently under development."
            icon={Mail}
        />
    );
};

export default MailTab;

'use client';

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
    );
};

export default MessagesPage;

'use client';

import React from 'react';
<<<<<<< HEAD
import WhatsAppChatHub from './business/WhatsAppChatHub';

export default function WhatsAppManagementPage() {
    return (
        <WhatsAppChatHub />
=======
import { MessageCircle } from 'lucide-react';
import ComingSoon from './ComingSoon';

export default function WhatsAppManagementPage() {
    return (
        <ComingSoon 
            title="WhatsApp Suite" 
            subtitle="Omnichannel WhatsApp messaging, automated workflows, and AI auto-reply agent integration are currently under development."
            icon={MessageCircle}
        />
>>>>>>> origin/main
    );
}

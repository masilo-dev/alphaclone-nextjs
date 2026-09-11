'use client';

import { useAuth } from '@/contexts/AuthContext';
import CampaignBuilder from '@/components/dashboard/business/CampaignBuilder';

export default function CampaignManager() {
    const { user } = useAuth();

    if (!user?.id) return null;

    return <CampaignBuilder userId={user.id} />;
}

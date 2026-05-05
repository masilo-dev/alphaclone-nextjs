'use client';

import React from 'react';
import { User } from '../../../types';
import EngagingDashboard from './EngagingDashboard';
import LaunchActivationChecklist from './LaunchActivationChecklist';
import PlanActivationPanel from './PlanActivationPanel';

interface BusinessHomeProps {
    user: User;
    stats?: any;
}

const BusinessHome: React.FC<BusinessHomeProps> = ({ user, stats }) => {
    return (
        <div className="space-y-4">
            <LaunchActivationChecklist />
            <PlanActivationPanel />
            <EngagingDashboard user={user} stats={stats} />
        </div>
    );
};

export default BusinessHome;

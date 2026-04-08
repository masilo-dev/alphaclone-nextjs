'use client';

import React from 'react';
import { User } from '../../../types';
import EngagingDashboard from './EngagingDashboard';

interface BusinessHomeProps {
    user: User;
    stats?: any;
}

const BusinessHome: React.FC<BusinessHomeProps> = ({ user, stats }) => {
    return <EngagingDashboard user={user} stats={stats} />;
};

export default BusinessHome;

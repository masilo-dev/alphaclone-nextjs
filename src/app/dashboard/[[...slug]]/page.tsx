import React from 'react';
import DashboardClientPage from './DashboardClientPage';

// Force Next.js to not statically cache this page in production
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
    return <DashboardClientPage />;
}

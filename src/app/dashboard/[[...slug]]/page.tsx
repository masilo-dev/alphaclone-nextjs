import React from 'react';
import DashboardNoSSR from './DashboardNoSSR';

// Force Next.js to not statically cache this page in production
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
    return <DashboardNoSSR />;
}

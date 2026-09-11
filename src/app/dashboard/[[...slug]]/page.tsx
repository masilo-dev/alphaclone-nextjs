import React from 'react';
import DashboardNoSSR from './DashboardNoSSR';

// Force Next.js to treat this page as fully dynamic (never statically prerendered)
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
    return <DashboardNoSSR />;
}

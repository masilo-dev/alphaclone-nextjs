'use client';

import React from 'react';

export default function MarketingShell({ children }: { children: React.ReactNode }) {
    // Pass-through shell for standard web users.
    // Any global marketing headers/footers that live outside of specific pages could go here.
    return <>{children}</>;
}

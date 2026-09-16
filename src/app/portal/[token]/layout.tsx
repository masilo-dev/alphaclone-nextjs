import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
    robots: { index: false, follow: false },
    title: 'Client Workspace · AlphaClone',
    description: 'Secure client workspace for projects, invoices, contracts, documents and communication.',
};

export default function ClientFinancePortalLayout({ children }: { children: ReactNode }) {
    return (
        <div className="ac-client-portal-root ac-business-root min-h-screen w-full bg-[color:var(--background-app)] text-[color:var(--text-primary)]">
            {children}
        </div>
    );
}

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getRawSessionCookie, verifyClientPortalSessionToken } from '@/lib/auth/clientPortalAuth';

export const metadata: Metadata = {
    robots: { index: false, follow: false },
    title: 'Client Workspace · AlphaClone',
    description: 'Secure client workspace for projects, invoices, contracts, documents and communication.',
};

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

async function ClientFinancePortalLayoutInner({
    children,
    params,
}: {
    children: ReactNode;
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const raw = await getRawSessionCookie();

    let hasValidSession = false;
    if (raw) {
        const verified = verifyClientPortalSessionToken(raw);
        hasValidSession = verified.ok;
    }

    if (!hasValidSession) {
        const nextPath = `/portal/${encodeURIComponent(token)}`;
        redirect(`/portal-login?next=${encodeURIComponent(nextPath)}`);
    }

    return (
        <div className="ac-client-portal-root ac-business-root min-h-screen w-full bg-[color:var(--background-app)] text-[color:var(--text-primary)]">
            {children}
        </div>
    );
}

export default function ClientFinancePortalLayout(props: {
    children: ReactNode;
    params: Promise<{ token: string }>;
}) {
    return ClientFinancePortalLayoutInner(props);
}

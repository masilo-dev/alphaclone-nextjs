import '@/styles/product-system.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireClientPortalAccessDoubleGuarded } from '@/lib/auth/clientPortalAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const metadata: Metadata = {
    robots: { index: false, follow: false },
    title: { absolute: 'Client workspace' },
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
    const admin = createSupabaseAdminClient();

    const resolveClientByPortalToken = async (db: any, portalToken: string) => {
        const { data, error } = await db
            .from('business_clients')
            .select('id, tenant_id, is_active')
            .eq('finance_portal_token', portalToken)
            .maybeSingle();
        if (error) throw error;
        return data;
    };

    const access = await requireClientPortalAccessDoubleGuarded(
        admin,
        token,
        resolveClientByPortalToken
    );

    if (!access.ok) {
        // Preserve the first-time setup experience only for an active client whose
        // invite token resolves and who has not set a portal password yet.
        const { data: client } = await admin
            .from('business_clients')
            .select('id, client_portal_password_hash, is_active')
            .eq('finance_portal_token', token)
            .maybeSingle();

        if (client && client.is_active !== false && client.client_portal_password_hash == null) {
            redirect(`/set-password?token=${encodeURIComponent(token)}`);
        }

        const nextPath = `/portal/${encodeURIComponent(token)}`;
        redirect(`/portal-login?next=${encodeURIComponent(nextPath)}`);
    }

    return (
        <div className="ac-product-system ac-client-portal-root ac-business-root min-h-screen w-full bg-[color:var(--background-app)] text-[color:var(--text-primary)]">
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

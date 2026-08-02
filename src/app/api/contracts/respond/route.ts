import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { notifyTenantOwners } from '@/lib/notifyTenantOwners';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const token = String(body.token || '').trim();
        const action = String(body.action || '').trim();
        const note = String(body.note || '').trim();

        if (!token) {
            return NextResponse.json({ error: 'Signing token is required' }, { status: 400 });
        }
        if (action !== 'decline') {
            return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
        }

        const admin = createSupabaseAdminClient();
        const { data: signingToken, error: tokenError } = await admin
            .from('contract_signing_tokens')
            .select('tenant_id, contract_id, signer_email, signer_role, expires_at, used_at, revoked_at')
            .eq('token', token)
            .is('revoked_at', null)
            .single();

        if (tokenError || !signingToken) {
            return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 });
        }
        if (signingToken.used_at) {
            return NextResponse.json({ error: 'This signing link has already been used' }, { status: 410 });
        }
        if (new Date(signingToken.expires_at).getTime() < Date.now()) {
            return NextResponse.json({ error: 'This signing link has expired' }, { status: 410 });
        }

        const { data: contract, error: contractError } = await admin
            .from('contracts')
            .select('id, title, status, tenant_id, created_by')
            .eq('id', signingToken.contract_id)
            .eq('tenant_id', signingToken.tenant_id)
            .single();

        if (contractError || !contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }
        if (contract.status === 'fully_signed' || contract.status === 'client_signed') {
            return NextResponse.json({ error: 'Contract has already been signed' }, { status: 409 });
        }
        if (contract.status === 'rejected') {
            return NextResponse.json({ error: 'Contract was already declined' }, { status: 409 });
        }

        const now = new Date().toISOString();
        const { error: updateError } = await admin
            .from('contracts')
            .update({
                status: 'rejected',
                metadata: {
                    declined_at: now,
                    declined_by_email: signingToken.signer_email,
                    decline_note: note || null,
                },
            })
            .eq('id', contract.id);

        if (updateError) throw updateError;

        await admin
            .from('contract_signing_tokens')
            .update({ used_at: now, revoked_at: now })
            .eq('token', token);

        await admin.from('contract_audit_trail').insert({
            tenant_id: contract.tenant_id,
            contract_id: contract.id,
            action: 'contract_declined',
            actor_role: signingToken.signer_role,
            actor_email: signingToken.signer_email,
            details: { note: note || null },
        });

        const origin = req.nextUrl.origin;
        await notifyTenantOwners({
            tenantId: contract.tenant_id,
            type: 'contract',
            title: `Contract declined: ${contract.title}`,
            message: `${signingToken.signer_email} declined the contract${note ? `: "${note}"` : '.'}`,
            link: `${origin}/dashboard/contracts`,
            fallbackUserId: contract.created_by || undefined,
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Contract respond error:', error);
        return clientErrorResponse(error, { request: req, scope: 'contracts/respond' });
    }
}

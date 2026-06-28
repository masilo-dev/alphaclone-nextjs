import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { contractServerService } from '@/services/server/contractServerService';
import { notifyTenantOwners } from '@/lib/notifyTenantOwners';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { contractEmailTemplates } from '@/lib/email/contractEmailTemplates';

function getClientIpAddress(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
        const firstIp = forwarded.split(',')[0]?.trim();
        if (firstIp) return firstIp;
    }

    const realIp = req.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;

    return '127.0.0.1';
}

export async function GET(req: NextRequest) {
    try {
        const token = req.nextUrl.searchParams.get('token');
        if (!token) {
            return NextResponse.json({ error: 'Signing token is required' }, { status: 400 });
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
            .select('id, title, content, status, client_signed_at, tenant:tenants(name)')
            .eq('id', signingToken.contract_id)
            .eq('tenant_id', signingToken.tenant_id)
            .single();

        if (contractError || !contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            token,
            signer: { email: signingToken.signer_email, role: signingToken.signer_role },
            tokenStatus: { expiresAt: signingToken.expires_at, serverTime: new Date().toISOString() },
            contract,
        });
    } catch (error: any) {
        console.error('Contract public fetch error:', error);
        return clientErrorResponse(error, { request: req, scope: 'contracts/sign.GET' });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { contractId, role, signatureDataUrl, signerName, signerEmail, signingToken, consentGiven } = body;
        const normalizedSignerName = String(signerName || '').trim();
        const normalizedSignerEmail = String(signerEmail || '').trim().toLowerCase();

        if ((!contractId || !role) && !signingToken) {
            return NextResponse.json({ error: 'Missing signer context' }, { status: 400 });
        }
        if (!signatureDataUrl) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        if (signingToken && (!normalizedSignerName || !normalizedSignerEmail)) {
            return NextResponse.json({ error: 'Signer name and email are required' }, { status: 400 });
        }

        const ipAddress = getClientIpAddress(req);
        const userAgent = req.headers.get('user-agent') || 'unknown';
        let updatedContract;

        if (signingToken) {
            updatedContract = await contractServerService.signContractWithToken({
                signingToken,
                signatureDataUrl,
                signerName: normalizedSignerName,
                signerEmail: normalizedSignerEmail,
                ipAddress,
                userAgent,
                consentGiven: !!consentGiven,
            });
        } else {
            const supabase = await createSupabaseServerClient();
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            if (signerEmail && user.email && String(signerEmail).trim().toLowerCase() !== user.email.toLowerCase()) {
                return NextResponse.json({ error: 'Signer email does not match authenticated user' }, { status: 403 });
            }

            updatedContract = await contractServerService.signContract({
                contractId,
                userId: user.id,
                role,
                signatureDataUrl,
                signerName: normalizedSignerName || user.user_metadata?.full_name || user.email || 'Authorized Signer',
                signerEmail: normalizedSignerEmail || user.email || '',
                ipAddress,
                userAgent,
                consentGiven: !!consentGiven,
            });
        }

        // EMIT AUTOMATION EVENT + notify owner
        if (updatedContract) {
            const origin = req.nextUrl.origin;
            const admin = createSupabaseAdminClient();
            const { data: tenantRow } = await admin
                .from('tenants')
                .select('name')
                .eq('id', updatedContract.tenant_id)
                .maybeSingle();
            const workspaceName = tenantRow?.name || 'AlphaClone Systems';
            const signerEmailForMail =
                normalizedSignerEmail ||
                String(updatedContract.client_email || updatedContract.signer_email || '').trim().toLowerCase();
            const signerNameForMail =
                normalizedSignerName ||
                String(updatedContract.client_name || updatedContract.signer_name || 'Signer').trim();
            const fullySigned = updatedContract.status === 'fully_signed';

            if (
                signerEmailForMail &&
                (updatedContract.status === 'fully_signed' || updatedContract.status === 'client_signed')
            ) {
                await sendEmailServer({
                    tenantId: updatedContract.tenant_id,
                    to: signerEmailForMail,
                    subject: fullySigned
                        ? `Fully signed: ${updatedContract.title}`
                        : `Signed: ${updatedContract.title}`,
                    html: contractEmailTemplates.signedConfirmation({
                        recipientEmail: signerEmailForMail,
                        tenantId: updatedContract.tenant_id,
                        contractTitle: updatedContract.title,
                        signerName: signerNameForMail,
                        workspaceName,
                        fullySigned,
                    }),
                    isPlatformNotification: true,
                    skipFooter: true,
                }).catch((err) => console.error('Contract signer confirmation email failed:', err));
            }

            if (updatedContract.status === 'fully_signed' || updatedContract.status === 'client_signed') {
                await notifyTenantOwners({
                    tenantId: updatedContract.tenant_id,
                    type: 'contract',
                    title:
                        updatedContract.status === 'fully_signed'
                            ? `Contract fully signed: ${updatedContract.title}`
                            : `Client signed contract: ${updatedContract.title}`,
                    message: `Contract "${updatedContract.title}" was signed by ${signerNameForMail}${signerEmailForMail ? ` (${signerEmailForMail})` : ''}.`,
                    link: `${origin}/dashboard/contracts`,
                    fallbackUserId: updatedContract.created_by || undefined,
                }).catch((err) => console.error('Contract sign owner notify failed:', err));
            }
            if (updatedContract.status === 'fully_signed') {
                const { emitBusinessEvent } = await import('@/lib/automation/emit-event');
                await emitBusinessEvent(updatedContract.tenant_id, 'contract_signed', {
                    contractId: updatedContract.id,
                    title: updatedContract.title,
                    clientId: updatedContract.client_id,
                    projectId: updatedContract.project_id
                }).catch(err => console.error('Failed to emit contract_signed event:', err));
            }
        }

        return NextResponse.json({ success: true, contract: updatedContract });

    } catch (error: any) {
        console.error('Contract Sign Error:', error);
        return clientErrorResponse(error, { request: req, scope: 'contracts/sign' });
    }
}

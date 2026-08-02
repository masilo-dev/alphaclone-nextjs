import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { contractServerService } from '@/services/server/contractServerService';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { contractEmailTemplates } from '@/lib/email/contractEmailTemplates';
import { resolveContractDealId } from '@/lib/contracts/contractCoherenceServer';

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
            .select('id, title, content, status, client_signed_at, payment_amount, metadata, tenant:tenants(name, logo_url, settings)')
            .eq('id', signingToken.contract_id)
            .eq('tenant_id', signingToken.tenant_id)
            .single();

        if (contractError || !contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        const now = new Date().toISOString();
        const signerEmail = String(signingToken.signer_email || '').trim().toLowerCase();
        const { data: party } = await admin
            .from('contract_parties')
            .select('id, signing_order')
            .eq('tenant_id', signingToken.tenant_id)
            .eq('contract_id', signingToken.contract_id)
            .contains('party_snapshot', { email: signerEmail })
            .maybeSingle();

        await Promise.all([
            admin.from('contract_signature_events').insert({
                tenant_id: signingToken.tenant_id,
                contract_id: signingToken.contract_id,
                party_id: party?.id || null,
                event_type: 'viewed',
                signer_email: signerEmail,
                signing_order: party?.signing_order || null,
                provider: 'bonnie_esign',
                ip_address: getClientIpAddress(req),
                user_agent: req.headers.get('user-agent') || 'unknown',
                evidence: { token_expires_at: signingToken.expires_at },
                occurred_at: now,
            }),
            admin.from('contract_audit_trail').insert({
                tenant_id: signingToken.tenant_id,
                contract_id: signingToken.contract_id,
                action: 'contract_viewed',
                actor_role: signingToken.signer_role,
                actor_email: signerEmail,
                ip_address: getClientIpAddress(req),
                user_agent: req.headers.get('user-agent') || 'unknown',
            }),
            admin.from('contracts').update({
                viewed_at: contract.client_signed_at ? undefined : now,
                lifecycle_status: ['draft', 'review', 'sent'].includes(String(contract.status)) ? 'viewed' : undefined,
            }).eq('id', signingToken.contract_id).eq('tenant_id', signingToken.tenant_id),
        ]);

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

            if (!fullySigned) {
                const { sendOrderedContractSignatureReminders } = await import(
                    '@/services/contractSignatureReminderService'
                );
                await sendOrderedContractSignatureReminders({
                    tenantId: updatedContract.tenant_id,
                    contractId: updatedContract.id,
                    actorUserId: updatedContract.created_by || undefined,
                    force: true,
                }).catch((err) => console.error('Next ordered signer notification failed:', err));
            }

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
                const { onContractSignedSideEffects } = await import('@/services/contractNotificationService');
                await onContractSignedSideEffects({
                    tenantId: updatedContract.tenant_id,
                    contractId: updatedContract.id,
                    title: updatedContract.title,
                    clientId: updatedContract.client_id,
                    clientName: signerNameForMail,
                    dealId: resolveContractDealId(updatedContract),
                    createdBy: updatedContract.created_by,
                }).catch((err) => console.error('Contract signed side effects failed:', err));
            }
            if (updatedContract.status === 'fully_signed') {
                const { emitBusinessEvent } = await import('@/lib/automation/emit-event');
                await emitBusinessEvent(updatedContract.tenant_id, 'contract_signed', {
                    contractId: updatedContract.id,
                    title: updatedContract.title,
                    clientId: updatedContract.client_id,
                    projectId: updatedContract.project_id,
                    actorUserId: updatedContract.created_by,
                }).catch(err => console.error('Failed to emit contract_signed event:', err));

                const contentHash =
                    String(updatedContract.metadata?.content_hash || '') ||
                    String(updatedContract.content || updatedContract.title || '');
                const { generateContractAuditTrailPdf } = await import(
                    '@/lib/contracts/generateContractAuditTrailPdf'
                );
                await generateContractAuditTrailPdf({
                    tenantId: updatedContract.tenant_id,
                    contractId: updatedContract.id,
                    title: updatedContract.title,
                    contentHash,
                    status: updatedContract.status,
                }).catch((err) => console.error('Contract audit trail PDF failed:', err));
            }
        }

        return NextResponse.json({ success: true, contract: updatedContract });

    } catch (error: any) {
        console.error('Contract Sign Error:', error);
        return clientErrorResponse(error, { request: req, scope: 'contracts/sign' });
    }
}

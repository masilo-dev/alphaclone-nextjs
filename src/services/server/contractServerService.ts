import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import crypto from 'crypto';

export interface SignatureRequest {
    contractId: string;
    userId?: string;
    role: 'client' | 'admin';
    signatureDataUrl: string;
    signerName: string;
    signerEmail: string;
    ipAddress: string;
    userAgent: string;
    consentGiven?: boolean;
}

export interface TokenSignatureRequest {
    signingToken: string;
    signatureDataUrl: string;
    signerName: string;
    signerEmail: string;
    ipAddress: string;
    userAgent: string;
    consentGiven?: boolean;
}

export const contractServerService = {
    async resolveSigningToken(token: string) {
        const supabaseAdmin = createSupabaseAdminClient();
        const { data, error } = await supabaseAdmin
            .from('contract_signing_tokens')
            .select('id, tenant_id, contract_id, signer_email, signer_role, expires_at, used_at, revoked_at')
            .eq('token', token)
            .is('revoked_at', null)
            .single();

        if (error || !data) {
            throw new Error('Invalid signing token');
        }
        if (data.used_at) {
            throw new Error('Signing link already used');
        }
        if (new Date(data.expires_at).getTime() < Date.now()) {
            throw new Error('Signing link expired');
        }
        return data;
    },

    /**
     * Securely sign a contract
     */
    async signContract(req: SignatureRequest) {
        const supabase = await createSupabaseServerClient();
        const supabaseAdmin = createSupabaseAdminClient();

        // 1. Fetch current contract state
        const { data: contract, error: fetchError } = await supabaseAdmin
            .from('contracts')
            .select('*')
            .eq('id', req.contractId)
            .single();

        if (fetchError || !contract) {
            throw new Error('Contract not found');
        }

        // 2. Validate Sequence and state transitions
        if (req.role === 'admin' && contract.status !== 'client_signed' && contract.status !== 'sent') {
            throw new Error('Contract is not ready for admin signature');
        }

        if (req.role === 'client' && contract.status !== 'sent' && contract.status !== 'draft') {
            throw new Error('Contract is not available for client signature');
        }

        const signerEmail = String(req.signerEmail || '').trim().toLowerCase();
        const { data: signerParty } = await supabaseAdmin
            .from('contract_parties')
            .select('id, signing_order, signature_required, signature_status, party_snapshot')
            .eq('tenant_id', contract.tenant_id)
            .eq('contract_id', req.contractId)
            .contains('party_snapshot', { email: signerEmail })
            .maybeSingle();
        if (signerParty?.signing_order) {
            const { data: pendingEarlier } = await supabaseAdmin
                .from('contract_parties')
                .select('id')
                .eq('tenant_id', contract.tenant_id)
                .eq('contract_id', req.contractId)
                .eq('signature_required', true)
                .lt('signing_order', signerParty.signing_order)
                .neq('signature_status', 'signed')
                .limit(1);
            if (pendingEarlier?.length) {
                throw new Error('An earlier signer must complete their signature first');
            }
        }

        // 3. Verify Content Integrity
        const currentHash = this.generateHash(contract.content || '');
        // If the contract has a metadata.content_hash, we could verify against it.

        // 4. Record Signature Event (Compliance)
        const tamperSealInput = [
            req.contractId,
            req.userId,
            req.signerEmail,
            currentHash,
            new Date().toISOString()
        ].join('|');
        const tamperSeal = this.generateHash(tamperSealInput);

        const { data: sigEvent, error: sigError } = await supabaseAdmin
            .from('signature_events')
            .insert({
                contract_id: req.contractId,
                // signer_id must reference auth.users. Public signing links do not have auth users.
                signer_id: req.userId || null,
                signer_role: req.role,
                signer_name: req.signerName,
                signer_email: req.signerEmail,
                signer_ip: req.ipAddress,
                event_type: 'signature_completed',
                signature_data: req.signatureDataUrl,
                authentication_method: 'session',
                intent_statement: `I, ${req.signerName}, intend to sign this document and agree to be legally bound by its terms.`,
                device_info: {
                    user_agent: req.userAgent,
                    timestamp: new Date().toISOString(),
                },
                content_hash_at_signing: currentHash,
                tamper_seal: tamperSeal,
            })
            .select()
            .single();

        if (sigError) throw sigError;

        await supabaseAdmin.from('contract_signature_events').insert({
            tenant_id: contract.tenant_id,
            contract_id: req.contractId,
            party_id: signerParty?.id || null,
            event_type: 'signed',
            signer_email: signerEmail,
            signing_order: signerParty?.signing_order || null,
            provider: 'bonnie_esign',
            ip_address: req.ipAddress,
            user_agent: req.userAgent,
            document_hash: currentHash,
            evidence: {
                signature_event_id: sigEvent.id,
                authentication_method: req.userId ? 'session' : 'email_token',
                consent_given: Boolean(req.consentGiven),
                tamper_seal: tamperSeal,
            },
        });

        if (signerParty?.id) {
            await supabaseAdmin
                .from('contract_parties')
                .update({ signature_status: 'signed' })
                .eq('id', signerParty.id)
                .eq('tenant_id', contract.tenant_id);
        }

        const { data: requiredParties } = await supabaseAdmin
            .from('contract_parties')
            .select('id, signature_status')
            .eq('tenant_id', contract.tenant_id)
            .eq('contract_id', req.contractId)
            .eq('signature_required', true);
        const hasCanonicalParties = Boolean(requiredParties?.length);
        const allCanonicalPartiesSigned =
            hasCanonicalParties && requiredParties!.every((party: any) => party.signature_status === 'signed');

        // 4.5 Record Consent (Compliance)
        if (req.consentGiven) {
            const { error: consentError } = await supabaseAdmin
                .from('esignature_consents')
                .insert({
                    user_id: req.userId || null,
                    contract_id: req.contractId,
                    consent_given: true,
                    consent_text: 'Electronic Signature Disclosure and Consent accepted at time of signing.',
                    consent_method: 'checkbox',
                    ip_address: req.ipAddress,
                    user_agent: req.userAgent,
                });
            if (consentError) {
                console.error('Failed to record consent during signing:', consentError);
                // We don't throw here to avoid blocking signature if consent record fails but signature event succeeded
                // though ideally it should be atomic.
            }
        }

        // 5. Update Contract Status
        const updates: any = {};
        const now = new Date().toISOString();

        if (req.role === 'client') {
            updates.client_signature = req.signatureDataUrl;
            updates.client_signed_at = now;
        } else {
            updates.admin_signature = req.signatureDataUrl;
            updates.admin_signed_at = now;
        }
        if (hasCanonicalParties) {
            updates.status = allCanonicalPartiesSigned ? 'fully_signed' : 'sent';
            updates.lifecycle_status = allCanonicalPartiesSigned ? 'signed' : 'sent';
        } else if (req.role === 'client') {
            updates.status = contract.admin_signature ? 'fully_signed' : 'client_signed';
            updates.lifecycle_status = contract.admin_signature ? 'signed' : 'sent';
        } else {
            updates.status = contract.client_signature ? 'fully_signed' : 'sent';
            updates.lifecycle_status = contract.client_signature ? 'signed' : 'sent';
        }

        // Add audit fields directly to contract for redundancy/readability
        updates.metadata = {
            ...contract.metadata,
            last_signing_ip: req.ipAddress,
            content_hash: currentHash,
            history: [
                ...(contract.metadata?.history || []),
                { action: `signed_by_${req.role}`, sub: req.userId || 'external_signer', ts: now }
            ]
        };

        const { data: updatedContract, error: updateError } = await supabaseAdmin
            .from('contracts')
            .update(updates)
            .eq('id', req.contractId)
            .select()
            .single();

        if (updateError) throw updateError;

        // 6. Log to Audit Trail
        await supabaseAdmin.from('contract_audit_trail').insert({
            tenant_id: contract.tenant_id,
            contract_id: req.contractId,
            action: `contract_signed_by_${req.role}`,
            actor_id: req.userId || null,
            actor_role: req.role,
            actor_name: req.signerName,
            actor_email: req.signerEmail,
            ip_address: req.ipAddress,
            user_agent: req.userAgent,
            details: { signature_event_id: sigEvent.id, status: updates.status },
        });

        return updatedContract;
    },

    async signContractWithToken(req: TokenSignatureRequest) {
        const supabaseAdmin = createSupabaseAdminClient();
        const normalizedEmail = String(req.signerEmail || '').trim().toLowerCase();
        if (!normalizedEmail) {
            throw new Error('Signer email is required');
        }

        const nowIso = new Date().toISOString();
        const { data: claimed, error: claimError } = await supabaseAdmin
            .from('contract_signing_tokens')
            .update({
                used_at: nowIso,
                metadata: {
                    claimMode: 'pre_sign_atomic_claim',
                    claimedAt: nowIso,
                    claimedByEmail: normalizedEmail,
                },
            })
            .eq('token', req.signingToken)
            .eq('signer_email', normalizedEmail)
            .is('used_at', null)
            .is('revoked_at', null)
            .gt('expires_at', nowIso)
            .select('id, contract_id, signer_role, signer_email')
            .maybeSingle();

        if (claimError) {
            throw claimError;
        }
        if (!claimed) {
            // Distinguish invalid/used/expired/mismatch with a secondary lookup for better UX.
            const tokenState = await this.resolveSigningToken(req.signingToken).catch(() => null);
            if (!tokenState) throw new Error('Invalid signing token');
            if (String(tokenState.signer_email || '').trim().toLowerCase() !== normalizedEmail) {
                throw new Error('Signer email does not match this signing link');
            }
            if (tokenState.used_at) throw new Error('Signing link already used');
            if (new Date(tokenState.expires_at).getTime() < Date.now()) throw new Error('Signing link expired');
            throw new Error('Unable to claim signing link');
        }

        try {
            const updated = await this.signContract({
                contractId: claimed.contract_id,
                userId: undefined,
                role: claimed.signer_role,
                signatureDataUrl: req.signatureDataUrl,
                signerName: req.signerName,
                signerEmail: normalizedEmail,
                ipAddress: req.ipAddress,
                userAgent: req.userAgent,
                consentGiven: req.consentGiven,
            });

            return updated;
        } catch (error) {
            // Release token on failed signature write so the recipient can retry with the same link.
            await supabaseAdmin
                .from('contract_signing_tokens')
                .update({
                    used_at: null,
                    metadata: {
                        claimReleasedAt: new Date().toISOString(),
                        claimReleasedReason: error instanceof Error ? error.message : 'unknown_error',
                    },
                })
                .eq('id', claimed.id)
                .eq('used_at', nowIso);
            throw error;
        }
    },

    generateHash(text: string): string {
        return crypto.createHash('sha256').update(text).digest('hex');
    }
};

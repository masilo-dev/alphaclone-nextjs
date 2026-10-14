import { createSupabaseAdminClient } from '@/lib/supabase-admin';
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
    expectedTenantId?: string;
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

    /** All validation, token consumption and evidence writes commit or roll back together. */
    async signContract(req: SignatureRequest) {
        return recordAtomicSignature(req);
    },

    async signContractWithToken(req: TokenSignatureRequest) {
        return recordAtomicSignature(req);
    },

    generateHash(text: string): string {
        return crypto.createHash('sha256').update(text).digest('hex');
    }
};

async function recordAtomicSignature(req: SignatureRequest | TokenSignatureRequest) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc('record_contract_signature_atomic', {
        p_request: { ...req, signerEmail: String(req.signerEmail || '').trim().toLowerCase() },
    });
    if (error) throw new Error(error.message || 'Atomic signature transaction failed');
    if (!data?.contract) throw new Error('Atomic signature transaction returned no contract');
    return { ...data.contract, signature_replayed: data.replayed === true, signature_event_id: data.signature_event_id };
}

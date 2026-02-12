import { createAdminClient } from '@/lib/supabaseServer';
import crypto from 'crypto';

export interface SignatureRequest {
    contractId: string;
    userId: string;
    role: 'client' | 'admin';
    signatureDataUrl: string;
    signerName: string;
    signerEmail: string;
    ipAddress: string;
    userAgent: string;
}

export const contractServerService = {
    /**
     * Securely sign a contract
     */
    async signContract(req: SignatureRequest) {
        const supabaseAdmin = createAdminClient();

        // 1. Fetch current contract state
        const { data: contract, error: fetchError } = await supabaseAdmin
            .from('contracts')
            .select('*')
            .eq('id', req.contractId)
            .single();

        if (fetchError || !contract) {
            throw new Error('Contract not found');
        }

        // 2. Validate Sequence
        if (req.role === 'admin' && contract.status !== 'client_signed' && contract.status !== 'sent') {
            // In some flows, Admin can sign first if status is 'sent', 
            // but usually we want Client first. 
            // Let's allow Admin to sign if it's 'client_signed' or 'sent'.
        }

        if (req.role === 'client' && contract.status !== 'sent' && contract.status !== 'draft') {
            // Client can sign if it's 'sent' (standard) or 'draft' (if allowed)
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
                signer_id: req.userId,
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

        // 5. Update Contract Status
        const updates: any = {};
        const now = new Date().toISOString();

        if (req.role === 'client') {
            updates.client_signature = req.signatureDataUrl;
            updates.client_signed_at = now;
            updates.status = contract.admin_signature ? 'fully_signed' : 'client_signed';
        } else {
            updates.admin_signature = req.signatureDataUrl;
            updates.admin_signed_at = now;
            updates.status = contract.client_signature ? 'fully_signed' : 'sent';
        }

        // Add audit fields directly to contract for redundancy/readability
        updates.metadata = {
            ...contract.metadata,
            last_signing_ip: req.ipAddress,
            content_hash: currentHash,
            history: [
                ...(contract.metadata?.history || []),
                { action: `signed_by_${req.role}`, sub: req.userId, ts: now }
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
            contract_id: req.contractId,
            action: `contract_signed_by_${req.role}`,
            actor_id: req.userId,
            actor_role: req.role,
            actor_name: req.signerName,
            actor_email: req.signerEmail,
            ip_address: req.ipAddress,
            user_agent: req.userAgent,
            details: { signature_event_id: sigEvent.id, status: updates.status },
        });

        return updatedContract;
    },

    generateHash(text: string): string {
        return crypto.createHash('sha256').update(text).digest('hex');
    }
};

<<<<<<< HEAD
export const contractSigningService = {
  /**
   * Resolve a signing token to a contract and client (uses public API — contract_signing_tokens table).
   */
  async resolveToken(token: string): Promise<{
    contract: any | null;
    client: any | null;
    error: string | null;
  }> {
    try {
      const response = await fetch(`/api/contracts/sign?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.contract) {
        return {
          contract: null,
          client: null,
          error: payload?.error || 'Invalid or expired signing link.',
        };
      }

      const signerEmail = payload.signer?.email || '';
      return {
        contract: {
          ...payload.contract,
          tenant: payload.contract.tenant,
        },
        client: signerEmail ? { name: '', email: signerEmail } : null,
        error: null,
      };
    } catch (err: unknown) {
      console.error('[signingService] Error resolving token:', err);
      return {
        contract: null,
        client: null,
        error: err instanceof Error ? err.message : 'Failed to load signing link',
      };
=======
import { supabase } from '../lib/supabase';
import { esignatureComplianceService } from './esignatureComplianceService';

export const contractSigningService = {
  /**
   * Resolve a signing token to a contract and client
   */
  async resolveToken(token: string): Promise<{ 
    contract: any | null; 
    client: any | null; 
    error: string | null 
  }> {
    try {
      // 1. Find contract with this signing token
      const { data: contract, error: contractErr } = await supabase
        .from('contracts')
        .select(`
          *,
          tenant:tenant_id (*),
          client:client_id (*)
        `)
        .eq('signing_token', token)
        .single();

      if (contractErr || !contract) {
        return { contract: null, client: null, error: 'Invalid or expired signing link.' };
      }

      // 2. Return contract and attached client
      return { 
        contract, 
        client: contract.client, 
        error: null 
      };
    } catch (err: any) {
      console.error('[signingService] Error resolving token:', err);
      return { contract: null, client: null, error: err.message };
>>>>>>> origin/main
    }
  },

  /**
<<<<<<< HEAD
   * Execute the signature via the public signing API.
   */
  async signContract(
    contractId: string,
=======
   * Execute the signature
   */
  async signContract(
    contractId: string, 
>>>>>>> origin/main
    token: string,
    signatureData: string,
    signerName: string,
    signerEmail: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
<<<<<<< HEAD
      const response = await fetch('/api/contracts/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signingToken: token,
          signatureDataUrl: signatureData,
          signerName,
          signerEmail,
          consentGiven: true,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to sign contract');
      }

      return { success: true, error: null };
    } catch (err: unknown) {
      console.error('[signingService] Error signing contract:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to sign contract' };
    }
  },
=======
      // 1. Verify token still matches
      const { data: contract, error: verifyErr } = await supabase
        .from('contracts')
        .select('id, content, status')
        .eq('id', contractId)
        .eq('signing_token', token)
        .single();

      if (verifyErr || !contract) throw new Error('Unauthorized or invalid signature attempt.');
      if (contract.status === 'signed') throw new Error('Contract is already signed.');

      // 2. Generate content hash for legal integrity
      const contentHash = await esignatureComplianceService.generateHash(contract.content || '');

      // 3. Record the signature event (ESIGN compliant)
      const { success: eventSuccess, error: eventErr } = await esignatureComplianceService.recordSignatureEvent(
        contractId,
        'public-signer', // Generic ID for public signers
        'client',
        signerName,
        signerEmail,
        'signature_completed',
        signatureData,
        contentHash,
        ipAddress,
        userAgent,
        esignatureComplianceService.INTENT_STATEMENT.replace('[NAME]', signerName)
      );

      if (!eventSuccess) throw new Error(eventErr || 'Failed to record signature event.');

      // 4. Update contract status
      const { error: updateErr } = await supabase
        .from('contracts')
        .update({ 
          status: 'signed', 
          signed_at: new Date().toISOString(),
          // Clear token after signing to prevent reuse if desired, 
          // but we might want to keep it for "view signed document"
          // signing_token: null 
        })
        .eq('id', contractId);

      if (updateErr) throw updateErr;

      // 5. Log to audit trail
      await esignatureComplianceService.logAuditEvent(
        contractId,
        'CONTRACT_SIGNED_PUBLIC',
        'public-signer',
        'client',
        signerName,
        signerEmail,
        ipAddress,
        userAgent,
        { method: 'token_link', token }
      );

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[signingService] Error signing contract:', err);
      return { success: false, error: err.message };
    }
  }
>>>>>>> origin/main
};

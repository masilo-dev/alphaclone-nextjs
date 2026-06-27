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
    }
  },

  /**
   * Execute the signature via the public signing API.
   */
  async signContract(
    contractId: string,
    token: string,
    signatureData: string,
    signerName: string,
    signerEmail: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
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
};

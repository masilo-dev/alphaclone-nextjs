import {
  EMPTY_SIGNER_PROFILE,
  normalizeSignerProfile,
  type ContractSignerProfile,
  type SignerProfilePatch,
} from '@/lib/contracts/signerProfile';

const ENDPOINT = '/api/contracts/signer-profile';

async function parse(response: Response): Promise<ContractSignerProfile> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Signer profile request failed');
  }
  return normalizeSignerProfile(payload?.profile);
}

/** Client-side access to the owner's reusable signer profile. */
export const contractSignerProfileService = {
  async load(): Promise<ContractSignerProfile> {
    try {
      const response = await fetch(ENDPOINT, { credentials: 'include' });
      if (response.status === 401) return EMPTY_SIGNER_PROFILE;
      return await parse(response);
    } catch (error) {
      console.warn('[contractSignerProfile] load failed', error);
      return EMPTY_SIGNER_PROFILE;
    }
  },

  async save(patch: SignerProfilePatch): Promise<ContractSignerProfile> {
    const response = await fetch(ENDPOINT, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return parse(response);
  },

  async removeSignature(): Promise<ContractSignerProfile> {
    const response = await fetch(ENDPOINT, { method: 'DELETE', credentials: 'include' });
    return parse(response);
  },
};

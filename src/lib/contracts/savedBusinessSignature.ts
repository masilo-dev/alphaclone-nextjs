import { createHash } from 'node:crypto';
import { normalizeSignerProfile, SIGNER_PROFILE_CUSTOM_FIELD } from './signerProfile';

export async function inspectSavedBusinessSignature(admin: any, tenantId: string, userId: string, contractId: string) {
  const membership = await admin.from('tenant_users').select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (membership.error) throw new Error(membership.error.message);
  if (!['owner', 'admin', 'tenant_admin', 'super_admin'].includes(membership.data?.role)) throw new Error('Authorized tenant administrator required');
  const contract = await admin.from('contracts').select('id,tenant_id,status,content').eq('tenant_id', tenantId).eq('id', contractId).maybeSingle();
  if (contract.error || !contract.data) throw new Error(contract.error?.message || 'Contract not found');
  if (typeof contract.data.content !== 'string') throw new Error('Contract needs canonical text content');
  const profileRow = await admin.from('profiles').select('custom_fields').eq('id', userId).maybeSingle();
  if (profileRow.error) throw new Error(profileRow.error.message);
  const profile = normalizeSignerProfile(profileRow.data?.custom_fields?.[SIGNER_PROFILE_CUSTOM_FIELD]);
  if (!profile.signature || !profile.providerEmail) throw new Error('Saved business signature and provider email are required');
  return { contract: contract.data, profile, contentHash: createHash('sha256').update(contract.data.content).digest('hex') };
}

export async function applySavedBusinessSignature(admin: any, input: {
  tenantId: string; userId: string; contractId: string; expectedContentHash: string;
  ownerApproved: boolean; consentGiven: boolean;
}) {
  if (!input.ownerApproved || !input.consentGiven) throw new Error('Explicit owner approval and electronic-signature consent are required');
  const prepared = await inspectSavedBusinessSignature(admin, input.tenantId, input.userId, input.contractId);
  if (prepared.contentHash !== input.expectedContentHash) throw new Error('Contract changed since approval; review the current document');
  const { data, error } = await admin.rpc('record_contract_signature_atomic', { p_request: {
    contractId: input.contractId, expectedTenantId: input.tenantId, userId: input.userId,
    role: 'admin', signatureDataUrl: prepared.profile.signature!.dataUrl,
    signerName: prepared.profile.signature!.fullName, signerEmail: prepared.profile.providerEmail,
    consentGiven: true, expectedContentHash: input.expectedContentHash,
    ipAddress: '', userAgent: 'AlphaClone MCP saved-business-signature',
  } });
  if (error || !data?.contract || !data?.signature_event_id) throw new Error(error?.message || 'Signature persistence could not be verified');
  return { contract_id: input.contractId, status: data.contract.status, signature_event_id: data.signature_event_id, replayed: data.replayed === true, business_signature_recorded: true };
}

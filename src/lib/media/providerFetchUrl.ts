import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { requireCredentialEncryptionSecret } from '@/lib/integration/credentialEncryptionSecret';
import { getPublicAppUrl } from '@/lib/server/appUrl';

const PURPOSE = 'social_provider_fetch';
const DEFAULT_TTL_SECONDS = 60 * 60;

type ProviderFetchClaims = {
  asset_id: string;
  tenant_id: string;
  expires_at: number;
  purpose: typeof PURPOSE;
};

function secret(): string {
  return requireCredentialEncryptionSecret().secret;
}

function key(): Buffer {
  return createHash('sha256').update(secret()).digest();
}

export function createProviderFetchUrl(params: {
  tenantId: string;
  assetId: string;
  ttlSeconds?: number;
}): string {
  const claims: ProviderFetchClaims = {
    tenant_id: params.tenantId,
    asset_id: params.assetId,
    expires_at: Math.floor(Date.now() / 1000) + (params.ttlSeconds || DEFAULT_TTL_SECONDS),
    purpose: PURPOSE,
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(claims), 'utf8'), cipher.final()]);
  const token = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
  return `${getPublicAppUrl().replace(/\/$/, '')}/api/social-media/public/${token}`;
}

export function verifyProviderFetchToken(token: string): ProviderFetchClaims | null {
  try {
    const packed = Buffer.from(token, 'base64url');
    if (packed.length < 29) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(), packed.subarray(0, 12));
    decipher.setAuthTag(packed.subarray(12, 28));
    const plaintext = Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]);
    const claims = JSON.parse(plaintext.toString('utf8')) as ProviderFetchClaims;
    if (claims.purpose !== PURPOSE || !claims.asset_id || !claims.tenant_id) return null;
    if (!Number.isFinite(claims.expires_at) || claims.expires_at <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

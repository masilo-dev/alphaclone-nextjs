import { ENV } from '@/config/env';
import { decrypt, encrypt } from '@/lib/encryption';

export function getIntegrationEncryptionSecret(): string | null {
  const secret = ENV.ENCRYPTION_SECRET || ENV.ZOHO_ENCRYPTION_SECRET || null;
  return secret && secret.length === 32 ? secret : null;
}

export function isEncryptedToken(value: string): boolean {
  return value.includes(':') && value.split(':').length === 3;
}

export async function encryptIntegrationToken(token: string): Promise<string> {
  const secret = getIntegrationEncryptionSecret();
  if (!secret) return token;
  if (isEncryptedToken(token)) return token;
  return encrypt(token, secret);
}

export async function decryptIntegrationToken(stored: string): Promise<string> {
  if (!stored) return '';
  if (!isEncryptedToken(stored)) return stored;
  const secret = getIntegrationEncryptionSecret();
  if (!secret) return stored;
  try {
    return await decrypt(stored, secret);
  } catch {
    return stored;
  }
}

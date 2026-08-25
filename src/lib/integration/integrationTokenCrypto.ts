import { decrypt, encrypt } from '@/lib/encryption';
import {
  requireCredentialEncryptionSecret,
  resolveCredentialEncryptionSecret,
} from '@/lib/integration/credentialEncryptionSecret';
import { isProduction } from '@/lib/security/productionGuard';

export function getIntegrationEncryptionSecret(): string | null {
  return resolveCredentialEncryptionSecret()?.secret ?? null;
}

export function requireIntegrationEncryptionSecret(): string {
  try {
    return requireCredentialEncryptionSecret().secret;
  } catch (err) {
    if (isProduction()) {
      throw new Error(
        err instanceof Error ? err.message : 'Credential encryption secret (32+ chars) is required in production',
      );
    }
    throw err;
  }
}

export function isEncryptedToken(value: string): boolean {
  return value.includes(':') && value.split(':').length === 3;
}

const CONFIG_SECRET_KEYS = new Set([
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'apiKey',
  'api_key',
  'secret_key',
  'secretKey',
  'smtpPass',
  'imapPass',
  'appPassword',
  'webhookToken',
  'password',
  'botAccessToken',
  'pageAccessToken',
  'token',
  'clientSecret',
]);

export async function encryptIntegrationToken(token: string): Promise<string> {
  if (!token) return token;
  if (isEncryptedToken(token)) return token;
  const secret = getIntegrationEncryptionSecret();
  if (!secret) {
    if (isProduction()) {
      throw new Error('INTEGRATION_TOKEN_ENCRYPTION_SECRET (32+ chars) is required in production');
    }
    return token;
  }
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

export async function encryptIntegrationConfig(
  config: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const out = { ...config };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === 'string' && CONFIG_SECRET_KEYS.has(key) && value && !isEncryptedToken(value)) {
      out[key] = await encryptIntegrationToken(value);
    }
  }
  return out;
}

export async function decryptIntegrationConfig(
  config: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const out = { ...config };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === 'string' && CONFIG_SECRET_KEYS.has(key)) {
      out[key] = await decryptIntegrationToken(value);
    }
  }
  return out;
}

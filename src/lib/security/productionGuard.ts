import { NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { getIntegrationEncryptionSecret } from '@/lib/integration/integrationTokenCrypto';

export function isProduction(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT === 'production'
  );
}

/** Block dev-only inbox test injectors in production. */
export function denyIfInboxTestDisabled(): NextResponse | null {
  if (!isProduction()) return null;
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

/** Require internal API key for system routes (welcome email, etc.). */
export function denyUnlessInternalApiKey(req: Request): NextResponse | null {
  const secret = process.env.INTERNAL_API_KEY || process.env.CRON_SECRET;
  if (!secret) {
    if (isProduction()) {
      return NextResponse.json({ error: 'Route misconfigured' }, { status: 503 });
    }
    return null;
  }
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/** Fail closed when encryption secret is missing in production. */
export function assertProductionEncryptionConfigured(): void {
  if (!isProduction()) return;
  if (!getIntegrationEncryptionSecret()) {
    throw new Error('ENCRYPTION_SECRET (32 chars) is required in production');
  }
}

export function stripOAuthTokens<T extends Record<string, unknown>>(row: T | null): Record<string, unknown> | null {
  if (!row) return null;
  const copy = { ...row };
  for (const key of ['access_token', 'refresh_token', 'page_access_token', 'user_access_token', 'bot_access_token', 'auth_token', 'api_key', 'client_secret']) {
    if (key in copy) delete copy[key];
  }
  return copy;
}

export function maskIntegrationConfig(config: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!config || typeof config !== 'object') return null;
  const sensitive = new Set([
    'accessToken',
    'refreshToken',
    'access_token',
    'refresh_token',
    'apiKey',
    'api_key',
    'apiKey',
    'secret_key',
    'secretKey',
    'smtpPass',
    'imapPass',
    'appPassword',
    'webhookToken',
    'password',
    'botAccessToken',
    'pageAccessToken',
  ]);
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (sensitive.has(key) && typeof value === 'string' && value.length > 4) {
      masked[key] = `••••${value.slice(-4)}`;
    } else if (sensitive.has(key) && value) {
      masked[key] = '••••';
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

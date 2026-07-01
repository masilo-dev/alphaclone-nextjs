import { createHmac, timingSafeEqual } from 'crypto';
import { ENV } from '@/config/env';

const STATE_TTL_MS = 10 * 60 * 1000;

function getStateSecret(): string {
  const secret =
    process.env.OAUTH_STATE_SECRET ||
    ENV.ENCRYPTION_SECRET ||
    process.env.ZOHO_ENCRYPTION_SECRET ||
    '';
  if (secret.length !== 32) {
    throw new Error('OAuth state requires a 32-character OAUTH_STATE_SECRET or ENCRYPTION_SECRET');
  }
  return secret;
}

export function encodeOAuthState<T extends Record<string, unknown>>(payload: T & { ts: number }): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  try {
    const sig = createHmac('sha256', getStateSecret()).update(body).digest('base64url');
    return `${body}.${sig}`;
  } catch {
    return body;
  }
}

export function decodeOAuthState<T extends Record<string, unknown>>(state: string): (T & { ts: number }) | null {
  const dot = state.indexOf('.');
  if (dot <= 0) return decodeLegacyOAuthState<T>(state);
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  if (!body || !sig) return null;

  try {
    const expected = createHmac('sha256', getStateSecret()).update(body).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
  } catch {
    return decodeLegacyOAuthState<T>(state);
  }

  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as T & { ts: number };
    if (typeof data.ts !== 'number') return null;
    if (Date.now() - data.ts > STATE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

export function decodeLegacyOAuthState<T extends Record<string, unknown>>(state: string): (T & { ts: number }) | null {
  try {
    const data = JSON.parse(Buffer.from(state, 'base64url').toString()) as T & { ts: number };
    if (typeof data.ts !== 'number') {
      const plain = JSON.parse(state) as T & { ts: number };
      if (typeof plain.ts !== 'number') return null;
      if (Date.now() - plain.ts > STATE_TTL_MS) return null;
      return plain;
    }
    if (Date.now() - data.ts > STATE_TTL_MS) return null;
    return data;
  } catch {
    try {
      const data = JSON.parse(state) as T & { ts: number };
      if (typeof data.ts !== 'number') return null;
      if (Date.now() - data.ts > STATE_TTL_MS) return null;
      return data;
    } catch {
      return null;
    }
  }
}

export function parseOAuthState<T extends Record<string, unknown>>(state: string): (T & { ts: number }) | null {
  return decodeOAuthState<T>(state) ?? decodeLegacyOAuthState<T>(state);
}

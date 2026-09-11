import { createHmac, timingSafeEqual } from 'crypto';
import { ENV } from '@/config/env';

const STATE_TTL_MS = 10 * 60 * 1000;

export type LinkedInOAuthState = {
  nonce?: string | null;
  userId: string;
  tenantId?: string | null;
  returnTo?: string | null;
  ts: number;
};

function getStateSecret(): string {
  const candidates = [
    process.env.LINKEDIN_STATE_SECRET,
    ENV.ENCRYPTION_SECRET,
    process.env.ZOHO_ENCRYPTION_SECRET,
  ];
  const secret = candidates.find((value) => typeof value === 'string' && value.trim().length === 32)?.trim();
  if (!secret) {
    throw new Error(
      'LinkedIn OAuth state requires a 32-character LINKEDIN_STATE_SECRET, ENCRYPTION_SECRET, or ZOHO_ENCRYPTION_SECRET'
    );
  }
  return secret;
}

export function encodeLinkedInOAuthState(payload: LinkedInOAuthState): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  try {
    const sig = createHmac('sha256', getStateSecret()).update(body).digest('base64url');
    return `${body}.${sig}`;
  } catch {
    // Dev fallback when ENCRYPTION_SECRET is unset — callback still accepts legacy unsigned state
    return body;
  }
}

export function decodeLinkedInOAuthState(state: string): LinkedInOAuthState | null {
  const dot = state.indexOf('.');
  if (dot <= 0) return null;
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  if (!body || !sig) return null;

  const expected = createHmac('sha256', getStateSecret()).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as LinkedInOAuthState;
    if (!data?.userId || typeof data.ts !== 'number') return null;
    if (Date.now() - data.ts > STATE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

/** @deprecated Legacy unsigned state — accepted during rollout only */
export function decodeLegacyLinkedInOAuthState(state: string): LinkedInOAuthState | null {
  try {
    const data = JSON.parse(Buffer.from(state, 'base64url').toString()) as LinkedInOAuthState;
    if (!data?.userId || typeof data.ts !== 'number') return null;
    if (Date.now() - data.ts > STATE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

export function parseLinkedInOAuthState(state: string): LinkedInOAuthState | null {
  return decodeLinkedInOAuthState(state) ?? decodeLegacyLinkedInOAuthState(state);
}

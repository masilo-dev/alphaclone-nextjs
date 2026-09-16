import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { hashPortalPassword, verifyPortalPassword } from '@/lib/projects/portalPassword';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Ratelimit, Duration } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getActiveRedisBackend, getRedisAsync } from '@/lib/redis/client';

export const CLIENT_PORTAL_COOKIE_NAME = 'ac_client_portal_session';
export const CLIENT_PORTAL_JWT_AUD = 'ac:client-portal';
export const CLIENT_PORTAL_JWT_ISS = 'alphaclone-systems';
export const CLIENT_PORTAL_SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours
export const CLIENT_PORTAL_LOCKOUT_FAILURES = 10;
export const CLIENT_PORTAL_LOCKOUT_MINUTES = 30;
export const CLIENT_PORTAL_PASSWORD_MIN_LENGTH = 8;

export type ClientPortalClaims = {
  sub: string;      // client_id (business_clients.id)
  tid: string;      // tenant_id
  jti: string;      // unique session id (maps to client_portal_sessions.session_jti)
  salt: string;     // client_portal_session_salt — rotation invalidates all JWTs for this client
  iat: number;
  exp: number;
  iss: typeof CLIENT_PORTAL_JWT_ISS;
  aud: typeof CLIENT_PORTAL_JWT_AUD;
};

export type AuthenticatedClientPortal = {
  clientId: string;
  tenantId: string;
  claims: ClientPortalClaims;
  sessionJti: string;
};

const SHARED_SECRET_CANDIDATE_ENVS = [
  'CLIENT_PORTAL_SESSION_SIGNING_SECRET',
  'ENCRYPTION_SECRET',
  'BONNIE_EVENT_SIGNING_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

function getSessionSigningSecret(): Buffer {
  for (const name of SHARED_SECRET_CANDIDATE_ENVS) {
    const raw = process.env[name];
    if (raw && raw.length >= 32) return Buffer.from(raw, 'utf8');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[clientPortalAuth] No 32+ byte signing secret available. Set CLIENT_PORTAL_SESSION_SIGNING_SECRET (preferred), ENCRYPTION_SECRET, or BONNIE_EVENT_SIGNING_SECRET.'
    );
  }
  // Development fallback: deterministic per-boot secret so cookies don't persist across
  // reboots (intentional security hygiene for dev).
  console.warn('[clientPortalAuth] Using per-boot dev signing secret. Set ENCRYPTION_SECRET in prod.');
  return Buffer.from(
    (globalThis as any).__CLIENT_PORTAL_DEV_SECRET ||= randomBytes(48).toString('hex'),
    'utf8'
  );
}

function base64UrlEncode(buf: string | Buffer): string {
  return Buffer.from(buf)
    .toString('base64url')
    .replace(/=+$/, '');
}

function base64UrlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export function hashClientPortalPassword(password: string): string {
  return hashPortalPassword(password);
}

export function verifyClientPortalPassword(password: string, stored: string | null | undefined): boolean {
  return verifyPortalPassword(password, stored);
}

export function rotateClientPortalSessionSalt(): string {
  return randomBytes(24).toString('hex');
}

export function generateClientPortalJti(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Sign client claims into a compact HMAC-SHA256 token. Not using jose because the
 * project does not ship a JWT library and we want 0 new dependencies. Claims embed
 * the client-scoped session salt directly so salt rotation invalidates the token
 * even if exp is still in the future.
 */
export function signClientPortalSession(params: {
  clientId: string;
  tenantId: string;
  sessionSalt: string;
  sessionJti: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: ClientPortalClaims = {
    sub: params.clientId,
    tid: params.tenantId,
    jti: params.sessionJti,
    salt: params.sessionSalt,
    iat: now,
    exp: now + CLIENT_PORTAL_SESSION_TTL_SECONDS,
    iss: CLIENT_PORTAL_JWT_ISS,
    aud: CLIENT_PORTAL_JWT_AUD,
  };
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  const sig = base64UrlEncode(
    createHmac('sha256', getSessionSigningSecret()).update(signingInput).digest()
  );
  return `${signingInput}.${sig}`;
}

function safeJsonParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

export function verifyClientPortalSessionToken(
  token: string
): { ok: true; claims: ClientPortalClaims } | { ok: false; reason: 'bad_token' | 'bad_sig' | 'expired' | 'bad_claims' } {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'bad_token' };
  const [headerB64, payloadB64, sigB64] = token.split('.');
  if (!headerB64 || !payloadB64 || !sigB64) return { ok: false, reason: 'bad_token' };
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = createHmac('sha256', getSessionSigningSecret()).update(signingInput).digest();
  try {
    if (!timingSafeEqual(base64UrlDecode(sigB64), expectedSig)) return { ok: false, reason: 'bad_sig' };
  } catch {
    return { ok: false, reason: 'bad_sig' };
  }
  const header = safeJsonParse(base64UrlDecode(headerB64).toString('utf8'));
  if (!header || typeof header !== 'object' || (header as any).alg !== 'HS256') return { ok: false, reason: 'bad_token' };
  const claims = safeJsonParse(base64UrlDecode(payloadB64).toString('utf8'));
  if (!claims || typeof claims !== 'object') return { ok: false, reason: 'bad_claims' };
  const c = claims as Record<string, unknown>;
  if (
    typeof c.sub !== 'string' ||
    typeof c.tid !== 'string' ||
    typeof c.jti !== 'string' ||
    typeof c.salt !== 'string' ||
    typeof c.iat !== 'number' ||
    typeof c.exp !== 'number' ||
    c.iss !== CLIENT_PORTAL_JWT_ISS ||
    c.aud !== CLIENT_PORTAL_JWT_AUD
  ) return { ok: false, reason: 'bad_claims' };
  if (c.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: 'expired' };
  return { ok: true, claims: claims as ClientPortalClaims };
}

export async function getRawSessionCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(CLIENT_PORTAL_COOKIE_NAME)?.value;
}

export type ClientPortalAuthError =
  | { code: 'NO_SESSION'; http: 401 }
  | { code: 'BAD_TOKEN'; http: 401 }
  | { code: 'SALT_ROTATED'; http: 401 }
  | { code: 'CLIENT_INACTIVE'; http: 403 }
  | { code: 'SESSION_REVOKED'; http: 401 }
  | { code: 'INTERNAL_ERROR'; http: 500 };

/**
 * Read + verify the session cookie AND compare the embedded session salt with the
 * row-stored salt + ensure session row is still active (not signed out / revoked).
 * This is the canonical gate all /api/client-finance endpoints and the portal page
 * MUST call before returning any client-scoped data.
 *
 * The resolved clientId/tenantId pair MUST match whatever the URL token resolves to.
 * A second double-guard check is recommended at the call site to prevent any client
 * from swapping tokens. See requireClientPortalAccessDoubleGuarded().
 */
export async function requireClientPortalSession(
  admin: SupabaseClient<any, 'public', any>
): Promise<{ ok: true; session: AuthenticatedClientPortal } | { ok: false; error: ClientPortalAuthError }> {
  const raw = await getRawSessionCookie();
  if (!raw) return { ok: false, error: { code: 'NO_SESSION', http: 401 } };
  const verified = verifyClientPortalSessionToken(raw);
  if (!verified.ok) return { ok: false, error: { code: 'BAD_TOKEN', http: 401 } };
  const claims = verified.claims;
  const { data: client, error } = await admin
    .from('business_clients')
    .select('id, tenant_id, is_active, client_portal_session_salt')
    .eq('id', claims.sub)
    .maybeSingle();
  if (error || !client) return { ok: false, error: { code: 'INTERNAL_ERROR', http: 500 } };
  if (client.is_active === false) return { ok: false, error: { code: 'CLIENT_INACTIVE', http: 403 } };
  if (client.client_portal_session_salt !== claims.salt) {
    return { ok: false, error: { code: 'SALT_ROTATED', http: 401 } };
  }
  const { data: sessionRow } = await admin
    .from('client_portal_sessions')
    .select('id, is_active, signed_out_at, expires_at')
    .eq('session_jti', claims.jti)
    .maybeSingle();
  if (
    !sessionRow ||
    sessionRow.is_active === false ||
    sessionRow.signed_out_at !== null ||
    new Date(sessionRow.expires_at).getTime() < Date.now()
  ) {
    return { ok: false, error: { code: 'SESSION_REVOKED', http: 401 } };
  }
  return {
    ok: true,
    session: {
      clientId: claims.sub,
      tenantId: claims.tid,
      claims,
      sessionJti: claims.jti,
    },
  };
}

/**
 * Combines session cookie auth + URL token resolve into a single double-guarded
 * primitive. Caller receives the client+portal data only if BOTH match.
 */
export async function requireClientPortalAccessDoubleGuarded(
  admin: SupabaseClient<any, 'public', any>,
  tokenFromUrl: string,
  resolveClientByPortalToken: (admin: SupabaseClient<any, 'public', any>, token: string) => Promise<{ id: string; tenant_id: string; is_active?: boolean | null } | null>
): Promise<
  | { ok: true; session: AuthenticatedClientPortal; resolvedClient: { id: string; tenant_id: string; is_active?: boolean | null } }
  | { ok: false; error: ClientPortalAuthError | { code: 'TOKEN_MISMATCH'; http: 403 } | { code: 'BAD_PORTAL_TOKEN'; http: 404 } }
> {
  const session = await requireClientPortalSession(admin);
  if (!session.ok) return { ok: false, error: session.error };
  const resolved = await resolveClientByPortalToken(admin, tokenFromUrl);
  if (!resolved) return { ok: false, error: { code: 'BAD_PORTAL_TOKEN', http: 404 } };
  if (resolved.tenant_id !== session.session.tenantId || resolved.id !== session.session.clientId) {
    return { ok: false, error: { code: 'TOKEN_MISMATCH', http: 403 } };
  }
  return { ok: true, session: session.session, resolvedClient: resolved };
}

export function clearClientPortalCookie(response?: NextResponse): NextResponse {
  const res = response ?? NextResponse.json({ success: true });
  res.cookies.set({
    name: CLIENT_PORTAL_COOKIE_NAME,
    value: '',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}

export function setClientPortalCookie(jwt: string, response?: NextResponse): NextResponse {
  const res = response ?? NextResponse.json({ success: true });
  res.cookies.set({
    name: CLIENT_PORTAL_COOKIE_NAME,
    value: jwt,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: CLIENT_PORTAL_SESSION_TTL_SECONDS,
  });
  return res;
}

export function validateClientPortalPasswordStrength(password: string): { ok: true } | { ok: false; reason: string } {
  if (!password || typeof password !== 'string') return { ok: false, reason: 'Password is required.' };
  if (password.length < CLIENT_PORTAL_PASSWORD_MIN_LENGTH) {
    return { ok: false, reason: `Password must be at least ${CLIENT_PORTAL_PASSWORD_MIN_LENGTH} characters.` };
  }
  const uniqueChars = new Set(password.split('')).size;
  if (uniqueChars < 4) return { ok: false, reason: 'Password is too simple to be secure.' };
  return { ok: true };
}

type SlidingWindowEntry = { timestamps: number[] };
const inMemorySlidingWindows = new Map<string, SlidingWindowEntry>();

function pruneInMemoryWindow(key: string, windowMs: number, now: number): number[] {
  const entry = inMemorySlidingWindows.get(key);
  if (!entry) return [];
  const cutoff = now - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length === 0) {
    inMemorySlidingWindows.delete(key);
  }
  return entry.timestamps;
}

function checkInMemorySlidingWindow(identifier: string, limit: number, windowMs: number): {
  success: boolean;
  remaining: number;
  reset: number;
} {
  const now = Date.now();
  const timestamps = pruneInMemoryWindow(identifier, windowMs, now);
  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    return {
      success: false,
      remaining: 0,
      reset: oldest + windowMs,
    };
  }
  timestamps.push(now);
  inMemorySlidingWindows.set(identifier, { timestamps });
  return {
    success: true,
    remaining: Math.max(limit - timestamps.length, 0),
    reset: now + windowMs,
  };
}

export type ClientPortalRateLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
  limit: number;
};

export async function rateLimitClientPortalLogin(
  email: string
): Promise<ClientPortalRateLimitResult> {
  const limit = 10;
  const window: Duration = '15m';
  const windowMs = 15 * 60 * 1000;
  const identifier = `client-portal-login:${email.toLowerCase().trim()}`;

  const backend = getActiveRedisBackend();
  if (backend === 'railway' || backend === 'upstash') {
    try {
      const sharedRedis = await getRedisAsync();
      if (sharedRedis) {
        const key = `alphaclone:cp:rl:${identifier}`;
        const now = Date.now();
        const count = await sharedRedis.incr(key);
        if (count === 1) {
          await sharedRedis.pexpire(key, windowMs);
        }
        const ttl = await sharedRedis.pttl(key);
        return {
          success: count <= limit,
          remaining: Math.max(limit - count, 0),
          reset: now + (ttl > 0 ? ttl : windowMs),
          limit,
        };
      }
    } catch (err) {
      console.error('[clientPortalAuth] Railway/Upstash Redis rate limit error, falling back:', err);
    }
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (upstashUrl && upstashToken) {
    try {
      const upstashRedis = new Redis({ url: upstashUrl, token: upstashToken });
      const ratelimit = new Ratelimit({
        redis: upstashRedis,
        limiter: Ratelimit.slidingWindow(limit, window),
        analytics: true,
        prefix: 'alphaclone:cp',
      });
      const result = await ratelimit.limit(identifier);
      return {
        success: result.success,
        remaining: result.remaining,
        reset: result.reset,
        limit,
      };
    } catch (err) {
      console.error('[clientPortalAuth] Upstash REST rate limit error, falling back:', err);
    }
  }

  const mem = checkInMemorySlidingWindow(identifier, limit, windowMs);
  return { ...mem, limit };
}

export type ClientPortalAuditRow = {
  tenant_id: string;
  client_id: string;
  session_jti?: string | null;
  event_type:
    | 'login_success'
    | 'login_failure'
    | 'logout'
    | 'password_set'
    | 'password_rotated'
    | 'session_revoked'
    | 'salt_rotated'
    | 'grant_access';
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function writeClientPortalAuditRow(
  admin: SupabaseClient<any, 'public', any>,
  row: ClientPortalAuditRow
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const metadata: Record<string, unknown> = {
      ...(row.metadata ?? {}),
      ip_address: row.ip_address ?? null,
      user_agent: row.user_agent ?? null,
      session_jti: row.session_jti ?? null,
    };
    await admin.from('client_portal_events').insert({
      tenant_id: row.tenant_id,
      client_id: row.client_id,
      project_id: null,
      event_type: row.event_type,
      metadata,
      created_at: now,
    });
  } catch (err) {
    console.error('[clientPortalAuth] writeClientPortalAuditRow failed (non-fatal):', err);
  }
}

export function extractRequestIp(req: Pick<Request, 'headers'>): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xr = req.headers.get('x-real-ip');
  if (xr) return xr.trim();
  return '0.0.0.0';
}

export function extractUserAgent(req: Pick<Request, 'headers'>): string {
  return req.headers.get('user-agent') ?? '';
}

export async function createClientPortalSessionRow(
  admin: SupabaseClient<any, 'public', any>,
  params: {
    clientId: string;
    tenantId: string;
    sessionJti: string;
    sessionSalt: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CLIENT_PORTAL_SESSION_TTL_SECONDS * 1000);
  await admin.from('client_portal_sessions').insert({
    tenant_id: params.tenantId,
    client_id: params.clientId,
    session_jti: params.sessionJti,
    session_salt: params.sessionSalt,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    is_active: true,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
}

export async function revokeClientPortalSessionByJti(
  admin: SupabaseClient<any, 'public', any>,
  sessionJti: string
): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from('client_portal_sessions')
    .update({ is_active: false, signed_out_at: now, updated_at: now })
    .eq('session_jti', sessionJti);
}

export async function rotateClientPortalSaltAndRevoke(
  admin: SupabaseClient<any, 'public', any>,
  clientId: string,
  tenantId: string
): Promise<string> {
  const newSalt = rotateClientPortalSessionSalt();
  await admin
    .from('business_clients')
    .update({
      client_portal_session_salt: newSalt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)
    .eq('tenant_id', tenantId);
  return newSalt;
}

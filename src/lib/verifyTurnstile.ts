/**
 * Cloudflare Turnstile server verification (canonical siteverify).
 * Prefers TURNSTILE_SECRET; falls back to TURNSTILE_SECRET_KEY for legacy deploys.
 * When unset or placeholder, verification is skipped (local dev).
 */

import { TURNSTILE_BYPASS_TOKEN } from '@/components/security/TurnstileWidget';

/**
 * Known fake/fallback token strings that must never be accepted as valid.
 * These were historically emitted by TurnstileWidget on timeout/error —
 * they have been removed from the widget but we guard server-side too.
 */
const KNOWN_FAKE_TOKENS = new Set([
  'turnstile-bypass-timeout',
  'turnstile-fallback-error',
  'bypass',
]);

function turnstileSecret(): string | undefined {
    const primary = process.env.TURNSTILE_SECRET?.trim();
    if (primary && primary !== 'placeholder') return primary;
    const legacy = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (legacy && legacy !== 'placeholder') return legacy;
    return undefined;
}

export function isTurnstileEnforced(): boolean {
    return !!turnstileSecret();
}

export function readTurnstileToken(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return '';
    const record = payload as Record<string, unknown>;
    return String(
        record.turnstileToken ||
            record.turnstile_token ||
            record['cf-turnstile-response'] ||
            ''
    ).trim();
}

/** Best-effort client IP from a Fetch/Next request. */
export function readClientIp(request: { headers: Headers } | null | undefined): string | undefined {
    if (!request) return undefined;
    const cf = request.headers.get('cf-connecting-ip')?.trim();
    if (cf) return cf;
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
    const realIp = request.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;
    return undefined;
}

/**
 * Returns true if the token is the explicit bypass sentinel emitted by
 * TurnstileWidget when `bypassOnError` is true. Used by API routes that
 * want to accept graceful degradation (e.g. non-critical public forms).
 * NOT accepted by the auth or payment routes.
 */
export function isTurnstileBypassToken(token: string): boolean {
    return token === TURNSTILE_BYPASS_TOKEN;
}

export async function verifyTurnstileToken(
    token: string | undefined,
    remoteip?: string | null
): Promise<boolean> {
    if (!isTurnstileEnforced()) {
        return true;
    }
    if (!token?.trim()) {
        return false;
    }

    const trimmed = token.trim();

    // Hard-reject known fake strings that should never reach the API.
    if (KNOWN_FAKE_TOKENS.has(trimmed)) {
        console.warn('[verifyTurnstile] Rejected known fake token:', trimmed);
        return false;
    }

    // Hard-reject the bypass sentinel — callers that accept it must check
    // isTurnstileBypassToken() before calling verifyTurnstileToken().
    if (trimmed === TURNSTILE_BYPASS_TOKEN) {
        return false;
    }

    // Development-only bypass: TURNSTILE_ALLOW_BYPASS=true skips network call.
    // Never set this in production.
    if (process.env.TURNSTILE_ALLOW_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
        console.warn('[verifyTurnstile] DEV BYPASS ACTIVE — skipping siteverify');
        return true;
    }

    try {
        const secret = turnstileSecret()!;
        const body = new URLSearchParams({
            secret,
            response: trimmed,
        });
        if (remoteip?.trim()) {
            body.set('remoteip', remoteip.trim());
        }
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });
        const data = (await res.json()) as { success?: boolean };
        return !!data.success;
    } catch {
        return false;
    }
}

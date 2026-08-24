/**
 * Cloudflare Turnstile server verification (canonical siteverify).
 * Prefers TURNSTILE_SECRET; falls back to TURNSTILE_SECRET_KEY for legacy deploys.
 * When unset or placeholder, verification is skipped (local dev).
 */

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
    try {
        const secret = turnstileSecret()!;
        const body = new URLSearchParams({
            secret,
            response: token.trim(),
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

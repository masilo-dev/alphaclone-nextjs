/**
 * Cloudflare Turnstile server verification.
 * When TURNSTILE_SECRET_KEY is unset or placeholder, verification is skipped (local dev).
 */

export function isTurnstileEnforced(): boolean {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    const isProd = process.env.NODE_ENV === 'production';
    
    if (isProd && (!secret || secret === 'your_secret_key_here')) {
        console.error('[CRITICAL] Cloudflare Turnstile is NOT configured in production. Security verification is bypassed.');
    }
    
    return !!(secret && secret !== 'your_secret_key_here');
}

export async function verifyTurnstileToken(token: string | undefined): Promise<boolean> {
    if (!isTurnstileEnforced()) {
        return true;
    }
    if (!token?.trim()) {
        return false;
    }
    try {
        const secretKey = process.env.TURNSTILE_SECRET_KEY!;
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const data = (await res.json()) as { success?: boolean };
        return !!data.success;
    } catch {
        return false;
    }
}

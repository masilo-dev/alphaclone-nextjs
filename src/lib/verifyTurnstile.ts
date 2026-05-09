/**
 * Cloudflare Turnstile server verification.
 * When TURNSTILE_SECRET_KEY is unset or placeholder, verification is skipped (local dev).
 */

export function isTurnstileEnforced(): boolean {
    // Cloudflare Turnstile is disabled system-wide as per user request.
    return false;
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

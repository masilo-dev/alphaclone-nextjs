/**
 * Cloudflare Turnstile server verification.
 * When TURNSTILE_SECRET_KEY is unset or placeholder, verification is skipped (local dev).
 */

export function isTurnstileEnforced(): boolean {
    return !!process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SECRET_KEY !== 'placeholder';
}

export function readTurnstileToken(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return '';
    const record = payload as Record<string, unknown>;
    return String(record.turnstileToken || record.turnstile_token || '').trim();
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

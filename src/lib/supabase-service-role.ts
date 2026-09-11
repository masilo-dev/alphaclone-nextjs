/** True when a Supabase JWT is the service_role key (bypasses RLS). */
export function isSupabaseServiceRoleKey(key: string | undefined | null): boolean {
    const trimmed = key?.trim();
    if (!trimmed) return false;

    const parts = trimmed.split('.');
    if (parts.length < 2) return false;

    try {
        const payload = JSON.parse(
            Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
        ) as { role?: string };
        return payload.role === 'service_role';
    } catch {
        return false;
    }
}

/** First env candidate that is a verified service_role JWT. */
export function resolveSupabaseServiceRoleKey(
    ...candidates: Array<string | undefined | null>
): string | undefined {
    for (const candidate of candidates) {
        const trimmed = candidate?.trim();
        if (trimmed && isSupabaseServiceRoleKey(trimmed)) {
            return trimmed;
        }
    }
    return undefined;
}

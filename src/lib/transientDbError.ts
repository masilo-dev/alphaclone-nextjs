/**
 * Utilities for detecting and handling transient PostgREST / PostgreSQL failures
 * (e.g. PGRST002 schema cache reload, statement timeouts, connection pool hiccups).
 */

export function isTransientDatabaseError(error: unknown): boolean {
    if (!error) return false;
    const candidate = error as { code?: string; message?: string; status?: number } | null;
    const code = String(candidate?.code || '');
    const message = String(candidate?.message || '').toLowerCase();
    return (
        code === 'PGRST000' ||
        code === 'PGRST001' ||
        code === 'PGRST002' ||
        code === 'PGRST003' ||
        code === '57014' || // query_canceled / statement_timeout
        code === '53300' || // too_many_connections
        code === '08000' || // connection_exception
        code === '08003' || // connection_does_not_exist
        code === '08006' || // connection_failure
        message.includes('schema cache') ||
        message.includes('statement timeout') ||
        message.includes('timed out') ||
        message.includes('connection refused') ||
        message.includes('failed to fetch') ||
        message.includes('network error')
    );
}

/**
 * Executes a database action with automatic retries on transient errors.
 */
export async function withTransientDbRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 2,
    baseDelayMs = 150
): Promise<T> {
    let lastResult: T | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await fn();
            lastResult = result;
            if (result && typeof result === 'object' && 'error' in result && (result as any).error) {
                const error = (result as any).error;
                if (isTransientDatabaseError(error) && attempt < maxRetries) {
                    await new Promise((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)));
                    continue;
                }
            }
            return result;
        } catch (err: unknown) {
            if (isTransientDatabaseError(err) && attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)));
                continue;
            }
            throw err;
        }
    }
    return lastResult as T;
}

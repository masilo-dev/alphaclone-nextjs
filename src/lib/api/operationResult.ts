/**
 * User-safe copy for failed API operations (no internal exception text).
 */
export const OPERATION_FAILED_MESSAGE = 'The operation could not be completed. Please try again.';

export function operationFailed(scope: string, err: unknown): { success: false; error: string } {
    if (err instanceof Error) {
        console.error(`[api:${scope}]`, err.message, err.stack);
    } else {
        console.error(`[api:${scope}]`, err);
    }
    return { success: false, error: OPERATION_FAILED_MESSAGE };
}

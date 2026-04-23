import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { RouteAuthError } from './routeAuthError';

export type ApiErrorBody = {
    error: string;
    code: string;
    requestId?: string;
};

export function getRequestIdFromRequest(req: Pick<Request, 'headers'>): string | undefined {
    return req.headers.get('x-request-id')?.trim() || undefined;
}

function logServerError(scope: string, err: unknown, requestId?: string) {
    if (err instanceof Error) {
        const message = err.message?.trim() || err.name || 'Unknown error';
        console.error(`[api:${scope}]`, requestId ?? '', message, err.stack);
    } else {
        console.error(`[api:${scope}]`, requestId ?? '', err);
    }
}

/**
 * JSON error for API routes. Never forwards Error.message or stack to the client (except RouteAuthError.message).
 */
export function clientErrorResponse(
    err: unknown,
    options: {
        request?: Pick<Request, 'headers'>;
        scope: string;
        /** Shown to client on 500 when err is not RouteAuthError */
        fallbackMessage?: string;
    }
): NextResponse<ApiErrorBody> {
    const requestId = options.request ? getRequestIdFromRequest(options.request) : undefined;

    if (err instanceof RouteAuthError) {
        const body: ApiErrorBody = {
            error: err.message,
            code: err.code,
            ...(requestId ? { requestId } : {}),
        };
        return NextResponse.json(body, { status: err.status });
    }

    logServerError(options.scope, err, requestId);
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
        tags: { api_scope: options.scope },
        extra: requestId ? { requestId } : undefined,
    });

    const body: ApiErrorBody = {
        error: options.fallbackMessage ?? 'Something went wrong. Please try again.',
        code: 'INTERNAL_ERROR',
        ...(requestId ? { requestId } : {}),
    };
    return NextResponse.json(body, { status: 500 });
}

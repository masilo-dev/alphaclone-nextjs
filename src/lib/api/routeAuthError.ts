export class RouteAuthError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(status: number, message: string, code?: string) {
        super(message);
        this.name = 'RouteAuthError';
        this.status = status;
        this.code = code ?? defaultCodeForStatus(status);
    }
}

function defaultCodeForStatus(status: number): string {
    switch (status) {
        case 400:
            return 'BAD_REQUEST';
        case 401:
            return 'UNAUTHORIZED';
        case 403:
            return 'FORBIDDEN';
        case 404:
            return 'NOT_FOUND';
        case 429:
            return 'RATE_LIMITED';
        default:
            return 'ERROR';
    }
}

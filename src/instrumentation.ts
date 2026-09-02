export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('../sentry.server.config');
        const { registerProcessGuards } = await import('@/lib/runtime/processGuards');
        const { startMemoryTelemetry } = await import('@/lib/runtime/memoryTelemetry');
        registerProcessGuards();
        startMemoryTelemetry();
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('../sentry.edge.config');
    }
}

export async function onRequestError(...args: any[]) {
    const Sentry = await import('@sentry/nextjs');
    return Sentry.captureRequestError(...args);
}

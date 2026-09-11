export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('../sentry.server.config');
        const { registerProcessGuards } = await import('@/lib/runtime/processGuards');
        const { startMemoryTelemetry } = await import('@/lib/runtime/memoryTelemetry');
        const { warmRedisConnection } = await import('@/lib/redis/client');
        registerProcessGuards();
        startMemoryTelemetry();
        void warmRedisConnection().catch(() => {
          // Non-fatal — cache/rate-limit fall back until Redis connects
        });
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('../sentry.edge.config');
    }
}

export async function onRequestError(...args: any[]) {
    const Sentry = await import('@sentry/nextjs');
    return Sentry.captureRequestError(...args);
}

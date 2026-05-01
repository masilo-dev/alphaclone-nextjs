/**
 * Helper to create a chainable unavailable Supabase client for non-production fallback scenarios
 * and to prevent build crashes when environment variables are missing during module evaluation.
 */
export const createUnavailableSupabaseClient = (serviceName: string) => {
    // Only log warning if not in a suppressed environment (like build)
    const isBuild = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NODE_ENV === 'production';
    
    if (!isBuild) {
        console.warn(`[${serviceName}] Supabase credentials are missing. Returning an unavailable client.`);
    }

    const mockError = { message: `[${serviceName}] Supabase is not configured` };
    const mockResult = { data: null, error: mockError, count: 0 };

    const queryChain: any = new Proxy(() => { }, {
        get: (_, prop) => {
            if (prop === 'then') return Promise.resolve(mockResult).then.bind(Promise.resolve(mockResult));
            if (prop === 'catch') return Promise.resolve(mockResult).catch.bind(Promise.resolve(mockResult));
            if (prop === 'finally') return Promise.resolve(mockResult).finally.bind(Promise.resolve(mockResult));
            if (prop === 'data') return null;
            if (prop === 'error') return mockError;
            if (prop === 'count') return 0;
            if (typeof prop === 'symbol') return undefined;
            if (prop === 'toString' || prop === 'valueOf') return () => '[Mock Supabase Query]';
            return (..._args: any[]) => queryChain;
        },
        apply: () => queryChain,
    });

    const auth = {
        getUser: async () => ({ data: { user: null }, error: mockError }),
        getSession: async () => ({ data: { session: null }, error: mockError }),
        signOut: async () => ({ error: mockError }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
    };

    return new Proxy({}, {
        get: (_, prop) => {
            if (prop === 'then') return undefined;
            if (prop === 'auth') return auth;
            if (prop === 'from' || prop === 'rpc') return (..._args: any[]) => queryChain;
            if (prop === 'storage') {
                return {
                    from: (..._args: any[]) => queryChain,
                };
            }
            if (prop === 'toString' || prop === 'valueOf') return () => '[Mock Supabase Client]';
            if (typeof prop === 'symbol') return undefined;
            return queryChain;
        },
    }) as any;
};

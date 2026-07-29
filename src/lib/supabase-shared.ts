<<<<<<< HEAD
import { ENV } from '@/config/env';

const isPlaceholder = (val?: string) => !val || val === 'undefined' || val.includes('placeholder');

/** True when both Supabase URL and anon key are present and non-placeholder. */
export const isSupabaseConfigured = (): boolean =>
    !isPlaceholder(ENV.VITE_SUPABASE_URL) && !isPlaceholder(ENV.VITE_SUPABASE_ANON_KEY);

export const SUPABASE_NOT_CONFIGURED_MESSAGE =
    'Supabase is not configured. Copy .env.example to .env.local and add your project URL, anon key, and service role key.';

let unavailableClientWarned = false;

/**
 * Chainable unavailable Supabase client for local dev when credentials are missing.
 * Session reads return "logged out" (no error); writes return a clear config error.
 */
export const createUnavailableSupabaseClient = (serviceName: string) => {
    const isBuild =
        process.env.NEXT_PHASE === 'phase-production-build' ||
        (process.env.NODE_ENV === 'production' && typeof window === 'undefined');

    if (!isBuild && !unavailableClientWarned) {
        unavailableClientWarned = true;
        console.warn(
            `[${serviceName}] Supabase credentials are missing. Auth and database features are disabled until .env.local is configured.`
        );
    }

    const configError = { message: SUPABASE_NOT_CONFIGURED_MESSAGE };
    const mockResult = { data: null, error: configError, count: 0 };

    const queryChain: any = new Proxy(() => {}, {
=======
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
>>>>>>> origin/main
        get: (_, prop) => {
            if (prop === 'then') return Promise.resolve(mockResult).then.bind(Promise.resolve(mockResult));
            if (prop === 'catch') return Promise.resolve(mockResult).catch.bind(Promise.resolve(mockResult));
            if (prop === 'finally') return Promise.resolve(mockResult).finally.bind(Promise.resolve(mockResult));
            if (prop === 'data') return null;
<<<<<<< HEAD
            if (prop === 'error') return configError;
=======
            if (prop === 'error') return mockError;
>>>>>>> origin/main
            if (prop === 'count') return 0;
            if (typeof prop === 'symbol') return undefined;
            if (prop === 'toString' || prop === 'valueOf') return () => '[Mock Supabase Query]';
            return (..._args: any[]) => queryChain;
        },
        apply: () => queryChain,
    });

<<<<<<< HEAD
    const authUnavailableResult = { data: { user: null, session: null }, error: configError };

    const auth = {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
        signInWithPassword: async () => authUnavailableResult,
        signUp: async () => authUnavailableResult,
        signInWithOAuth: async () => ({ data: { provider: null, url: null }, error: configError }),
        resetPasswordForEmail: async () => ({ data: {}, error: configError }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        mfa: {
            getAuthenticatorAssuranceLevel: async () => ({
                data: { currentLevel: 'aal1', nextLevel: 'aal1' },
                error: null,
            }),
            listFactors: async () => ({ data: { all: [], totp: [] }, error: null }),
            challenge: async () => ({ data: { id: '' }, error: configError }),
            verify: async () => ({ data: null, error: configError }),
        },
    };

    return new Proxy({} as any, {
=======
    const auth = {
        getUser: async () => ({ data: { user: null }, error: mockError }),
        getSession: async () => ({ data: { session: null }, error: mockError }),
        signOut: async () => ({ error: mockError }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
    };

    return new Proxy({}, {
>>>>>>> origin/main
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
<<<<<<< HEAD
    });
=======
    }) as any;
>>>>>>> origin/main
};

import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';
import { signInSchema, signUpSchema } from '../schemas/validation';
import { z } from 'zod';

/**
 * Utility to forcefully break Supabase internal storage/Web Locks API deadlocks.
 * If a call to Supabase auth hangs for longer than the timeout, this forcefully 
 * purges the `sb-*` cache to break the lock and throws an error so the UI recovers.
 */
async function withAuthTimeout<T = any>(promise: any, timeoutMs: number = 10000): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
            console.warn(`[AuthService] Timeout (${timeoutMs}ms) hit for Auth request.`);
            reject(new Error("Auth request timed out. Please try again."));
        }, timeoutMs);
    });

    return Promise.race([
        promise,
        timeoutPromise
    ]).finally(() => {
        clearTimeout(timeoutHandle);
    });
}

export const authService = {
    /**
     * Sign in with email and password
     */
    async signIn(email: string, password: string): Promise<{ user: User | null; error: string | null; needsMfa?: boolean }> {
        try {
            // Validate input
            const validated = signInSchema.parse({ email: email.toLowerCase(), password });

            const { data, error } = await withAuthTimeout(supabase.auth.signInWithPassword({
                email: validated.email,
                password: validated.password,
            }), 20000); // 20s timeout for sign-in

            if (error) {
                console.error("SignIn Error:", error);

                // ✅ Track failed attempts in database
                const currentAttempts = parseInt(localStorage.getItem('failed_login_attempts') || '0') + 1;
                localStorage.setItem('failed_login_attempts', currentAttempts.toString());

                // Log failed login to database (non-blocking)
                import('./activityService').then(({ activityService }) => {
                    activityService.logFailedLogin(
                        validated.email,
                        error.message,
                        undefined, // IP will be fetched automatically
                        navigator.userAgent
                    ).catch(err => console.error('Failed to log failed login:', err));
                });

                if (currentAttempts >= 3) {
                    console.warn(`SECURITY ALERT: ${currentAttempts} failed login attempts for ${email}`);
                }

                return { user: null, error: error.message };
            }

            // Success - Reset attempts
            localStorage.setItem('failed_login_attempts', '0');

            if (!data.user) {
                return { user: null, error: 'No user data returned' };
            }

            // OPTIMIZED: Try to use cached metadata first, then fall back to DB query
            // This reduces login time by avoiding unnecessary database calls
            let user: User;

            // Check if we have complete user data in metadata (faster)
            const metadata = data.user.user_metadata;
            if (metadata?.name && metadata?.role) {
                user = {
                    id: data.user.id,
                    email: data.user.email || '',
                    name: metadata.name,
                    role: metadata.role,
                    avatar: metadata.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.user.email}`,
                };
            } else {
                // Fallback: Fetch user profile from database (slower, but needed for old users)
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .maybeSingle();

                if (profileError) {
                    console.error("AuthService: Profile fetch error", profileError);
                    return { user: null, error: 'Failed to fetch user profile' };
                }

                if (!profile) {
                    // If no profile yet, don't fail immediately, try to return a basic user 
                    // and let background sync handle creation
                    console.warn("AuthService: No profile found for user during sign in", data.user.id);
                    user = {
                        id: data.user.id,
                        email: data.user.email || '',
                        name: metadata?.name || data.user.email?.split('@')[0] || 'User',
                        role: 'client', // Default fallback
                        avatar: metadata?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.user.email}`,
                    };
                } else {
                    user = {
                        id: profile.id,
                        email: profile.email,
                        name: profile.name,
                        role: profile.role,
                        avatar: profile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.email}`,
                    };
                }

                // Update metadata for next login (optimization)
                supabase.auth.updateUser({
                    data: {
                        name: user.name,
                        role: user.role,
                        avatar: user.avatar,
                    }
                }).catch(() => { }); // Non-blocking, silent fail
            }

            // 5. Create Login Session & Log Activity (NON-BLOCKING)
            // Defer this to background so login returns immediately
            // 5. Create Login Session & Log Activity (NON-BLOCKING)
            // Defer this to background so login returns immediately
            Promise.allSettled([
                import('./activityService').then(({ activityService }) => activityService.createLoginSession(user.id)),
                import('./ipTrackingService').then(({ ipTrackingService }) => ipTrackingService.trackLogin(user.id))
            ]).catch(err => {
                console.error("❌ Activity tracking error:", err);
            });

            // Check for MFA requirement
            let needsMfa = false;
            try {
                const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
                if (mfaData?.nextLevel === 'aal2' && mfaData?.currentLevel === 'aal1') {
                    needsMfa = true;
                }
            } catch (e) {
                console.error("MFA check error", e);
            }

            // Return user immediately without waiting for activity tracking
            return { user, error: null, needsMfa };
        } catch (err: any) {
            if (err.name === 'ZodError') {
                return { user: null, error: err.errors[0]?.message || 'Validation failed', needsMfa: false };
            }
            return { user: null, error: err instanceof Error ? err.message : 'Unknown error', needsMfa: false };
        }
    },

    /**
     * Sign up new user
     */
    async signUp(email: string, password: string, name: string, role: UserRole = 'client'): Promise<{ user: User | null; error: string | null }> {
        try {
            // Validate input
            const validated = signUpSchema.parse({ email: email.toLowerCase(), password, name });

            // Fetch location for registration
            let registrationCountry = 'Unknown';
            try {
                const { ipTrackingService } = await import('./ipTrackingService');
                const loc = await ipTrackingService.getClientIP();
                if (loc?.country_name) {
                    registrationCountry = loc.country_name;
                }
            } catch (e) {
                console.warn('Failed to fetch location for registration', e);
            }

            const { data, error } = await withAuthTimeout(supabase.auth.signUp({
                email: validated.email,
                password: validated.password,
                options: {
                    data: {
                        name: validated.name,
                        role: role,
                        registration_country: registrationCountry,
                    },
                },
            }), 5000);

            if (error) {
                console.error("SignUp Error:", error);
                return { user: null, error: error.message };
            }

            if (!data.user) {
                return { user: null, error: 'No user data returned' };
            }

            const user: User = {
                id: data.user.id,
                email: validated.email,
                name: validated.name,
                role: role,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${validated.email}`,
            };

            // Trigger Welcome Email (Non-blocking)
            import('./emailCampaignService').then(({ emailCampaignService }) => {
                emailCampaignService.sendTransactionalEmail(validated.email, 'Welcome Email', {
                    name: validated.name,
                    email: validated.email
                }).catch(err => console.error('Failed to trigger welcome email:', err));
            });

            return { user, error: null };
        } catch (err: any) {
            if (err.name === 'ZodError') {
                return { user: null, error: err.errors[0]?.message || 'Validation failed' };
            }
            return { user: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Send password reset email
     */
    async resetPassword(email: string): Promise<{ error: string | null }> {
        try {
            const { error } = await withAuthTimeout(supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/reset-password`,
            }), 3000);

            if (error) {
                console.error("Reset Password Error:", error);
                return { error: error.message };
            }

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update password (used after reset or in settings)
     */
    async updatePassword(password: string): Promise<{ error: string | null }> {
        try {
            // Use the same validation as sign up for consistency
            const passwordSchema = z.string()
                .min(8, 'Password must be at least 8 characters')
                .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
                .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
                .regex(/[0-9]/, 'Password must contain at least one number')
                .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

            passwordSchema.parse(password);

            const { error } = await withAuthTimeout(supabase.auth.updateUser({ password }), 5000);

            if (error) {
                console.error("Update Password Error:", error);
                return { error: error.message };
            }

            return { error: null };
        } catch (err: any) {
            if (err.name === 'ZodError') {
                return { error: err.errors[0]?.message || 'Validation failed' };
            }
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Sign in with Google OAuth
     */
    async signInWithGoogle(): Promise<{ error: string | null }> {
        try {
            // Set a flag to help AuthContext/AuthService identify that we are in a callback loop
            // and should be more persistent with session discovery.
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('auth_callback_in_progress', 'true');
            }

            const { error } = await withAuthTimeout(supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            }), 5000);

            if (error) {
                console.error("Google SignIn Error:", error);
                if (typeof window !== 'undefined') {
                    sessionStorage.removeItem('auth_callback_in_progress');
                }
                return { error: error.message };
            }

            return { error: null };
        } catch (err) {
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('auth_callback_in_progress');
            }
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Sign out current user
     */
    async signOut(): Promise<{ error: string | null }> {
        try {
            // Run cleanup tasks in parallel for faster response
            const [sessionResult, authResult] = await Promise.allSettled([
                import('./activityService').then(({ activityService }) =>
                    activityService.endLoginSession()
                ),
                withAuthTimeout(supabase.auth.signOut(), 2500)
            ]);

            // Check auth result (session cleanup is non-critical)
            if (authResult.status === 'rejected') {
                return { error: 'Logout failed' };
            }

            if (authResult.status === 'fulfilled' && authResult.value.error) {
                return { error: authResult.value.error.message };
            }

            // Log session cleanup errors but don't fail logout
            if (sessionResult.status === 'rejected') {
                console.warn('Session cleanup failed:', sessionResult.reason);
            }

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get current session
     */
    async getCurrentUser(): Promise<{ user: User | null; error: string | null }> {
        try {
            // OPTIMIZATION: Small wait/retry for OAuth redirects where cookies might not be ready
            let session = null;
            let lastError = null;

            const isAuthCallback = typeof window !== 'undefined' &&
                (window.location.search.includes('code=') ||
                    window.location.pathname.includes('/auth/callback') ||
                    sessionStorage.getItem('auth_callback_in_progress') === 'true');

            // If we're on the dashboard, we also benefit from a small retry if session is initially missing
            const isDashboard = typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard');

            console.time('auth:getSession');
            const maxAttempts = isAuthCallback ? 3 : 1; // Only retry during explicit auth callbacks

            for (let i = 0; i < maxAttempts; i++) {
                const { data: { session: s }, error } = await withAuthTimeout(supabase.auth.getSession(), 10000);
                if (s?.user) {
                    session = s;
                    if (isAuthCallback) sessionStorage.removeItem('auth_callback_in_progress');
                    break;
                }
                lastError = error;
                if (isAuthCallback && i < maxAttempts - 1) {
                    const delay = 800;
                    console.log(`AuthService: Retrying session retrieval during callback (${i + 1}/${maxAttempts}) in ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
            console.timeEnd('auth:getSession');

            if (lastError) {
                console.error("AuthService: getSession error", lastError);
                return { user: null, error: lastError.message };
            }

            if (!session?.user) {
                console.log("AuthService: No active session found (data.session is null)");
                return { user: null, error: null };
            }

            console.log("AuthService: Active session found", {
                userId: session.user.id,
                expiresAt: session.expires_at,
                now: Math.floor(Date.now() / 1000)
            });

            const startTime = Date.now();
            console.time('auth:getProfile');
            console.log(`AuthService: Fetching profile for ${session.user.id}...`);

            let user: User;

            const metadata = session.user.user_metadata;

            // FAST PATH: If we have basic metadata, return immediately and sync in background
            if (metadata?.name && metadata?.role) {
                console.log("AuthService: Fast-path hit (metadata exists)");
                const fastUser: User = {
                    id: session.user.id,
                    email: session.user.email || '',
                    name: metadata.name,
                    role: metadata.role,
                    avatar: metadata.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`,
                };

                // Sync profile in background to ensure database is up to date
                supabase.from('profiles').select('name, role, avatar').eq('id', session.user.id).single()
                    .then(({ data: p }: { data: any }) => {
                        if (p && (p.name !== fastUser.name || p.role !== fastUser.role)) {
                            console.log("AuthService: Background sync found profile update needed");
                        }
                    }).catch(() => { });

                console.timeEnd('auth:getProfile');
                return { user: fastUser, error: null };
            }

            // If metadata is incomplete, we still want to avoid blocking for too long
            console.log("AuthService: Metadata incomplete, entering fallback fetch/transient mode");

            let profile = null;
            lastError = null;
            const maxRetries = 3;
            const retryDelay = 500;

            for (let i = 0; i < maxRetries; i++) {
                const { data: p, error: profileError } = await supabase
                    .from('profiles')
                    .select('*, account_status, scheduled_deletion_at')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (!profileError && p) {
                    profile = p;
                    break;
                }

                lastError = profileError;

                if (profileError?.code === 'PGRST301' || profileError?.message?.includes('403')) {
                    console.error('AuthService: Profile 403 Forbidden', profileError);
                    break;
                }

                if (i < maxRetries - 1) {
                    console.log(`AuthService: Profile sync retry ${i + 1}/${maxRetries}...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }

            if (!profile) {
                console.warn("AuthService: Profile retrieval failed. Using transient profile.", lastError);
                const fallbackRole: UserRole = (session.user.user_metadata.role as UserRole) || 'tenant_admin';

                user = {
                    id: session.user.id,
                    email: session.user.email || '',
                    name: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'User',
                    role: fallbackRole,
                    avatar: session.user.user_metadata.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.id}`,
                };

                import('./userService').then(({ userService }) => {
                    userService.syncUserProfile(session.user).catch(err =>
                        console.warn('Background profile sync failed:', err)
                    );
                });

                console.timeEnd('auth:getProfile');
                return { user, error: null };
            }

            console.log("AuthService: Profile retrieved successfully", profile.role);

            user = {
                id: profile.id,
                email: profile.email,
                name: profile.name,
                role: profile.role,
                avatar: profile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.email}`,
            };

            if (
                session.user.user_metadata.name !== user.name ||
                session.user.user_metadata.role !== user.role ||
                session.user.user_metadata.avatar !== user.avatar
            ) {
                supabase.auth.updateUser({
                    data: {
                        name: user.name,
                        role: user.role,
                        avatar: user.avatar,
                    }
                }).catch(() => { });
            }

            console.timeEnd('auth:getProfile');
            console.log(`AuthService: Profile fetched in ${Date.now() - startTime}ms. Role: ${user.role}`);
            return { user, error: null };
        } catch (err) {
            return { user: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update user profile
     */
    async updateProfile(userId: string, updates: { name?: string; avatar?: string }): Promise<{ error: string | null }> {
        try {
            // Update both database and auth metadata in parallel for consistency
            const [dbResult, authResult] = await Promise.allSettled([
                supabase.from('profiles').update(updates).eq('id', userId),
                supabase.auth.updateUser({ data: updates })
            ]);

            // Check database result
            if (dbResult.status === 'rejected' || (dbResult.status === 'fulfilled' && dbResult.value.error)) {
                const error = dbResult.status === 'rejected'
                    ? dbResult.reason
                    : dbResult.value.error;
                return { error: error?.message || 'Failed to update profile' };
            }

            // Auth metadata update is non-critical, just log if it fails
            if (authResult.status === 'rejected') {
                console.warn('Failed to update auth metadata:', authResult.reason);
            }

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Listen to auth state changes
     */
    onAuthStateChange(callback: (user: User | null, event?: AuthChangeEvent) => void) {
        return supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
            console.log(`AuthService: State changed - Event: ${event}, UserID: ${session?.user?.id}`);

            if (session?.user) {
                const { user } = await this.getCurrentUser();
                callback(user, event);
            } else {
                callback(null, event);
            }
        });
    },

    /**
     * Request account deletion
     */
    async requestAccountDeletion(): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase.rpc('request_account_deletion');
            if (error) {
                console.error("Request Account Deletion Error:", error);
                return { error: error.message };
            }
            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Cancel account deletion
     */
    async cancelAccountDeletion(): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase.rpc('cancel_account_deletion');
            if (error) {
                console.error("Cancel Account Deletion Error:", error);
                return { error: error.message };
            }
            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },
};

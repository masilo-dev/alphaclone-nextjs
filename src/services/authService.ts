import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';
import { signInSchema, signUpSchema } from '../schemas/validation';
import { z } from 'zod';

export const authService = {
    /**
     * Sign in with email and password
     */
    async signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
        try {
            // Validate input
            const validated = signInSchema.parse({ email: email.toLowerCase(), password });

            const { data, error } = await supabase.auth.signInWithPassword({
                email: validated.email,
                password: validated.password,
            });

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
                    .single();

                if (profileError || !profile) {
                    return { user: null, error: 'Failed to fetch user profile' };
                }

                user = {
                    id: profile.id,
                    email: profile.email,
                    name: profile.name,
                    role: profile.role,
                    avatar: profile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.email}`,
                };

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

            // Return user immediately without waiting for activity tracking
            return { user, error: null };
        } catch (err: any) {
            if (err.name === 'ZodError') {
                return { user: null, error: err.errors[0]?.message || 'Validation failed' };
            }
            return { user: null, error: err instanceof Error ? err.message : 'Unknown error' };
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

            const { data, error } = await supabase.auth.signUp({
                email: validated.email,
                password: validated.password,
                options: {
                    data: {
                        name: validated.name,
                        role: role,
                        registration_country: registrationCountry,
                    },
                },
            });

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
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/reset-password`,
            });

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

            const { error } = await supabase.auth.updateUser({ password });

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
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });

            if (error) {
                console.error("Google SignIn Error:", error);
                return { error: error.message };
            }

            return { error: null };
        } catch (err) {
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
                supabase.auth.signOut()
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
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                console.error("AuthService: getSession error", error);
                return { user: null, error: error.message };
            }

            if (!session?.user) {
                console.log("AuthService: No active session found");
                return { user: null, error: null };
            }

            const startTime = Date.now();
            console.log(`AuthService: Fetching profile for ${session.user.id}...`);

            let user: User;

            const metadata = session.user.user_metadata;
            if (metadata?.name && metadata?.role) {
                // Fast path: Use cached metadata
                user = {
                    id: session.user.id,
                    email: session.user.email || '',
                    name: metadata.name,
                    role: metadata.role,
                    avatar: metadata.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`,
                };
            } else {
                // MISSION CRITICAL: Slower retry loop for high-latency regions (e.g. South Africa)
                // or slow database triggers during OAuth registration.
                let profile = null;
                let lastError = null;
                const maxRetries = 10; // Increased from 5
                const retryDelay = 1000; // Increased from 500ms

                for (let i = 0; i < maxRetries; i++) {
                    const { data: p, error: profileError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    if (!profileError && p) {
                        profile = p;
                        break;
                    }

                    lastError = profileError;

                    // If we get a 403, it's a structural RLS issue, retrying won't help
                    if (profileError?.code === 'PGRST301' || profileError?.message?.includes('403')) {
                        console.error('AuthService: Profile 403 Forbidden', profileError);
                        break;
                    }

                    console.log(`AuthService: Profile sync retry ${i + 1}/${maxRetries}...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }

                if (!profile) {
                    // EMERGENCY FALLBACK: If we're authenticated but the profile is still missing 
                    // (e.g. trigger failed or network timeout), we create a transient user 
                    // instead of returning null and triggering a redirect loop.
                    console.warn("AuthService: Profile retrieval failed. Using transient profile.", lastError);

                    user = {
                        id: session.user.id,
                        email: session.user.email || '',
                        name: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'User',
                        role: (session.user.user_metadata.role as any) || 'client',
                        avatar: session.user.user_metadata.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.id}`,
                    };

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

                // Update metadata for next time (non-blocking optimization)
                supabase.auth.updateUser({
                    data: {
                        name: user.name,
                        role: user.role,
                        avatar: user.avatar,
                    }
                }).catch(() => { }); // Silent fail
            }

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
};

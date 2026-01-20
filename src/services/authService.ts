import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../types';
import { signInSchema, signUpSchema } from '../schemas/validation';

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

                // Track failed attempts
                const currentAttempts = parseInt(localStorage.getItem('failed_login_attempts') || '0') + 1;
                localStorage.setItem('failed_login_attempts', currentAttempts.toString());

                // Import dynamically to avoid circle
                // const { activityService } = await import('./activityService'); 

                if (currentAttempts >= 3) {
                    // Log Critical Alert (if possible/public)
                    // Note: This might fail if RLS requires auth, but we try anyway or rely on Client-side blocking
                    console.warn(`SECURITY ALERT: ${currentAttempts} failed login attempts for ${email}`);
                    // We can't insert into secure table without user_id usually, so we just log to console or handle in UI
                    // Ideally this calls a secure Edge Function.
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
        } catch (err) {
            return { user: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Sign up new user
     */
    async signUp(email: string, password: string, name: string): Promise<{ user: User | null; error: string | null }> {
        try {
            // Validate input
            const validated = signUpSchema.parse({ email: email.toLowerCase(), password, name });

            const { data, error } = await supabase.auth.signUp({
                email: validated.email,
                password: validated.password,
                options: {
                    data: {
                        name: validated.name,
                        role: 'client',
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

            // Profile is created automatically by trigger
            const user: User = {
                id: data.user.id,
                email: validated.email,
                name: validated.name,
                role: 'client',
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${validated.email}`,
            };

            return { user, error: null };
        } catch (err) {
            return { user: null, error: err instanceof Error ? err.message : 'Unknown error' };
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
                    redirectTo: `${window.location.origin}/`,
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
                return { user: null, error: error.message };
            }

            if (!session?.user) {
                return { user: null, error: null };
            }

            // OPTIMIZED: Use metadata first to avoid database query
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
                // Slow path: Fetch from database and update metadata
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
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

                // Update metadata for next time (non-blocking optimization)
                supabase.auth.updateUser({
                    data: {
                        name: user.name,
                        role: user.role,
                        avatar: user.avatar,
                    }
                }).catch(() => { }); // Silent fail
            }

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
    onAuthStateChange(callback: (user: User | null) => void) {
        return supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
            if (session?.user) {
                const { user } = await this.getCurrentUser();
                callback(user);
            } else {
                callback(null);
            }
        });
    },
};

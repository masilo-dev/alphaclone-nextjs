import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, SUPABASE_NOT_CONFIGURED_MESSAGE, supabase } from '../lib/supabase';
import { User, UserRole } from '../types';
import { signInSchema, signUpSchema } from '../schemas/validation';
import { z } from 'zod';
import { getOAuthRedirectOrigin } from '../lib/config/public-origin';

/** Always apex for production OAuth — www.alphaclonesystems.com is NXDOMAIN. */
function buildAuthCallbackRedirect(nextPath?: string): string {
  const origin = getOAuthRedirectOrigin(
    typeof window !== 'undefined' ? window.location.origin : undefined
  );
  return nextPath
    ? `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
    : `${origin}/auth/callback`;
}

/**
 * Utility to forcefully break Supabase internal storage/Web Locks API deadlocks.
 * If a call to Supabase auth hangs for longer than the timeout, this forcefully 
 * purges the `sb-*` cache to break the lock and throws an error so the UI recovers.
 */
async function withAuthTimeout<T = any>(promise: any, timeoutMs: number = 30000): Promise<T> {
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

// In-flight deduplication: if getCurrentUser() is already running, return the same promise
let _getCurrentUserInflight: Promise<{ user: User | null; error: string | null }> | null = null;

function supabaseConfigError(): string | null {
    return isSupabaseConfigured() ? null : SUPABASE_NOT_CONFIGURED_MESSAGE;
}

export const authService = {
    /**
     * Sign in with email and password
     */
    async signIn(email: string, password: string): Promise<{ user: User | null; error: string | null; needsMfa?: boolean }> {
        const configError = supabaseConfigError();
        if (configError) {
            return { user: null, error: configError };
        }

        try {
            // Validate input
            const validated = signInSchema.parse({ email: email.trim().toLowerCase(), password });

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

            const metadata = data.user.user_metadata;
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, email, name, role, avatar, account_status, scheduled_deletion_at')
                .eq('id', data.user.id)
                .maybeSingle();

<<<<<<< HEAD
            if (profileError || !profile) {
                console.error("AuthService: Canonical profile fetch failed", profileError);
                await supabase.auth.signOut().catch(() => undefined);
                return { user: null, error: 'Your account profile could not be verified. Please try again.' };
=======
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
                        role: (metadata?.role as UserRole) || 'tenant_admin',
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
>>>>>>> origin/main
            }

            if (['deleted', 'suspended', 'pending_deletion'].includes(String(profile.account_status))) {
                await supabase.auth.signOut().catch(() => undefined);
                return { user: null, error: 'This account is not currently active.' };
            }

            const user: User = {
                id: profile.id,
                email: profile.email,
                name: profile.name,
                role: profile.role,
                avatar: profile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.email}`,
                account_status: profile.account_status,
                scheduled_deletion_at: profile.scheduled_deletion_at,
            };

            supabase.auth.updateUser({
                data: { name: user.name, avatar: user.avatar }
            }).catch(() => { });

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
                const { data: mfaData } = await withAuthTimeout(supabase.auth.mfa.getAuthenticatorAssuranceLevel(), 5000);
                if (mfaData?.nextLevel === 'aal2' && mfaData?.currentLevel === 'aal1') {
                    needsMfa = true;
                }
            } catch (e) {
                console.error("MFA check error", e);
            }

            if (!needsMfa && (user.role === 'tenant_admin' || user.role === 'business_dashboard')) {
                try {
                    const { bootstrapTenantViaApi } = await import('@/lib/tenant/bootstrapTenantClient');
                    await bootstrapTenantViaApi({
                        name:
                            (metadata?.business_name as string | undefined)?.trim() ||
                            `${user.name}'s Organization`,
                    });
                } catch (bootstrapErr) {
                    console.warn('[authService] post-login tenant bootstrap failed:', bootstrapErr);
                }
            }

            // Return user immediately without waiting for activity tracking
            return { user, error: null, needsMfa };
        } catch (err: any) {
            if (err.name === 'ZodError') {
                return { user: null, error: err.errors?.[0]?.message || 'Validation failed', needsMfa: false };
            }
            return { user: null, error: err instanceof Error ? err.message : 'Unknown error', needsMfa: false };
        }
    },

    /**
     * Sign up new user
     */
    async signUp(
        email: string,
        password: string,
        name: string,
        role: UserRole = 'tenant_admin',
        options?: {
            businessName?: string;
            plan?: string;
            referralCode?: string;
            marketingOptIn?: boolean;
            euConsent?: boolean;
            ageConfirmed?: boolean;
            legalAccepted?: boolean;
        }
    ): Promise<{ user: User | null; error: string | null; needsEmailConfirmation?: boolean }> {
        const configError = supabaseConfigError();
        if (configError) {
            return { user: null, error: configError };
        }

        try {
            // Validate input
            const validated = signUpSchema.parse({ email: email.toLowerCase(), password, name });
            const { assertPasswordAllowed } = await import('@/lib/security/passwordPolicy');
            const passwordCheck = await assertPasswordAllowed(validated.password);
            if (!passwordCheck.ok) {
                return { user: null, error: passwordCheck.error };
            }

            try {
                const eligibilityResponse = await fetch('/api/auth/signup-eligibility', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: validated.email }),
                });
                const eligibilityData = await eligibilityResponse.json().catch(() => ({}));
                if (eligibilityResponse.ok && eligibilityData?.blocked) {
                    return { user: null, error: 'This email address is permanently blocked after account deletion.' };
                }
            } catch (eligibilityError) {
                console.warn('Signup eligibility precheck failed, continuing with auth provider check.', eligibilityError);
            }

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

            // Email confirmation links must land on /auth/callback so workspace + prefs can finish.
            const emailRedirectTo = buildAuthCallbackRedirect('/dashboard');

            const { data, error } = await withAuthTimeout(supabase.auth.signUp({
                email: validated.email,
                password: validated.password,
                options: {
                    emailRedirectTo,
                    data: {
                        name: validated.name,
                        full_name: validated.name,
                        role,
                        account_type: 'business_owner',
                        registration_country: registrationCountry,
                        business_name: options?.businessName?.trim() || undefined,
                        plan: options?.plan || 'free',
                        referral_code: options?.referralCode?.trim() || undefined,
                        // Persist consent through email-confirmation (no session until confirmed).
                        marketing_opt_in: Boolean(options?.marketingOptIn),
                        legal_accepted: options?.legalAccepted !== false,
                        eu_consent: Boolean(options?.euConsent),
                        age_confirmed: Boolean(options?.ageConfirmed),
                        signup_method: 'email',
                    },
                },
            }));

            if (error) {
                console.error("SignUp Error:", error);
                const msg = String(error.message || '').toLowerCase();
                if (msg.includes('permanently blocked')) {
                    return { user: null, error: 'This email address is permanently blocked after account deletion.' };
                }
                if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('already exists')) {
                    return { user: null, error: 'An account with this email already exists. Please sign in instead, or reset your password.' };
                }
                return { user: null, error: error.message };
            }

            if (!data.user) {
                return { user: null, error: 'No user data returned' };
            }

            // Supabase anti-enumeration: existing emails return a user with empty identities and no error.
            const identities = Array.isArray(data.user.identities) ? data.user.identities : [];
            if (identities.length === 0) {
                return {
                    user: null,
                    error: 'An account with this email already exists. Please sign in instead, or reset your password.',
                };
            }

            const user: User = {
                id: data.user.id,
                email: validated.email,
                name: validated.name,
                role: role === 'client' ? 'tenant_admin' : role,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${validated.email}`,
            };

            if (data.session) {
                try {
                    const { bootstrapTenantViaApi } = await import('@/lib/tenant/bootstrapTenantClient');
                    const orgName = options?.businessName?.trim() || `${validated.name}'s Organization`;
                    await bootstrapTenantViaApi({
                        name: orgName,
                        plan: options?.plan || 'free',
                        referralCode: options?.referralCode?.trim() || undefined,
                    });
                } catch (bootstrapErr) {
                    console.warn('[authService] tenant bootstrap after signup failed:', bootstrapErr);
                }
            }

            if (options?.referralCode?.trim()) {
                try {
                    await fetch('/api/referrals/claim', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            referralCode: options.referralCode.trim(),
                            referredEmail: validated.email,
                        }),
                    });
                } catch (refErr) {
                    console.warn('[authService] referral claim record failed:', refErr);
                }
            }

            // Welcome email is sent after workspace provisioning on the login/register page,
            // or via auth/callback for email-confirmation signups — not here (avoids duplicates).
            return { user, error: null, needsEmailConfirmation: !data.session };
        } catch (err: any) {
            if (err.name === 'ZodError') {
                return { user: null, error: err.errors?.[0]?.message || 'Validation failed' };
            }
            return { user: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Send password reset email
     */
    async resetPassword(email: string): Promise<{ error: string | null }> {
        const configError = supabaseConfigError();
        if (configError) {
            return { error: configError };
        }

        try {
            const { error } = await withAuthTimeout(supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${getOAuthRedirectOrigin(
                    typeof window !== 'undefined' ? window.location.origin : undefined
                )}/auth/reset-password`,
            }));

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
                .min(12, 'Password must be at least 12 characters')
                .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
                .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
                .regex(/[0-9]/, 'Password must contain at least one number')
                .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

            passwordSchema.parse(password);
            const { assertPasswordAllowed } = await import('@/lib/security/passwordPolicy');
            const passwordCheck = await assertPasswordAllowed(password);
            if (!passwordCheck.ok) {
                return { error: passwordCheck.error };
            }

            const { error } = await withAuthTimeout(supabase.auth.updateUser({ password }));

            if (error) {
                console.error("Update Password Error:", error);
                return { error: error.message };
            }

            return { error: null };
        } catch (err: any) {
            if (err.name === 'ZodError') {
                return { error: err.errors?.[0]?.message || 'Validation failed' };
            }
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * After email confirmation or delayed session, send welcome once (server is idempotent).
     * Skipped when welcome_email_sent_at is already set (e.g. Google handled in /auth/callback).
     */
    async triggerPlatformWelcomeIfNeeded(): Promise<void> {
        if (typeof window === 'undefined') return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token || !session.user?.email) return;
            if (session.user.user_metadata?.welcome_email_sent_at) return;

            await fetch(`${window.location.origin}/api/email/platform-transactional`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ templateName: 'Welcome Email', variables: {} }),
            });
        } catch (e) {
            console.warn('triggerPlatformWelcomeIfNeeded:', e);
        }
    },

    /**
     * Sign in with Google OAuth
     */
    async signInWithGoogle(nextPath?: string): Promise<{ error: string | null }> {
        const configError = supabaseConfigError();
        if (configError) {
            return { error: configError };
        }

        try {
            // Set a flag to help AuthContext/AuthService identify that we are in a callback loop
            // and should be more persistent with session discovery.
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('auth_callback_in_progress', 'true');
            }

            const redirectTo = buildAuthCallbackRedirect(nextPath);

            const { error } = await withAuthTimeout(supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
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
     * Sign in with LinkedIn OAuth
     */
    async signInWithLinkedIn(nextPath?: string): Promise<{ error: string | null }> {
        const configError = supabaseConfigError();
        if (configError) {
            return { error: configError };
        }

        try {
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('auth_callback_in_progress', 'true');
            }

            const redirectTo = buildAuthCallbackRedirect(nextPath);

            const { error } = await withAuthTimeout(supabase.auth.signInWithOAuth({
                provider: 'linkedin_oidc',
                options: {
                    redirectTo,
                    queryParams: {
                        prompt: 'consent',
                    },
                },
            }), 5000);

            if (error) {
                console.error("LinkedIn SignIn Error:", error);
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
     * Connect LinkedIn as integration for the CURRENT signed-in user.
     * This avoids switching app account sessions during OAuth.
     */
    async connectLinkedInIntegration(nextPath: string = '/dashboard/business/linkedin', tenantId?: string): Promise<{ error: string | null }> {
        try {
            if (typeof window === 'undefined') return { error: 'LinkedIn connection is browser-only' };
            const params = new URLSearchParams();
            params.set('return_to', nextPath);
            if (tenantId) params.set('tenant_id', tenantId);
            params.set('force_reauth', '1');
            window.location.href = `/api/auth/linkedin/connect?${params.toString()}`;
            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Handle LinkedIn connector callback status in dashboard routes.
     */
    consumeLinkedInConnectStatusFromUrl(): void {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        const connected = url.searchParams.get('li_connected');
        const liError = url.searchParams.get('li_error');
        if (!connected && !liError) return;

        if (connected === 'true') {
            // Keep feedback concise and non-blocking
            import('react-hot-toast').then(({ default: toast }) => {
                toast.success('LinkedIn connected');
            }).catch(() => { });
        } else if (liError) {
            import('react-hot-toast').then(({ default: toast }) => {
                const messages: Record<string, string> = {
                    missing_w_member_social: 'LinkedIn connected, but write scope is missing. Reconnect and approve posting permissions.',
                    missing_required_scopes: 'LinkedIn connected, but required scopes are missing. Reconnect and approve all requested permissions.',
<<<<<<< HEAD
                    missing_write_permissions: 'LinkedIn connected, but posting permissions are missing. Reconnect and approve both personal and company page scopes.',
                    invalid_state: 'LinkedIn sign-in expired. Start the connection again.',
                    unauthorized_state: 'LinkedIn sign-in does not match the current user. Start the connection again.',
=======
>>>>>>> origin/main
                    unauthorized_scope_error: 'LinkedIn rejected one or more scopes for this app. Check LinkedIn app products/permissions, then reconnect.',
                    app_not_configured: 'LinkedIn app is not configured on server.',
                    token_exchange_failed: 'LinkedIn OAuth token exchange failed. Please try reconnecting.',
                    profile_failed: 'LinkedIn profile read failed. Please reconnect.',
                    tenant_not_found: 'No workspace membership was found for this LinkedIn connection.',
                    save_failed: 'LinkedIn connected, but saving the page identities failed. Please reconnect.',
                    unexpected_error: 'LinkedIn connect failed unexpectedly. Please try reconnecting.',
                };
                toast.error(messages[liError] || `LinkedIn connect failed: ${liError}`);
            }).catch(() => { });
        }

        url.searchParams.delete('li_connected');
        url.searchParams.delete('li_error');
        window.history.replaceState({}, '', url.toString());
    },

    /**
     * Sign in with Facebook OAuth
     */
    async signInWithFacebook(nextPath?: string): Promise<{ error: string | null }> {
        const configError = supabaseConfigError();
        if (configError) {
            return { error: configError };
        }

        try {
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('auth_callback_in_progress', 'true');
            }

            const redirectTo = buildAuthCallbackRedirect(nextPath);

            const { error } = await withAuthTimeout(supabase.auth.signInWithOAuth({
                provider: 'facebook',
                options: {
                    redirectTo,
                },
            }), 5000);

            if (error) {
                console.error("Facebook SignIn Error:", error);
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
                withAuthTimeout(supabase.auth.signOut())
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
     * Deduplicated: concurrent calls share the same in-flight promise.
     */
    async getCurrentUser(): Promise<{ user: User | null; error: string | null }> {
        // If a call is already in-flight, reuse it instead of stacking up parallel requests
        if (_getCurrentUserInflight) {
            return _getCurrentUserInflight;
        }
        _getCurrentUserInflight = this._doGetCurrentUser().finally(() => {
            _getCurrentUserInflight = null;
        });
        return _getCurrentUserInflight;
    },

    async _doGetCurrentUser(): Promise<{ user: User | null; error: string | null }> {
        if (!isSupabaseConfigured()) {
            return { user: null, error: null };
        }

        try {
            let session = null;
            let lastError = null;

            const isAuthCallback = typeof window !== 'undefined' &&
                (window.location.search.includes('code=') ||
                    window.location.pathname.includes('/auth/callback') ||
                    sessionStorage.getItem('auth_callback_in_progress') === 'true');

            const t0 = Date.now();
            const maxAttempts = isAuthCallback ? 3 : 1;

            for (let i = 0; i < maxAttempts; i++) {
                const { data: { session: s }, error } = await withAuthTimeout(supabase.auth.getSession(), 8000); // Increased from 3s to 8s
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
            console.log(`auth:getSession: ${Date.now() - t0}ms`);

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
            console.log(`AuthService: Fetching profile for ${session.user.id}...`);

            let profile = null;
            lastError = null;
            const maxRetries = 2; // Reduced from 3
            const retryDelay = 500;

            for (let i = 0; i < maxRetries; i++) {
                try {
                    const { data: p, error: profileError } = await withAuthTimeout(
                        supabase
                            .from('profiles')
                            .select('*, account_status, scheduled_deletion_at')
                            .eq('id', session.user.id)
                            .maybeSingle(),
                        3000 // Reduced from 5s to 3s
                    );

                    if (!profileError && p) {
                        profile = p;
                        break;
                    }

                    lastError = profileError;

                    if (profileError?.code === 'PGRST301' || profileError?.message?.includes('403')) {
                        console.error('AuthService: Profile 403 Forbidden', profileError);
                        break;
                    }
                } catch (timeoutErr) {
                    console.warn(`AuthService: Profile fetch attempt ${i + 1} timed out`);
                    lastError = { message: 'Profile fetch timed out' };
                }

                if (i < maxRetries - 1) {
                    console.log(`AuthService: Profile sync retry ${i + 1}/${maxRetries}...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }

            if (!profile) {
                console.warn("AuthService: Canonical profile retrieval failed.", lastError);
                // After Google OAuth, profile/tenant bootstrap can lag — heal via server bootstrap.
                if (isAuthCallback || typeof window !== 'undefined') {
                    try {
                        const ensureRes = await fetch('/api/tenant/bootstrap', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ mode: 'ensure' }),
                        });
                        if (ensureRes.ok) {
                            const { data: p2 } = await withAuthTimeout(
                                supabase
                                    .from('profiles')
                                    .select('*, account_status, scheduled_deletion_at')
                                    .eq('id', session.user.id)
                                    .maybeSingle(),
                                3000
                            );
                            if (p2) profile = p2;
                        }
                    } catch (ensureErr) {
                        console.warn('AuthService: tenant bootstrap fallback failed', ensureErr);
                    }
                }
            }

            if (!profile) {
                console.warn("AuthService: Canonical profile retrieval failed.", lastError);
                return { user: null, error: 'Your account profile could not be verified. Please sign in again.' };
            }

            if (['deleted', 'suspended', 'pending_deletion'].includes(String(profile.account_status))) {
                return { user: null, error: 'Account is not active' };
            }

            console.log("AuthService: Profile retrieved successfully", profile.role);

            const user: User = {
                id: profile.id,
                email: profile.email,
                name: profile.name,
                role: profile.role,
                avatar: profile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.email}`,
                account_status: profile.account_status,
                scheduled_deletion_at: profile.scheduled_deletion_at,
            };

            if (
                session.user.user_metadata.name !== user.name ||
                session.user.user_metadata.avatar !== user.avatar
            ) {
                supabase.auth.updateUser({
                    data: {
                        name: user.name,
                        avatar: user.avatar,
                    }
                }).catch(() => { });
            }

            console.log(`auth:getProfile: ${Date.now() - startTime}ms. Role: ${user.role}`);
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
                withAuthTimeout(supabase.from('profiles').update(updates).eq('id', userId), 8000),
                withAuthTimeout(supabase.auth.updateUser({ data: updates }), 8000)
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
     * Debounced: rapid SIGNED_IN bursts (e.g. session refresh) are collapsed into one callback.
     */
    onAuthStateChange(callback: (user: User | null, event?: AuthChangeEvent) => void) {
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        let pendingEvent: { event: AuthChangeEvent; session: Session | null } | null = null;

        return supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
            console.log(`AuthService: State changed - Event: ${event}, UserID: ${session?.user?.id}`);

            // Collapse rapid bursts of the same event (e.g. multiple SIGNED_IN on refresh)
            if (debounceTimer) clearTimeout(debounceTimer);
            pendingEvent = { event, session };

            debounceTimer = setTimeout(async () => {
                const { event: e, session: s } = pendingEvent!;
                pendingEvent = null;
                debounceTimer = null;

                if (s?.user) {
                    const { user } = await this.getCurrentUser();
                    callback(user, e);
                } else {
                    callback(null, e);
                }
            }, 50); // 50ms debounce window
        });
    },

    /**
     * Request account deletion
     */
    async requestAccountDeletion(options?: { immediate?: boolean }): Promise<{ error: string | null }> {
        try {
            const immediate = options?.immediate ? '?immediate=true' : '';
            const res = await fetch(`/api/account/delete${immediate}`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                return { error: data.error || (options?.immediate ? 'Failed to delete account' : 'Failed to schedule account deletion') };
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
            const res = await fetch('/api/account/delete', { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                return { error: data.error || 'Failed to cancel account deletion' };
            }
            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },
};

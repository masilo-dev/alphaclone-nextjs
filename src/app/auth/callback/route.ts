import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { getPostAuthDashboardPath } from '@/lib/auth/postAuthRedirect'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const requestedNext = searchParams.get('next')

    if (code) {
        try {
            await cookies()

            const supabase = await createSupabaseServerClient()
            const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
            if (!error && session) {
                const user = session.user
                const provider = (session as any)?.user?.app_metadata?.provider as string | undefined

                // Ensure tenant exists BEFORE integration syncs (LinkedIn, etc.)
                let tenantId = user.user_metadata?.tenant_id as string | undefined;
                try {
                    const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
                    const admin = createSupabaseAdminClient();

                    if (tenantId) {
                        const { data: metadataMembership } = await admin
                            .from('tenant_users')
                            .select('tenant_id')
                            .eq('user_id', user.id)
                            .eq('tenant_id', tenantId)
                            .maybeSingle();
                        if (!metadataMembership?.tenant_id) {
                            tenantId = undefined;
                        }
                    }

                    if (!tenantId) {
                        const { data: existingMembership } = await admin
                            .from('tenant_users')
                            .select('tenant_id')
                            .eq('user_id', user.id)
                            .maybeSingle();

                        if (existingMembership?.tenant_id) {
                            tenantId = existingMembership.tenant_id;
                        } else {
                            const { bootstrapTenantForUser } = await import('@/lib/tenant/bootstrapTenantServer');
                            const name = (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User').trim();
                            const workspaceName = `${name}'s Workspace`;
                            const randomSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
                            const slug = name.toLowerCase().replace(/[^a-z]+/g, '-') + '-' + randomSuffix;

                            const { tenantId: newTenantId } = await bootstrapTenantForUser(admin, user, {
                                name: workspaceName,
                                slug,
                                plan: 'starter',
                            });

                            if (newTenantId) {
                                await admin.auth.admin.updateUserById(user.id, {
                                    user_metadata: { ...user.user_metadata, tenant_id: newTenantId },
                                });
                                tenantId = newTenantId;
                            }
                        }
                    }
                } catch (tenantErr) {
                    console.error('[auth/callback] Failed to ensure tenant for OAuth user:', tenantErr);
                    // Still try to ensure a profile exists so getCurrentUser does not clear the session.
                    try {
                        const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
                        const { ensureUserProfile } = await import('@/lib/tenant/bootstrapTenantServer');
                        const admin = createSupabaseAdminClient();
                        await ensureUserProfile(admin, user);
                    } catch (profileErr) {
                        console.error('[auth/callback] Profile ensure also failed:', profileErr);
                        return NextResponse.redirect(
                            `${origin}/auth/login?error=${encodeURIComponent('workspace_bootstrap_failed')}`
                        );
                    }
                }

                if (provider === 'linkedin_oidc') {
                    // Login via Supabase OIDC only — do not store short-lived provider_token as integration credential.
                    // Full posting scopes + encrypted tokens come from /api/auth/linkedin/connect.
                    try {
                        const identities = Array.isArray(user.identities) ? user.identities : []
                        const linkedInIdentity = identities.find((identity: any) => identity?.provider === 'linkedin_oidc')
                        const memberId =
                            linkedInIdentity?.identity_data?.sub ||
                            linkedInIdentity?.id ||
                            (user.user_metadata?.sub as string | undefined)

                        if (memberId) {
                            const resolvedTenantId = tenantId || (user.user_metadata?.tenant_id as string | undefined)
                            if (resolvedTenantId) {
                                const { createSupabaseAdminClient } = await import('@/lib/supabase-admin')
                                const admin = createSupabaseAdminClient()
                                const { data: existing } = await admin
                                    .from('linkedin_integrations')
                                    .select('id, metadata')
                                    .eq('tenant_id', resolvedTenantId)
                                    .eq('user_id', user.id)
                                    .eq('linkedin_member_id', String(memberId))
                                    .maybeSingle()

                                if (existing?.id) {
                                    const metadata =
                                        existing.metadata && typeof existing.metadata === 'object'
                                            ? { ...(existing.metadata as Record<string, unknown>) }
                                            : {}
                                    await admin
                                        .from('linkedin_integrations')
                                        .update({
                                            metadata: {
                                                ...metadata,
                                                last_login_via: 'linkedin_oidc',
                                                last_login_at: new Date().toISOString(),
                                            },
                                            updated_at: new Date().toISOString(),
                                        })
                                        .eq('id', existing.id)
                                }
                            }
                        }
                    } catch (linkedinErr) {
                        console.error('[auth/callback] LinkedIn login metadata sync error:', linkedinErr)
                    }
                }

                if (user.email && !user.user_metadata?.welcome_email_sent_at) {
                    try {
                        const { createSupabaseAdminClient } = await import('@/lib/supabase-admin')
                        const {
                            sendPlatformTemplateEmail,
                            SYSTEM_PLATFORM_TEMPLATES,
                            defaultDashboardUrl,
                        } = await import('@/lib/email/platformTemplateEmail')
                        const admin = createSupabaseAdminClient()
                        const normalizedEmail = user.email.toLowerCase().trim()
                        const name =
                            (user.user_metadata?.name as string | undefined) ||
                            normalizedEmail.split('@')[0] ||
                            'there'
                        await sendPlatformTemplateEmail(admin, {
                            templateName: 'Welcome Email',
                            to: normalizedEmail,
                            variables: {
                                name,
                                email: normalizedEmail,
                                dashboardUrl: defaultDashboardUrl(),
                            },
                            credentialUserId: user.id,
                            templateAllowlist: SYSTEM_PLATFORM_TEMPLATES,
                            skipIfWelcomeAlreadySent: true,
                            authUserId: user.id,
                        })
                    } catch (welcomeErr) {
                        console.error('[auth/callback] Welcome email:', welcomeErr)
                    }
                }

                try {
                    const { createSupabaseAdminClient } = await import('@/lib/supabase-admin')
                    const { recordRegistrationEvent, inferSignupMethod } = await import('@/lib/auth/registrationEvents')
                    const admin = createSupabaseAdminClient()
                    const registrationResult = await recordRegistrationEvent(admin, {
                        user,
                        signupMethod: inferSignupMethod(user),
                        sourceUrl: request.headers.get('referer'),
                        userAgent: request.headers.get('user-agent'),
                        metadata: {
                            callbackProvider: provider || null,
                            callbackNext: requestedNext || null,
                        },
                    })
                    if (!registrationResult.success) {
                        console.error('[auth/callback] Registration event failed:', registrationResult.error)
                    }
                } catch (registrationErr) {
                    console.error('[auth/callback] Registration event error:', registrationErr)
                }

                // Apply signup consent prefs after email confirmation (no session existed at signUp).
                if (user.user_metadata?.signup_method === 'email' && !user.user_metadata?.communication_prefs_applied_at) {
                    try {
                        const { createSupabaseAdminClient } = await import('@/lib/supabase-admin')
                        const admin = createSupabaseAdminClient()
                        const marketing = Boolean(user.user_metadata?.marketing_opt_in)
                        const profileName = String(
                            user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User'
                        ).trim()
                        const consentAt = new Date().toISOString()
                        await admin.from('profiles').upsert(
                            {
                                id: user.id,
                                email: user.email,
                                name: profileName,
                                role: 'tenant_admin',
                                communication_prefs: {
                                    transactional: true,
                                    product_updates: true,
                                    marketing,
                                    sms: false,
                                    legal_acceptance: {
                                        accepted_at: consentAt,
                                        policy_version: '2026-06-01',
                                        eu_consent: Boolean(user.user_metadata?.eu_consent) || null,
                                        age_confirmed: Boolean(user.user_metadata?.age_confirmed) || null,
                                        terms_url: 'https://alphaclonesystems.com/terms-of-service',
                                        privacy_url: 'https://alphaclonesystems.com/privacy-policy',
                                    },
                                },
                                gdpr_consent_date: consentAt,
                            },
                            { onConflict: 'id' }
                        )
                        await admin.auth.admin.updateUserById(user.id, {
                            user_metadata: {
                                ...user.user_metadata,
                                communication_prefs_applied_at: consentAt,
                            },
                        })
                    } catch (prefsErr) {
                        console.error('[auth/callback] Failed to apply registration communication prefs:', prefsErr)
                    }
                }

                let next = requestedNext ?? '/dashboard'
                if (requestedNext) {
                    // Only allow same-origin relative redirects (OAuth return, dashboard).
                    const safe =
                        requestedNext.startsWith('/authorize') ||
                        requestedNext.startsWith('/oauth/') ||
                        requestedNext.startsWith('/dashboard') ||
                        requestedNext.startsWith('/auth/')
                    if (!safe || requestedNext.startsWith('//') || requestedNext.includes('://')) {
                        next = '/dashboard'
                    } else {
                        next = requestedNext
                    }
                } else {
                    try {
                        const { createSupabaseAdminClient } = await import('@/lib/supabase-admin')
                        const admin = createSupabaseAdminClient()
                        const { data: profile } = await admin
                            .from('profiles')
                            .select('role')
                            .eq('id', user.id)
                            .maybeSingle()
                        next = getPostAuthDashboardPath(profile?.role)
                    } catch {
                        next = '/dashboard'
                    }
                }

                const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
                const isLocalEnv = process.env.NODE_ENV === 'development'
                let redirectUrl = ''

                if (isLocalEnv) {
                    redirectUrl = `${origin}${next}`
                } else if (forwardedHost) {
                    redirectUrl = `https://${forwardedHost}${next}`
                } else {
                    redirectUrl = `${origin}${next}`
                }

                return NextResponse.redirect(redirectUrl)
            } else {
                console.error('Auth Callback Exchange Error:', error)
            }
        } catch (err) {
            console.error('Auth Callback Critical Error:', err)
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}

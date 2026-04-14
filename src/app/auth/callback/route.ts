import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard/business'

    if (code) {
        try {
            const cookieStore = await cookies()

            // Use centralized ENV to handle variable resolution (VITE_ vs NEXT_PUBLIC_)
            // and fallback logic
            const { ENV } = await import('@/config/env')

            const supabase = createServerClient(
                ENV.VITE_SUPABASE_URL,
                ENV.VITE_SUPABASE_ANON_KEY,
                {
                    cookies: {
                        getAll() {
                            return cookieStore.getAll()
                        },
                        setAll(cookiesToSet) {
                            try {
                                cookiesToSet.forEach(({ name, value, options }) =>
                                    cookieStore.set(name, value, options)
                                )
                            } catch {
                                // The `setAll` method was called from a Server Component.
                                // This can be ignored if you have middleware refreshing
                                // user sessions.
                            }
                        },
                    },
                }
            )
            const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
            if (!error && session) {
                const user = session.user
                const provider = (session as any)?.user?.app_metadata?.provider as string | undefined

                if (provider === 'linkedin_oidc') {
                    try {
                        const providerToken = (session as any).provider_token as string | undefined
                        if (providerToken) {
                            const identities = Array.isArray(user.identities) ? user.identities : []
                            const linkedInIdentity = identities.find((identity: any) => identity?.provider === 'linkedin_oidc')
                            const memberId =
                                linkedInIdentity?.identity_data?.sub ||
                                linkedInIdentity?.id ||
                                (user.user_metadata?.sub as string | undefined)

                            if (memberId) {
                                const personUrn = `urn:li:person:${memberId}`
                                const scopeRaw = (user.user_metadata?.provider_scopes as string | undefined) || ''
                                const scopes = scopeRaw
                                    .split(' ')
                                    .map((s) => s.trim())
                                    .filter(Boolean)

                                const { data: tenantUser } = await supabase
                                    .from('tenant_users')
                                    .select('tenant_id')
                                    .eq('user_id', user.id)
                                    .order('created_at', { ascending: true })
                                    .limit(1)
                                    .maybeSingle()

                                const tenantId = tenantUser?.tenant_id || (user.user_metadata?.tenant_id as string | undefined)
                                if (tenantId) {
                                    await supabase
                                        .from('linkedin_integrations')
                                        .upsert(
                                            {
                                                tenant_id: tenantId,
                                                user_id: user.id,
                                                linkedin_member_id: memberId,
                                                linkedin_person_urn: personUrn,
                                                access_token: providerToken,
                                                token_expires_at: session.expires_at
                                                    ? new Date(session.expires_at * 1000).toISOString()
                                                    : null,
                                                scopes,
                                                is_active: true,
                                                metadata: {
                                                    provider: 'linkedin_oidc',
                                                },
                                                updated_at: new Date().toISOString(),
                                            },
                                            { onConflict: 'tenant_id,user_id,linkedin_member_id' }
                                        )
                                }
                            }
                        }
                    } catch (linkedinErr) {
                        console.error('[auth/callback] LinkedIn integration sync error:', linkedinErr)
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

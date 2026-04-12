import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'

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

                // Check if this is a new user (first-time sign-in)
                // We check the 'created_at' and 'last_sign_in_at' timestamps. 
                // If they are very close (e.g. within a few seconds), it's likely a new user.
                const createdAt = new Date(user.created_at).getTime()
                const lastSignIn = new Date(user.last_sign_in_at || user.created_at).getTime()
                const isNewUser = Math.abs(lastSignIn - createdAt) < 5000 // 5 seconds tolerance

                if (isNewUser) {
                    // Redirect to landing page with a special flag for new users
                    const landingUrl = new URL(origin)
                    landingUrl.searchParams.set('auth_status', 'new_account')
                    landingUrl.searchParams.set('message', 'Please sign in again to confirm your account.')
                    return NextResponse.redirect(landingUrl.toString())
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

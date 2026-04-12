import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import {
    sendPlatformTemplateEmail,
    USER_INITIATED_PLATFORM_TEMPLATES,
    defaultDashboardUrl,
} from '@/lib/email/platformTemplateEmail';

export const dynamic = 'force-dynamic';

function createUserClient(accessToken: string) {
    const url = ENV.VITE_SUPABASE_URL || ENV.NEXT_PUBLIC_SUPABASE_URL;
    const anon = ENV.VITE_SUPABASE_ANON_KEY || ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
        throw new Error('Supabase URL or anon key missing');
    }
    return createClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

/**
 * POST /api/email/platform-transactional
 * User path: Authorization Bearer access_token (or cookie session via getSession in future).
 * Sends allowlisted templates to the authenticated user's email only.
 *
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const templateName = String(body?.templateName ?? '');
        const variables = (body?.variables ?? {}) as Record<string, string | number>;

        const admin = createSupabaseAdminClient();

        const authHeader = req.headers.get('authorization');
        const token = authHeader?.startsWith('Bearer ')
            ? authHeader.slice('Bearer '.length).trim()
            : null;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userClient = createUserClient(token);
        const {
            data: { user },
            error: userErr,
        } = await userClient.auth.getUser();

        if (userErr || !user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!USER_INITIATED_PLATFORM_TEMPLATES.has(templateName)) {
            return NextResponse.json({ error: 'Template not allowed' }, { status: 400 });
        }

        const normalizedEmail = user.email.toLowerCase().trim();
        const name =
            (user.user_metadata?.name as string | undefined) ||
            normalizedEmail.split('@')[0] ||
            'there';

        const mergedVars: Record<string, string | number> = {
            name,
            email: normalizedEmail,
            dashboardUrl: defaultDashboardUrl(),
            ...variables,
        };

        const result = await sendPlatformTemplateEmail(admin, {
            templateName,
            to: normalizedEmail,
            variables: mergedVars,
            credentialUserId: user.id,
            templateAllowlist: USER_INITIATED_PLATFORM_TEMPLATES,
            skipIfWelcomeAlreadySent: true,
            authUserId: user.id,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: result.error === 'Email service not configured' ? 503 : 400 }
            );
        }

        return NextResponse.json({ success: true, skipped: result.skipped ?? false });
    } catch (e) {
        console.error('[platform-transactional]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

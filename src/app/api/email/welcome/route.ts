import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendPlatformTemplateEmail, SYSTEM_PLATFORM_TEMPLATES, defaultDashboardUrl } from '@/lib/email/platformTemplateEmail';

export async function POST(req: Request) {
    try {
        const { email, name, trial_ends_at, workspace_name } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const admin = createSupabaseAdminClient();
        const normalizedEmail = email.toLowerCase().trim();
        const displayName = name || normalizedEmail.split('@')[0] || 'there';

        // Trigger the platform template email
        // This service already handles deduping via 'welcome_email_sent_at' in user_metadata
        const { error } = await sendPlatformTemplateEmail(admin, {
            templateName: 'Welcome Email',
            to: normalizedEmail,
            variables: {
                name: displayName,
                email: normalizedEmail,
                dashboardUrl: defaultDashboardUrl(),
                trial_ends_at: trial_ends_at ? new Date(trial_ends_at).toLocaleDateString() : '14 days',
                workspace_name: workspace_name || 'Your Workspace'
            },
            templateAllowlist: SYSTEM_PLATFORM_TEMPLATES,
            skipIfWelcomeAlreadySent: true
        });

        if (error) {
            console.error('[api/email/welcome] Service error:', error);
            return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[api/email/welcome] Critical error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

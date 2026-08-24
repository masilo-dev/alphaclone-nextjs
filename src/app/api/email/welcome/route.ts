import { NextResponse } from 'next/server';
import { routeErrorResponse } from '@/lib/apiAuth';
import { denyUnlessInternalApiKey } from '@/lib/security/productionGuard';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendPlatformTemplateEmail, SYSTEM_PLATFORM_TEMPLATES, defaultDashboardUrl } from '@/lib/email/platformTemplateEmail';

export async function POST(req: Request) {
    const denied = denyUnlessInternalApiKey(req);
    if (denied) return denied;

    try {
        const { email, name, trial_ends_at, workspace_name } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const admin = createSupabaseAdminClient();
        const normalizedEmail = email.toLowerCase().trim();
        const displayName = name || normalizedEmail.split('@')[0] || 'there';

        // 1. Resolve Auth User ID (needed for the access link)
        const { data: userData } = await admin.auth.admin.listUsers();
        const authUser = userData.users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
        
        let secureDashboardUrl = defaultDashboardUrl();
        if (authUser) {
            const { accessLinkService } = await import('@/services/accessLinkService');
            const { link } = await accessLinkService.createAccessLink(admin, authUser.id, 'welcome');
            secureDashboardUrl = link;
        }

        // 2. Trigger the platform template email
        const { error } = await sendPlatformTemplateEmail(admin, {
            templateName: 'Welcome Email',
            to: normalizedEmail,
            variables: {
                name: displayName,
                email: normalizedEmail,
                dashboardUrl: secureDashboardUrl, // Now points to the Welcome Gate
                trial_ends_at: trial_ends_at ? new Date(trial_ends_at).toLocaleDateString() : '14 days',
                workspace_name: workspace_name || 'Your Workspace'
            },
            templateAllowlist: SYSTEM_PLATFORM_TEMPLATES,
            skipIfWelcomeAlreadySent: true,
            authUserId: authUser?.id
        });

        if (error) {
            console.error('[api/email/welcome] Service error:', error);
            return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[api/email/welcome] Critical error:', err);
        return routeErrorResponse(err, undefined, req);
    }
}

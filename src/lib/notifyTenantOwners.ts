import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';

/**
 * Fan-out in-app + email notifications to tenant owners/admins.
 */
export async function notifyTenantOwners(options: {
    tenantId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    fallbackUserId?: string;
}): Promise<void> {
    const admin = createSupabaseAdminClient();
    const { data: members } = await admin
        .from('tenant_users')
        .select('user_id, role')
        .eq('tenant_id', options.tenantId)
        .in('role', ['owner', 'admin']);

    const userIds = [
        ...new Set([
            ...(members || []).map((m: { user_id: string }) => m.user_id),
            ...(options.fallbackUserId ? [options.fallbackUserId] : []),
        ]),
    ];

    for (const userId of userIds) {
        const { data: profile } = await admin
            .from('profiles')
            .select('email, name')
            .eq('id', userId)
            .maybeSingle();

        await admin.from('notifications').insert({
            user_id: userId,
            tenant_id: options.tenantId,
            type: options.type,
            title: options.title,
            message: options.message,
            action_url: options.link || null,
            read: false,
        });

        if (profile?.email) {
            await sendEmailServer({
                tenantId: options.tenantId,
                to: profile.email,
                subject: options.title,
                html: `
                    <div style="font-family:sans-serif;padding:20px;color:#333;">
                        <p>${options.message}</p>
                        ${options.link ? `<p><a href="${options.link}" style="color:#0d9488;">View details</a></p>` : ''}
                    </div>
                `,
                isPlatformNotification: true,
            }).catch((err) => console.error('[notifyTenantOwners] email failed:', err));
        }
    }
}

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';

export async function tenantCreatedWorkflow({ tenantId, payload }: { tenantId: string; payload: any }) {
    "use workflow";

    await notifyPlatformStep(tenantId, payload);
}

async function notifyPlatformStep(tenantId: string, payload: any) {
    "use step";

    const supabase = createSupabaseAdminClient();

    const { data: settingsRow } = await supabase
        .from('platform_global_settings')
        .select('settings')
        .eq('singleton_key', 'default')
        .maybeSingle();

    const supportEmail = (settingsRow as any)?.settings?.branding?.supportEmail;
    const to = String(supportEmail || '').trim();
    if (!to) return;

    const tenantName = String(payload?.name || '').trim();
    const adminUserId = String(payload?.adminUserId || '').trim();

    const html = `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #111;">
            <h2 style="margin: 0 0 8px;">New workspace created</h2>
            <p style="margin: 0 0 12px;">A new workspace was created on AlphaClone.</p>
            <ul style="margin: 0; padding-left: 18px;">
                <li><strong>Tenant ID:</strong> ${tenantId}</li>
                <li><strong>Workspace:</strong> ${tenantName || '(unknown)'}</li>
                <li><strong>Admin user ID:</strong> ${adminUserId || '(unknown)'}</li>
            </ul>
        </div>
    `;

    await sendEmailServer({
        tenantId,
        to,
        subject: `New workspace created: ${tenantName || tenantId}`,
        html,
        isPlatformNotification: true,
    });
}


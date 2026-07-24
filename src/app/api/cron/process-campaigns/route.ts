import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { sendScheduledCampaignServer } from '@/lib/server/sendScheduledCampaignServer';

export const dynamic = 'force-dynamic';

/**
 * Cron-triggered endpoint to process scheduled campaigns (every 5–15 minutes).
 * Auth: Railway Cron (`x-railway-cron`) or `Authorization: Bearer ${CRON_SECRET}`.
 * Requires INTERNAL_API_KEY for outbound email via /api/email/send.
 */
export async function GET(req: NextRequest) {
    const denied = denyIfCronUnauthorized(req);
    if (denied) return denied;

    try {
        const now = new Date().toISOString();
        const admin = createSupabaseAdminClient();

        const { data: campaigns, error } = await admin
            .from('email_campaigns')
            .select('id, tenant_id, status, scheduled_at')
            .eq('status', 'scheduled')
            .lte('scheduled_at', now);

        if (error) throw error;

        if (!campaigns?.length) {
            return NextResponse.json({ message: 'No campaigns to process' });
        }

        const { assertCronRowTenantContext, quarantineTenantIsolationRow } = await import(
            '@/lib/tenant/platformTenant'
        );
        const results = [];
        for (const campaign of campaigns) {
            try {
                assertCronRowTenantContext(campaign);
            } catch (quarantineErr: any) {
                console.error('[cron/process-campaigns] quarantined:', quarantineErr?.message);
                await quarantineTenantIsolationRow({
                    tableName: 'email_campaigns',
                    recordId: campaign.id,
                    reason: 'missing_tenant_id',
                    payload: {
                        status: campaign.status,
                        scheduled_at: campaign.scheduled_at,
                    },
                }).catch(() => undefined);
                // Move out of scheduled so we do not retry forever
                await admin
                    .from('email_campaigns')
                    .update({
                        status: 'draft',
                        updated_at: now,
                    })
                    .eq('id', campaign.id)
                    .eq('status', 'scheduled');
                results.push({
                    id: campaign.id,
                    ok: false,
                    error: 'missing_tenant_id',
                    quarantined: true,
                });
                continue;
            }
            const result = await sendScheduledCampaignServer(campaign.id);
            results.push({ id: campaign.id, tenant_id: campaign.tenant_id, ...result });
        }

        return NextResponse.json({
            message: `Processed ${campaigns.length} campaigns`,
            results,
        });
    } catch (err: unknown) {
        console.error('Campaign Processing Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'cron/process-campaigns.GET' });
    }
}

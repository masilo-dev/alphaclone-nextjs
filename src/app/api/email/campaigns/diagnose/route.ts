import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/email/campaigns/diagnose?tenantId=xxx&campaignId=yyy
 * Returns a diagnostic report explaining why a campaign may not be sending.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get('tenantId');
        const campaignId = searchParams.get('campaignId');

        if (!tenantId || !campaignId) {
            return NextResponse.json({ error: 'tenantId and campaignId are required' }, { status: 400 });
        }

        await requireTenantAccess(tenantId);
        const admin = createSupabaseAdminClient();

        const issues: string[] = [];
        const warnings: string[] = [];
        const info: string[] = [];

        // 1. Fetch campaign
        const { data: campaign, error: cErr } = await admin
            .from('email_campaigns')
            .select('*')
            .eq('id', campaignId)
            .eq('tenant_id', tenantId)
            .single();

        if (cErr || !campaign) {
            return NextResponse.json({ issues: ['Campaign not found'], warnings: [], info: [] });
        }

        info.push(`Campaign status: "${campaign.status}"`);

        if (campaign.status === 'sent' || campaign.status === 'completed') {
            info.push(`Campaign already completed. Sent: ${campaign.total_sent} emails.`);
            return NextResponse.json({ issues, warnings, info });
        }

        if (campaign.status === 'draft') {
            issues.push('Campaign is still in DRAFT — it has not been sent yet. Click "Send" to launch it.');
        }

        if (campaign.status === 'scheduled' && campaign.scheduled_at) {
            const scheduledAt = new Date(campaign.scheduled_at);
            if (scheduledAt > new Date()) {
                info.push(`Campaign is scheduled for ${scheduledAt.toISOString()} — it has not fired yet.`);
            }
        }

        // 2. Check created_by
        const creatorId = campaign.created_by;
        if (!creatorId) {
            issues.push('CRITICAL: Campaign has no creator (created_by is null). Recreate the campaign while logged in.');
        }

        // 3. Check email providers
        if (creatorId) {
            const { data: integrations } = await admin
                .from('integrations')
                .select('type, enabled, config')
                .eq('user_id', creatorId)
                .eq('enabled', true)
                .in('type', ['sendgrid', 'resend', 'brevo', 'zoho', 'gmail']);

            if (!integrations || integrations.length === 0) {
                issues.push('No email provider connected. Go to Settings > Integrations and connect SendGrid, Resend, Brevo, Zoho Mail, or Gmail.');
            } else {
                const providerNames = integrations.map((i: any) => i.type).join(', ');
                info.push(`Active email providers: ${providerNames}`);

                // Check if API keys are present
                for (const integ of integrations) {
                    const cfg = integ.config || {};
                    if (integ.type !== 'zoho' && integ.type !== 'gmail') {
                        const hasKey = !!(cfg.apiKey || cfg.api_key);
                        if (!hasKey) {
                            issues.push(`Provider "${integ.type}" is connected but missing an API key. Edit the integration and add a valid key.`);
                        }
                    }
                }
            }
        }

        // 4. Check recipients
        const { data: recipients } = await admin
            .from('campaign_recipients')
            .select('status', { count: 'exact' })
            .eq('campaign_id', campaignId);

        const total = (recipients || []).length;
        const pending = (recipients || []).filter((r: any) => r.status === 'pending').length;
        const failed = (recipients || []).filter((r: any) => r.status === 'failed').length;
        const sent = (recipients || []).filter((r: any) => r.status === 'sent').length;

        info.push(`Recipients: ${total} total, ${pending} pending, ${sent} sent, ${failed} failed`);

        if (total === 0) {
            issues.push('Campaign has no recipients. Add recipients before sending.');
        } else if (pending === 0 && failed > 0) {
            issues.push(`All ${failed} recipients failed to send. Check provider config and suppression list.`);
        } else if (pending === 0 && sent === 0) {
            warnings.push('No pending recipients found. The campaign may have already been processed or recipients need to be re-added.');
        }

        // 5. Check suppression
        if (failed > 0) {
            const { data: failedRows } = await admin
                .from('campaign_recipients')
                .select('email, error_message')
                .eq('campaign_id', campaignId)
                .eq('status', 'failed')
                .limit(5);

            if (failedRows?.length) {
                const reasons = [...new Set(failedRows.map((r: any) => r.error_message).filter(Boolean))];
                if (reasons.length > 0) {
                    warnings.push(`Failure reasons (sample): ${reasons.join(' | ')}`);
                }
            }
        }

        const healthy = issues.length === 0;
        return NextResponse.json({ healthy, issues, warnings, info });
    } catch (err) {
        return routeErrorResponse(err, 'Failed to diagnose campaign', req);
    }
}

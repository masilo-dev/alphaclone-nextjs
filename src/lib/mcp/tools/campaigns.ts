// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

registerTool('campaigns', {
  name: 'campaign_brief',
  description:
    'Plain-English campaign summary for email outreach. Shows status, audience size, sent/open/click counts, and the most likely next step.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    campaign_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      campaign_id: { type: 'string', description: 'Email campaign UUID' },
    },
    required: ['tenant_id', 'campaign_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();

    const { data: campaign, error } = await supabase
      .from('email_campaigns')
      .select('id, name, subject, status, scheduled_at, sent_at, total_recipients, total_sent, total_opened, total_clicked, total_bounced, metadata, created_at, updated_at')
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.campaign_id)
      .single();

    if (error || !campaign) {
      throw new Error(`Campaign not found: ${error?.message || 'missing campaign record'}`);
    }

    const { data: recipientRows = [] } = await supabase
      .from('campaign_recipients')
      .select('status')
      .eq('tenant_id', args.tenant_id)
      .eq('campaign_id', args.campaign_id);

    const statusCounts = (recipientRows || []).reduce((acc: Record<string, number>, row: any) => {
      const key = String(row.status || 'pending');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const sent = Number(campaign.total_sent || 0);
    const opened = Number(campaign.total_opened || 0);
    const clicked = Number(campaign.total_clicked || 0);
    const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
    const clickRate = sent > 0 ? Math.round((clicked / sent) * 100) : 0;

    const nextStep =
      campaign.status === 'draft'
        ? 'Finish the message and choose recipients before sending.'
        : campaign.status === 'scheduled'
          ? 'Wait for the scheduled send time or send it manually if needed.'
          : campaign.status === 'sending'
            ? 'The system is sending messages now. Check delivery status soon.'
            : campaign.status === 'sent'
              ? 'Review opens and clicks, then follow up with engaged contacts.'
              : 'Check the campaign health and recipient status for issues.';

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          campaign: {
            id: campaign.id,
            name: campaign.name,
            subject: campaign.subject,
            status: campaign.status,
          },
          audience: {
            total_recipients: Number(campaign.total_recipients || 0),
            sent,
            opened,
            clicked,
            bounced: Number(campaign.total_bounced || 0),
            open_rate_percent: openRate,
            click_rate_percent: clickRate,
          },
          recipient_status_counts: statusCounts,
          next_step: nextStep,
          schedule: {
            scheduled_at: campaign.scheduled_at || null,
            sent_at: campaign.sent_at || null,
          },
        }, null, 2),
      }],
    };
  },
});

registerTool('campaigns', {
  name: 'campaign_diagnose',
  description:
    'Finds the most likely reason an email campaign is not sending or is underperforming, in language a non-technical user can understand.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    campaign_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      campaign_id: { type: 'string', description: 'Email campaign UUID' },
    },
    required: ['tenant_id', 'campaign_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();

    const { data: campaign, error } = await supabase
      .from('email_campaigns')
      .select('id, name, subject, status, scheduled_at, total_recipients, total_sent, total_opened, total_clicked, metadata, created_at')
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.campaign_id)
      .single();

    if (error || !campaign) {
      throw new Error(`Campaign not found: ${error?.message || 'missing campaign record'}`);
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    if (!campaign.subject || !campaign.name) issues.push('The campaign is missing a name or subject.');
    if (campaign.status === 'draft') warnings.push('The campaign is still a draft, so nothing will send yet.');
    if (campaign.status === 'scheduled' && !campaign.scheduled_at) warnings.push('It is scheduled, but no send time is set.');
    if (Number(campaign.total_recipients || 0) === 0) warnings.push('No recipients are attached yet.');
    if (Number(campaign.total_sent || 0) === 0 && ['sent', 'sending'].includes(String(campaign.status))) {
      warnings.push('The campaign has been marked as sending or sent, but no emails have been recorded.');
    }

    const { data: recipients = [] } = await supabase
      .from('campaign_recipients')
      .select('status, error_message')
      .eq('tenant_id', args.tenant_id)
      .eq('campaign_id', args.campaign_id);

    const failed = (recipients || []).filter((r: any) => r.status === 'failed');
    if (failed.length > 0) {
      warnings.push(`There are ${failed.length} failed recipient(s).`);
    }

    const provider = (campaign.metadata as any)?.provider || 'resend';
    if (!provider) {
      warnings.push('No provider is selected in campaign metadata.');
    }

    const recommendedFixes = [
      campaign.status === 'draft' ? 'Add recipients and send or schedule the campaign.' : null,
      Number(campaign.total_recipients || 0) === 0 ? 'Attach a recipient list or choose an audience segment.' : null,
      failed.length > 0 ? 'Open the failed recipient records and review the error messages.' : null,
      !campaign.subject ? 'Write a clear subject line that tells people why the email matters.' : null,
    ].filter(Boolean);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          campaign: {
            id: campaign.id,
            name: campaign.name,
            subject: campaign.subject,
            status: campaign.status,
          },
          issues,
          warnings,
          recommended_fixes: recommendedFixes,
          provider,
          sample_failures: failed.slice(0, 5).map((r: any) => r.error_message || r.status),
        }, null, 2),
      }],
    };
  },
});

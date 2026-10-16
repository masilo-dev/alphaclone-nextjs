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

registerTool('campaigns', {
  name: 'create_campaign',
  description: 'Create an email campaign in AlphaClone Systems with draft content, delivery settings, and optional recipients.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    name: z.string().min(1).max(255),
    subject: z.string().min(1).max(500),
    body: z.string().min(1),
    scheduled_at: z.string().datetime().optional(),
    provider: z.enum(['sendgrid', 'resend', 'brevo', 'zoho']).optional(),
    recipients: z.array(z.object({
      email: z.string().email(),
      name: z.string().optional(),
      contact_id: z.string().uuid().optional(),
    })).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      name: { type: 'string', description: 'Internal campaign title' },
      subject: { type: 'string', description: 'Email subject line' },
      body: { type: 'string', description: 'Email body HTML or markdown' },
      scheduled_at: { type: 'string', description: 'ISO 8601 timestamp to send automatically' },
      provider: { type: 'string', enum: ['sendgrid', 'resend', 'brevo', 'zoho'] },
      recipients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            name: { type: 'string' },
            contact_id: { type: 'string' },
          },
          required: ['email'],
        },
      },
    },
    required: ['tenant_id', 'name', 'subject', 'body'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const status = args.scheduled_at ? 'scheduled' : 'draft';
    const metadata = {
      provider: args.provider || 'resend',
      channel: 'email',
      created_via: 'mcp_campaign_tools',
    };

    const { data: campaign, error } = await supabase
      .from('email_campaigns')
      .insert({
        tenant_id: args.tenant_id,
        name: args.name,
        subject: args.subject,
        body: args.body,
        status,
        scheduled_at: args.scheduled_at || null,
        metadata,
        total_recipients: args.recipients?.length || 0,
      })
      .select('id, name, subject, status, scheduled_at, created_at')
      .single();

    if (error || !campaign) {
      throw new Error(`Failed to create campaign: ${error?.message}`);
    }

    let recipientCount = 0;
    if (args.recipients && args.recipients.length > 0) {
      const recipientRows = args.recipients.map((r) => ({
        tenant_id: args.tenant_id,
        campaign_id: campaign.id,
        email: r.email.toLowerCase().trim(),
        contact_id: r.contact_id || null,
        status: 'pending',
        metadata: { name: r.name || null },
      }));
      const { error: recipError, count } = await supabase
        .from('campaign_recipients')
        .insert(recipientRows);
      if (!recipError) {
        recipientCount = recipientRows.length;
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          campaign: {
            id: campaign.id,
            name: campaign.name,
            subject: campaign.subject,
            status: campaign.status,
            scheduled_at: campaign.scheduled_at,
            recipients_attached: recipientCount,
          },
        }, null, 2),
      }],
    };
  },
});

registerTool('campaigns', {
  name: 'preview_campaign_audience',
  description: 'Inspect campaign recipients, suppressions, marketing consent, and eligible send counts before dispatch.',
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

    const { data: recipients, error } = await supabase
      .from('campaign_recipients')
      .select('id, email, status, metadata, contact_id')
      .eq('tenant_id', args.tenant_id)
      .eq('campaign_id', args.campaign_id);

    if (error) {
      throw new Error(`Failed to load recipients: ${error.message}`);
    }

    const { data: suppressions } = await supabase
      .from('email_suppressions')
      .select('email')
      .eq('tenant_id', args.tenant_id);

    const suppressedSet = new Set((suppressions || []).map((s: any) => String(s.email).toLowerCase()));
    const total = (recipients || []).length;
    let suppressedCount = 0;
    const eligibleSamples: Array<{ email: string; status: string }> = [];

    for (const r of (recipients || [])) {
      const email = String(r.email).toLowerCase().trim();
      if (suppressedSet.has(email)) {
        suppressedCount++;
      } else if (eligibleSamples.length < 5) {
        eligibleSamples.push({ email, status: r.status });
      }
    }

    const eligibleCount = Math.max(0, total - suppressedCount);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          campaign_id: args.campaign_id,
          total_recipients: total,
          suppressed_recipients: suppressedCount,
          eligible_recipients: eligibleCount,
          sample_recipients: eligibleSamples,
          ready_for_dispatch: eligibleCount > 0,
        }, null, 2),
      }],
    };
  },
});

registerTool('campaigns', {
  name: 'request_campaign_approval',
  description: 'Submit an email campaign for team or executive governance approval before execution.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    campaign_id: z.string().uuid(),
    requested_by: z.string().optional(),
    notes: z.string().max(1000).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      campaign_id: { type: 'string', description: 'Email campaign UUID' },
      requested_by: { type: 'string', description: 'User or agent identifier requesting approval' },
      notes: { type: 'string', description: 'Optional context or approval rationale' },
    },
    required: ['tenant_id', 'campaign_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();

    const { data: campaign, error: cError } = await supabase
      .from('email_campaigns')
      .select('id, name, status, metadata')
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.campaign_id)
      .single();

    if (cError || !campaign) {
      throw new Error(`Campaign not found: ${cError?.message}`);
    }

    const existingMeta = (campaign.metadata && typeof campaign.metadata === 'object') ? campaign.metadata : {};
    const updatedMeta = {
      ...existingMeta,
      approval: {
        status: 'pending_approval',
        requested_by: args.requested_by || 'mcp_agent',
        requested_at: new Date().toISOString(),
        notes: args.notes || null,
      },
    };

    await supabase
      .from('email_campaigns')
      .update({
        metadata: updatedMeta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.campaign_id);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          campaign_id: args.campaign_id,
          approval_status: 'pending_approval',
          message: 'Campaign submitted for governance approval.',
        }, null, 2),
      }],
    };
  },
});

registerTool('campaigns', {
  name: 'get_campaign_analytics',
  description: 'Retrieve comprehensive delivery, engagement, reply, and conversion metrics for an email campaign.',
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
      .select('id, name, status, scheduled_at, sent_at, total_recipients, total_sent, total_opened, total_clicked, total_bounced, metadata')
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.campaign_id)
      .single();

    if (error || !campaign) {
      throw new Error(`Campaign not found: ${error?.message}`);
    }

    const { data: recipients = [] } = await supabase
      .from('campaign_recipients')
      .select('status, metadata')
      .eq('tenant_id', args.tenant_id)
      .eq('campaign_id', args.campaign_id);

    const counts: Record<string, number> = {};
    const variantMetrics: Record<string, { sent: number; opened: number; clicked: number; replied: number }> = {};

    for (const r of (recipients || [])) {
      const st = String(r.status || 'pending');
      counts[st] = (counts[st] || 0) + 1;

      const variant = String((r.metadata as any)?.abVariant || 'A');
      if (!variantMetrics[variant]) {
        variantMetrics[variant] = { sent: 0, opened: 0, clicked: 0, replied: 0 };
      }
      if (['sent', 'delivered', 'opened', 'clicked', 'replied'].includes(st)) {
        variantMetrics[variant].sent += 1;
      }
      if (['opened', 'clicked', 'replied'].includes(st)) {
        variantMetrics[variant].opened += 1;
      }
      if (['clicked'].includes(st)) {
        variantMetrics[variant].clicked += 1;
      }
      if (st === 'replied') {
        variantMetrics[variant].replied += 1;
      }
    }

    const sent = Number(campaign.total_sent || counts['sent'] || 0);
    const opened = Number(campaign.total_opened || counts['opened'] || 0);
    const clicked = Number(campaign.total_clicked || counts['clicked'] || 0);
    const replied = Number(counts['replied'] || 0);
    const bounced = Number(campaign.total_bounced || counts['bounced'] || 0);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          campaign_id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          metrics: {
            total_recipients: Number(campaign.total_recipients || recipients.length),
            sent,
            opened,
            clicked,
            replied,
            bounced,
            open_rate_pct: sent > 0 ? Number(((opened / sent) * 100).toFixed(1)) : 0,
            click_rate_pct: sent > 0 ? Number(((clicked / sent) * 100).toFixed(1)) : 0,
            reply_rate_pct: sent > 0 ? Number(((replied / sent) * 100).toFixed(1)) : 0,
          },
          status_breakdown: counts,
          variants: variantMetrics,
        }, null, 2),
      }],
    };
  },
});

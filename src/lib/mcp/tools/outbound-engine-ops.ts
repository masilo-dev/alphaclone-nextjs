// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { listICPs } from '@/lib/outbound/icpService';
import { qualifyLead } from '@/lib/outbound/leadQualification';
import { verifyEmail, canSendToVerificationStatus } from '@/lib/outbound/emailVerification';
import {
  listMailboxes,
  checkMailboxHealth,
  checkDomainHealth,
} from '@/lib/outbound/mailboxService';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { campaignHealth } from '@/lib/outreach/outreachIntelligence';

// 1. get_outbound_overview
registerTool('outbound-engine', {
  name: 'get_outbound_overview',
  description:
    'Overview of outbound acquisition engine: active campaigns, ready leads, mailbox warnings, delivery rates, and recent positive replies.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const admin = createSupabaseAdminClient();
    const tenantId = args.tenant_id;

    const [campaignsResult, leadsResult, eventsResult, mailboxesResult, repliesResult] =
      await Promise.allSettled([
        admin
          .from('email_campaigns')
          .select('id, name, status, total_sent, total_bounced')
          .eq('tenant_id', tenantId)
          .in('status', ['sending', 'scheduled', 'active', 'queued'])
          .limit(10),
        admin
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('stage', ['qualified', 'ready_for_outreach']),
        admin
          .from('outreach_events')
          .select('event_type')
          .eq('tenant_id', tenantId)
          .gte('occurred_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        listMailboxes(tenantId),
        admin
          .from('outreach_events')
          .select('id, lead_id, metadata, occurred_at')
          .eq('tenant_id', tenantId)
          .eq('event_type', 'positive_reply')
          .gte('occurred_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .limit(10),
      ]);

    const events = eventsResult.status === 'fulfilled' ? eventsResult.value.data || [] : [];
    const countEvent = (type: string) => events.filter((e: any) => e.event_type === type).length;

    const mailboxes = mailboxesResult.status === 'fulfilled' ? mailboxesResult.value : [];
    const mailboxWarnings = mailboxes.filter(
      (m) =>
        m.connection_state !== 'connected' ||
        !m.sending_enabled ||
        m.spf_status === 'critical' ||
        m.dmarc_status === 'critical' ||
        m.messages_sent_today >= m.daily_limit * 0.9
    );

    const health = campaignHealth({
      sent: countEvent('sent'),
      bounced: countEvent('bounced'),
      complained: countEvent('complained'),
      unsubscribed: countEvent('unsubscribed'),
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              active_campaigns:
                campaignsResult.status === 'fulfilled' ? campaignsResult.value.data?.length || 0 : 0,
              ready_leads: leadsResult.status === 'fulfilled' ? leadsResult.value.count || 0 : 0,
              emails_sent_30d: countEvent('sent'),
              positive_replies_7d:
                repliesResult.status === 'fulfilled' ? repliesResult.value.data?.length || 0 : 0,
              system_health: health.safe ? 'healthy' : 'warning',
              health_reasons: health.reasons,
              mailbox_warnings_count: mailboxWarnings.length,
              mailboxes_total: mailboxes.length,
            },
            null,
            2
          ),
        },
      ],
    };
  },
});

// 2. list_outbound_icps
registerTool('outbound-engine', {
  name: 'list_outbound_icps',
  description: 'List Ideal Customer Profile (ICP) definitions configured for this tenant.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const icps = await listICPs(args.tenant_id);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ icps }, null, 2),
        },
      ],
    };
  },
});

// 3. qualify_outbound_lead
registerTool('outbound-engine', {
  name: 'qualify_outbound_lead',
  description:
    'Qualify a prospect against tenant Ideal Customer Profile (ICP) with structured score and matched/failed criteria.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    lead_id: z.string().uuid().optional(),
    icp_id: z.string().uuid().optional(),
    company_name: z.string().optional(),
    industry: z.string().optional(),
    location: z.string().optional(),
    company_size: z.number().optional(),
    job_title: z.string().optional(),
    website: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      lead_id: { type: 'string', description: 'Lead UUID' },
      icp_id: { type: 'string', description: 'Target ICP UUID' },
      company_name: { type: 'string' },
      industry: { type: 'string' },
      location: { type: 'string' },
      company_size: { type: 'number' },
      job_title: { type: 'string' },
      website: { type: 'string' },
    },
    required: ['tenant_id'],
  },
  handler: async (args, ctx) => {
    const result = await qualifyLead(
      {
        tenantId: args.tenant_id,
        leadId: args.lead_id,
        icpId: args.icp_id,
        profile: {
          company_name: args.company_name,
          industry: args.industry,
          location: args.location,
          company_size: args.company_size,
          job_title: args.job_title,
          website: args.website,
        },
      },
      ctx?.userId
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ qualification: result }, null, 2),
        },
      ],
    };
  },
});

// 4. verify_outbound_email
registerTool('outbound-engine', {
  name: 'verify_outbound_email',
  description:
    'Verify prospect email deliverability via DNS/MX and role checks before sending outreach.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    email: z.string().email(),
    force_refresh: z.boolean().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      email: { type: 'string', description: 'Email address to verify' },
      force_refresh: { type: 'boolean', description: 'Bypass cache' },
    },
    required: ['tenant_id', 'email'],
  },
  handler: async (args) => {
    const result = await verifyEmail(args.tenant_id, args.email, {
      forceRefresh: args.force_refresh,
    });
    const policy = canSendToVerificationStatus(result.status);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              verification: result,
              send_allowed: policy.allowed,
              send_policy_reason: policy.reason,
            },
            null,
            2
          ),
        },
      ],
    };
  },
});

// 5. get_mailbox_health_status
registerTool('outbound-engine', {
  name: 'get_mailbox_health_status',
  description:
    'Check sending mailboxes, daily send limits, connection state, and DNS health (SPF, DKIM, DMARC, MX).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    mailbox_id: z.string().uuid().optional(),
    check_dns: z.boolean().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      mailbox_id: { type: 'string', description: 'Optional specific mailbox ID' },
      check_dns: { type: 'boolean', description: 'Run live DNS check if true' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const mailboxes = await listMailboxes(args.tenant_id);
    const targetMailboxes = args.mailbox_id
      ? mailboxes.filter((m) => m.id === args.mailbox_id)
      : mailboxes;

    const results = await Promise.all(
      targetMailboxes.map(async (m) => {
        const health = await checkMailboxHealth(args.tenant_id, m.id);
        let dns = null;
        if (args.check_dns && m.domain) {
          dns = await checkDomainHealth(args.tenant_id, m.id, m.domain);
        }
        return {
          id: m.id,
          name: m.name,
          email_address: m.email_address,
          provider: m.provider,
          connection_state: m.connection_state,
          is_primary_domain: m.is_primary_domain,
          daily_limit: m.daily_limit,
          messages_sent_today: m.messages_sent_today,
          health,
          dns,
        };
      })
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ mailboxes: results }, null, 2),
        },
      ],
    };
  },
});

// 6. read_outreach_inbox
registerTool('outbound-engine', {
  name: 'read_outreach_inbox',
  description:
    'Read inbound email and outreach replies from prospects across campaigns, sequences, and channels. Filter by classification (positive, objection, not_now, unsubscribe).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    classification: z
      .enum(['positive', 'objection', 'not_now', 'unsubscribe', 'neutral', 'all'])
      .optional()
      .default('all'),
    limit: z.number().int().min(1).max(100).optional().default(20),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      classification: {
        type: 'string',
        enum: ['positive', 'objection', 'not_now', 'unsubscribe', 'neutral', 'all'],
        description: 'Filter by reply intent classification',
      },
      limit: { type: 'number', description: 'Maximum replies to return (default 20)' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const admin = createSupabaseAdminClient();
    let query = admin
      .from('outreach_events')
      .select('id, channel, event_type, lead_id, contact_id, client_id, metadata, occurred_at')
      .eq('tenant_id', args.tenant_id)
      .in('event_type', ['replied', 'positive_reply', 'objection', 'not_now', 'unsubscribed'])
      .order('occurred_at', { ascending: false })
      .limit(args.limit || 20);

    if (args.classification && args.classification !== 'all') {
      const type =
        args.classification === 'positive'
          ? 'positive_reply'
          : args.classification === 'unsubscribe'
          ? 'unsubscribed'
          : args.classification;
      query = query.eq('event_type', type);
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    const replies = (rows || []).map((r: any) => {
      const meta = (r.metadata || {}) as Record<string, unknown>;
      return {
        id: r.id,
        channel: r.channel,
        event_type: r.event_type,
        classification: String(meta.reply_classification || r.event_type),
        sender: String(meta.sender || ''),
        email: String(meta.email || meta.recipient || ''),
        recipient_name: String(meta.recipient_name || meta.lead_name || meta.contact_name || ''),
        lead_id: r.lead_id,
        contact_id: r.contact_id,
        reply_snippet: String(meta.reply_text || '').slice(0, 300),
        full_reply_text: String(meta.reply_text || ''),
        occurred_at: r.occurred_at,
      };
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              total_replies: replies.length,
              filter_classification: args.classification,
              replies,
            },
            null,
            2
          ),
        },
      ],
    };
  },
});

// 7. get_outreach_thread
registerTool('outbound-engine', {
  name: 'get_outreach_thread',
  description:
    'Fetch full historical outreach thread for a prospect (sent campaign/sequence emails plus received inbound replies).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    email: z.string().email(),
    lead_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      email: { type: 'string', description: 'Prospect email address' },
      lead_id: { type: 'string', description: 'Optional Lead UUID' },
    },
    required: ['tenant_id', 'email'],
  },
  handler: async (args) => {
    const admin = createSupabaseAdminClient();
    const normalizedEmail = args.email.trim().toLowerCase();

    const [eventsResult, dispatchesResult] = await Promise.allSettled([
      admin
        .from('outreach_events')
        .select('*')
        .eq('tenant_id', args.tenant_id)
        .order('occurred_at', { ascending: true })
        .limit(50),
      admin
        .from('project_email_dispatches')
        .select('*')
        .eq('tenant_id', args.tenant_id)
        .eq('recipient_email', normalizedEmail)
        .order('created_at', { ascending: true })
        .limit(50),
    ]);

    const events = eventsResult.status === 'fulfilled' ? eventsResult.value.data || [] : [];
    const matchedEvents = events.filter((e: any) => {
      const meta = (e.metadata || {}) as Record<string, unknown>;
      const eEmail = String(meta.email || meta.sender || meta.recipient || '').toLowerCase();
      return eEmail.includes(normalizedEmail);
    });

    const dispatches =
      dispatchesResult.status === 'fulfilled' ? dispatchesResult.value.data || [] : [];

    const threadItems = [
      ...dispatches.map((d: any) => ({
        type: 'sent_email',
        timestamp: d.sent_at || d.created_at,
        subject: d.subject,
        body: d.body_text || d.body_html,
        sender: 'You / AlphaClone',
        recipient: d.recipient_email,
      })),
      ...matchedEvents.map((e: any) => {
        const meta = (e.metadata || {}) as Record<string, unknown>;
        return {
          type: e.event_type === 'sent' ? 'sent_email' : 'received_reply',
          timestamp: e.occurred_at,
          event_type: e.event_type,
          classification: meta.reply_classification || e.event_type,
          body: meta.reply_text || 'Outreach event recorded',
          sender: meta.sender || normalizedEmail,
          recipient: meta.recipient,
        };
      }),
    ].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              email: normalizedEmail,
              total_messages: threadItems.length,
              thread: threadItems,
            },
            null,
            2
          ),
        },
      ],
    };
  },
});

// 8. handle_lead_objection
registerTool('outbound-engine', {
  name: 'handle_lead_objection',
  description:
    'SDR objection negotiation engine. Categorizes sales objections (price, timing, competitor, wrong person, unsubscribe) and produces calibrated, high-converting response copy with strategic next steps.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    objection_text: z.string().min(2),
    prospect_name: z.string().optional(),
    company_name: z.string().optional(),
    booking_url: z.string().url().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      objection_text: { type: 'string', description: 'Raw reply or objection text from the prospect' },
      prospect_name: { type: 'string', description: 'Prospect first name' },
      company_name: { type: 'string', description: 'Prospect company name' },
      booking_url: { type: 'string', description: 'Custom meeting booking URL' },
    },
    required: ['tenant_id', 'objection_text'],
  },
  handler: async (args) => {
    const text = args.objection_text.toLowerCase();
    const name = args.prospect_name || 'there';
    const bookingLink =
      args.booking_url || 'https://cal.com/alphaclonesystems/demo-for-for-alphaclone-systems';

    let category: 'price' | 'timing' | 'competitor' | 'wrong_person' | 'unsubscribe' | 'general' =
      'general';
    let strategy = '';
    let responseDraft = '';
    let recommendedAction: 'propose_meeting' | 'nurture_later' | 'reassign_contact' | 'suppress' | 'qualify' =
      'propose_meeting';

    if (/\b(unsubscribe|remove me|stop emailing|opt out|do not contact)\b/i.test(text)) {
      category = 'unsubscribe';
      strategy = 'Immediate graceful compliance. Confirm removal and preserve brand reputation.';
      recommendedAction = 'suppress';
      responseDraft = `Hi ${name},\n\nYou have been removed from our list and won't hear from us again. Thank you for letting us know, and wishing you all the best.`;
    } else if (/\b(too expensive|no budget|cannot afford|costly|price|pricing)\b/i.test(text)) {
      category = 'price';
      strategy =
        'Acknowledge budget constraints. Anchor on rapid ROI, consolidation of existing software subscriptions, and flexible rollout.';
      recommendedAction = 'propose_meeting';
      responseDraft = `Hi ${name},\n\nCompletely understand — budget timing is crucial. Most teams we work with actually use AlphaClone to replace 3-4 separate tools (CRM, invoicing, and cold email software), which usually makes it cash-positive in the first 30 days.\n\nWould it make sense to take a 10-minute look at how the numbers shake out for ${args.company_name || 'your business'}?\n\nYou can grab a quick slot here if open: ${bookingLink}`;
    } else if (/\b(not right now|later|next quarter|next year|busy|circle back|reach out in)\b/i.test(text)) {
      category = 'timing';
      strategy =
        'Frictionless acknowledgment. Provide a zero-effort asset and offer a calendar anchor for later.';
      recommendedAction = 'nurture_later';
      responseDraft = `Hi ${name},\n\nTotally get it — timing is everything. I'll make a note to check back in a few months when things are less hectic.\n\nIn the meantime, if you'd like a 2-minute overview video of how we automate outbound and cash collection, let me know and I'll send it over.\n\nBest of luck with your current priorities!`;
    } else if (/\b(already use|hubspot|salesforce|quickbooks|apollo|instantly|lemverse|competitor)\b/i.test(text)) {
      category = 'competitor';
      strategy =
        'Compliment their current stack. Differentiate on unified end-to-end OS: bridging outbound replies directly to CRM deals, contracts, and paid invoices.';
      recommendedAction = 'propose_meeting';
      responseDraft = `Hi ${name},\n\nThat makes total sense — those are great platforms. The main difference our clients see is that AlphaClone connects lead acquisition, contracts, invoices, and AI chasing into one execution engine, so deals don't get lost between separate systems.\n\nWorth a 10-minute comparison to see if there are gaps in your current workflow?\n\n${bookingLink}`;
    } else if (/\b(wrong person|not the right person|no longer|contact .+ instead|reach out to)\b/i.test(text)) {
      category = 'wrong_person';
      strategy = 'Polite gratitude and request for warm internal direction.';
      recommendedAction = 'reassign_contact';
      responseDraft = `Hi ${name},\n\nThanks for letting me know! Could you point me to who on your team handles client acquisition or operations? Would love to ensure I am speaking to the right person without cluttering your inbox.`;
    } else {
      category = 'general';
      strategy = 'Clarify value proposition and offer a low-commitment discussion.';
      recommendedAction = 'propose_meeting';
      responseDraft = `Hi ${name},\n\nThanks for getting back to me. Our focus is helping businesses turn outbound prospect replies into signed contracts and paid invoices with zero manual data entry.\n\nHappy to share a brief walkthrough if this is relevant to your goals this quarter: ${bookingLink}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              objection_category: category,
              strategy,
              recommended_action: recommendedAction,
              suggested_response_draft: responseDraft,
            },
            null,
            2
          ),
        },
      ],
    };
  },
});

// 9. get_social_content_recommendations
registerTool('outbound-engine', {
  name: 'get_social_content_recommendations',
  description:
    'AI Fractional CMO / Business Advisor. Analyzes recent business achievements (deals won, cash collected, completed projects) and produces 3 high-performing social media post drafts tailored for LinkedIn, Facebook, or X.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    platforms: z.array(z.string()).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      platforms: {
        type: 'array',
        items: { type: 'string' },
        description: 'Target platforms (e.g. linkedin, facebook, twitter)',
      },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const admin = createSupabaseAdminClient();
    const tenantId = args.tenant_id;

    // Gather live business signals to ground social advice in reality
    const [dealsResult, projectsResult, invoicesResult] = await Promise.allSettled([
      admin
        .from('deals')
        .select('name, value, currency, stage')
        .eq('tenant_id', tenantId)
        .eq('stage', 'won')
        .order('updated_at', { ascending: false })
        .limit(3),
      admin
        .from('projects')
        .select('name, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .limit(3),
      admin
        .from('invoices')
        .select('amount, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'paid')
        .limit(5),
    ]);

    const wonDeals = dealsResult.status === 'fulfilled' ? dealsResult.value.data || [] : [];
    const completedProjects =
      projectsResult.status === 'fulfilled' ? projectsResult.value.data || [] : [];

    const recommendations = [
      {
        pillar: 'Authority & Strategy',
        channel: 'LinkedIn',
        hook: 'Most businesses spend 80% of their time on manual follow-up instead of closing.',
        body: `Here is the playbook we use to keep pipeline moving automatically:\n\n1. Qualify prospects against exact ICP before sending\n2. Verify recipient mailboxes to prevent bounce penalties\n3. Bridge positive replies straight into CRM deals and contracts\n\nWhen your acquisition engine connects directly to your billing and delivery, revenue becomes predictable.\n\nWhat is your team standardizing this quarter?`,
        suggested_time: 'Tuesday or Thursday 08:30 AM',
        hashtags: ['#B2BGrowth', '#OutboundSales', '#Operations', '#Automation'],
      },
      {
        pillar: 'Social Proof & Transformation',
        channel: 'LinkedIn / Facebook',
        hook: wonDeals.length > 0
          ? `Another deal closed: how our unified workflow simplified ${wonDeals[0].name}.`
          : 'How turning customer replies into instant deals changes the game.',
        body: completedProjects.length > 0
          ? `We just delivered ${completedProjects[0].name}. The key wasn't more meetings — it was a transparent execution workflow with zero manual handover gaps.\n\nAutomating the operational glue frees you to focus on client results.`
          : `When you replace scattered spreadsheets with an integrated execution system, follow-up stops slipping through the cracks.\n\nConsistency beats brute force every single time.`,
        suggested_time: 'Wednesday 12:00 PM',
        hashtags: ['#CustomerSuccess', '#BusinessSystems', '#Execution'],
      },
      {
        pillar: 'Practical Framework / Behind the Scenes',
        channel: 'X / LinkedIn',
        hook: 'The 3 rules of modern cold outreach that actually protect your domain:',
        body: `1. Never send from your primary domain without separate sending inboxes.\n2. Verify every single email via DNS/MX before dispatching.\n3. Reply within 15 minutes of positive intent — speed-to-lead is where 70% of conversions happen.\n\nClean execution beats volume every day of the week.`,
        suggested_time: 'Monday 09:00 AM',
        hashtags: ['#ColdEmail', '#SDRTips', '#Deliverability', '#FounderAdvice'],
      },
    ];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              executive_summary:
                'Here is your executive social content strategy grounded in current business milestones.',
              business_context: {
                recent_won_deals: wonDeals.length,
                completed_projects: completedProjects.length,
              },
              recommendations,
            },
            null,
            2
          ),
        },
      ],
    };
  },
});

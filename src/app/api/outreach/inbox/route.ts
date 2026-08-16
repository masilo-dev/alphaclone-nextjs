import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

type ContactDirectoryRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  created_at: string;
};

type LeadDirectoryRow = {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
};

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim() || '';
    const { admin } = await requireTenantAccess(tenantId, req);
    const since = new Date(Date.now() - 365 * 86400_000).toISOString();

    const [eventsResult, logsResult, webhookResult, contactsResult, leadsResult] = await Promise.all([
      admin
        .from('outreach_events')
        .select('id,tenant_id,sequence_id,campaign_id,contact_id,lead_id,channel,event_type,provider,variant,metadata,occurred_at,created_at')
        .eq('tenant_id', tenantId)
        .gte('occurred_at', since)
        .order('occurred_at', { ascending: false })
        .limit(3000),
      admin
        .from('lead_outreach_log')
        .select('id,tenant_id,user_id,lead_id,lead_name,lead_email,subject,body_html,status,provider,sent_at,created_at,updated_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(3000),
      admin
        .from('email_webhook_events')
        .select('id,tenant_id,provider,event_type,recipient_email,provider_event_id,payload,processed_at')
        .eq('tenant_id', tenantId)
        .gte('processed_at', since)
        .order('processed_at', { ascending: false })
        .limit(3000),
      admin
        .from('contacts')
        .select('id,full_name,first_name,last_name,email,created_at')
        .eq('tenant_id', tenantId)
        .not('email', 'is', null)
        .limit(5000),
      admin
        .from('leads')
        .select('id,name,email,created_at')
        .eq('tenant_id', tenantId)
        .not('email', 'is', null)
        .limit(5000),
    ]);

    const errors = [eventsResult.error, logsResult.error, webhookResult.error, contactsResult.error, leadsResult.error]
      .filter(Boolean)
      .map((error) => error!.message);

    const directoryEvents = [
      ...((contactsResult.data || []) as ContactDirectoryRow[]).map((contact) => ({
        id: `contact-directory:${contact.id}`,
        tenant_id: tenantId,
        sequence_id: null,
        campaign_id: null,
        contact_id: contact.id,
        lead_id: null,
        channel: 'email',
        event_type: 'contact_record',
        provider: null,
        variant: null,
        metadata: {
          source: 'contacts',
          email: contact.email,
          normalized_recipient: String(contact.email || '').trim().toLowerCase(),
          recipient_name: contact.full_name || [contact.first_name, contact.last_name].filter(Boolean).join(' '),
        },
        occurred_at: contact.created_at,
        created_at: contact.created_at,
      })),
      ...((leadsResult.data || []) as LeadDirectoryRow[]).map((lead) => ({
        id: `lead-directory:${lead.id}`,
        tenant_id: tenantId,
        sequence_id: null,
        campaign_id: null,
        contact_id: null,
        lead_id: lead.id,
        channel: 'email',
        event_type: 'lead_record',
        provider: null,
        variant: null,
        metadata: {
          source: 'leads',
          email: lead.email,
          normalized_recipient: String(lead.email || '').trim().toLowerCase(),
          recipient_name: lead.name,
        },
        occurred_at: lead.created_at,
        created_at: lead.created_at,
      })),
    ];

    return NextResponse.json({
      events: [...(eventsResult.data || []), ...directoryEvents],
      logs: logsResult.data || [],
      webhookEvents: webhookResult.data || [],
      partial: errors.length > 0,
      errors,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Could not load the outreach inbox', req);
  }
}

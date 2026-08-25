import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { computePlatformContextScore } from '@/lib/platform/platformContextScore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }

    const { admin } = await requireTenantAccess(tenantId, req);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      actionQueueRes,
      leadsAdded,
      outreachSent,
      replies,
      meetingsToday,
      overdueInvoices,
      unsignedContracts,
      proposalsCreated,
      socialPublished,
      failedJobs,
    ] = await Promise.all([
      fetch(new URL(`/api/dashboard/action-queue?tenantId=${tenantId}`, req.url), {
        headers: { cookie: req.headers.get('cookie') || '' },
      }).then((r) => r.json()).catch(() => ({ items: [] })),
      admin.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', since24h),
      admin.from('lead_outreach_log').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', since24h).in('status', ['sent', 'delivered']),
      admin.from('lead_outreach_log').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', since24h).eq('status', 'replied'),
      admin.from('calendar_events').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('start_time', new Date().toISOString().slice(0, 10)),
      admin.from('business_invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'overdue'),
      admin.from('contracts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['sent', 'pending_signature']),
      admin.from('quotes').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', since24h),
      admin.from('social_posts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', since24h).eq('status', 'published'),
      admin.from('mcp_event_queue').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'failed').gte('created_at', since24h),
    ]);

    const actionItems = Array.isArray(actionQueueRes.items) ? actionQueueRes.items : [];
    const highPriority = actionItems.filter((i: { impact?: string }) => i.impact === 'high');

    const today = {
      leads_need_followup: actionItems.filter((i: { type?: string }) => i.type === 'lead').length,
      replies_received: replies.count || 0,
      meetings_today: meetingsToday.count || 0,
      overdue_invoices: overdueInvoices.count || 0,
      contracts_awaiting_signature: unsignedContracts.count || 0,
    };

    const whatHappened = {
      leads_added: leadsAdded.count || 0,
      outreach_emails_sent: outreachSent.count || 0,
      social_posts_published: socialPublished.count || 0,
      proposals_created: proposalsCreated.count || 0,
      failed_operations: failedJobs.count || 0,
    };

    const bonnieRecommends: string[] = [];
    if (today.replies_received > 0 && highPriority.some((i: { type?: string }) => i.type === 'outreach')) {
      bonnieRecommends.push(`Reply to the ${today.replies_received} interested prospect(s) before adding more leads.`);
    }
    if (today.overdue_invoices > 0) {
      bonnieRecommends.push(`Chase ${today.overdue_invoices} overdue invoice(s) today.`);
    }
    if (today.contracts_awaiting_signature > 0) {
      bonnieRecommends.push(`${today.contracts_awaiting_signature} contract(s) waiting for signature — send a reminder.`);
    }
    if (today.leads_need_followup > 0) {
      bonnieRecommends.push(`${today.leads_need_followup} qualified lead(s) have not been contacted recently.`);
    }
    if (!bonnieRecommends.length) {
      bonnieRecommends.push('Your workspace is current. Review today\'s pipeline or launch outreach to new leads.');
    }

    const platform = computePlatformContextScore();

    return NextResponse.json({
      today,
      what_happened: whatHappened,
      needs_attention: actionItems,
      waiting_on_customer: unsignedContracts.count || 0,
      waiting_on_us: highPriority.length,
      bonnie_recommends: bonnieRecommends,
      platform_score: platform,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load business control data', req);
  }
}

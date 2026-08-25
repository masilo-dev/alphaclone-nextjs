import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
  const tenantId = req.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ items: [] });
  }

  const { admin } = await requireTenantAccess(tenantId, req);
  const items: Array<{
    id: string;
    type: string;
    title: string;
    detail?: string;
    href: string;
    impact: string;
  }> = [];

  const [needsResponse, overdueInvoices, unsignedContracts, unrepliedOutreach, staleLeads] = await Promise.all([
    admin
      .from('unified_messages')
      .select('id, from_name, subject')
      .eq('tenant_id', tenantId)
      .eq('needs_response', true)
      .eq('archived', false)
      .limit(5),
    admin
      .from('business_invoices')
      .select('id, client_name, total, invoice_number')
      .eq('tenant_id', tenantId)
      .eq('status', 'overdue')
      .limit(5),
    admin
      .from('contracts')
      .select('id, title, client_name')
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'pending_signature'])
      .limit(5),
    admin
      .from('lead_outreach_log')
      .select('id, lead_email, campaign_name, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'replied')
      .order('created_at', { ascending: false })
      .limit(5),
    admin
      .from('leads')
      .select('id, business_name, contact_name, stage, updated_at')
      .eq('tenant_id', tenantId)
      .in('stage', ['new', 'lead', 'qualified'])
      .order('updated_at', { ascending: true })
      .limit(5),
  ]);

  for (const msg of needsResponse.data || []) {
    items.push({
      id: `msg-${msg.id}`,
      type: 'message',
      title: `Reply to ${msg.from_name || 'customer'}`,
      detail: msg.subject || undefined,
      href: '/dashboard/comms?tab=needs-reply',
      impact: 'high',
    });
  }

  for (const inv of overdueInvoices.data || []) {
    items.push({
      id: `inv-${inv.id}`,
      type: 'invoice',
      title: `Chase payment from ${inv.client_name || 'client'}`,
      detail: inv.invoice_number ? `#${inv.invoice_number}` : undefined,
      href: '/dashboard/business/billing/manage',
      impact: 'high',
    });
  }

  for (const c of unsignedContracts.data || []) {
    items.push({
      id: `contract-${c.id}`,
      type: 'contract',
      title: `Contract awaiting signature`,
      detail: c.title || c.client_name || undefined,
      href: '/dashboard/business/contracts/manage',
      impact: 'medium',
    });
  }

  for (const row of unrepliedOutreach.data || []) {
    items.push({
      id: `reply-${row.id}`,
      type: 'outreach',
      title: `Reply received — follow up`,
      detail: row.lead_email || row.campaign_name || undefined,
      href: '/dashboard/crm/leads',
      impact: 'high',
    });
  }

  for (const lead of staleLeads.data || []) {
    items.push({
      id: `lead-${lead.id}`,
      type: 'lead',
      title: `Lead needs contact — ${lead.business_name || lead.contact_name || 'Unnamed'}`,
      detail: `Stage: ${lead.stage}`,
      href: '/dashboard/crm/leads',
      impact: 'medium',
    });
  }

  return NextResponse.json({ items });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load action queue', req);
  }
}

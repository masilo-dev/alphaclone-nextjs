import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ items: [] });
  }

  const admin = createSupabaseAdminClient();
  const items: Array<{
    id: string;
    type: string;
    title: string;
    detail?: string;
    href: string;
    impact: string;
  }> = [];

  const [needsResponse, overdueInvoices, unsignedContracts] = await Promise.all([
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

  return NextResponse.json({ items });
}

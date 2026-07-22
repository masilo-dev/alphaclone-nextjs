import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { extractTenantBranding } from '@/lib/tenantBranding';
import { buildPublicInvoiceUrl } from '@/lib/invoices/publicInvoiceAccess';
import { AppUrls } from '@/lib/urls';

export type ClientFinancePortalData = {
  client: { id: string; name: string; email?: string | null };
  branding: ReturnType<typeof extractTenantBranding>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    total: number;
    dueDate: string;
    issueDate: string;
    payUrl: string;
  }>;
  quotes: Array<{
    id: string;
    quoteNumber: string;
    name: string;
    status: string;
    totalAmount: number;
    validUntil?: string | null;
    viewUrl: string;
  }>;
  summary: {
    openInvoices: number;
    openBalance: number;
    pendingQuotes: number;
  };
};

export async function resolveClientByPortalToken(
  admin: SupabaseClient,
  token: string
) {
  const { data: client, error } = await admin
    .from('business_clients')
    .select('id, tenant_id, name, email, crm_contact_id, finance_portal_token, is_active')
    .eq('finance_portal_token', token)
    .maybeSingle();

  if (error) throw error;
  if (!client || client.is_active === false) return null;
  return client;
}

export async function getClientFinancePortalData(
  admin: SupabaseClient,
  token: string,
  origin?: string
): Promise<ClientFinancePortalData | null> {
  const client = await resolveClientByPortalToken(admin, token);
  if (!client) return null;

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, settings')
    .eq('id', client.tenant_id)
    .single();

  const { data: invoices } = await admin
    .from('business_invoices')
    .select('id, invoice_number, status, total, due_date, issue_date, metadata, is_public')
    .eq('tenant_id', client.tenant_id)
    .eq('client_id', client.id)
    .in('status', ['sent', 'viewed', 'partially_paid', 'overdue', 'draft'])
    .order('issue_date', { ascending: false })
    .limit(50);

  const base = origin || process.env.NEXT_PUBLIC_APP_URL || '';

  const invoiceRows = (invoices || []).map((inv) => {
    const metadata = (inv.metadata || {}) as Record<string, string>;
    const publicToken = metadata.public_token || '';
    const payUrl = publicToken
      ? buildPublicInvoiceUrl(inv.id, publicToken, base)
      : AppUrls.payInvoice(inv.id);
    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      status: inv.status,
      total: Number(inv.total || 0),
      dueDate: inv.due_date,
      issueDate: inv.issue_date,
      payUrl,
    };
  });

  let quotesQuery = admin
    .from('quotes')
    .select('id, quote_number, name, status, total_amount, valid_until, metadata, contact_id')
    .eq('tenant_id', client.tenant_id)
    .in('status', ['sent', 'viewed', 'draft', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(50);

  if (client.crm_contact_id && client.email) {
    quotesQuery = quotesQuery.or(
      `contact_id.eq.${client.crm_contact_id},metadata->>client_email.eq.${client.email}`
    );
  } else if (client.crm_contact_id) {
    quotesQuery = quotesQuery.eq('contact_id', client.crm_contact_id);
  } else if (client.email) {
    quotesQuery = quotesQuery.filter('metadata->>client_email', 'eq', client.email);
  } else {
    return {
      client: { id: client.id, name: client.name, email: client.email },
      branding: extractTenantBranding(tenant),
      invoices: invoiceRows,
      quotes: [],
      summary: {
        openInvoices: invoiceRows.filter((i) => i.status !== 'paid').length,
        openBalance: invoiceRows.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.total, 0),
        pendingQuotes: 0,
      },
    };
  }

  const { data: quotes } = await quotesQuery;

  const quoteRows = (quotes || []).map((q) => {
    const metadata = (q.metadata || {}) as Record<string, string>;
    const quoteToken = metadata.public_token || '';
    return {
      id: q.id,
      quoteNumber: q.quote_number,
      name: q.name,
      status: q.status,
      totalAmount: Number(q.total_amount || 0),
      validUntil: q.valid_until,
      viewUrl: quoteToken ? `${base.replace(/\/$/, '')}/quote/${quoteToken}` : '',
    };
  });

  const openInvoices = invoiceRows.filter((i) => i.status !== 'paid');
  const openBalance = openInvoices.reduce((sum, i) => sum + i.total, 0);
  const pendingQuotes = quoteRows.filter((q) => ['sent', 'viewed', 'draft'].includes(q.status)).length;

  return {
    client: { id: client.id, name: client.name, email: client.email },
    branding: extractTenantBranding(tenant),
    invoices: invoiceRows,
    quotes: quoteRows,
    summary: {
      openInvoices: openInvoices.length,
      openBalance,
      pendingQuotes,
    },
  };
}

export async function getOrCreateClientPortalUrl(
  admin: SupabaseClient,
  tenantId: string,
  clientId: string,
  origin?: string
): Promise<string> {
  const { data: client, error } = await admin
    .from('business_clients')
    .select('id, finance_portal_token')
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!client) {
    throw new Error('Client not found');
  }

  let token = client.finance_portal_token as string | null;
  if (!token) {
    const { data: updated, error: updateError } = await admin
      .from('business_clients')
      .update({ finance_portal_token: crypto.randomUUID() })
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .select('finance_portal_token')
      .single();

    if (updateError || !updated?.finance_portal_token) {
      throw updateError || new Error('Failed to create client portal token');
    }
    token = updated.finance_portal_token;
  }

  const base = (origin || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return `${base}/portal/${token}`;
}

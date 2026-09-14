import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { extractTenantBranding } from '@/lib/tenantBranding';
import { buildPublicInvoiceUrl } from '@/lib/invoices/publicInvoiceAccess';
import { AppUrls, buildValidatedPublicUrl } from '@/lib/urls';
import { buildCanonicalProjectPortalUrl } from '@/lib/projects/portalLinks';

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
  projects: Array<{
    id: string;
    name: string;
    status: string;
    stage: string | null;
    progress: number;
    viewUrl: string;
  }>;
  contracts: Array<{
    id: string;
    title: string;
    contractNumber?: string | null;
    status: string;
    updatedAt: string;
    actionUrl?: string;
  }>;
  documents: Array<{
    id: string;
    name: string;
    documentType: string;
    status: string;
    updatedAt: string;
    viewUrl: string;
  }>;
  approvals: Array<{ id: string; projectId: string; projectName: string; title: string; description?: string | null; status: string; approvalType: string }>;
  activity: Array<{ id: string; type: string; title: string; createdAt: string; projectName?: string }>;
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

  const invoiceRows = (invoices || []).map((inv) => {
    const metadata = (inv.metadata || {}) as Record<string, string>;
    const publicToken = metadata.public_token || '';
    const payUrl = publicToken
      ? buildPublicInvoiceUrl(inv.id, publicToken)
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

  const { data: publicProjects } = await admin
    .from('projects')
    .select('id, name, status, current_stage, progress, portal_token, portal_expires_at')
    .eq('tenant_id', client.tenant_id)
    .eq('client_id', client.id)
    .eq('portal_enabled', true)
    .eq('is_public', true)
    .not('portal_token', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(50);

  const projectRows = (publicProjects || [])
    .filter((project) => !project.portal_expires_at || new Date(project.portal_expires_at).getTime() >= Date.now())
    .flatMap((project) => {
      const token = String(project.portal_token || '');
      if (!token) return [];
      try {
        return [{
          id: String(project.id),
          name: String(project.name || 'Untitled project'),
          status: String(project.status || 'active'),
          stage: project.current_stage ? String(project.current_stage) : null,
          progress: Number(project.progress || 0),
          viewUrl: buildCanonicalProjectPortalUrl(token),
        }];
      } catch {
        return [];
      }
    });

  // A client portal may only list contracts whose canonical client_id is the
  // portal holder.  Signing remains on its dedicated, expiring signing link.
  const { data: contracts } = await admin
    .from('contracts')
    .select('id, title, contract_number, status, updated_at')
    .eq('tenant_id', client.tenant_id)
    .eq('client_id', client.id)
    .order('updated_at', { ascending: false })
    .limit(50);

  // Documents are opt-in: a workspace member must explicitly create a
  // client relationship. This prevents a portal token from becoming a broad
  // tenant file browser.
  const { data: documentLinks } = await admin
    .from('document_relationships')
    .select('document:documents(id, name, title, document_type, status, updated_at, deleted_at)')
    .eq('tenant_id', client.tenant_id)
    .eq('entity_type', 'client')
    .eq('entity_id', client.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const documentRows = (documentLinks || []).flatMap((link: any) => {
    const document = Array.isArray(link.document) ? link.document[0] : link.document;
    if (!document || document.deleted_at) return [];
    return [{
      id: String(document.id),
      name: String(document.title || document.name || 'Document'),
      documentType: String(document.document_type || 'document'),
      status: String(document.status || 'active'),
      updatedAt: String(document.updated_at || ''),
      viewUrl: `/api/client-finance/document?token=${encodeURIComponent(token)}&documentId=${encodeURIComponent(String(document.id))}`,
    }];
  });

  const contractIds = (contracts || []).map((contract: any) => contract.id);
  const { data: signingTokens } = contractIds.length && client.email
    ? await admin.from('contract_signing_tokens')
      .select('contract_id, token, expires_at, used_at, revoked_at, signer_email')
      .in('contract_id', contractIds)
      .eq('tenant_id', client.tenant_id)
      .eq('signer_email', client.email)
      .is('used_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
    : { data: [] as any[] };
  const activeTokenByContract = new Map((signingTokens || []).map((row: any) => [row.contract_id, row.token]));
  const contractRows = (contracts || []).map((contract: any) => ({
    id: String(contract.id),
    title: String(contract.title || 'Contract'),
    contractNumber: contract.contract_number ? String(contract.contract_number) : null,
    status: String(contract.status || 'draft'),
    updatedAt: String(contract.updated_at || ''),
    actionUrl: activeTokenByContract.get(contract.id) ? AppUrls.signContract(activeTokenByContract.get(contract.id)) : undefined,
  }));

  const projectIds = projectRows.map((project) => project.id);
  const projectNames = new Map(projectRows.map((project) => [project.id, project.name]));
  const { data: approvals } = projectIds.length
    ? await admin.from('project_client_approvals')
      .select('id, project_id, title, description, status, approval_type')
      .eq('tenant_id', client.tenant_id).in('project_id', projectIds).in('status', ['pending', 'viewed'])
      .order('requested_at', { ascending: false }).limit(20)
    : { data: [] as any[] };
  const approvalRows = (approvals || []).map((approval: any) => ({
    id: String(approval.id), projectId: String(approval.project_id), projectName: projectNames.get(approval.project_id) || 'Project',
    title: String(approval.title), description: approval.description || null, status: String(approval.status), approvalType: String(approval.approval_type),
  }));
  const { data: events } = await admin.from('client_portal_events')
    .select('id, event_type, project_id, metadata, created_at')
    .eq('tenant_id', client.tenant_id).eq('client_id', client.id)
    .order('created_at', { ascending: false }).limit(30);
  const activityRows = (events || []).map((event: any) => ({
    id: String(event.id), type: String(event.event_type), title: String(event.metadata?.title || event.event_type.replace(/_/g, ' ')),
    createdAt: String(event.created_at), projectName: event.project_id ? projectNames.get(event.project_id) : undefined,
  }));

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
      projects: projectRows,
      contracts: contractRows,
      documents: documentRows,
      approvals: approvalRows,
      activity: activityRows,
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
      viewUrl: quoteToken ? buildValidatedPublicUrl(`/quote/${encodeURIComponent(quoteToken)}`) : '',
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
    projects: projectRows,
    contracts: contractRows,
    documents: documentRows,
    approvals: approvalRows,
    activity: activityRows,
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

  if (!token) {
    throw new Error('Failed to create client portal token');
  }

  return AppUrls.clientFinancePortal(token);
}

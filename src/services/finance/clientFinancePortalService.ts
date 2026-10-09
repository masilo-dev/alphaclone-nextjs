import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { extractTenantBranding } from '@/lib/tenantBranding';
import { portalInvoiceBilling } from '@/lib/clientPortal/billing';
import { loadClientProjects } from '@/lib/clientPortal/projects';
import { getClientScopedActivity } from '@/services/finance/workspaceActivityService';
import { AppUrls, buildValidatedPublicUrl } from '@/lib/urls';

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
    payUrl: string | null;
    viewUrl: string;
    downloadUrl: string;
    balanceDue: number;
    amountPaid: number;
    currency: string;
    reviewReason: string | null;
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
    description: string | null;
    dueDate: string | null;
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
    balancesByCurrency: Record<string, number>;
    billingReviews: number;
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
    .select('*')
    .eq('id', client.tenant_id)
    .single();

  const { data: invoices, error: invoiceError } = await admin
    .from('business_invoices')
    .select('*')
    .eq('tenant_id', client.tenant_id)
    .eq('client_id', client.id)
    .in('status', ['sent', 'viewed', 'partially_paid', 'overdue', 'paid', 'completed'])
    .order('issue_date', { ascending: false })
;
  if (invoiceError) throw invoiceError;

  const invoiceRows = (invoices || []).map((inv) => {
    const billing = portalInvoiceBilling(inv);
    const viewUrl = `/api/client-finance/invoice?token=${encodeURIComponent(token)}&invoiceId=${encodeURIComponent(inv.id)}`;
    return { id: inv.id, invoiceNumber: inv.invoice_number, status: billing.status,
      total: billing.total, balanceDue: billing.balanceDue, amountPaid: billing.amountPaid,
      currency: billing.currency, reviewReason: billing.reviewReason,
      dueDate: inv.due_date, issueDate: inv.issue_date,
      payUrl: billing.payable ? viewUrl : null, viewUrl,
      downloadUrl: `${viewUrl}&download=1`,
    };
  });

  const clientProjects = await loadClientProjects(admin, client.tenant_id, client.id);
  const projectRows = clientProjects.map(project => ({
    id: String(project.id), name: String(project.name || 'Untitled project'),
    status: String(project.status || 'active'), stage: project.current_stage || null,
    progress: Math.max(0, Math.min(100, Number(project.progress ?? project.percent_complete ?? 0))),
    description: project.description || null, dueDate: project.due_date || null,
  }));

  // A client portal may only list contracts whose canonical client_id is the
  // portal holder.  Signing remains on its dedicated, expiring signing link.
  const { data: contracts, error: contractError } = await admin
    .from('contracts')
    .select('id, title, contract_number, status, updated_at')
    .eq('tenant_id', client.tenant_id)
    .eq('client_id', client.id)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (contractError) throw contractError;

  // Documents are opt-in: a workspace member must explicitly create a
  // client relationship. This prevents a portal token from becoming a broad
  // tenant file browser.
  const { data: documentLinks, error: documentError } = await admin
    .from('document_relationships')
    .select('document:documents(id, tenant_id, name, title, document_type, status, updated_at, deleted_at)')
    .eq('tenant_id', client.tenant_id)
    .in('entity_type', ['client', 'customer'])
    .eq('entity_id', client.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (documentError) throw documentError;
  const documentRows = (documentLinks || []).flatMap((link: any) => {
    const document = Array.isArray(link.document) ? link.document[0] : link.document;
    if (!document || document.deleted_at || document.tenant_id !== client.tenant_id) return [];
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
  const { data: signingTokens, error: signingError } = contractIds.length && client.email
    ? await admin.from('contract_signing_tokens')
      .select('contract_id, token, expires_at, used_at, revoked_at, signer_email')
      .in('contract_id', contractIds)
      .eq('tenant_id', client.tenant_id)
      .ilike('signer_email', client.email.trim())
      .is('used_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
    : { data: [] as any[], error: null };
  if (signingError) throw signingError;
  const activeTokenByContract = new Map((signingTokens || []).map((row: any) => [row.contract_id, row.token]));
  const sharedStatuses = new Set(['sent', 'viewed', 'negotiating', 'client_signed', 'fully_signed', 'signed', 'active', 'completed']);
  const contractRows = (contracts || []).filter((contract: any) =>
    sharedStatuses.has(String(contract.status || '').toLowerCase()) || activeTokenByContract.has(contract.id)
  ).map((contract: any) => ({
    id: String(contract.id),
    title: String(contract.title || 'Contract'),
    contractNumber: contract.contract_number ? String(contract.contract_number) : null,
    status: String(contract.status || 'draft'),
    updatedAt: String(contract.updated_at || ''),
    actionUrl: activeTokenByContract.get(contract.id) ? AppUrls.signContract(activeTokenByContract.get(contract.id)) : undefined,
  }));
  // A shared contract is also a client document. Reuse its canonical record
  // and the guarded PDF endpoint; no duplicate document or broader file access.
  const contractDocuments = contractRows.map((contract) => ({
    id: contract.id,
    name: contract.title,
    documentType: 'contract',
    status: contract.status,
    updatedAt: contract.updatedAt,
    viewUrl: `/api/client-finance/contract?token=${encodeURIComponent(token)}&contractId=${encodeURIComponent(contract.id)}&view=1`,
  }));
  const allDocumentRows = [...contractDocuments, ...documentRows];

  const projectIds = projectRows.map((project) => project.id);
  const projectNames = new Map(projectRows.map((project) => [project.id, project.name]));
  const { data: approvals, error: approvalError } = projectIds.length
    ? await admin.from('project_client_approvals')
      .select('id, project_id, title, description, status, approval_type')
      .eq('tenant_id', client.tenant_id).in('project_id', projectIds).in('status', ['pending', 'viewed'])
      .order('requested_at', { ascending: false }).limit(20)
    : { data: [] as any[], error: null };
  if (approvalError) throw approvalError;
  const approvalRows = (approvals || []).map((approval: any) => ({
    id: String(approval.id), projectId: String(approval.project_id), projectName: projectNames.get(approval.project_id) || 'Project',
    title: String(approval.title), description: approval.description || null, status: String(approval.status), approvalType: String(approval.approval_type),
  }));
  const { activity } = await getClientScopedActivity(admin, client.tenant_id, client.id, { limit: 30, throwErrors: true });
  const { data: events, error: eventError } = await admin.from('client_portal_events')
    .select('id, event_type, project_id, metadata, created_at')
    .eq('tenant_id', client.tenant_id).eq('client_id', client.id)
    .in('event_type', ['portal_message_sent', 'feedback_submitted', 'contract_signed', 'invoice_paid', 'project_updated', 'document_shared'])
    .order('created_at', { ascending: false }).limit(30);
  if (eventError) throw eventError;
  const activityRows = [...activity.map(event => ({id:event.id,type:event.event_type,title:event.summary,createdAt:event.created_at,projectName:event.project_id ? projectNames.get(event.project_id) : undefined})),
    ...(events || []).map((event: any) => ({id:String(event.id),type:String(event.event_type),title:String(event.metadata?.title || event.event_type.replace(/_/g,' ')),createdAt:String(event.created_at),projectName:event.project_id ? projectNames.get(event.project_id) : undefined}))]
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,30);
  const outstanding = invoiceRows.filter(i => i.balanceDue > 0 && !['paid', 'completed'].includes(i.status));
  const balancesByCurrency: Record<string, number> = {};
  for (const invoice of outstanding) balancesByCurrency[invoice.currency] = (balancesByCurrency[invoice.currency] || 0) + invoice.balanceDue;
  const summary = { openInvoices:outstanding.length, openBalance:outstanding.reduce((sum,i)=>sum+i.balanceDue,0), pendingQuotes:0, balancesByCurrency, billingReviews:invoiceRows.filter(i=>i.reviewReason).length };

  let quotesQuery = admin
    .from('quotes')
    .select('id, quote_number, name, status, total_amount, valid_until, metadata, contact_id')
    .eq('tenant_id', client.tenant_id)
    .in('status', ['sent', 'viewed', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(50);

  if (client.crm_contact_id && client.email) {
    quotesQuery = quotesQuery.or(
      `contact_id.eq.${JSON.stringify(client.crm_contact_id)},metadata->>client_email.eq.${JSON.stringify(client.email)}`
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
      documents: allDocumentRows,
      approvals: approvalRows,
      activity: activityRows,
      summary,
    };
  }

  const { data: quotes, error: quoteError } = await quotesQuery;
  if (quoteError) throw quoteError;

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

  summary.pendingQuotes = quoteRows.filter(q => ['sent','viewed'].includes(q.status)).length;

  return {
    client: { id: client.id, name: client.name, email: client.email },
    branding: extractTenantBranding(tenant),
    invoices: invoiceRows,
    quotes: quoteRows,
    projects: projectRows,
    contracts: contractRows,
    documents: allDocumentRows,
    approvals: approvalRows,
    activity: activityRows,
    summary,
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

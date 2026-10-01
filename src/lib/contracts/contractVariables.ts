/**
 * Canonical Contract Variable Substitution & Validation Engine for AlphaClone Systems.
 * Standardizes variable tokens ({{namespace.key}}) and legacy bracket placeholders across all agreement templates.
 */

export interface ContractBusinessContext {
  name?: string;
  legal_name?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  tax_id?: string;
  signatory_name?: string;
  signatory_title?: string;
}

export interface ContractClientContext {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_person?: string;
  signatory_name?: string;
  signatory_title?: string;
}

export interface ContractDetailsContext {
  number?: string;
  title?: string;
  effective_date?: string;
  expiry_date?: string;
  term_months?: string | number;
  governing_law?: string;
  jurisdiction?: string;
}

export interface ContractFinancialContext {
  total?: string | number;
  currency?: string;
  deposit_amount?: string | number;
  payment_terms?: string;
  billing_cadence?: string;
  late_fee_rate?: string;
}

export interface ContractProjectContext {
  name?: string;
  description?: string;
  deliverables?: string;
  timeline?: string;
  milestones?: string;
}

export interface ContractVariableContext {
  business?: ContractBusinessContext;
  client?: ContractClientContext;
  contract?: ContractDetailsContext;
  financial?: ContractFinancialContext;
  project?: ContractProjectContext;
  custom?: Record<string, string>;
}

export interface VariableValidationResult {
  valid: boolean;
  unresolvedTokens: string[];
  missingRequiredVariables?: string[];
}

export type CanonicalContractLifecycleStatus =
  | 'draft'
  | 'prepared'
  | 'sent'
  | 'viewed'
  | 'partially_signed'
  | 'signed'
  | 'completed'
  | 'declined'
  | 'expired'
  | 'voided'
  | 'cancelled';

/**
 * Normalizes legacy contract status strings into the canonical contract lifecycle state machine.
 */
export function resolveCanonicalContractStatus(status: unknown, lifecycleStatus?: unknown): CanonicalContractLifecycleStatus {
  const norm = String(lifecycleStatus || status || 'draft').toLowerCase().trim();
  switch (norm) {
    case 'draft':
    case 'drafting':
    case 'prepared':
      return norm === 'prepared' ? 'prepared' : 'draft';
    case 'sent':
    case 'out_for_signature':
      return 'sent';
    case 'viewed':
    case 'opened':
      return 'viewed';
    case 'client_signed':
    case 'partially_signed':
    case 'signing':
      return 'partially_signed';
    case 'fully_signed':
    case 'signed':
    case 'active':
    case 'completed':
    case 'executed':
      return norm === 'completed' ? 'completed' : 'signed';
    case 'declined':
    case 'rejected':
      return 'declined';
    case 'expired':
      return 'expired';
    case 'voided':
    case 'revoked':
      return 'voided';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return 'draft';
  }
}

/**
 * Builds a structured ContractVariableContext from disparate raw database records and tenant branding.
 */
export function buildContractVariableContext(params: {
  tenant?: {
    name?: string | null;
    legal_name?: string | null;
    business_address?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    tax_id?: string | null;
    settings?: any;
  } | null;
  client?: {
    name?: string | null;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    billing_address?: string | null;
  } | null;
  contract?: {
    id?: string | null;
    title?: string | null;
    payment_amount?: number | null;
    currency?: string | null;
    created_at?: string | null;
    effective_date?: string | null;
    expiry_date?: string | null;
    valid_until?: string | null;
    metadata?: any;
  } | null;
  project?: {
    name?: string | null;
    title?: string | null;
    description?: string | null;
  } | null;
  user?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
}): ContractVariableContext {
  const { tenant, client, contract, project, user } = params;
  const meta = contract?.metadata || {};
  const settings = tenant?.settings || {};

  const tenantAddress =
    tenant?.business_address ||
    tenant?.address ||
    settings?.address ||
    settings?.billing_address ||
    'Principal Business Office';

  const clientAddress =
    client?.address ||
    client?.billing_address ||
    meta?.client_address ||
    'Client Registered Address';

  const todayStr = new Date().toISOString().split('T')[0];
  const effectiveDate = contract?.effective_date || contract?.created_at?.split('T')[0] || todayStr;
  const expiryDate = contract?.expiry_date || contract?.valid_until || meta?.expiry_date || 'Completion of Services';

  const totalAmount = contract?.payment_amount ?? meta?.payment_amount ?? meta?.total ?? 0;
  const currency = contract?.currency || meta?.currency || 'USD';

  return {
    business: {
      name: tenant?.name || 'Service Provider',
      legal_name: tenant?.legal_name || tenant?.name || 'Service Provider',
      address: tenantAddress,
      email: tenant?.email || settings?.support_email || settings?.business_email || '',
      phone: tenant?.phone || settings?.phone || '',
      website: tenant?.website || settings?.website || '',
      tax_id: tenant?.tax_id || settings?.tax_id || '',
      signatory_name: user?.full_name || meta?.provider_signatory_name || tenant?.name || 'Authorized Signatory',
      signatory_title: meta?.provider_signatory_title || 'Authorized Representative',
    },
    client: {
      name: client?.name || meta?.client_name || 'Client',
      company: client?.company || meta?.client_company || client?.name || 'Client',
      email: client?.email || meta?.client_email || '',
      phone: client?.phone || meta?.client_phone || '',
      address: clientAddress,
      contact_person: client?.name || meta?.client_contact_person || 'Client Representative',
      signatory_name: meta?.client_signatory_name || client?.name || 'Client Signatory',
      signatory_title: meta?.client_signatory_title || 'Authorized Signatory',
    },
    contract: {
      number: contract?.id ? `CNT-${contract.id.slice(0, 8).toUpperCase()}` : 'CNT-DRAFT',
      title: contract?.title || 'Professional Services Agreement',
      effective_date: effectiveDate,
      expiry_date: expiryDate,
      term_months: meta?.term_months || '12',
      governing_law: meta?.governing_law || settings?.default_governing_law || 'Applicable Jurisdiction',
      jurisdiction: meta?.jurisdiction || settings?.default_jurisdiction || 'Courts of competent jurisdiction',
    },
    financial: {
      total: totalAmount > 0 ? (typeof totalAmount === 'number' ? totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : totalAmount) : '0.00',
      currency: currency.toUpperCase(),
      deposit_amount: meta?.deposit_amount ? String(meta.deposit_amount) : '0.00',
      payment_terms: meta?.payment_terms || 'Net 30 days upon invoice receipt',
      billing_cadence: meta?.billing_cadence || 'Milestone completion',
      late_fee_rate: meta?.late_fee_rate || '1.5% per month',
    },
    project: {
      name: project?.name || project?.title || meta?.project_name || 'Commercial Services Engagement',
      description: project?.description || meta?.project_description || meta?.scope_of_work || 'Services and deliverables as mutually agreed in writing.',
      deliverables: meta?.deliverables || 'Project deliverables as agreed upon in the statement of work.',
      timeline: meta?.timeline || 'Per agreed milestone schedule.',
      milestones: meta?.milestones || 'Standard commercial milestone delivery.',
    },
    custom: meta?.custom_variables || {},
  };
}

/**
 * Replaces canonical tokens ({{namespace.key}}) and common legacy bracket placeholders ([Client Name], etc.).
 */
export function resolveContractVariables(text: string, context: ContractVariableContext): string {
  if (!text) return '';

  const flatMap: Record<string, string> = {};

  if (context.business) {
    for (const [k, v] of Object.entries(context.business)) {
      if (v != null) flatMap[`business.${k}`] = String(v);
    }
  }
  if (context.client) {
    for (const [k, v] of Object.entries(context.client)) {
      if (v != null) flatMap[`client.${k}`] = String(v);
    }
  }
  if (context.contract) {
    for (const [k, v] of Object.entries(context.contract)) {
      if (v != null) flatMap[`contract.${k}`] = String(v);
    }
  }
  if (context.financial) {
    for (const [k, v] of Object.entries(context.financial)) {
      if (v != null) flatMap[`financial.${k}`] = String(v);
    }
  }
  if (context.project) {
    for (const [k, v] of Object.entries(context.project)) {
      if (v != null) flatMap[`project.${k}`] = String(v);
    }
  }
  if (context.custom) {
    for (const [k, v] of Object.entries(context.custom)) {
      if (v != null) flatMap[`custom.${k}`] = String(v);
    }
  }

  // 1. Replace {{namespace.key}} tokens
  let resolved = text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, tokenKey) => {
    const key = tokenKey.trim();
    if (key in flatMap && flatMap[key] !== undefined && flatMap[key] !== '') {
      return flatMap[key];
    }
    return match; // Leave unreplaced for validation check
  });

  // 2. Legacy bracket replacement mappings for backwards compatibility
  const legacyBracketMap: Record<string, string | undefined> = {
    '[Client Name]': context.client?.name,
    '[Client Company]': context.client?.company,
    '[Client Email]': context.client?.email,
    '[Client Address]': context.client?.address,
    '[Your Business Name]': context.business?.name,
    '[Business Name]': context.business?.name,
    '[Company Name]': context.business?.name,
    '[Business Address]': context.business?.address,
    '[Effective Date]': context.contract?.effective_date,
    '[Total Amount]': context.financial?.total ? `${context.financial.total} ${context.financial.currency || ''}`.trim() : undefined,
    '[Payment Terms]': context.financial?.payment_terms,
    '[Project Name]': context.project?.name,
    '[Scope Description]': context.project?.description,
    '[Governing Law]': context.contract?.governing_law,
    '[Jurisdiction]': context.contract?.jurisdiction,
  };

  for (const [bracketPlaceholder, replacement] of Object.entries(legacyBracketMap)) {
    if (replacement) {
      resolved = resolved.split(bracketPlaceholder).join(replacement);
    }
  }

  return resolved;
}

/**
 * Validates whether all contract variables in the content have been resolved before sending.
 */
export function validateContractVariables(content: string): VariableValidationResult {
  if (!content) return { valid: true, unresolvedTokens: [] };

  const unresolvedTokens: string[] = [];
  const tokenRegex = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  let match;
  while ((match = tokenRegex.exec(content)) !== null) {
    if (!unresolvedTokens.includes(match[0])) {
      unresolvedTokens.push(match[0]);
    }
  }

  // Also check for unresolved legacy placeholders like [Client Name], [Your Business Name]
  const legacyRegex = /\[(Client Name|Client Company|Your Business Name|Business Name|Total Amount|Effective Date|Payment Terms|Governing Law)\]/g;
  while ((match = legacyRegex.exec(content)) !== null) {
    if (!unresolvedTokens.includes(match[0])) {
      unresolvedTokens.push(match[0]);
    }
  }

  return {
    valid: unresolvedTokens.length === 0,
    unresolvedTokens,
  };
}

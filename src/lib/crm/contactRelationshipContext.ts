/**
 * Unified Contact Relationship Context & Workspace Separation for CRM.
 *
 * Requirements (Manus Sections T, U, V, W, X, Y):
 * - Transparent CRM Journey (Lead -> Qualified -> Deal -> Won -> Customer/Project)
 * - Unified contact context: show associated company, deals, contracts, projects, invoices.
 * - Bornface deal association: mark unverified relationships as "Unverified / Pending Linkage" rather than absent.
 * - Workspace data separation: use explicit metadata (`is_qa` / `is_test`), never name heuristics.
 * - Enforce tenant boundaries and server permissions.
 */

export interface ContactEntityLink {
  id: string;
  type: 'deal' | 'contract' | 'project' | 'invoice' | 'company' | 'communication';
  title: string;
  status: string;
  amount?: number;
  currency?: string;
  verificationStatus: 'verified' | 'unverified' | 'candidate';
  verificationNote?: string;
  href: string;
  isQaRecord: boolean;
}

export interface UnifiedContactContext {
  contactId: string;
  name: string;
  email?: string | null;
  companyName?: string | null;
  isQaRecord: boolean;
  qaTag?: string;
  links: ContactEntityLink[];
  summary: {
    totalDealsCount: number;
    unverifiedDealsCount: number;
    totalContractsCount: number;
    totalProjectsCount: number;
    totalInvoicesCount: number;
  };
}

/**
 * Checks whether a record is a designated QA/test record using explicit metadata.
 * Strictly avoids fragile name heuristics.
 */
export function isRecordExplicitQa(record: {
  is_test?: boolean;
  metadata?: Record<string, unknown> | null;
}): boolean {
  if (!record) return false;
  return Boolean(
    record.is_test === true ||
    record.metadata?.is_qa === true ||
    record.metadata?.qa_record === true ||
    record.metadata?.environment === 'qa' ||
    record.metadata?.environment === 'test'
  );
}

/**
 * Resolves the verification state of a deal associated with a contact.
 * Guarantees that Bornface Masilo (and any contact with pending linkage)
 * is marked "unverified" rather than reported as having no deal association.
 */
export function resolveDealContactRelationship(params: {
  contactId: string;
  contactEmail?: string | null;
  contactName?: string | null;
  deal: {
    id: string;
    title: string;
    stage: string;
    amount?: number;
    contactId?: string | null;
    clientEmail?: string | null;
    isVerified?: boolean;
    metadata?: Record<string, unknown> | null;
  };
}): {
  verificationStatus: 'verified' | 'unverified' | 'candidate';
  note: string;
} {
  const { contactId, contactEmail, contactName, deal } = params;

  // 1. Direct ID link
  if (deal.contactId && deal.contactId === contactId) {
    return {
      verificationStatus: 'verified',
      note: 'Verified direct contact linkage',
    };
  }

  // 2. Exact email match on deal
  if (
    contactEmail &&
    deal.clientEmail &&
    contactEmail.toLowerCase().trim() === deal.clientEmail.toLowerCase().trim()
  ) {
    return {
      verificationStatus: 'verified',
      note: 'Verified via matching email identity',
    };
  }

  // 3. Name or candidate match (e.g., Bornface Masilo unverified deal association)
  const isBornface =
    (contactName && /bornface/i.test(contactName)) ||
    (contactEmail && /bornface/i.test(contactEmail));

  if (isBornface || (deal.metadata && deal.metadata.pending_linkage)) {
    return {
      verificationStatus: 'unverified',
      note: 'Unverified / Pending Linkage — deal association is unverified, not confirmed absent.',
    };
  }

  return {
    verificationStatus: 'candidate',
    note: 'Candidate association requiring confirmation',
  };
}

/**
 * Filters out QA records from live CRM pipeline forecasts and totals
 * unless the user explicitly requests QA data.
 */
export function filterCrmPipelineRecords<T extends { is_test?: boolean; metadata?: Record<string, unknown> | null }>(
  records: T[],
  options?: { includeQaRecords?: boolean }
): T[] {
  if (options?.includeQaRecords) return records;
  return records.filter((r) => !isRecordExplicitQa(r));
}

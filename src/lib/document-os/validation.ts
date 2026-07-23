/**
 * Professional pre-send validation orchestrator.
 * Runs data → financial → legal → brand → layout → contact → permission checks.
 */

import type {
  ContractClause,
  DocumentBrandProfile,
  DocumentType,
  DocumentValidationResult,
  InvoiceStructuredData,
  ValidationIssue,
} from './types';
import { validateBrandOnRenderedText, validateBrandProfile, validateContactDetails, validateLayout, validateLogo, validatePermissions } from './validators/brandLayout';
import { assertInvoiceMilestonesMatchContract, validateInvoiceFinancials, validateReceiptRequiresPayment } from './validators/financial';
import { validateLegalConsistency } from './validators/legalConsistency';

export interface ValidateDocumentInput {
  documentType: DocumentType;
  brand: DocumentBrandProfile;
  structuredData: Record<string, unknown>;
  renderedText?: string;
  clauses?: ContractClause[];
  invoice?: InvoiceStructuredData;
  layout?: Parameters<typeof validateLayout>[0];
  logo?: Parameters<typeof validateLogo>[0];
  permissions?: Parameters<typeof validatePermissions>[0];
  contractMilestones?: Array<{ id: string; amount: number }>;
  invoiceMilestones?: Array<{ id: string; amount: number }>;
}

function bucket(issues: ValidationIssue[]): DocumentValidationResult {
  const blocking = issues.filter((i) => i.severity === 'blocking');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const legal = issues.filter((i) =>
    [
      'IP_',
      'GOVERNING_',
      'JURISDICTION_',
      'DUPLICATE_CLAUSE',
      'BLANK_PLACEHOLDER',
      'SUPPLIER_NAME',
      'CLIENT_NAME',
      'CLIENT_EMAIL',
    ].some((p) => i.code.startsWith(p) || i.code.includes(p.replace(/_$/, '')))
  );
  const financial = issues.filter((i) =>
    [
      'LINE_',
      'SUBTOTAL_',
      'TOTAL_',
      'BALANCE_',
      'PAID_',
      'PAYMENT_',
      'RECEIPT_',
      'MILESTONE_',
      'DUE_',
    ].some((p) => i.code.startsWith(p))
  );
  const brand = issues.filter((i) =>
    ['MISSING_LEGAL', 'HARDCODED_', 'MISSING_LOGO', 'CROSS_TENANT', 'LEGAL_NAME_NOT', 'UNSUPPORTED_LOGO', 'LOGO_', 'MISSING_JURISDICTION'].some(
      (p) => i.code.startsWith(p) || i.code.includes('BRAND') || i.code.includes('LOGO') || i.code.includes('ORG')
    )
  );
  const layout = issues.filter((i) =>
    ['ORPHAN_', 'ISOLATED_', 'SPLIT_', 'TEXT_CLIPPED', 'MISSING_PAGE', 'AGREEMENT_HAS', 'UNSIGNED_', 'DRAFT_MARKED'].some((p) =>
      i.code.startsWith(p)
    )
  );

  return {
    valid: blocking.length === 0,
    blocking_issues: blocking,
    warnings,
    layout_issues: layout,
    financial_issues: financial,
    legal_consistency_issues: legal,
    brand_issues: brand,
    recommended_fixes: [...new Set(issues.map((i) => i.recommended_fix).filter(Boolean) as string[])],
  };
}

export function validateDocument(input: ValidateDocumentInput): DocumentValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Data validation
  if (!input.structuredData || Object.keys(input.structuredData).length === 0) {
    issues.push({
      code: 'EMPTY_STRUCTURED_DATA',
      severity: 'blocking',
      field: 'structured_data',
      message: 'Document must provide structured data — models may not inject raw HTML/SQL.',
      recommended_fix: 'Supply structured document fields via create_document / update_document.',
    });
  }

  if (typeof input.structuredData.html === 'string' || typeof input.structuredData.sql === 'string') {
    issues.push({
      code: 'FORBIDDEN_RAW_CONTROL',
      severity: 'blocking',
      field: 'structured_data',
      message: 'AI must not directly control raw HTML, SQL, tenant identity, payment status, or signature status.',
      recommended_fix: 'Remove raw html/sql fields; use structured clauses and fields only.',
    });
  }

  // 2. Financial
  if (input.invoice) {
    issues.push(...validateInvoiceFinancials(input.invoice));
  }
  if (input.documentType === 'receipt') {
    const txs = (input.structuredData.payment_transactions ||
      input.invoice?.payment_transactions) as Parameters<typeof validateReceiptRequiresPayment>[0];
    issues.push(...validateReceiptRequiresPayment(txs));
  }
  if (input.invoiceMilestones && input.contractMilestones) {
    issues.push(...assertInvoiceMilestonesMatchContract(input.invoiceMilestones, input.contractMilestones));
  }

  // 3. Legal consistency
  if (input.clauses?.length) {
    issues.push(
      ...validateLegalConsistency({
        clauses: input.clauses,
        supplierLegalName: input.brand.legal_business_name,
        clientLegalName: String(input.structuredData.client_legal_name || ''),
        governingLaw: String(input.structuredData.governing_law || input.brand.jurisdiction || ''),
        jurisdiction: String(input.structuredData.jurisdiction || input.brand.jurisdiction || ''),
        emails: [
          String(input.structuredData.client_email || ''),
          String(input.structuredData.notice_email || ''),
        ].filter(Boolean),
      })
    );
  }

  // 4. Brand
  issues.push(...validateBrandProfile(input.brand));
  if (input.renderedText) {
    issues.push(...validateBrandOnRenderedText(input.renderedText, input.brand));
  }
  if (input.logo) {
    issues.push(...validateLogo(input.logo));
  }

  // 5. Layout
  if (input.layout) {
    issues.push(...validateLayout(input.layout));
  } else if (['contract', 'msa', 'sla', 'sow', 'nda'].includes(input.documentType)) {
    // Default contract layout checks from structured flags
    issues.push(
      ...validateLayout({
        documentType: input.documentType,
        showsInvoiceTotalOnAgreement: Boolean(input.structuredData.show_invoice_total_box),
        unsignedDraftHasSignatures: Boolean(input.structuredData.has_completed_signatures),
        status: String(input.structuredData.status || ''),
        hasPageNumbers: input.structuredData.has_page_numbers !== false,
      })
    );
  }

  // 6. Contact details
  issues.push(
    ...validateContactDetails({
      supplierEmail: input.brand.business_email,
      clientEmail: String(input.structuredData.client_email || ''),
      noticeEmails: Array.isArray(input.structuredData.notice_emails)
        ? (input.structuredData.notice_emails as string[])
        : undefined,
    })
  );

  // 7. Permissions
  if (input.permissions) {
    issues.push(...validatePermissions(input.permissions));
  }

  return bucket(issues);
}

/** Documents with blocking issues must not be sent or signed. */
export function assertCanSendOrSign(result: DocumentValidationResult, action: 'send' | 'sign' | 'approve'): void {
  if (!result.valid) {
    const codes = result.blocking_issues.map((i) => i.code).join(', ');
    throw new Error(`Cannot ${action} document with blocking issues: ${codes}`);
  }
}

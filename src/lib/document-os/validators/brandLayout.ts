/**
 * Brand, layout, contact, and data validators.
 */

import { assertNoHardcodedOrgName, brandDisplayName } from '../brandProfile';
import type { DocumentBrandProfile, DocumentType, ValidationIssue } from '../types';

export function validateBrandProfile(profile: DocumentBrandProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!profile.legal_business_name?.trim()) {
    issues.push({
      code: 'MISSING_LEGAL_NAME',
      severity: 'blocking',
      field: 'legal_business_name',
      message: 'Tenant legal business name is required on documents.',
      recommended_fix: 'Configure the tenant document brand profile legal name.',
    });
  }

  const forbidden = assertNoHardcodedOrgName(profile.legal_business_name || '');
  if (forbidden) {
    issues.push({
      code: 'HARDCODED_ORG_NAME',
      severity: 'blocking',
      field: 'legal_business_name',
      message: forbidden,
      recommended_fix: 'Use the tenant configured legal name from the brand profile.',
    });
  }

  if (!profile.primary_logo_url) {
    issues.push({
      code: 'MISSING_LOGO',
      severity: 'warning',
      field: 'primary_logo_url',
      message: 'No logo configured — text fallback will be used.',
      recommended_fix: 'Upload a primary SVG or transparent PNG logo.',
    });
  }

  if (!profile.jurisdiction) {
    issues.push({
      code: 'MISSING_JURISDICTION',
      severity: 'warning',
      field: 'jurisdiction',
      message: 'Brand profile jurisdiction is empty.',
      recommended_fix: 'Set country and jurisdiction on the brand profile.',
    });
  }

  return issues;
}

export function validateBrandOnRenderedText(
  text: string,
  profile: DocumentBrandProfile
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const forbidden = assertNoHardcodedOrgName(text);
  if (forbidden) {
    issues.push({
      code: 'HARDCODED_ORG_IN_OUTPUT',
      severity: 'blocking',
      field: 'brand',
      message: forbidden,
    });
  }
  const display = brandDisplayName(profile);
  if (profile.legal_business_name && !text.includes(profile.legal_business_name) && !text.includes(display)) {
    issues.push({
      code: 'LEGAL_NAME_NOT_IN_OUTPUT',
      severity: 'blocking',
      field: 'brand',
      message: 'Rendered document does not include the tenant legal or trading name.',
      recommended_fix: 'Ensure headers and footers use the brand profile.',
    });
  }
  return issues;
}

export interface LogoValidationInput {
  url?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  tenantId: string;
  logoTenantId?: string;
}

export function validateLogo(input: LogoValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.url) return issues;

  if (input.logoTenantId && input.logoTenantId !== input.tenantId) {
    issues.push({
      code: 'CROSS_TENANT_LOGO',
      severity: 'blocking',
      field: 'logo',
      message: 'Never substitute another tenant’s logo.',
      recommended_fix: 'Use only logos belonging to the current tenant.',
    });
  }

  if (input.mimeType && !/image\/(png|svg\+xml|webp|jpeg)/i.test(input.mimeType)) {
    issues.push({
      code: 'UNSUPPORTED_LOGO_FORMAT',
      severity: 'warning',
      field: 'logo',
      message: `Logo MIME type ${input.mimeType} is not preferred; use SVG or transparent PNG.`,
    });
  }

  if (input.width && input.height) {
    if (input.width < 64 || input.height < 32) {
      issues.push({
        code: 'LOGO_RESOLUTION_LOW',
        severity: 'warning',
        field: 'logo',
        message: 'Logo resolution is low for print-quality rendering.',
        recommended_fix: 'Provide a higher-resolution transparent PNG or SVG.',
      });
    }
  }

  return issues;
}

export function validateLayout(input: {
  documentType: DocumentType;
  hasPageNumbers?: boolean;
  hasOrphanHeading?: boolean;
  hasIsolatedParagraph?: boolean;
  signatureBlockSplit?: boolean;
  tableHeadersRepeated?: boolean;
  textClipped?: boolean;
  showsInvoiceTotalOnAgreement?: boolean;
  unsignedDraftHasSignatures?: boolean;
  status?: string;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (input.hasOrphanHeading) {
    issues.push({
      code: 'ORPHAN_HEADING',
      severity: 'blocking',
      field: 'layout',
      message: 'Heading would appear alone at the bottom of a page.',
      recommended_fix: 'Keep headings with following content (page-break-after: avoid).',
    });
  }
  if (input.hasIsolatedParagraph) {
    issues.push({
      code: 'ISOLATED_PARAGRAPH',
      severity: 'warning',
      field: 'layout',
      message: 'A single paragraph appears alone on a new page.',
    });
  }
  if (input.signatureBlockSplit) {
    issues.push({
      code: 'SPLIT_SIGNATURE_BLOCK',
      severity: 'blocking',
      field: 'layout',
      message: 'Signature blocks must stay together across pages.',
    });
  }
  if (input.textClipped) {
    issues.push({
      code: 'TEXT_CLIPPED',
      severity: 'blocking',
      field: 'layout',
      message: 'Text clipping or overlap detected in render.',
    });
  }
  if (input.hasPageNumbers === false) {
    issues.push({
      code: 'MISSING_PAGE_NUMBERS',
      severity: 'warning',
      field: 'layout',
      message: 'Page numbers such as “Page 2 of 6” should render.',
    });
  }
  if (
    ['contract', 'msa', 'sla', 'sow', 'nda', 'employment_agreement'].includes(input.documentType) &&
    input.showsInvoiceTotalOnAgreement
  ) {
    issues.push({
      code: 'AGREEMENT_HAS_INVOICE_TOTAL_BOX',
      severity: 'blocking',
      field: 'layout',
      message: 'Agreement must not contain an invoice total box.',
      recommended_fix: 'Remove financial total-due boxes from contract templates.',
    });
  }
  if (input.unsignedDraftHasSignatures) {
    issues.push({
      code: 'UNSIGNED_DRAFT_HAS_SIGNATURES',
      severity: 'blocking',
      field: 'signatures',
      message: 'Unsigned drafts must not contain signature images or completed signature blocks.',
    });
  }
  if (input.status === 'draft' && input.unsignedDraftHasSignatures) {
    issues.push({
      code: 'DRAFT_MARKED_SIGNED_VISUAL',
      severity: 'blocking',
      field: 'status',
      message: 'Draft documents must not appear signed.',
    });
  }

  return issues;
}

export function validateContactDetails(input: {
  supplierEmail?: string;
  clientEmail?: string;
  noticeEmails?: string[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (input.clientEmail && !emailRe.test(input.clientEmail)) {
    issues.push({
      code: 'INVALID_CLIENT_EMAIL',
      severity: 'blocking',
      field: 'client_email',
      message: `Invalid client email: ${input.clientEmail}`,
    });
  }
  if (input.supplierEmail && !emailRe.test(input.supplierEmail)) {
    issues.push({
      code: 'INVALID_SUPPLIER_EMAIL',
      severity: 'blocking',
      field: 'business_email',
      message: `Invalid supplier email: ${input.supplierEmail}`,
    });
  }
  const all = [input.clientEmail, ...(input.noticeEmails || [])].filter(Boolean) as string[];
  if (all.length >= 2) {
    const norm = all.map((e) => e.trim().toLowerCase());
    if (new Set(norm).size > 1) {
      issues.push({
        code: 'CONTACT_EMAIL_INCONSISTENT',
        severity: 'blocking',
        field: 'emails',
        message: `Client emails are inconsistent across contact fields: ${[...new Set(norm)].join(', ')}`,
      });
    }
  }
  return issues;
}

export function validatePermissions(input: {
  actorTenantId: string;
  documentTenantId: string;
  canApprove?: boolean;
  action: 'send' | 'approve' | 'sign' | 'void' | 'archive' | 'edit';
  requiresApproval?: boolean;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (input.actorTenantId !== input.documentTenantId) {
    issues.push({
      code: 'TENANT_ISOLATION_VIOLATION',
      severity: 'blocking',
      field: 'tenant_id',
      message: 'Actor tenant does not match document tenant.',
    });
  }
  if (
    (input.action === 'approve' || input.action === 'send') &&
    input.requiresApproval &&
    input.canApprove === false
  ) {
    issues.push({
      code: 'MISSING_APPROVAL_PERMISSION',
      severity: 'blocking',
      field: 'permissions',
      message: 'Actor lacks permission for this sensitive document action.',
    });
  }
  return issues;
}

/**
 * Document quality check — Bonnie pre-send validation.
 */

export type QualityIssueSeverity = 'critical' | 'warning' | 'info';

export interface QualityIssue {
  id: string;
  severity: QualityIssueSeverity;
  message: string;
  field?: string;
}

export interface DocumentQualityInput {
  type: 'invoice' | 'quote' | 'proposal' | 'contract' | 'email';
  hasLogo?: boolean;
  hasSignature?: boolean;
  hasPaymentDetails?: boolean;
  hasClientName?: boolean;
  hasPricing?: boolean;
  hasTerms?: boolean;
  brokenLinks?: string[];
  clientEmail?: string;
}

export interface DocumentQualityResult {
  score: number;
  issues: QualityIssue[];
  canSend: boolean;
}

export function checkDocumentQuality(input: DocumentQualityInput): DocumentQualityResult {
  const issues: QualityIssue[] = [];

  if (!input.hasLogo) {
    issues.push({
      id: 'missing-logo',
      severity: 'warning',
      message: 'Company logo is missing — documents look more professional with branding.',
      field: 'logo',
    });
  }

  if (!input.hasClientName) {
    issues.push({
      id: 'missing-client',
      severity: 'critical',
      message: 'No customer selected — verify this goes to the right person.',
      field: 'client',
    });
  }

  if (input.type === 'invoice' && !input.hasPaymentDetails) {
    issues.push({
      id: 'missing-payment',
      severity: 'critical',
      message: 'Payment details missing — clients cannot pay you.',
      field: 'payment',
    });
  }

  if (['quote', 'proposal', 'invoice'].includes(input.type) && !input.hasPricing) {
    issues.push({
      id: 'missing-pricing',
      severity: 'critical',
      message: 'No pricing found — add line items before sending.',
      field: 'pricing',
    });
  }

  if (input.type === 'contract' && !input.hasSignature) {
    issues.push({
      id: 'missing-signature',
      severity: 'warning',
      message: 'Signature block missing — add where clients should sign.',
      field: 'signature',
    });
  }

  if (!input.hasTerms && ['quote', 'proposal', 'contract'].includes(input.type)) {
    issues.push({
      id: 'missing-terms',
      severity: 'warning',
      message: 'Terms and conditions not included.',
      field: 'terms',
    });
  }

  if (input.brokenLinks && input.brokenLinks.length > 0) {
    issues.push({
      id: 'broken-links',
      severity: 'critical',
      message: `${input.brokenLinks.length} broken link(s) found in document.`,
      field: 'links',
    });
  }

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const score = Math.max(0, 100 - criticalCount * 25 - warningCount * 10);

  return {
    score,
    issues,
    canSend: criticalCount === 0,
  };
}

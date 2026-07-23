/**
 * Contract + invoice validation engine for autonomous document workflows.
 */

export type ValidationSeverity = 'critical' | 'warning' | 'info';

export type ValidationFinding = {
  id: string;
  severity: ValidationSeverity;
  message: string;
  field?: string;
  evidence?: Record<string, unknown>;
};

export type DocumentValidationResult = {
  valid: boolean;
  can_send: boolean;
  score: number;
  findings: ValidationFinding[];
};

export type ContractValidationInput = {
  text: string;
  clientName?: string;
  clientEmail?: string;
  clientAddress?: string;
  jurisdiction?: string;
  hasSignatureBlock?: boolean;
  isDraft?: boolean;
  hasSignaturesFilled?: boolean;
  paymentSchedule?: Array<{ amount: number; due?: string; label?: string }>;
  invoiceMilestones?: Array<{ amount: number; due?: string; label?: string }>;
  documentVersion?: string | null;
  pageCount?: number | null;
  hasPageNumbers?: boolean;
};

const ORIGINALITY_PROMISE =
  /original(ity)?|unique design|not\s+cop(y|ied)|wholly\s+original|guarantees?\s+original/i;
const ORIGINALITY_DISCLAIMER =
  /copy\s+(the\s+)?logo|disclaim(s|er)?\s+original|no\s+claim\s+to\s+original|agreed\s+to\s+copy|based\s+on\s+(existing|client)/i;

export function validateContract(input: ContractValidationInput): DocumentValidationResult {
  const findings: ValidationFinding[] = [];
  const text = input.text || '';
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  // Duplicate clauses (exact repeated paragraphs)
  const seen = new Map<string, number>();
  for (const line of lines) {
    if (line.length < 40) continue;
    const key = line.toLowerCase();
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  for (const [clause, count] of seen) {
    if (count > 1) {
      findings.push({
        id: 'duplicate-clause',
        severity: 'warning',
        message: `Duplicate clause detected (${count}×): "${clause.slice(0, 80)}…"`,
        field: 'clauses',
      });
    }
  }

  // Contradictory originality
  if (ORIGINALITY_PROMISE.test(text) && ORIGINALITY_DISCLAIMER.test(text)) {
    findings.push({
      id: 'contradictory-originality',
      severity: 'critical',
      message:
        'Contradictory originality clauses: document both promises originality and disclaims/admits copying (e.g. logo copy). Remove one position before send.',
      field: 'originality',
      evidence: { promise: true, disclaimer: true },
    });
  }

  if (!input.jurisdiction && !/jurisdiction|governing\s+law|laws?\s+of/i.test(text)) {
    findings.push({
      id: 'undefined-jurisdiction',
      severity: 'critical',
      message: 'Jurisdiction / governing law is undefined.',
      field: 'jurisdiction',
    });
  }

  // Inconsistent client emails
  const emails = Array.from(text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)).map((m) =>
    m[0].toLowerCase()
  );
  if (input.clientEmail) {
    const expected = input.clientEmail.toLowerCase();
    const others = emails.filter((e) => e !== expected);
    if (others.length > 0 && emails.includes(expected)) {
      findings.push({
        id: 'inconsistent-client-email',
        severity: 'critical',
        message: `Client email inconsistency: expected ${expected}, also found ${others.slice(0, 3).join(', ')}`,
        field: 'client_email',
      });
    }
  } else if (new Set(emails).size > 2) {
    findings.push({
      id: 'multiple-client-emails',
      severity: 'warning',
      message: 'Multiple distinct emails appear in the contract; verify client identity.',
      field: 'client_email',
    });
  }

  if (input.clientName && text && !text.toLowerCase().includes(input.clientName.toLowerCase())) {
    findings.push({
      id: 'inconsistent-client-name',
      severity: 'warning',
      message: `Client name "${input.clientName}" does not appear in contract body.`,
      field: 'client_name',
    });
  }

  if (input.isDraft && input.hasSignaturesFilled) {
    findings.push({
      id: 'draft-with-signatures',
      severity: 'critical',
      message: 'Draft document contains filled signatures — remove signature evidence before treating as draft.',
      field: 'signature',
    });
  }

  if (input.hasSignatureBlock === false || (!/signature|signed\s+by|\/s\//i.test(text) && !input.hasSignatureBlock)) {
    findings.push({
      id: 'missing-signature-evidence',
      severity: 'warning',
      message: 'Missing signature block / signature evidence.',
      field: 'signature',
    });
  }

  // Payment schedule vs invoice milestones
  if (input.paymentSchedule?.length && input.invoiceMilestones?.length) {
    const schedTotal = input.paymentSchedule.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const invTotal = input.invoiceMilestones.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (Math.abs(schedTotal - invTotal) > 0.01) {
      findings.push({
        id: 'payment-schedule-conflict',
        severity: 'critical',
        message: `Payment schedule total (${schedTotal}) conflicts with invoice milestones (${invTotal}).`,
        field: 'payment_schedule',
        evidence: { schedule_total: schedTotal, invoice_total: invTotal },
      });
    }
  }

  // Unreasonable milestones (negative / zero-only)
  if (input.paymentSchedule?.some((p) => Number(p.amount) < 0)) {
    findings.push({
      id: 'unreasonable-milestones',
      severity: 'critical',
      message: 'Payment milestones include negative amounts.',
      field: 'milestones',
    });
  }

  if (!input.documentVersion && !/version\s*[:#]?\s*\d/i.test(text)) {
    findings.push({
      id: 'missing-document-version',
      severity: 'warning',
      message: 'Document version is missing.',
      field: 'version',
    });
  }

  // Explicit false always warns; undefined only warns for multi-page docs.
  if (
    input.hasPageNumbers === false ||
    (input.pageCount != null && input.pageCount > 1 && input.hasPageNumbers == null)
  ) {
    findings.push({
      id: 'missing-page-numbers',
      severity: 'warning',
      message: 'Page numbers are missing from multi-page document layout.',
      field: 'layout',
    });
  }

  if (/ALPHACLONE SYSTEMS'?s Organization/i.test(text)) {
    findings.push({
      id: 'placeholder-org-name',
      severity: 'critical',
      message: 'Replace placeholder "ALPHACLONE SYSTEMS\'s Organization" with the configured legal/trading name.',
      field: 'supplier_name',
    });
  }

  return scoreFindings(findings);
}

export type InvoiceValidationInput = {
  status: string;
  total: number;
  amount_paid?: number | null;
  balance_due?: number | null;
  paid_at?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  currency?: string | null;
  due_date?: string | null;
  payment_terms?: string | null;
  supplier_legal_name?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_address?: string | null;
  milestone_total?: number | null;
  display_name?: string | null;
  is_receipt?: boolean;
};

const INVOICE_STATES = new Set([
  'draft',
  'sent',
  'overdue',
  'partially_paid',
  'paid',
  'void',
  'refunded',
]);

export function validateInvoice(input: InvoiceValidationInput): DocumentValidationResult {
  const findings: ValidationFinding[] = [];
  const status = String(input.status || '').toLowerCase();

  if (!INVOICE_STATES.has(status)) {
    findings.push({
      id: 'invalid-invoice-status',
      severity: 'critical',
      message: `Invoice status "${input.status}" is not a distinct allowed state.`,
      field: 'status',
    });
  }

  const total = Number(input.total) || 0;
  const paid = Number(input.amount_paid) || 0;
  const balance =
    input.balance_due == null ? Math.max(total - paid, 0) : Number(input.balance_due);

  if (status === 'paid') {
    if (Math.abs(balance) > 0.001) {
      findings.push({
        id: 'paid-nonzero-balance',
        severity: 'critical',
        message: `Paid invoices must have balance_due = 0 (found ${balance}).`,
        field: 'balance_due',
      });
    }
    if (!input.paid_at) {
      findings.push({
        id: 'paid-missing-date',
        severity: 'critical',
        message: 'Paid invoice missing payment date.',
        field: 'paid_at',
      });
    }
    if (!input.payment_method) {
      findings.push({
        id: 'paid-missing-method',
        severity: 'critical',
        message: 'Paid invoice missing payment method.',
        field: 'payment_method',
      });
    }
    if (!input.payment_reference) {
      findings.push({
        id: 'paid-missing-reference',
        severity: 'critical',
        message: 'Paid invoice missing payment reference.',
        field: 'payment_reference',
      });
    }
    if (paid <= 0) {
      findings.push({
        id: 'paid-missing-amount',
        severity: 'critical',
        message: 'Paid invoice missing amount paid.',
        field: 'amount_paid',
      });
    }
    if (!input.is_receipt) {
      findings.push({
        id: 'paid-not-receipt',
        severity: 'warning',
        message: 'Paid invoice should be marked as a receipt or clearly show payment evidence.',
        field: 'receipt',
      });
    }
  }

  if (input.milestone_total != null && Math.abs(total - Number(input.milestone_total)) > 0.01) {
    findings.push({
      id: 'invoice-milestone-mismatch',
      severity: 'critical',
      message: `Invoice total (${total}) does not agree with contract milestones (${input.milestone_total}).`,
      field: 'total',
    });
  }

  if (!input.currency) {
    findings.push({
      id: 'missing-currency',
      severity: 'critical',
      message: 'Currency must be explicit.',
      field: 'currency',
    });
  }

  if (!input.supplier_legal_name || /ALPHACLONE SYSTEMS'?s Organization/i.test(input.supplier_legal_name)) {
    findings.push({
      id: 'incomplete-supplier',
      severity: 'critical',
      message: 'Supplier legal/trading name is missing or still a placeholder.',
      field: 'supplier_legal_name',
    });
  }

  if (!input.client_name || !input.client_email) {
    findings.push({
      id: 'incomplete-client',
      severity: 'critical',
      message: 'Client name and email must be complete.',
      field: 'client',
    });
  }

  if (input.display_name && /ALPHACLONE SYSTEMS'?s Organization/i.test(input.display_name)) {
    findings.push({
      id: 'placeholder-display-name',
      severity: 'critical',
      message: 'Replace "ALPHACLONE SYSTEMS\'s Organization" with configured legal/trading name.',
      field: 'display_name',
    });
  }

  return scoreFindings(findings);
}

function scoreFindings(findings: ValidationFinding[]): DocumentValidationResult {
  const critical = findings.filter((f) => f.severity === 'critical').length;
  const warning = findings.filter((f) => f.severity === 'warning').length;
  const score = Math.max(0, 100 - critical * 25 - warning * 8);
  return {
    valid: critical === 0,
    can_send: critical === 0,
    score,
    findings,
  };
}

/** Detect Novus Power style originality contradiction specifically. */
export function detectNovusOriginalityContradiction(text: string): boolean {
  return ORIGINALITY_PROMISE.test(text) && ORIGINALITY_DISCLAIMER.test(text);
}

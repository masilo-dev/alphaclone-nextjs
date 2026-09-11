/**
 * Financial calculation validation for invoices, quotes, and receipts.
 */

import type { InvoiceStructuredData, PaymentTransaction, ValidationIssue } from '../types';

const MONEY_EPS = 0.005;

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= MONEY_EPS;
}

export function validateInvoiceFinancials(invoice: InvoiceStructuredData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const {
    subtotal,
    tax,
    discount,
    total,
    amount_paid,
    balance_due,
    line_items,
    payment_status,
    payment_transactions,
    payment_link,
    currency,
  } = invoice;

  const lineSum = line_items.reduce((sum, item) => {
    const expected = item.quantity * item.unit_price - (item.discount || 0);
    if (!nearlyEqual(item.amount, expected)) {
      issues.push({
        code: 'LINE_AMOUNT_MISMATCH',
        severity: 'blocking',
        field: 'line_items',
        message: `Line "${item.description}" amount ${item.amount} != qty*price - discount (${expected}).`,
        recommended_fix: 'Recalculate line item amounts.',
      });
    }
    return sum + item.amount;
  }, 0);

  if (!nearlyEqual(subtotal, lineSum)) {
    issues.push({
      code: 'SUBTOTAL_MISMATCH',
      severity: 'blocking',
      field: 'subtotal',
      message: `Subtotal ${subtotal} does not equal sum of line items ${lineSum}.`,
      recommended_fix: 'Recalculate subtotal from line items.',
    });
  }

  const expectedTotal = subtotal + tax - discount;
  if (!nearlyEqual(total, expectedTotal)) {
    issues.push({
      code: 'TOTAL_MISMATCH',
      severity: 'blocking',
      field: 'total',
      message: `Total ${total} != subtotal + tax - discount (${expectedTotal}).`,
      recommended_fix: 'Set total = subtotal + tax - discount.',
    });
  }

  if (!nearlyEqual(amount_paid + balance_due, total)) {
    issues.push({
      code: 'BALANCE_EQUATION',
      severity: 'blocking',
      field: 'balance_due',
      message: `amount_paid (${amount_paid}) + balance_due (${balance_due}) must equal total (${total}).`,
      recommended_fix: 'Recalculate balance_due from verified payments.',
    });
  }

  if (payment_status === 'paid') {
    if (!nearlyEqual(balance_due, 0)) {
      issues.push({
        code: 'PAID_NONZERO_BALANCE',
        severity: 'blocking',
        field: 'balance_due',
        message: 'Paid invoices must have balance_due = 0.',
        recommended_fix: 'Set balance_due to 0 and record full payment evidence.',
      });
    }
    if (!nearlyEqual(amount_paid, total)) {
      issues.push({
        code: 'PAID_AMOUNT_MISMATCH',
        severity: 'blocking',
        field: 'amount_paid',
        message: 'Paid invoice amount_paid must equal total.',
        recommended_fix: 'Align amount_paid with total and payment records.',
      });
    }
    const verified = (payment_transactions || []).filter((t) => t.verified);
    if (verified.length === 0) {
      issues.push({
        code: 'PAID_WITHOUT_EVIDENCE',
        severity: 'blocking',
        field: 'payment_transactions',
        message:
          'A paid invoice requires verified payment transaction evidence. Do not use a paid stamp alone as proof of payment.',
        recommended_fix: 'Attach verified payment transactions with date, amount, method, and reference.',
      });
    } else {
      for (const tx of verified) {
        for (const field of ['paid_at', 'method', 'reference'] as const) {
          if (!tx[field]) {
            issues.push({
              code: 'PAYMENT_EVIDENCE_INCOMPLETE',
              severity: 'blocking',
              field: 'payment_transactions',
              message: `Payment ${tx.transaction_id} missing ${field}.`,
              recommended_fix: 'Include payment date, amount, method, and reference on paid invoices.',
            });
          }
        }
        if (tx.currency && tx.currency !== currency) {
          issues.push({
            code: 'PAYMENT_CURRENCY_MISMATCH',
            severity: 'blocking',
            field: 'payment_transactions',
            message: `Payment currency ${tx.currency} does not match invoice ${currency}.`,
          });
        }
      }
    }
  }

  // PDF must not show PAID and a positive total due simultaneously
  if (payment_status === 'paid' && balance_due > MONEY_EPS) {
    issues.push({
      code: 'PAID_WITH_TOTAL_DUE',
      severity: 'blocking',
      field: 'balance_due',
      message: 'A PDF cannot show PAID and a positive Total due simultaneously.',
      recommended_fix: 'Zero the balance due when marking paid.',
    });
  }

  if (payment_link) {
    const amountInLink = payment_link.match(/(?:amount|total)=([\d.]+)/i);
    const currencyInLink = payment_link.match(/(?:currency|cur)=([A-Z]{3})/i);
    if (amountInLink && !nearlyEqual(Number(amountInLink[1]), balance_due > 0 ? balance_due : total)) {
      issues.push({
        code: 'PAYMENT_LINK_AMOUNT_MISMATCH',
        severity: 'blocking',
        field: 'payment_link',
        message: 'Payment link amount does not match invoice balance/total.',
        recommended_fix: 'Regenerate the payment link for the correct amount.',
      });
    }
    if (currencyInLink && currencyInLink[1] !== currency) {
      issues.push({
        code: 'PAYMENT_LINK_CURRENCY_MISMATCH',
        severity: 'blocking',
        field: 'payment_link',
        message: 'Payment link currency does not match invoice currency.',
      });
    }
  }

  if (dueDateBeforeIssue(invoice.issue_date, invoice.due_date)) {
    issues.push({
      code: 'DUE_BEFORE_ISSUE',
      severity: 'blocking',
      field: 'due_date',
      message: 'Due date must not precede issue date.',
      recommended_fix: 'Set due date according to configured payment terms.',
    });
  }

  return issues;
}

function dueDateBeforeIssue(issue?: string, due?: string): boolean {
  if (!issue || !due) return false;
  const a = Date.parse(issue);
  const b = Date.parse(due);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return b < a;
}

export function validateReceiptRequiresPayment(
  transactions: PaymentTransaction[] | undefined
): ValidationIssue[] {
  const verified = (transactions || []).filter((t) => t.verified && t.amount > 0);
  if (verified.length === 0) {
    return [
      {
        code: 'RECEIPT_WITHOUT_PAYMENT',
        severity: 'blocking',
        field: 'payment_transactions',
        message: 'A receipt cannot exist without verified payment evidence.',
        recommended_fix: 'Create the receipt only after payment is confirmed.',
      },
    ];
  }
  return [];
}

export function assertInvoiceMilestonesMatchContract(
  invoiceMilestones: Array<{ id: string; amount: number }>,
  contractMilestones: Array<{ id: string; amount: number }>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const m of invoiceMilestones) {
    const match = contractMilestones.find((c) => c.id === m.id);
    if (!match) {
      issues.push({
        code: 'MILESTONE_NOT_IN_CONTRACT',
        severity: 'blocking',
        field: 'milestones',
        message: `Invoice milestone ${m.id} is not present on the related contract.`,
      });
      continue;
    }
    if (!nearlyEqual(match.amount, m.amount)) {
      issues.push({
        code: 'MILESTONE_AMOUNT_MISMATCH',
        severity: 'blocking',
        field: 'milestones',
        message: `Invoice milestone ${m.id} amount ${m.amount} != contract ${match.amount}.`,
        recommended_fix: 'Invoice milestones must match the related contract payment schedule.',
      });
    }
  }
  return issues;
}

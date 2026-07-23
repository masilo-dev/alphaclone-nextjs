/**
 * Cross-module document automation workflows.
 * Owner approves sensitive actions in-conversation.
 */

import type { DocumentBrandProfile, DocumentActor, InvoiceLineItem, PaymentTransaction } from './types';
import { buildStandardContractClauses, type ContractStructuredData } from './engines/contractEngine';
import {
  buildInvoiceData,
  buildQuoteData,
  convertQuoteToInvoiceData,
  createReceiptFromPayment,
  type QuoteData,
} from './engines/invoiceEngine';
import { requireOwnerApprovalForSensitiveAction } from './engines/signatureEngine';
import { DocumentOsService, type DocumentOsStore } from '../../services/documentOs/documentOsService';
import type { AuthenticatedSession } from './actors';

export interface AutomationContext {
  store: DocumentOsStore;
  brand: DocumentBrandProfile;
  session: AuthenticatedSession;
  actor: DocumentActor;
  ownerApproved: boolean;
}

export interface CrmSeed {
  lead_id?: string;
  client_id: string;
  company_id?: string;
  company_name: string;
  client_email: string;
  client_address?: string;
  opportunity_id?: string;
}

/**
 * End-to-end automation chain used by AI agents with owner approval gates.
 */
export function runDocumentAutomationChain(
  ctx: AutomationContext,
  seed: CrmSeed,
  pricing: {
    line_items: InvoiceLineItem[];
    tax?: number;
    deposit_amount?: number;
    milestones?: Array<{ id: string; title: string; amount: number; due_date?: string }>;
    scope: string;
    governing_law: string;
    jurisdiction: string;
  }
) {
  const svc = new DocumentOsService(ctx.store, ctx.brand);
  const today = new Date().toISOString().slice(0, 10);

  // 1–3: quote from CRM
  const quoteData = buildQuoteData({
    quote_number: 'PENDING',
    currency: ctx.brand.default_currency,
    validity_period_days: 30,
    issue_date: today,
    line_items: pricing.line_items,
    tax: pricing.tax,
    scope: pricing.scope,
  });

  const quote = svc.createDocument({
    session: ctx.session,
    document_type: 'quote',
    title: `Quote — ${seed.company_name}`,
    client_id: seed.client_id,
    company_id: seed.company_id,
    structured_data: {
      ...quoteData,
      client_legal_name: seed.company_name,
      client_email: seed.client_email,
      lead_id: seed.lead_id,
      opportunity_id: seed.opportunity_id,
    },
  });

  // 4: approve + send quote (sensitive)
  requireOwnerApprovalForSensitiveAction('send_invoice', ctx.actor, ctx.ownerApproved);
  svc.transition({
    session: ctx.session,
    document_id: quote.document_id,
    to: 'approved',
    action: 'approved',
  });
  svc.transition({
    session: ctx.session,
    document_id: quote.document_id,
    to: 'sent',
    action: 'sent',
    sent_to: [seed.client_email],
  });

  // 5: client acceptance
  svc.transition({
    session: ctx.session,
    document_id: quote.document_id,
    to: 'viewed',
    action: 'viewed',
  });
  svc.transition({
    session: ctx.session,
    document_id: quote.document_id,
    to: 'accepted',
    action: 'accepted',
  });

  // 6: contract from accepted quote
  const contractPayload: ContractStructuredData = {
    parties: {
      supplier_legal_name: ctx.brand.legal_business_name,
      client_legal_name: seed.company_name,
      supplier_email: ctx.brand.business_email,
      client_email: seed.client_email,
      supplier_address: ctx.brand.physical_address,
      client_address: seed.client_address,
    },
    scope: pricing.scope,
    deliverables: pricing.line_items.map((i) => i.description),
    fees: pricing.line_items.map((i) => ({
      amount: i.amount,
      currency: ctx.brand.default_currency,
      description: i.description,
    })),
    deposit: pricing.deposit_amount
      ? { amount: pricing.deposit_amount, currency: ctx.brand.default_currency }
      : undefined,
    milestones: pricing.milestones,
    payment_terms: 'Net 14',
    governing_law: pricing.governing_law,
    jurisdiction: pricing.jurisdiction,
    notices: `Notices to Client: ${seed.client_email}. Notices to Supplier: ${ctx.brand.business_email}.`,
    intellectual_property:
      'Upon full payment, Client receives a license to use deliverables. Supplier retains ownership of pre-existing tools and frameworks.',
    clauses: [],
  };
  contractPayload.clauses = buildStandardContractClauses(contractPayload);

  const contract = svc.createDocument({
    session: ctx.session,
    document_type: 'contract',
    title: `Service Agreement — ${seed.company_name}`,
    client_id: seed.client_id,
    company_id: seed.company_id,
    source_document_id: quote.document_id,
    structured_data: {
      ...contractPayload,
      client_legal_name: seed.company_name,
      client_email: seed.client_email,
      notice_email: seed.client_email,
      governing_law: pricing.governing_law,
      jurisdiction: pricing.jurisdiction,
      clauses: contractPayload.clauses,
    },
  });

  svc.transition({
    session: ctx.session,
    document_id: quote.document_id,
    to: 'converted_to_contract',
    action: 'amended',
  });

  // 7–8: review + approve exact version
  svc.transition({
    session: ctx.session,
    document_id: contract.document_id,
    to: 'under_review',
    action: 'submitted_for_review',
  });
  svc.transition({
    session: ctx.session,
    document_id: contract.document_id,
    to: 'approved',
    action: 'approved',
    requireValidation: true,
  });

  // 9–10: send for signature
  requireOwnerApprovalForSensitiveAction('send_contract', ctx.actor, ctx.ownerApproved);
  svc.transition({
    session: ctx.session,
    document_id: contract.document_id,
    to: 'sent',
    action: 'sent',
    sent_to: [seed.client_email],
    requireValidation: true,
  });
  svc.transition({
    session: ctx.session,
    document_id: contract.document_id,
    to: 'viewed',
    action: 'viewed',
  });
  svc.transition({
    session: ctx.session,
    document_id: contract.document_id,
    to: 'awaiting_signature',
    action: 'signature_requested',
  });
  requireOwnerApprovalForSensitiveAction('sign', ctx.actor, ctx.ownerApproved);
  svc.transition({
    session: ctx.session,
    document_id: contract.document_id,
    to: 'signed',
    action: 'signed',
  });
  svc.transition({
    session: ctx.session,
    document_id: contract.document_id,
    to: 'active',
    action: 'accepted',
  });

  // 11–12: activate project conceptually + milestone invoice
  const deposit = pricing.deposit_amount || pricing.line_items[0]?.amount || 0;
  const milestone = pricing.milestones?.[0];
  const invoiceData = buildInvoiceData({
    brand: ctx.brand,
    client: {
      legal_name: seed.company_name,
      email: seed.client_email,
      address: seed.client_address,
    },
    invoice_number: 'PENDING',
    issue_date: today,
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    line_items: milestone
      ? [
          {
            description: milestone.title,
            quantity: 1,
            unit_price: milestone.amount,
            amount: milestone.amount,
          },
        ]
      : [
          {
            description: 'Deposit / milestone',
            quantity: 1,
            unit_price: deposit,
            amount: deposit,
          },
        ],
    related_contract_id: contract.document_id,
    payment_status: 'draft',
  });

  const invoice = svc.createDocument({
    session: ctx.session,
    document_type: 'invoice',
    title: `Invoice — ${seed.company_name}`,
    client_id: seed.client_id,
    project_id: undefined,
    source_document_id: contract.document_id,
    structured_data: {
      ...invoiceData,
      client_legal_name: seed.company_name,
      client_email: seed.client_email,
      milestones: milestone ? [{ id: milestone.id, amount: milestone.amount }] : [],
    },
  });

  requireOwnerApprovalForSensitiveAction('send_invoice', ctx.actor, ctx.ownerApproved);
  svc.transition({
    session: ctx.session,
    document_id: invoice.document_id,
    to: 'approved',
    action: 'approved',
  });
  svc.transition({
    session: ctx.session,
    document_id: invoice.document_id,
    to: 'sent',
    action: 'sent',
    sent_to: [seed.client_email],
    requireValidation: true,
    validationExtra: {
      invoice: invoiceData,
      contractMilestones: pricing.milestones?.map((m) => ({ id: m.id, amount: m.amount })),
      invoiceMilestones: milestone ? [{ id: milestone.id, amount: milestone.amount }] : undefined,
    },
  });

  // 13–14: payment + receipt
  const tx: PaymentTransaction = {
    transaction_id: `txn_${Date.now()}`,
    amount: invoiceData.total,
    currency: invoiceData.currency,
    paid_at: new Date().toISOString(),
    method: 'card',
    provider: 'stripe',
    reference: `pi_test_${Date.now()}`,
    payer_name: seed.company_name,
    verified: true,
  };
  const paidInvoice = buildInvoiceData({
    brand: ctx.brand,
    client: invoiceData.client,
    invoice_number: invoice.document_number,
    issue_date: invoiceData.issue_date,
    due_date: invoiceData.due_date,
    line_items: invoiceData.line_items,
    tax: invoiceData.tax,
    amount_paid: invoiceData.total,
    related_contract_id: contract.document_id,
    payment_transactions: [tx],
    payment_status: 'paid',
  });
  svc.updateDocument({
    session: ctx.session,
    document_id: invoice.document_id,
    structured_data: {
      ...invoice.structured_data,
      ...paidInvoice,
    },
    change_summary: 'Record verified payment',
  });
  // after update status may still be sent — transition through payment states
  const invAfterPay = svc.getDocument(invoice.document_id);
  if (invAfterPay.status === 'sent' || invAfterPay.status === 'viewed') {
    svc.transition({
      session: ctx.session,
      document_id: invoice.document_id,
      to: 'paid',
      action: 'paid',
      validationExtra: { invoice: paidInvoice },
    });
  }

  const receiptData = createReceiptFromPayment({
    invoice_number: invoice.document_number,
    transaction: tx,
    remaining_balance: 0,
  });
  const receipt = svc.createDocument({
    session: ctx.session,
    document_type: 'receipt',
    title: `Receipt — ${seed.company_name}`,
    client_id: seed.client_id,
    source_document_id: invoice.document_id,
    structured_data: {
      ...receiptData,
      payment_transactions: [tx],
      client_email: seed.client_email,
    },
  });

  svc.transition({
    session: ctx.session,
    document_id: invoice.document_id,
    to: 'receipted',
    action: 'paid',
  });

  // 15–16: archive trail preserved via events
  return {
    quote: svc.getDocument(quote.document_id),
    contract: svc.getDocument(contract.document_id),
    invoice: svc.getDocument(invoice.document_id),
    receipt: svc.getDocument(receipt.document_id),
    timeline: {
      quote: svc.getTimeline(quote.document_id),
      contract: svc.getTimeline(contract.document_id),
      invoice: svc.getTimeline(invoice.document_id),
      receipt: svc.getTimeline(receipt.document_id),
    },
    related: svc.search(seed.company_name),
  };
}

export function quoteToInvoiceConversion(
  quote: QuoteData,
  brand: DocumentBrandProfile,
  client: { legal_name: string; email?: string },
  invoiceNumber: string,
  issueDate: string,
  dueDate: string
) {
  return convertQuoteToInvoiceData(quote, brand, client, invoiceNumber, issueDate, dueDate);
}

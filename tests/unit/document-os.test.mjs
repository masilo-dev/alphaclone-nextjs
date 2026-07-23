/**
 * Document OS unit tests — Novus Power regression fixtures + core engines.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alphacloneBrandProfile,
  novusPowerConflictingClauses,
  novusPowerCoherentClauses,
  novusDepositInvoice,
  NOVUS_CLIENT,
  NOVUS_CONTRACT_MILESTONES,
} from '../../src/lib/document-os/fixtures/novusPower.ts';
import { validateDocument } from '../../src/lib/document-os/validation.ts';
import { detectOriginalityContradictions } from '../../src/lib/document-os/validators/legalConsistency.ts';
import {
  validateInvoiceFinancials,
  assertInvoiceMilestonesMatchContract,
} from '../../src/lib/document-os/validators/financial.ts';
import {
  canTransition,
  assertTransition,
  InvalidTransitionError,
} from '../../src/lib/document-os/lifecycle.ts';
import { resolveActorFromSession } from '../../src/lib/document-os/actors.ts';
import { createReceiptFromPayment } from '../../src/lib/document-os/engines/invoiceEngine.ts';
import { renderCorporateDocumentHtml } from '../../src/lib/document-os/corporateRenderer.ts';
import { assertNoHardcodedOrgName } from '../../src/lib/document-os/brandProfile.ts';
import { validateLayout } from '../../src/lib/document-os/validators/brandLayout.ts';
import {
  createSignatureEnvelope,
  recordSignature,
  requireOwnerApprovalForSensitiveAction,
} from '../../src/lib/document-os/engines/signatureEngine.ts';
import {
  createDocumentOsStore,
  DocumentOsService,
} from '../../src/services/documentOs/documentOsService.ts';
import { runDocumentAutomationChain } from '../../src/lib/document-os/automation.ts';
import { renderDocumentHtml } from '../../src/lib/documents/renderDocument.ts';

const brand = alphacloneBrandProfile();

test('brand profile uses Alphaclone legal name — never hardcoded Organization string', () => {
  assert.equal(brand.legal_business_name, 'Alphaclone Systems (Pty) Ltd');
  assert.equal(assertNoHardcodedOrgName(brand.legal_business_name), null);
  assert.ok(assertNoHardcodedOrgName("ALPHACLONE SYSTEMS's Organization."));
});

test('Novus Power conflicting originality clauses are blocking', () => {
  const clauses = novusPowerConflictingClauses();
  const ipIssues = detectOriginalityContradictions(clauses);
  assert.ok(ipIssues.some((i) => i.code.includes('CONTRADICTION') || i.code.includes('IP_')));
  assert.ok(ipIssues.every((i) => i.severity === 'blocking'));

  const result = validateDocument({
    documentType: 'contract',
    brand,
    structuredData: {
      client_legal_name: NOVUS_CLIENT.legal_name,
      client_email: NOVUS_CLIENT.email,
      notice_email: 'accounts@novus-power.example',
      governing_law: 'undefined',
      jurisdiction: 'undefined',
      clauses,
      status: 'draft',
    },
    clauses,
  });
  assert.equal(result.valid, false);
  assert.ok(result.blocking_issues.length > 0);
  assert.ok(
    result.legal_consistency_issues.some((i) =>
      /ORIGINALITY|CONTRADICTION|IP_/i.test(i.code)
    )
  );
  assert.ok(
    result.blocking_issues.some((i) => i.code === 'JURISDICTION_UNDEFINED' || i.code === 'GOVERNING_LAW_UNDEFINED')
  );
  assert.ok(
    result.blocking_issues.some((i) => i.code === 'CLIENT_EMAIL_INCONSISTENT' || i.code === 'CONTACT_EMAIL_INCONSISTENT')
  );
});

test('Novus Power coherent contract can be approved and does not include invoice total box', () => {
  const clauses = novusPowerCoherentClauses();
  const result = validateDocument({
    documentType: 'contract',
    brand,
    structuredData: {
      client_legal_name: NOVUS_CLIENT.legal_name,
      client_email: NOVUS_CLIENT.email,
      notice_email: NOVUS_CLIENT.email,
      governing_law: 'South Africa',
      jurisdiction: 'Western Cape, South Africa',
      clauses,
      status: 'under_review',
      show_invoice_total_box: false,
      has_completed_signatures: false,
      has_page_numbers: true,
    },
    clauses,
    renderedText: `Alphaclone Systems (Pty) Ltd agreement with ${NOVUS_CLIENT.legal_name}`,
    layout: {
      documentType: 'contract',
      hasPageNumbers: true,
      showsInvoiceTotalOnAgreement: false,
      unsignedDraftHasSignatures: false,
      status: 'draft',
    },
  });
  assert.equal(result.valid, true, JSON.stringify(result.blocking_issues, null, 2));

  const html = renderCorporateDocumentHtml({
    documentType: 'contract',
    brand,
    title: 'Service Agreement',
    documentNumber: 'CTR-NOVUS-0001',
    version: 1,
    status: 'draft',
    clientName: NOVUS_CLIENT.legal_name,
    clientEmail: NOVUS_CLIENT.email,
    clauses,
    showSignatures: false,
    metadata: { documentId: 'doc-novus', author: brand.legal_business_name },
  });
  assert.match(html, /Alphaclone Systems \(Pty\) Ltd/);
  assert.match(html, /Novus Power/);
  assert.match(html, /object-fit:\s*contain/);
  assert.doesNotMatch(html, /ALPHACLONE SYSTEMS'?s Organization/i);
  assert.doesNotMatch(html, /Total due/i);
  assert.doesNotMatch(html, /<div class="doc-payment-summary">/);
  assert.doesNotMatch(html, /Signed electronically/);
  assert.match(html, /Page " counter\(page\) " of " counter\(pages\)/);
  assert.match(html, /page-break-inside:\s*avoid/);
});

test('legacy themed renderer also omits invoice total box on contracts', () => {
  const html = renderDocumentHtml({
    type: 'contract',
    title: 'Agreement',
    documentNumber: 'CTR-1',
    branding: { name: brand.legal_business_name, logoUrl: brand.primary_logo_url, primaryColor: brand.primary_colour },
    total: 2500,
    status: 'draft',
    sections: [{ heading: 'Scope', body: 'Logo design' }],
  });
  assert.doesNotMatch(html, /Total due/);
  assert.match(html, /object-fit:contain/);
  assert.match(html, /Page " counter\(page\)/);
});

test('unsigned drafts must not contain signatures; signed contracts are not draft', () => {
  const layoutIssues = validateLayout({
    documentType: 'contract',
    unsignedDraftHasSignatures: true,
    status: 'draft',
  });
  assert.ok(layoutIssues.some((i) => i.code === 'UNSIGNED_DRAFT_HAS_SIGNATURES'));

  const store = createDocumentOsStore();
  const svc = new DocumentOsService(store, brand);
  const doc = svc.createDocument({
    session: { userId: 'u1', userName: 'Owner', channel: 'dashboard' },
    document_type: 'contract',
    title: 'Novus Agreement',
    structured_data: {
      client_legal_name: NOVUS_CLIENT.legal_name,
      client_email: NOVUS_CLIENT.email,
      clauses: novusPowerCoherentClauses(),
      governing_law: 'South Africa',
      jurisdiction: 'Western Cape, South Africa',
    },
  });
  assert.equal(doc.status, 'draft');
  svc.transition({
    session: { userId: 'u1', channel: 'dashboard' },
    document_id: doc.document_id,
    to: 'under_review',
    action: 'submitted_for_review',
  });
  svc.transition({
    session: { userId: 'u1', channel: 'dashboard' },
    document_id: doc.document_id,
    to: 'approved',
    action: 'approved',
    requireValidation: true,
  });
  svc.transition({
    session: { userId: 'u1', channel: 'dashboard' },
    document_id: doc.document_id,
    to: 'sent',
    action: 'sent',
    requireValidation: true,
  });
  svc.transition({
    session: { userId: 'u1', channel: 'dashboard' },
    document_id: doc.document_id,
    to: 'viewed',
    action: 'viewed',
  });
  svc.transition({
    session: { userId: 'u1', channel: 'dashboard' },
    document_id: doc.document_id,
    to: 'awaiting_signature',
    action: 'signature_requested',
  });
  const signed = svc.transition({
    session: { userId: 'u1', channel: 'dashboard' },
    document_id: doc.document_id,
    to: 'signed',
    action: 'signed',
  });
  assert.notEqual(signed.status, 'draft');
  assert.equal(signed.status, 'signed');
  assert.ok(signed.signed_at);
});

test('paid Novus invoice shows zero balance with payment evidence', () => {
  const unpaid = novusDepositInvoice(false);
  const unpaidIssues = validateInvoiceFinancials(unpaid);
  assert.equal(unpaidIssues.filter((i) => i.severity === 'blocking').length, 0);

  const paid = novusDepositInvoice(true);
  assert.equal(paid.balance_due, 0);
  assert.equal(paid.payment_status, 'paid');
  assert.ok(paid.payment_transactions?.length);
  const issues = validateInvoiceFinancials(paid);
  assert.equal(issues.length, 0, JSON.stringify(issues));

  const bad = { ...paid, balance_due: 20 };
  const badIssues = validateInvoiceFinancials(bad);
  assert.ok(badIssues.some((i) => i.code === 'PAID_NONZERO_BALANCE' || i.code === 'PAID_WITH_TOTAL_DUE' || i.code === 'BALANCE_EQUATION'));
});

test('invoice milestones must match contract schedule', () => {
  const ok = assertInvoiceMilestonesMatchContract(
    [{ id: 'M1', amount: 1000 }],
    NOVUS_CONTRACT_MILESTONES
  );
  assert.equal(ok.length, 0);
  const bad = assertInvoiceMilestonesMatchContract(
    [{ id: 'M1', amount: 999 }],
    NOVUS_CONTRACT_MILESTONES
  );
  assert.ok(bad.some((i) => i.code === 'MILESTONE_AMOUNT_MISMATCH'));
});

test('receipt requires verified payment evidence', () => {
  assert.throws(() =>
    createReceiptFromPayment({
      invoice_number: 'INV-1',
      remaining_balance: 0,
      transaction: {
        transaction_id: 't1',
        amount: 100,
        currency: 'USD',
        paid_at: new Date().toISOString(),
        method: 'card',
        reference: 'r1',
        verified: false,
      },
    })
  );
  const receipt = createReceiptFromPayment({
    invoice_number: 'INV-NOVUS-0001',
    remaining_balance: 0,
    transaction: novusDepositInvoice(true).payment_transactions[0],
  });
  assert.equal(receipt.invoice_reference, 'INV-NOVUS-0001');
  assert.equal(receipt.amount_received, 1000);
  assert.ok(receipt.verification_qr_payload);
});

test('lifecycle forbids draft→signed and paid→sent', () => {
  assert.equal(canTransition('contract', 'draft', 'signed'), false);
  assert.throws(
    () => assertTransition('invoice', 'paid', 'sent'),
    (err) => err instanceof InvalidTransitionError
  );
  assert.throws(
    () => assertTransition('invoice', 'void', 'paid'),
    (err) => err instanceof InvalidTransitionError
  );
});

test('actor identity ignores model-provided spoofing', () => {
  const actor = resolveActorFromSession(
    { userId: 'real-user', userName: 'Owner', channel: 'mcp_chatgpt' },
    { actor_type: 'system', actor_id: 'evil', actor_name: 'God Mode' }
  );
  assert.equal(actor.actor_id, 'real-user');
  assert.equal(actor.actor_type, 'chatgpt');
  assert.notEqual(actor.actor_name, 'God Mode');
});

test('typed-text-only signatures are rejected', () => {
  const envelope = createSignatureEnvelope({
    document_id: 'd1',
    version_id: 'v1',
    document_checksum: 'abc',
    signers: [{ name: 'A', email: 'a@example.com', role: 'Client' }],
  });
  assert.throws(() =>
    recordSignature(envelope, {
      signer_email: 'a@example.com',
      method: 'drawn',
      signature_payload: 'short',
      typed_text_only: true,
    })
  );
});

test('AI cannot send contracts without owner approval', () => {
  const ai = resolveActorFromSession({ userId: 'u', channel: 'mcp_claude' });
  assert.throws(() => requireOwnerApprovalForSensitiveAction('send_contract', ai, false));
  requireOwnerApprovalForSensitiveAction('send_contract', ai, true);
});

test('conflicting Novus contract cannot be approved via DocumentOsService', () => {
  const store = createDocumentOsStore();
  const svc = new DocumentOsService(store, brand);
  const doc = svc.createDocument({
    session: { userId: 'u1', channel: 'dashboard' },
    document_type: 'contract',
    title: 'Novus Bad Contract',
    structured_data: {
      client_legal_name: NOVUS_CLIENT.legal_name,
      client_email: NOVUS_CLIENT.email,
      notice_email: 'other@example.com',
      governing_law: 'undefined',
      jurisdiction: 'undefined',
      clauses: novusPowerConflictingClauses(),
    },
  });
  svc.transition({
    session: { userId: 'u1', channel: 'dashboard' },
    document_id: doc.document_id,
    to: 'under_review',
    action: 'submitted_for_review',
  });
  assert.throws(() =>
    svc.transition({
      session: { userId: 'u1', channel: 'dashboard' },
      document_id: doc.document_id,
      to: 'approved',
      action: 'approved',
      requireValidation: true,
    })
  );
});

test('end-to-end lifecycle automation: lead→quote→contract→invoice→receipt', () => {
  const store = createDocumentOsStore();
  const session = { userId: 'owner-1', userName: 'Owner', channel: 'dashboard' };
  const actor = resolveActorFromSession(session);
  const result = runDocumentAutomationChain(
    { store, brand, session, actor, ownerApproved: true },
    {
      lead_id: 'lead-novus',
      client_id: '22222222-2222-4222-8222-222222222222',
      company_name: 'Novus Power (Pty) Ltd',
      client_email: 'procurement@novuspower.example',
      client_address: NOVUS_CLIENT.address,
      opportunity_id: 'opp-novus',
    },
    {
      line_items: [
        { description: 'Logo design package', quantity: 1, unit_price: 2500, amount: 2500 },
      ],
      deposit_amount: 1000,
      milestones: [
        { id: 'M1', title: 'Deposit', amount: 1000, due_date: '2026-07-04' },
        { id: 'M2', title: 'Final delivery', amount: 1500 },
      ],
      scope: 'Design a company logo and brand stationery for Novus Power.',
      governing_law: 'South Africa',
      jurisdiction: 'Western Cape, South Africa',
    }
  );

  assert.ok(result.quote.document_id);
  assert.equal(result.quote.status, 'converted_to_contract');
  assert.equal(result.contract.status, 'active');
  assert.ok(['paid', 'receipted'].includes(result.invoice.status));
  assert.equal(result.receipt.document_type, 'receipt');
  assert.ok(result.timeline.contract.length >= 5);
  assert.ok(result.related.some((d) => d.document_type === 'contract'));
  assert.ok(result.related.some((d) => d.document_type === 'invoice'));
  assert.ok(result.related.some((d) => d.document_type === 'receipt'));

  const svc = new DocumentOsService(store, brand);
  const versions = svc.listVersions(result.contract.document_id);
  assert.ok(versions.length >= 1);
  assert.equal(versions[0].is_immutable, true);
  const timeline = svc.getTimeline(result.contract.document_id);
  assert.ok(timeline.some((e) => e.action === 'document_created'));
  assert.ok(timeline.some((e) => e.action === 'approved'));
  assert.ok(timeline.some((e) => e.action === 'signed'));
  assert.ok(timeline.every((e) => e.actor?.actor_id));
});

test('optimistic concurrency rejects stale version updates', () => {
  const store = createDocumentOsStore();
  const svc = new DocumentOsService(store, brand);
  const doc = svc.createDocument({
    session: { userId: 'u1', channel: 'dashboard' },
    document_type: 'quote',
    title: 'Q',
    structured_data: { client_legal_name: 'X', line_items: [] },
  });
  assert.throws(() =>
    svc.updateDocument({
      session: { userId: 'u1', channel: 'dashboard' },
      document_id: doc.document_id,
      structured_data: { client_legal_name: 'Y' },
      meta: { expected_current_version: 99 },
    })
  );
});

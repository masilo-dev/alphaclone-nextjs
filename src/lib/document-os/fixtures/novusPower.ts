/**
 * Novus Power regression fixtures.
 * Encodes the contradictory originality clauses that must be blocked.
 */

import { makeClause } from '../engines/contractEngine';
import type { ContractClause, DocumentBrandProfile, InvoiceStructuredData, PaymentTransaction } from '../types';
import { emptyBrandProfile } from '../brandProfile';

export const NOVUS_TENANT_ID = '11111111-1111-4111-8111-111111111111';
export const NOVUS_CLIENT_ID = '22222222-2222-4222-8222-222222222222';

export function alphacloneBrandProfile(): DocumentBrandProfile {
  return {
    ...emptyBrandProfile(NOVUS_TENANT_ID),
    legal_business_name: 'Alphaclone Systems (Pty) Ltd',
    trading_name: 'Alphaclone',
    registration_number: '2020/123456/07',
    tax_vat_number: '4123456789',
    physical_address: '1 Innovation Drive, Cape Town, 8001, South Africa',
    postal_address: 'PO Box 100, Cape Town, 8000',
    business_email: 'contracts@alphaclone.com',
    telephone: '+27 21 555 0100',
    website: 'https://alphaclone.com',
    default_currency: 'USD',
    country: 'ZA',
    jurisdiction: 'Western Cape, South Africa',
    primary_logo_url: 'https://cdn.alphaclone.com/brand/alphaclone-logo.svg',
    monochrome_logo_url: 'https://cdn.alphaclone.com/brand/alphaclone-logo-mono.svg',
    primary_colour: '#0f172a',
    secondary_colour: '#334155',
    accent_colour: '#0f766e',
    heading_font: '"Source Serif 4", Georgia, serif',
    body_font: '"IBM Plex Sans", Helvetica, Arial, sans-serif',
    logo_placement: 'left',
    authorized_signatories: [
      {
        id: 'sig-1',
        name: 'Bonnie Operator',
        title: 'Director',
        email: 'contracts@alphaclone.com',
        is_default: true,
      },
    ],
    bank_details: {
      bank_name: 'Example Bank',
      account_name: 'Alphaclone Systems (Pty) Ltd',
      account_number: '1234567890',
      swift_bic: 'EXAMPZAJ',
    },
    payment_instructions: 'Pay by EFT referencing the invoice number.',
    legal_footer: 'Alphaclone Systems (Pty) Ltd · Confidential',
    page_size: 'A4',
  };
}

export const NOVUS_CLIENT = {
  legal_name: 'Novus Power (Pty) Ltd',
  email: 'procurement@novuspower.example',
  address: '88 Energy Park, Johannesburg, 2196',
  tax_id: 'NP-998877',
};

/** Conflicting originality clauses — must fail validation. */
export function novusPowerConflictingClauses(): ContractClause[] {
  return [
    makeClause(
      'parties',
      'Parties',
      `This Agreement is between Alphaclone Systems (Pty) Ltd and Novus Power (Pty) Ltd (procurement@novuspower.example).`,
      1
    ),
    makeClause(
      'scope',
      'Scope',
      'Alphaclone will design brand assets for Novus Power including a company logo and related stationery.',
      2
    ),
    makeClause(
      'intellectual_property',
      'Intellectual Property — Originality Promise',
      'Alphaclone shall create an original logo for Novus Power. The logo will be a wholly original custom design.',
      3
    ),
    makeClause(
      'deliverables',
      'Deliverables — Copy Admission',
      'Alphaclone agreed to copy the logo provided by Novus Power’s reference materials and reproduce the existing logo artwork.',
      4
    ),
    makeClause(
      'warranties',
      'Warranties — Originality Disclaimer',
      'Alphaclone provides no warranty of originality with respect to the logo or design deliverables and disclaims originality.',
      5
    ),
    makeClause(
      'indemnification',
      'Indemnification',
      'Client shall indemnify Alphaclone against claims arising because the logo was copied from third-party designs.',
      6
    ),
    makeClause(
      'governing_law',
      'Governing Law',
      'This Agreement is governed by the laws of undefined. Jurisdiction remains undefined.',
      7
    ),
    makeClause(
      'payment_terms',
      'Payment Terms',
      'Deposit 40% on signature; balance on delivery. Currency USD.',
      8
    ),
  ];
}

/** Corrected coherent clauses — must pass originality checks. */
export function novusPowerCoherentClauses(): ContractClause[] {
  return [
    makeClause(
      'parties',
      'Parties',
      `This Agreement is between Alphaclone Systems (Pty) Ltd of 1 Innovation Drive, Cape Town, 8001, South Africa (contracts@alphaclone.com) and Novus Power (Pty) Ltd of 88 Energy Park, Johannesburg, 2196 (procurement@novuspower.example).`,
      1
    ),
    makeClause(
      'scope',
      'Scope',
      'Alphaclone will design a new company logo and brand stationery for Novus Power within the agreed revision limits.',
      2
    ),
    makeClause(
      'deliverables',
      'Deliverables',
      '1. Primary logo (SVG + PNG)\n2. Monochrome logo\n3. Favicon\n4. Letterhead template',
      3
    ),
    makeClause(
      'revisions',
      'Revisions',
      'The Client is entitled to up to 2 revision rounds within the agreed scope.',
      4
    ),
    makeClause(
      'fees',
      'Fees',
      'Logo design package: USD 2500.00',
      5
    ),
    makeClause(
      'deposits',
      'Deposit',
      'A deposit of USD 1000.00 is due on signature.',
      6
    ),
    makeClause(
      'milestones',
      'Milestones',
      'M1: Deposit — 1000.00 (due on signature)\nM2: Final delivery — 1500.00 (due on acceptance)',
      7
    ),
    makeClause(
      'intellectual_property',
      'Intellectual Property',
      'Upon full payment, Client receives ownership of the final logo files created under this Agreement. Alphaclone retains ownership of pre-existing tools, frameworks, and unused concepts. Alphaclone warrants that deliverables created by Alphaclone do not knowingly infringe third-party rights.',
      8
    ),
    makeClause(
      'confidentiality',
      'Confidentiality',
      'Each party shall keep confidential information private for 3 years.',
      9
    ),
    makeClause(
      'warranties',
      'Warranties',
      'Services will be performed with reasonable skill and care.',
      10
    ),
    makeClause(
      'liability',
      'Limitation of Liability',
      'Liability is limited to fees paid under this Agreement in the prior 12 months.',
      11
    ),
    makeClause(
      'termination',
      'Termination',
      'Either party may terminate for material breach uncured within 14 days of notice.',
      12
    ),
    makeClause(
      'dispute_resolution',
      'Dispute Resolution',
      'Disputes shall first be negotiated in good faith, then referred to mediation.',
      13
    ),
    makeClause(
      'governing_law',
      'Governing Law',
      'This Agreement is governed by the laws of South Africa. The courts of the Western Cape, South Africa have exclusive jurisdiction.',
      14
    ),
    makeClause(
      'notices',
      'Notices',
      'Notices to Client: procurement@novuspower.example. Notices to Supplier: contracts@alphaclone.com.',
      15
    ),
    makeClause(
      'signatures',
      'Signatures',
      'By signing, each party confirms authority to bind the named legal entity.',
      16
    ),
  ];
}

export const NOVUS_CONTRACT_MILESTONES = [
  { id: 'M1', title: 'Deposit', amount: 1000 },
  { id: 'M2', title: 'Final delivery', amount: 1500 },
];

export function novusDepositInvoice(paid = false): InvoiceStructuredData {
  const tx: PaymentTransaction = {
    transaction_id: 'txn_novus_deposit_1',
    amount: 1000,
    currency: 'USD',
    paid_at: '2026-07-01T10:00:00.000Z',
    method: 'eft',
    provider: 'bank',
    reference: 'NP-DEP-1000',
    payer_name: 'Novus Power (Pty) Ltd',
    verified: true,
  };

  return {
    supplier: alphacloneBrandProfile(),
    client: NOVUS_CLIENT,
    invoice_number: 'INV-NOVUS-0001',
    issue_date: '2026-06-20',
    due_date: '2026-07-04',
    currency: 'USD',
    line_items: [
      {
        description: 'Deposit — Logo design package (M1)',
        quantity: 1,
        unit_price: 1000,
        amount: 1000,
      },
    ],
    subtotal: 1000,
    tax: 0,
    discount: 0,
    total: 1000,
    amount_paid: paid ? 1000 : 0,
    balance_due: paid ? 0 : 1000,
    payment_terms: 'Due on signature / Net 14',
    payment_method: paid ? 'eft' : undefined,
    bank_details: alphacloneBrandProfile().bank_details,
    related_contract_id: 'novus-contract-fixture',
    payment_transactions: paid ? [tx] : [],
    payment_status: paid ? 'paid' : 'sent',
  };
}

export function novusInconsistentEmails(): string[] {
  return ['procurement@novuspower.example', 'accounts@novus-power.example'];
}

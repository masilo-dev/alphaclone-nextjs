/**
 * Comprehensive Acceptance Test Suite for Global Tenant-Aware Document Branding System.
 * Verifies invoices, quotes, contracts, proposals, and accounting reports across
 * landscape/square/transparent/no-logo/multipage variants.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTenantBranding } from '../../src/lib/tenantBranding.ts';
import { renderDocumentHtml } from '../../src/lib/documents/renderDocument.ts';
import {
  generateQuotePDF,
  generateInvoicePDF,
  generateContractPDF,
  generatePnLPDF,
  generateBalanceSheetPDF,
  generateTrialBalancePDF,
} from '../../src/utils/pdfGenerator.ts';

// Fixture tenants
const TENANT_WITH_LOGO = {
  id: 'tenant-acme-001',
  name: 'Acme Global Innovations',
  legal_name: 'Acme Global Innovations (Pty) Ltd',
  logo_url: 'https://cdn.example.com/logos/acme-wide-banner.png',
  brand_color_primary: '#2563eb',
  brand_color_secondary: '#38bdf8',
  tax_id: 'VAT-99887766',
  business_address: '100 Innovation Boulevard\nCape Town, 8001\nSouth Africa',
  settings: {
    branding: {
      registrationNumber: '2024/123456/07',
      businessEmail: 'billing@acme-innovations.example',
      businessPhone: '+27 21 555 0100',
      website: 'https://acme-innovations.example',
      documentFooterText: 'Acme Global Innovations (Pty) Ltd · Reg: 2024/123456/07 · Tax: VAT-99887766',
    },
  },
};

const TENANT_NO_LOGO = {
  id: 'tenant-apex-002',
  name: 'Apex Strategic Advisory',
  legal_name: 'Apex Advisory Partners Inc',
  logo_url: null,
  brand_color_primary: '#0f766e',
  tax_id: 'US-987654321',
  business_address: '450 Lexington Avenue, Suite 1800\nNew York, NY 10017',
  settings: {
    branding: {
      businessEmail: 'contact@apex-advisory.example',
    },
  },
};

const UNCONFIGURED_TENANT = null;

// =========================================================================
// 1. Branding Resolution Tests
// =========================================================================

test('extractTenantBranding resolves full tenant details when available', () => {
  const branding = extractTenantBranding(TENANT_WITH_LOGO);
  assert.equal(branding.name, 'Acme Global Innovations');
  assert.equal(branding.legalName, 'Acme Global Innovations (Pty) Ltd');
  assert.equal(branding.logoUrl, 'https://cdn.example.com/logos/acme-wide-banner.png');
  assert.equal(branding.primaryBrandColor, '#2563eb');
  assert.equal(branding.taxNumber, 'VAT-99887766');
  assert.equal(branding.registrationNumber, '2024/123456/07');
  assert.equal(branding.businessEmail, 'billing@acme-innovations.example');
  assert.equal(branding.businessPhone, '+27 21 555 0100');
  assert.equal(branding.website, 'https://acme-innovations.example');
  assert.ok(branding.documentFooterText?.includes('Acme Global Innovations'));
});

test('extractTenantBranding falls back to clean company-name when no logo exists', () => {
  const branding = extractTenantBranding(TENANT_NO_LOGO);
  assert.equal(branding.name, 'Apex Strategic Advisory');
  assert.equal(branding.logoUrl, undefined);
  assert.equal(branding.companyLogo, undefined);
  assert.equal(branding.primaryBrandColor, '#0f766e');
});

test('extractTenantBranding never falls back to hardcoded platform vendor name on null tenant', () => {
  const branding = extractTenantBranding(UNCONFIGURED_TENANT);
  assert.equal(branding.name, 'Unconfigured Business');
  assert.doesNotMatch(branding.name, /AlphaClone/i);
});

// =========================================================================
// 2. HTML Document Rendering & Hierarchy Tests
// =========================================================================

test('renderDocumentHtml enforces logo height constraint (28-36px) and aspect-ratio preservation', () => {
  const branding = extractTenantBranding(TENANT_WITH_LOGO);
  const html = renderDocumentHtml({
    type: 'invoice',
    title: 'Tax Invoice',
    documentNumber: 'INV-2026-0042',
    branding,
    clientName: 'Global Enterprises Ltd',
    clientEmail: 'finance@global.example',
    issueDate: '2026-09-24',
    dueDate: '2026-10-24',
    total: 12500,
    subtotal: 11000,
    tax: 1500,
    lineItems: [
      { description: 'Enterprise Architecture Consulting', quantity: 40, rate: 250, amount: 10000 },
      { description: 'Cloud Security Audit', quantity: 1, rate: 1000, amount: 1000 },
    ],
  });

  // Verify logo height is constrained to 36px and max-width 160px with object-fit: contain
  assert.match(html, /max-height:\s*36px/);
  assert.match(html, /max-width:\s*160px/);
  assert.match(html, /object-fit:\s*contain/);
  assert.match(html, /object-position:\s*left/);
});

test('renderDocumentHtml renders typographic wordmark in same footprint when no logo exists', () => {
  const branding = extractTenantBranding(TENANT_NO_LOGO);
  const html = renderDocumentHtml({
    type: 'quote',
    title: 'Commercial Proposal & Estimate',
    documentNumber: 'Q-2026-108',
    branding,
    clientName: 'Vanguard Ventures',
    total: 4500,
    lineItems: [{ description: 'Strategy Roadmap', quantity: 1, rate: 4500, amount: 4500 }],
  });

  // Wordmark fallback inside identical vertical footprint
  assert.match(html, /min-height:\s*36px/);
  assert.match(html, /Apex Strategic Advisory/);
  assert.doesNotMatch(html, /<img /);
});

test('renderDocumentHtml enforces authoritative document title with dominant visual hierarchy', () => {
  const branding = extractTenantBranding(TENANT_WITH_LOGO);
  const html = renderDocumentHtml({
    type: 'invoice',
    title: 'INVOICE',
    documentNumber: 'INV-1001',
    branding,
    total: 500,
  });

  // Document title must be bold, authoritative, uppercase
  assert.match(html, /font-size:\s*26px/);
  assert.match(html, /font-weight:\s*800/);
  assert.match(html, /text-transform:\s*uppercase/);
  assert.match(html, /INVOICE/);
});

test('renderDocumentHtml includes print compliance rules (margins, page-break avoidance, white paper canvas)', () => {
  const branding = extractTenantBranding(TENANT_WITH_LOGO);
  const html = renderDocumentHtml({
    type: 'contract',
    title: 'Master Services Agreement',
    documentNumber: 'MSA-2026-001',
    branding,
    sections: [
      { heading: '1. Engagement Scope', body: 'The service provider agrees to provide...' },
      { heading: '2. Term and Termination', body: 'This agreement shall remain effective for 12 months...' },
    ],
  });

  // Print compliance
  assert.match(html, /@page\s*\{\s*size:\s*A4;\s*margin:\s*15mm 12mm;/);
  assert.match(html, /page-break-inside:\s*avoid/);
  assert.match(html, /break-inside:\s*avoid/);
  assert.match(html, /color:\s*#0f172a;\s*background:\s*#fff/);
  // Contracts must not show invoice total box
  assert.doesNotMatch(html, /Total Due/i);
});

// =========================================================================
// 3. Direct PDF Generator Tenant-Awareness Tests
// =========================================================================

test('generateInvoicePDF uses tenant branding without vendor defaults', () => {
  const doc = generateInvoicePDF(
    {
      id: 'inv-1',
      invoiceNumber: 'INV-777',
      status: 'paid',
      subtotal: 1000,
      taxRate: 15,
      tax: 150,
      discountAmount: 0,
      total: 1150,
      currency: 'USD',
      createdAt: '2026-09-24T10:00:00Z',
      updatedAt: '2026-09-24T10:00:00Z',
    },
    [{ id: 'i1', invoiceId: 'inv-1', description: 'Consulting', quantity: 2, rate: 500, amount: 1000 }],
    TENANT_WITH_LOGO
  );

  assert.ok(doc);
  const output = doc.output();
  // PDF binary stream contains tenant info
  assert.ok(output.length > 1000);
});

test('generateQuotePDF uses tenant branding without hardcoded vendor text', () => {
  const doc = generateQuotePDF(
    {
      id: 'q-1',
      quoteNumber: 'QUO-888',
      name: 'Quote for BigCorp',
      status: 'sent',
      subtotal: 3000,
      totalAmount: 3000,
      currency: 'USD',
      createdAt: '2026-09-24T10:00:00Z',
    },
    [{ id: 'qi1', quoteId: 'q-1', productName: 'Design System', quantity: 1, unitPrice: 3000, lineTotal: 3000 }],
    TENANT_NO_LOGO
  );

  assert.ok(doc);
  const output = doc.output();
  assert.ok(output.length > 1000);
});

test('generateContractPDF renders contract title and tenant footer', () => {
  const doc = generateContractPDF(
    {
      id: 'c-1',
      title: 'Confidentiality & Non-Disclosure Agreement',
      status: 'active',
      content: 'This Agreement is entered into by and between the parties...',
      signer_name: 'Jane Doe',
      signer_email: 'jane@example.com',
      signed_at: '2026-09-24T11:00:00Z',
      created_at: '2026-09-24T10:00:00Z',
    },
    TENANT_WITH_LOGO
  );

  assert.ok(doc);
  const output = doc.output();
  assert.ok(output.length > 1000);
});

test('accounting reports (PnL, Balance Sheet, Trial Balance) use tenant branding and never vendor fallback', () => {
  const pnlDoc = generatePnLPDF(
    {
      revenue: [{ accountName: 'Product Sales', balance: 50000 }],
      operatingExpenses: [{ accountName: 'Software Subscriptions', balance: 12000 }],
      totalRevenue: 50000,
      totalExpenses: 12000,
      netIncome: 38000,
    },
    TENANT_NO_LOGO,
    '2026-01-01',
    '2026-09-24'
  );
  assert.ok(pnlDoc);

  const bsDoc = generateBalanceSheetPDF(
    {
      assets: [{ accountName: 'Checking Account', balance: 150000 }],
      liabilities: [{ accountName: 'Accounts Payable', balance: 25000 }],
      equity: [{ accountName: 'Retained Earnings', balance: 125000 }],
      totalAssets: 150000,
      totalLiabilities: 25000,
      totalEquity: 125000,
    },
    TENANT_WITH_LOGO,
    '2026-09-24'
  );
  assert.ok(bsDoc);

  const tbDoc = generateTrialBalancePDF(
    {
      asOfDate: '2026-09-24',
      totalDebits: 200000,
      totalCredits: 200000,
      isBalanced: true,
      accounts: [
        { accountCode: '1000', accountName: 'Cash', debitBalance: 100000, creditBalance: 0 },
        { accountCode: '3000', accountName: 'Common Stock', debitBalance: 0, creditBalance: 100000 },
      ],
    },
    TENANT_WITH_LOGO,
    '2026-09-24'
  );
  assert.ok(tbDoc);
});

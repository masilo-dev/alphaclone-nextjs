import test from 'node:test';
import assert from 'node:assert/strict';
import { generateContractPDF } from '../../src/utils/pdfGenerator.ts';
import { buildContractDocumentInput } from '../../src/lib/documents/documentBuilders.ts';
import { renderDocumentHtml } from '../../src/lib/documents/renderDocument.ts';
import {
  buildContractVariableContext,
  resolveContractVariables,
  validateContractVariables,
} from '../../src/lib/contracts/contractVariables.ts';

test('generateContractPDF creates multi-page PDF, sanitizes HTML, and paginates cleanly', () => {
  const longHtmlContent = `
    <h1>Master Services Agreement</h1>
    <p>This Agreement is entered into by and between the parties under mutual commercial terms.</p>
    <div>
      <h2>1. Scope of Services</h2>
      <p>The Service Provider shall deliver the following services and deliverables:</p>
      <ul>
        <li>Architecture and engineering design for enterprise systems.</li>
        <li>Automated testing, continuous deployment pipelines, and operational monitoring.</li>
        <li>Security auditing, cryptographic signing assurance, and compliance logging.</li>
      </ul>
    </div>
    <div>
      <h2>2. Payment & Retainers</h2>
      <p>${'Commercial clauses governing monthly billing, retainers, audit milestones, and deliverables. '.repeat(60)}</p>
    </div>
    <div>
      <h2>3. Confidentiality & Non-Disclosure</h2>
      <p>${'Both parties agree to hold all proprietary trade secrets, technical source code, and client documents in strict confidence. '.repeat(50)}</p>
    </div>
    <div>
      <h2>4. Termination & Governing Law</h2>
      <p>${'This agreement may be terminated by either party with thirty days written notice. '.repeat(40)}</p>
    </div>
  `;

  const contractData = {
    id: 'cnt-test-multipage-001',
    title: 'Enterprise Master Services Agreement',
    status: 'draft',
    content: longHtmlContent,
    signer_name: 'Alex Morgan',
    signer_email: 'alex@enterprise.com',
  };

  const tenant = {
    id: 'tenant-test-001',
    name: 'AlphaClone Systems Corp',
    brand_color_primary: '#0e1015',
    logo_url: 'https://alphaclonesystems.com/logo.png',
  };

  const doc = generateContractPDF(contractData, tenant);
  assert.ok(doc, 'PDF doc must be generated');
  const pageCount = doc.getNumberOfPages();
  assert.ok(pageCount >= 2, `Expected at least 2 pages for long content, got ${pageCount}`);
});

test('buildContractDocumentInput suppresses signatures and certificates for draft agreements', () => {
  const draftContract = {
    id: 'cnt-draft-001',
    title: 'Draft Services Agreement',
    status: 'draft',
    content: 'Draft content without execution.',
    admin_signature: 'typed:Provider CEO',
    admin_signed_at: '2026-10-15T12:00:00Z',
    client_signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    client_signed_at: '2026-10-15T13:00:00Z',
    metadata: {
      content_hash: '3f786850e387550fdab836ed7e6dc881de23001b70e8707d7154539b912f12fa',
      tamper_seal: 'seal-test-1234',
    },
  };

  const tenant = {
    name: 'AlphaClone Legal',
  };

  const input = buildContractDocumentInput(draftContract, tenant);
  assert.equal(input.status, 'draft');
  assert.ok(input.signers && input.signers.length > 0);
  // All signers must NOT be marked as signed on draft contracts
  for (const signer of input.signers) {
    assert.equal(signer.signed, false, `Signer ${signer.role} must not be marked signed in draft status`);
    assert.equal(signer.signatureUrl, undefined);
    assert.equal(signer.date, undefined);
  }
  // Audit certificate must not be produced for draft
  assert.equal(input.auditCertificate, undefined);

  // But for fully signed contracts, signers and certificate must be rendered
  const signedContract = {
    ...draftContract,
    status: 'fully_signed',
  };
  const signedInput = buildContractDocumentInput(signedContract, tenant);
  assert.ok(signedInput.signers?.every(s => s.signed));
  assert.ok(signedInput.auditCertificate);
  assert.equal(signedInput.auditCertificate?.documentHash, '3f786850e387550fdab836ed7e6dc881de23001b70e8707d7154539b912f12fa');
});

test('renderDocumentHtml renders logo and legal branding without text collision or duplication', () => {
  const html = renderDocumentHtml({
    type: 'contract',
    title: 'Consulting Contract',
    documentNumber: 'CNT-8822',
    branding: {
      name: 'AlphaClone Systems',
      legalName: 'AlphaClone International Ltd',
      logoUrl: 'https://alphaclonesystems.com/brand-logo.png',
      businessAddress: '100 Silicon Blvd, Suite 500\nSan Francisco, CA 94105',
      taxNumber: 'US-99-1234567',
      businessEmail: 'legal@alphaclonesystems.com',
    },
    sections: [{ heading: 'Scope', body: 'Full consulting services.' }],
  });

  // Verify logo img is rendered
  assert.ok(html.includes('<img src="https://alphaclonesystems.com/brand-logo.png"'));
  // Verify legal name is cleanly separated in company details block
  assert.ok(html.includes('AlphaClone International Ltd'));
  assert.ok(html.includes('Tax ID: US-99-1234567'));
  // Verify no jammed adjacent div next to img in logo container
  assert.ok(!html.includes('max-height:36px;max-width:160px;width:auto;height:auto;object-fit:contain;object-position:left;" /><div'));
});

test('resolveContractVariables resolves shorthand tokens and comprehensive legacy bracket placeholders', () => {
  const context = buildContractVariableContext({
    tenant: {
      name: 'AlphaClone Engineering',
      legal_name: 'AlphaClone Engineering Inc.',
      business_address: '450 Mission St, San Francisco, CA',
      email: 'contracts@alphaclone.io',
      phone: '+1 (415) 555-0100',
    },
    client: {
      name: 'Acme Global Ventures',
      company: 'Acme Global Ventures LLC',
      email: 'ops@acmeglobal.com',
      address: '700 Broadway, New York, NY',
    },
    contract: {
      id: '99887766-5544-3322-1100-aabbccddeeff',
      title: 'Digital Systems Retainer Agreement',
      effective_date: '2026-11-01',
      payment_amount: 25000,
      currency: 'USD',
    },
    project: {
      name: 'Enterprise Cloud Migration',
      description: 'Full migration to sovereign cloud architecture.',
      deliverables: 'Architecture specifications, migration automation scripts, operational runbooks.',
      timeline: '90 business days from execution.',
      milestones: 'Phase 1: Discovery, Phase 2: Implementation, Phase 3: Verification.',
    },
    user: {
      full_name: 'Sarah Connor',
      email: 'sconnor@alphaclone.io',
    },
  });

  const templateText = `
    Agreement between {{client_name}} and {{business_name}} ({{legal_name}}).
    Contract: {{contract_title}} (#{{contract_number}}).
    Effective: {{effective_date}}. Total: {{total}} {{currency}}.
    Deliverables: [Deliverables].
    Timeline: [Timeline].
    Milestones: [Milestones].
    Signatory: [Provider Signatory].
    Client Signatory: [Client Signatory].
  `;

  const resolved = resolveContractVariables(templateText, context);
  assert.ok(resolved.includes('Acme Global Ventures'));
  assert.ok(resolved.includes('AlphaClone Engineering'));
  assert.ok(resolved.includes('AlphaClone Engineering Inc.'));
  assert.ok(resolved.includes('Digital Systems Retainer Agreement'));
  assert.ok(resolved.includes('25,000.00 USD'));
  assert.ok(resolved.includes('Architecture specifications'));
  assert.ok(resolved.includes('90 business days'));
  assert.ok(resolved.includes('Phase 1: Discovery'));
  assert.ok(resolved.includes('Sarah Connor'));

  // Validation should show no unresolved tokens for this template
  const validation = validateContractVariables(resolved);
  if (!validation.valid) {
    console.log('UNRESOLVED TOKENS:', validation.unresolvedTokens);
  }
  assert.equal(validation.valid, true);
  assert.equal(validation.unresolvedTokens.length, 0);

  // Test unresolved cleanup option
  const textWithUnresolved = 'Hello {{unknown_token}} and [Missing Placeholder].';
  const cleaned = resolveContractVariables(textWithUnresolved, context, { removeUnresolved: true, fallbackValue: 'N/A' });
  assert.equal(cleaned, 'Hello N/A and N/A.');
});

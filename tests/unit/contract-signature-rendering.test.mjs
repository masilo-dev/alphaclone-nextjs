import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContractDocumentInput,
  parseContractContentToSections,
} from '../../src/lib/documents/documentBuilders.ts';
import {
  renderDocumentHtml,
} from '../../src/lib/documents/renderDocument.ts';

test('parseContractContentToSections breaks markdown headers into formal sections', () => {
  const markdown = `# Introduction
This is the intro.

## 1. Scope of Work
Deliverables and scope details.

## 2. Payment Terms
Payment milestones.`;

  const sections = parseContractContentToSections(markdown);
  assert.ok(sections.length >= 2);
  assert.ok(sections.some((s) => s.heading.includes('Scope of Work')));
  assert.ok(sections.some((s) => s.heading.includes('Payment Terms')));
});

test('buildContractDocumentInput extracts signers and audit certificate', () => {
  const contract = {
    id: 'cnt-12345678-90ab',
    title: 'Consulting Agreement',
    content: '## 1. Terms\nAgreed terms.',
    payment_amount: 15000,
    client_name: 'Jane Doe',
    client_email: 'jane@client.com',
    client_signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    client_signed_at: '2026-09-15T14:30:00.000Z',
    admin_signature: 'typed:John Provider',
    admin_signed_at: '2026-09-15T15:00:00.000Z',
    metadata: {
      content_hash: '3f786850e387550fdab836ed7e6dc881de23001b70e8707d7154539b912f12fa',
      tamper_seal: 'seal-998877665544332211',
    },
  };

  const tenant = {
    name: 'TechConsult Inc',
    logo_url: 'https://example.com/logo.png',
  };

  const input = buildContractDocumentInput(contract, tenant);

  assert.equal(input.type, 'contract');
  assert.equal(input.title, 'Consulting Agreement');
  assert.ok(input.signers && input.signers.length === 2);

  const providerSigner = input.signers.find((s) => s.role === 'Service Provider');
  assert.ok(providerSigner);
  assert.equal(providerSigner.signed, true);
  assert.equal(providerSigner.signatureUrl, 'typed:John Provider');

  const clientSigner = input.signers.find((s) => s.role === 'Client');
  assert.ok(clientSigner);
  assert.equal(clientSigner.signed, true);
  assert.ok(clientSigner.signatureUrl?.startsWith('data:image'));

  assert.ok(input.auditCertificate);
  assert.equal(input.auditCertificate.documentHash, '3f786850e387550fdab836ed7e6dc881de23001b70e8707d7154539b912f12fa');
  assert.equal(input.auditCertificate.tamperSeal, 'seal-998877665544332211');
});

test('renderDocumentHtml outputs authentic signature blocks and cryptographic audit certificate', () => {
  const html = renderDocumentHtml({
    type: 'contract',
    title: 'Master Service Agreement',
    documentNumber: 'CNT-990011',
    clientName: 'Jane Doe',
    clientEmail: 'jane@client.com',
    sections: [
      { heading: '1. Services', body: 'Full technical consulting.' },
    ],
    signers: [
      {
        role: 'Service Provider',
        name: 'John Apex',
        title: 'CEO',
        signed: true,
        signatureUrl: 'typed:John Apex',
        date: '9/15/2026',
      },
      {
        role: 'Client',
        name: 'Jane Doe',
        title: 'Managing Director',
        signed: true,
        signatureUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        date: '9/15/2026',
      },
    ],
    auditCertificate: {
      documentHash: 'sha256-abc123def456',
      tamperSeal: 'seal-secure-789',
      completedAt: 'September 15, 2026',
    },
  });

  // Verify signature block exists and is protected from page break
  assert.ok(html.includes('class="signature-block"'));
  assert.ok(html.includes('Execution & Signatures'));
  assert.ok(html.includes('Electronic Signature'));

  // Verify typed signature font rendering
  assert.ok(html.includes('John Apex'));
  assert.ok(html.includes("font-family:'Brush Script MT'"));

  // Verify drawn signature image rendering
  assert.ok(html.includes('<img src="data:image/png;base64,'));
  assert.ok(html.includes('Jane Doe'));

  // Verify cryptographic audit certificate
  assert.ok(html.includes('Cryptographic Audit Certificate'));
  assert.ok(html.includes('sha256-abc123def456'));
  assert.ok(html.includes('seal-secure-789'));
  assert.ok(html.includes('Tamper-Sealed Verification'));
});

test('renderDocumentHtml shows awaiting signature placeholder when signer has not yet signed', () => {
  const html = renderDocumentHtml({
    type: 'contract',
    title: 'Simple Agreement',
    sections: [{ heading: 'Terms', body: 'Standard agreement terms.' }],
    signers: [
      {
        role: 'Client',
        name: 'Pending Client',
        signed: false,
      },
    ],
  });

  assert.ok(html.includes('Awaiting signature'));
  assert.ok(html.includes('Pending Client'));
  assert.ok(html.includes('Pending'));
});

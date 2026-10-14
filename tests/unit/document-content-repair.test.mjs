import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { documentContentToHtml, normalizeDocumentHtml } from '../../src/lib/documents/documentContent.ts';
import { buildContractDocumentInput, buildInvoiceDocumentInput } from '../../src/lib/documents/documentBuilders.ts';
import { renderDocumentHtml } from '../../src/lib/documents/renderDocument.ts';
import { assessContractContentQuality } from '../../src/lib/documents/contractContentQuality.ts';
import { detectBlankPlaceholders } from '../../src/lib/document-os/validators/legalConsistency.ts';

test('legacy malformed headings normalize without changing amounts or clause text', () => {
  const source = '<h1>Agreement</h1></p><p style="text-align:justify"><h2>Fees</h2></p><p style="word-spacing:40px">USD 1 and USD 0.50</p>';
  const html = normalizeDocumentHtml(source);
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.querySelectorAll('p h2').length, 0);
  assert.equal(doc.querySelector('h2').textContent, 'Fees');
  assert.match(doc.body.textContent, /USD 1 and USD 0.50/);
  assert.doesNotMatch(html, /justify|word-spacing/);
});

test('markdown creates semantic headings, lists and escaped text', () => {
  const doc = new JSDOM(documentContentToHtml('# Agreement\n\nTerms & conditions\n\n- First\n- Second\n\n## Fees\nUSD 1')).window.document;
  assert.equal(doc.querySelectorAll('ul li').length, 2);
  assert.equal(doc.querySelectorAll('p h1, p h2').length, 0);
  assert.match(doc.body.textContent, /Terms & conditions/);
});

test('unsafe source code is removed while signature images and legal tables survive', () => {
  const html = normalizeDocumentHtml('<script>alert(1)</script><p onclick="bad()">Terms</p><img src="data:image/png;base64,AAAA" alt="Signature"><table><tr><td colspan="2">Clause</td></tr></table>');
  assert.doesNotMatch(html, /script|onclick|alert/);
  assert.match(html, /data:image\/png;base64,AAAA/);
  assert.match(html, /colspan="2"/);
});

test('clauses after a signature heading and embedded evidence are never truncated', () => {
  const input = buildContractDocumentInput({ content: '<h2>Signatures</h2><img src="data:image/png;base64,AAAA"><h2>Schedule A</h2><p>Binding final clause</p>' }, { name: 'Acme' });
  const html = renderDocumentHtml(input);
  assert.match(html, /Binding final clause/);
  assert.match(html, /data:image\/png;base64,AAAA/);
});

test('provider record evidence is recognized and decorative signatures do not sign clients', () => {
  const input = buildContractDocumentInput({ content: '<p>Signed by Client</p>', admin_signature: 'typed:Owner', admin_signed_at: '2026-10-01T12:00:00Z', contract_parties: [{ signer_role: 'provider', signature_status: 'pending', party_snapshot: { name: 'Owner' } }, { signer_role: 'client', signature_status: 'pending', party_snapshot: { name: 'Client' } }] }, { name: 'Acme' });
  assert.equal(input.signers[0].signed, true);
  assert.equal(input.signers[0].date, '2026-10-01T12:00:00.000Z');
  assert.equal(input.signers[1].signed, false);
});

test('branding remains tenant scoped and configured logos take precedence', () => {
  for (const name of ['Acme', 'Apex']) {
    const input = buildContractDocumentInput({ content: 'Terms' }, { name: 'Generated Organization', logo_url: '/old.png', business_settings: { business_name: name, logo_url: '/configured.png' } });
    assert.equal(input.branding.name, name);
    assert.equal(input.branding.logoUrl, '/configured.png');
    assert.doesNotMatch(renderDocumentHtml(input), /Generated Organization/);
  }
});

test('zero invoice total is preserved rather than replaced by subtotal', () => {
  assert.equal(buildInvoiceDocumentInput({ subtotal: 100, total: 0 }, [], { name: 'Acme' }).total, 0);
});

test('unresolved variables fail content quality validation before issuing', () => {
  const content = 'Payment terms and governing law apply. '.repeat(20) + '{{client.name}}';
  assert.equal(assessContractContentQuality(content).ok, false);
});

test('generated organization labels are flagged rather than presented as legal issuer names', () => {
  const input = buildContractDocumentInput({ content: 'Terms' }, { name: "PERSON's Organization" });
  assert.equal(input.branding.name, 'Unconfigured Business');
  assert.ok(input.branding.configurationIssues.length > 0);
});

test('legacy empty signature lines do not bypass validation of blank payment terms', () => {
  const clause = { clause_id: '1', clause_key: 'signature', title: 'Execution', body: 'Signature: ______________________', version: '1.0', order: 1, required: false };
  assert.equal(detectBlankPlaceholders([clause]).length, 0);
  assert.equal(detectBlankPlaceholders([{ ...clause, body: 'Signature: _____\nAmount: _____' }]).length, 1);
});
test('canonical client-only parties do not hide the already adopted provider signature', () => {
  const input=buildContractDocumentInput({content:'Terms',admin_signature:'typed:Existing Provider',admin_signed_at:'2026-10-01T12:00:00Z',contract_parties:[{role:'client',signature_status:'requested',party_snapshot:{name:'Client',email:'client@example.test'}}]}, {name:'Fixture Company'});
  const provider=input.signers.find(s=>s.role==='Service Provider');
  assert.equal(provider.signed,true);
  assert.equal(provider.signatureUrl,'typed:Existing Provider');
  assert.equal(input.signers.find(s=>s.role==='Client').signed,false);
});

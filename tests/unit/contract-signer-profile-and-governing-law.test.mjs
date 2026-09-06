import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySignerProfileDefaults,
  EMPTY_SIGNER_PROFILE,
  isSignatureDataUrl,
  mergeSignerProfile,
  normalizeSignerProfile,
} from '../../src/lib/contracts/signerProfile.ts';
import {
  isPlaceholderGoverningLaw,
  resolveContractGoverningLaw,
} from '../../src/lib/contracts/contractGoverningLaw.ts';

const PNG = `data:image/png;base64,${'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk'.repeat(2)}`;

test('signer profile: a saved signature is validated and reused, garbage is dropped', () => {
  const profile = normalizeSignerProfile({
    providerName: '  AlphaClone Systems LLC ',
    providerAddress: '30 N Gould St, Sheridan, WY',
    signature: { dataUrl: PNG, fullName: 'Jane Owner', savedAt: '2026-09-01T00:00:00.000Z' },
  });
  assert.equal(profile.providerName, 'AlphaClone Systems LLC');
  assert.equal(profile.signature?.fullName, 'Jane Owner');
  assert.equal(profile.signature?.dataUrl, PNG);

  const broken = normalizeSignerProfile({ signature: { dataUrl: 'javascript:alert(1)', fullName: 'x' } });
  assert.equal(broken.signature, null);
  assert.equal(normalizeSignerProfile(null).providerName, '');
  assert.equal(isSignatureDataUrl('data:image/svg+xml;base64,AAAA'), false);
});

test('signer profile: merge keeps details, replaces or clears the signature, and rejects bad images', () => {
  const now = new Date('2026-09-06T12:00:00.000Z');
  const withDetails = mergeSignerProfile(EMPTY_SIGNER_PROFILE, { providerName: 'Acme', jurisdiction: 'Poland', governingLaw: 'Laws of the Republic of Poland' }, now);
  assert.equal(withDetails.providerName, 'Acme');
  assert.equal(withDetails.updatedAt, now.toISOString());

  const withSignature = mergeSignerProfile(withDetails, { signature: { dataUrl: PNG, fullName: 'Jane Owner' } }, now);
  assert.equal(withSignature.providerName, 'Acme', 'signature save must not wipe provider details');
  assert.equal(withSignature.signature?.savedAt, now.toISOString());

  const cleared = mergeSignerProfile(withSignature, { signature: null });
  assert.equal(cleared.signature, null);
  assert.equal(cleared.jurisdiction, 'Poland');

  assert.throws(() => mergeSignerProfile(withDetails, { signature: { dataUrl: 'data:text/html,hi', fullName: 'Jane' } }), /PNG data URL/);
  assert.throws(() => mergeSignerProfile(withDetails, { signature: { dataUrl: PNG, fullName: '   ' } }), /legal full name/);
});

test('signer profile: defaults fill empty form fields and the tenant placeholder name, never typed values', () => {
  const profile = normalizeSignerProfile({
    providerName: 'AlphaClone Systems LLC',
    providerAddress: '30 N Gould St',
    providerEmail: 'sales@alphaclonesystems.com',
    providerPhone: '+1 307 555 0100',
    providerRegistration: '2026-002002581',
    jurisdiction: 'State of Wyoming, USA',
    governingLaw: 'Laws of the State of Wyoming',
  });
  const form = {
    providerName: "ALPHACLONE SYSTEMS's Organization",
    providerAddress: '',
    providerEmail: 'sales@alphaclonesystems.com',
    providerPhone: 'typed-by-user',
    providerRegistration: '',
    jurisdiction: '',
    governingLaw: '',
    clientName: 'Keep me',
  };
  const next = applySignerProfileDefaults(form, profile, { tenantFallbackName: "ALPHACLONE SYSTEMS's Organization" });
  assert.equal(next.providerName, 'AlphaClone Systems LLC', 'saved legal name replaces the auto tenant placeholder');
  assert.equal(next.providerAddress, '30 N Gould St');
  assert.equal(next.providerPhone, 'typed-by-user', 'in-progress edits are preserved');
  assert.equal(next.jurisdiction, 'State of Wyoming, USA');
  assert.equal(next.governingLaw, 'Laws of the State of Wyoming');
  assert.equal(next.clientName, 'Keep me');
});

test('governing law: template placeholders never count as a value', () => {
  assert.equal(isPlaceholderGoverningLaw('the laws of the applicable jurisdiction'), true);
  assert.equal(isPlaceholderGoverningLaw('the jurisdiction agreed by the parties'), true);
  assert.equal(isPlaceholderGoverningLaw('TBD'), true);
  assert.equal(isPlaceholderGoverningLaw(''), true);
  assert.equal(isPlaceholderGoverningLaw('Laws of the Republic of Poland'), false);
});

test('governing law: row wins, then owner-provided, then the contract text; placeholders fall through', () => {
  const placeholderContent = '<p><strong>Law &amp; disputes:</strong> Governed by the laws of the applicable jurisdiction. Disputes: binding arbitration in the jurisdiction agreed by the parties.</p>';

  const fromRow = resolveContractGoverningLaw({ row: { governing_law: 'Laws of Ireland', jurisdiction: 'Ireland' }, content: placeholderContent });
  assert.deepEqual(fromRow, { governingLaw: 'Laws of Ireland', jurisdiction: 'Ireland', source: 'row' });

  const fromProvided = resolveContractGoverningLaw({
    row: { governing_law: null, jurisdiction: null },
    provided: { governingLaw: 'Laws of the State of Wyoming', jurisdiction: 'State of Wyoming, USA' },
    content: placeholderContent,
  });
  assert.equal(fromProvided.source, 'provided');
  assert.equal(fromProvided.jurisdiction, 'State of Wyoming, USA');

  const fromContent = resolveContractGoverningLaw({
    row: {},
    content: '<h2>Governing Law</h2><p>Governed by the Laws of the Republic of Poland. Disputes: binding arbitration in Warsaw, Poland.</p>',
  });
  assert.equal(fromContent.source, 'content');
  assert.match(fromContent.governingLaw, /Republic of Poland/);
  assert.equal(fromContent.jurisdiction, 'Warsaw, Poland');

  const nothing = resolveContractGoverningLaw({ row: {}, provided: { governingLaw: 'applicable law' }, content: placeholderContent });
  assert.deepEqual(nothing, { governingLaw: null, jurisdiction: null, source: 'none' });
});

test('governing law: a single provided field backfills the other so the legal check sees both', () => {
  const only = resolveContractGoverningLaw({ provided: { jurisdiction: 'Germany' } });
  assert.equal(only.governingLaw, 'Germany');
  assert.equal(only.jurisdiction, 'Germany');
});

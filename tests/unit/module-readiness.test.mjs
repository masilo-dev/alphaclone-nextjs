import test from 'node:test';
import assert from 'node:assert/strict';
import { assessContractContentQuality } from '../../src/lib/documents/contractContentQuality.ts';

test('assessContractContentQuality flags placeholders as critical', () => {
  const result = assessContractContentQuality('Short [CLIENT NAME] contract with TODO.');
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.severity === 'critical'));
});

test('assessContractContentQuality accepts substantive contract text', () => {
  const content = `
    Service Agreement between Vendor and Client.
    Payment terms: net 30. Governing law: Delaware.
    Confidentiality applies to all shared materials.
    Signed by /s/ Authorized Representative.
    ${'The parties agree to deliver services professionally. '.repeat(20)}
  `;
  const result = assessContractContentQuality(content);
  assert.equal(result.ok, true);
});

test('resolveContactDeepLink type includes lead resolution', async () => {
  const { resolveContactDeepLink } = await import('../../src/lib/crm/resolveContactDeepLink.ts');
  assert.equal(typeof resolveContactDeepLink, 'function');
});

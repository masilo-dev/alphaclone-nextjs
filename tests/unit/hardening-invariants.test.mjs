import test from 'node:test';
import assert from 'node:assert/strict';

const { normalizeIdentityType } = await import('../../src/lib/social/identityResolution.ts');
const { rejectLocalAiPaths } = await import('../../src/lib/social/mediaUpload.ts');
const { getProbabilityForStage } = await import('../../src/lib/mcp/tools/deals.ts');

test('Identity Resolution Normalization — map identity type aliases to canonical model', () => {
  assert.equal(normalizeIdentityType('linkedin_personal'), 'linkedin_person');
  assert.equal(normalizeIdentityType('personal'), 'linkedin_person');
  assert.equal(normalizeIdentityType('member'), 'linkedin_person');
  assert.equal(normalizeIdentityType('person'), 'linkedin_person');

  assert.equal(normalizeIdentityType('linkedin_org'), 'linkedin_organization');
  assert.equal(normalizeIdentityType('organization'), 'linkedin_organization');
  assert.equal(normalizeIdentityType('company'), 'linkedin_organization');

  assert.equal(normalizeIdentityType('fb_page'), 'facebook_page');
  assert.equal(normalizeIdentityType('page'), 'facebook_page');
});

test('Media Pipeline — Reject Sandbox URLs and local filesystem paths with AI guidance', () => {
  assert.throws(
    () => rejectLocalAiPaths('sandbox:/files/image.png'),
    (err) => err instanceof Error && err.message.includes('looks like a local AI sandbox path')
  );

  assert.throws(
    () => rejectLocalAiPaths('/mnt/data/upload.jpg'),
    (err) => err instanceof Error && err.message.includes('looks like a local AI sandbox path')
  );

  assert.throws(
    () => rejectLocalAiPaths('file:///tmp/pic.png'),
    (err) => err instanceof Error && err.message.includes('looks like a local AI sandbox path')
  );

  assert.doesNotThrow(() => rejectLocalAiPaths('https://public.example.com/asset.png'));
});

test('Deal Invariants — Stage probability mapping', () => {
  assert.equal(getProbabilityForStage('closed_won'), 100);
  assert.equal(getProbabilityForStage('closed_lost'), 0);
  assert.equal(getProbabilityForStage('negotiation'), 75);
  assert.equal(getProbabilityForStage('proposal'), 50);
  assert.equal(getProbabilityForStage('qualified'), 25);
  assert.equal(getProbabilityForStage('lead'), 10);
  assert.equal(getProbabilityForStage(null), 10);
});

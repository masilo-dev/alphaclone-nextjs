import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeLeadFinderSettings } from '../../src/lib/lead-finder/searchPreferences.ts';
test('corrupt saved preferences recover to a usable search', () => {
  for (const value of [null, false, 'old format', { defaultSources: null, defaultResultLimit: -1 }, { defaultResultLimit: Infinity }]) {
    const settings = normalizeLeadFinderSettings(value);
    assert.equal(settings.defaultResultLimit, 50);
    assert.ok(settings.defaultSources.length > 0);
    assert.equal(settings.requireEmail, false);
  }
});
test('preferences preserve valid limits and contact requirements while rejecting unknown sources', () => {
  assert.deepEqual(normalizeLeadFinderSettings({defaultResultLimit:500, requireEmail:true, requireWebsite:true, defaultSources:['website','website','private_profiles']}), {
    defaultResultLimit:500, requireEmail:true, requireWebsite:true, defaultSources:['website'],
  });
});
test('string boolean values do not accidentally require websites or email', () => {
  const settings=normalizeLeadFinderSettings({requireEmail:'false',requireWebsite:'true',defaultSources:[]});
  assert.equal(settings.requireEmail,false);
  assert.equal(settings.requireWebsite,false);
  assert.ok(settings.defaultSources.length > 0);
});

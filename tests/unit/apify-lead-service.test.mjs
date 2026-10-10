import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getApifyApiToken,
  isApifyConfigured,
  buildGooglePlacesActorInput,
  normalizeApifyPlaceItem,
  generateMockDiscoveryResults,
  discoverBusinessesWithApify,
} from '../../src/services/apifyLeadService.ts';

test('Apify Service: buildGooglePlacesActorInput formats actor parameters correctly', () => {
  const input = buildGooglePlacesActorInput({
    query: 'plumbers',
    industry: 'home services',
    location: 'Harare, Zimbabwe',
    resultLimit: 30,
  });

  assert.equal(Array.isArray(input.searchStringsArray), true);
  assert.equal(input.searchStringsArray[0].includes('home services plumbers'), true);
  assert.equal(input.locationQuery, 'Harare, Zimbabwe');
  assert.equal(input.maxCrawledPlacesPerSearch, 30);
  assert.equal(input.language, 'en');
});

test('Apify Service: normalizeApifyPlaceItem accurately detects no-website opportunity', () => {
  const rawItem = {
    title: 'Harare Precision Roofing',
    phone: '+263 77 123 4567',
    website: null,
    street: '15 Enterprise Rd',
    city: 'Harare',
    countryCode: 'ZW',
    totalScore: 4.7,
    reviewsCount: 32,
    placeId: 'ChIJ_harare_roofing_123',
    url: 'https://maps.google.com/?cid=12345',
    categoryName: 'Roofing contractor',
  };

  const normalized = normalizeApifyPlaceItem(rawItem, {
    city: 'Harare',
    country: 'Zimbabwe',
  });

  assert.ok(normalized);
  assert.equal(normalized.businessName, 'Harare Precision Roofing');
  assert.equal(normalized.hasWebsite, false);
  assert.equal(normalized.opportunityType, 'no_website');
  assert.equal(normalized.opportunitySummary.includes('No public website'), true);
  assert.equal(normalized.apifyPlaceId, 'ChIJ_harare_roofing_123');
  assert.equal(normalized.source, 'apify:google-places');
  assert.equal(normalized.verificationStatus, 'unverified');
});

test('Apify Service: normalizeApifyPlaceItem accurately detects social-first opportunity', () => {
  const rawItem = {
    title: 'Glow Beauty Studio',
    phone: '+263 77 987 6543',
    website: '',
    instagram: 'https://instagram.com/glowbeautystudio',
    street: 'Avondale Shopping Centre',
    city: 'Harare',
    countryCode: 'ZW',
    totalScore: 4.9,
    reviewsCount: 64,
    placeId: 'ChIJ_glow_beauty_456',
  };

  const normalized = normalizeApifyPlaceItem(rawItem, {
    city: 'Harare',
    country: 'Zimbabwe',
  });

  assert.ok(normalized);
  assert.equal(normalized.hasWebsite, false);
  assert.equal(normalized.opportunityType, 'social_first');
  assert.equal(normalized.socialUrls?.instagram, 'https://instagram.com/glowbeautystudio');
});

test('Apify Service: normalizeApifyPlaceItem extracts discovered emails without fabricating deliverability', () => {
  const rawItem = {
    title: 'Apex Electrical Services',
    phone: '+263 77 444 5555',
    website: 'https://apexelectrical.co.zw',
    email: 'contact@apexelectrical.co.zw',
    city: 'Harare',
    countryCode: 'ZW',
  };

  const normalized = normalizeApifyPlaceItem(rawItem, {
    city: 'Harare',
    country: 'Zimbabwe',
  });

  assert.ok(normalized);
  assert.equal(normalized.email, 'contact@apexelectrical.co.zw');
  // Discovered emails must be labeled publicly_published, NEVER verified without deliverability checks
  assert.equal(normalized.verificationStatus, 'publicly_published');
});

test('Apify Service: rejects directory and non-business search listing titles', () => {
  const directoryItem = {
    title: 'Top 10 Best Dentists in Harare',
    website: 'https://yellowpages.co.zw',
    city: 'Harare',
  };

  const normalized = normalizeApifyPlaceItem(directoryItem, {
    city: 'Harare',
  });

  assert.equal(normalized, null);
});

test('Apify Service: discoverBusinessesWithApify in test environment returns receipt and cost metrics', async () => {
  process.env.APIFY_MOCK_TEST = 'true';

  const receipt = await discoverBusinessesWithApify({
    query: 'construction',
    city: 'Harare',
    country: 'Zimbabwe',
    resultLimit: 10,
    filterNoWebsite: true,
  });

  assert.equal(receipt.success, true);
  assert.equal(receipt.status, 'SUCCEEDED');
  assert.ok(receipt.discovered.length > 0);
  assert.ok(receipt.costUsd > 0);
  assert.ok(receipt.computeUnits > 0);

  // All results must respect filterNoWebsite
  for (const lead of receipt.discovered) {
    assert.equal(lead.hasWebsite, false);
    assert.ok(['no_website', 'social_first'].includes(lead.opportunityType));
  }
});

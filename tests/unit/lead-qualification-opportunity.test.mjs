import test from 'node:test';
import assert from 'node:assert/strict';

import { scoreCandidate, candidateMeetsRequirements } from '../../src/lib/lead-finder/core.ts';
import { buildLeadQualification } from '../../src/lib/lead-finder/qualificationEngine.ts';

test('Lead Qualification: scoreCandidate rewards no-website businesses as digital development opportunities', () => {
  const candidateNoSite = {
    business_name: 'Bulawayo Custom Joinery',
    public_phone: '+263771234567',
    public_email: null,
    website: null,
    city: 'Bulawayo',
  };

  const scoreResult = scoreCandidate(candidateNoSite, {
    city: 'Bulawayo',
  });

  const oppItem = scoreResult.explanation.find((x) => x.reason.includes('No website found'));
  assert.ok(oppItem, 'Should have positive opportunity reason for no-website business');
  assert.equal(oppItem.points, 25);
  assert.ok(scoreResult.qualityScore >= 25);
});

test('Lead Qualification: buildLeadQualification recommends AlphaClone Custom Website & Booking Portal for no-website business', () => {
  const candidate = {
    business_name: 'Kudzai Welding Works',
    public_phone: '+263771112222',
    website: null,
    city: 'Harare',
    country: 'Zimbabwe',
    source_type: 'apify:google-places',
    source_url: 'https://maps.google.com/?cid=123',
    quality_score: 60,
    fit_score: 75,
  };

  const qualification = buildLeadQualification(candidate);

  assert.equal(qualification.qualified, true);
  assert.ok(qualification.master_score >= 50);
  assert.equal(qualification.recommended_offer.primary_offer, 'AlphaClone Custom Website & Booking Portal');
  assert.ok(qualification.outreach_angle?.includes('booking portal'));
  // Truth guarantee: business maturity must remain unknown without explicit verifiable data
  assert.equal(qualification.business_maturity, 'unknown');
});

test('Lead Qualification: candidateMeetsRequirements strictly respects filterNoWebsite', () => {
  const candidateWithSite = {
    business_name: 'Tech Corp',
    website: 'https://techcorp.com',
    public_phone: '+263771234567',
  };

  const candidateNoSite = {
    business_name: 'Local Masonry',
    website: null,
    public_phone: '+263771234567',
  };

  assert.equal(candidateMeetsRequirements(candidateWithSite, { filterNoWebsite: true }), false);
  assert.equal(candidateMeetsRequirements(candidateNoSite, { filterNoWebsite: true }), true);
});

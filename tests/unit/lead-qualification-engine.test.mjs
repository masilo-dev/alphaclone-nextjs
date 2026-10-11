import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveQualificationProfile,
  COMPETITOR_KEYWORDS_FOR_WEBSITE_OFFERS,
  QUALIFICATION_RULES_VERSION,
} from '../../src/lib/lead-finder/qualificationContract.ts';
import { buildDiscoveryQueries } from '../../src/lib/lead-finder/queryGenerator.ts';
import {
  qualifyCandidate,
  qualifyCandidateBatch,
} from '../../src/lib/lead-finder/qualificationService.ts';
import { buildLlmExecutionTruth } from '../../src/lib/mcp/llmTruthfulResponse.ts';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Auckland Search Test Failure Labeled Fixtures
// ─────────────────────────────────────────────────────────────────────────────

test('Auckland Test: Competitor "Kiwi Web Design" is strictly rejected as NOT_A_FIT', () => {
  const profile = resolveQualificationProfile({
    intentPrompt: 'Small owner-operated businesses in Auckland, New Zealand that could benefit from a new or improved website. Prefer businesses with weak or absent websites and public business email addresses.',
    location: 'Auckland, New Zealand',
    country: 'New Zealand',
  });

  const kiwiWebDesign = {
    business_name: 'Kiwi Web Design',
    category: 'Website designer',
    website: 'https://kiwiwebdesign.co.nz',
    phone: '+64 9 123 4567',
    email: null,
    rating: 5.0,
    address: 'Auckland, New Zealand',
  };

  const record = qualifyCandidate(kiwiWebDesign, profile, 'test_auckland_1');

  assert.equal(record.decision, 'NOT_A_FIT');
  assert.equal(record.assessments.target_fit.isCompetitor, true);
  assert.ok(
    record.decisionReasons.some((r) => r.toLowerCase().includes('competitor')),
    'Decision reasons must identify competitor'
  );
  // High rating 5.0 must NOT be conflated with need
  assert.notEqual(record.assessments.evidence_of_need.level, 'confirmed_need');
  // Buying intent must NOT be fabricated
  assert.equal(record.assessments.buying_intent.level, 'not_observed');
});

test('Auckland Test: Competitor "authentic digital" is strictly rejected as NOT_A_FIT', () => {
  const profile = resolveQualificationProfile({
    intentPrompt: 'Small owner-operated businesses in Auckland that need a website',
    location: 'Auckland, New Zealand',
  });

  const authenticDigital = {
    business_name: 'authentic digital',
    category: 'Digital marketing agency',
    website: 'https://authenticdigital.co.nz',
    phone: '+64 9 987 6543',
    email: null,
    rating: 4.8,
    address: 'Auckland, New Zealand',
  };

  const record = qualifyCandidate(authenticDigital, profile, 'test_auckland_2');

  assert.equal(record.decision, 'NOT_A_FIT');
  assert.equal(record.assessments.target_fit.isCompetitor, true);
});

test('Auckland Test: "Phoenix Research Limited" with live website and no crawl is NOT qualified without proof of need', () => {
  const profile = resolveQualificationProfile({
    intentPrompt: 'Small owner-operated businesses in Auckland, New Zealand that could benefit from a new or improved website. Require public business email.',
    location: 'Auckland, New Zealand',
    country: 'New Zealand',
    requireEmail: true,
  });

  const phoenixResearch = {
    business_name: 'Phoenix Research Limited',
    category: 'Market research',
    website: 'https://phoenixresearch.co.nz',
    phone: '+64 9 555 1234',
    email: null, // No email
    rating: null,
    address: 'Auckland, New Zealand',
  };

  const record = qualifyCandidate(phoenixResearch, profile, 'test_auckland_3');

  // Must NOT be qualified: missing email (mandatory) and unverified website need
  assert.notEqual(record.decision, 'QUALIFIED');
  assert.ok(['REVIEW_NEEDED', 'NOT_A_FIT', 'INSUFFICIENT_DATA'].includes(record.decision));
  assert.equal(record.assessments.contact_readiness.channelReadiness, 'phone_ready');
  assert.equal(record.assessments.contact_readiness.emailValid, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. High rating (5.0★) & Lack of Reviews Do Not Prove Need
// ─────────────────────────────────────────────────────────────────────────────

test('Evidence of need: 5.0★ rating or absence of reviews never fabricates need or intent', () => {
  const profile = resolveQualificationProfile({
    intentPrompt: 'businesses needing websites in Auckland',
    location: 'Auckland, New Zealand',
  });

  const fiveStarClinic = {
    business_name: 'Premier Auckland Dental Practice',
    category: 'Dental clinic',
    website: 'https://premierdentalsmt.co.nz',
    phone: '+64 9 888 7777',
    email: 'info@premierdentalsmt.co.nz',
    rating: 5.0,
    reviews_count: 85,
    address: 'Auckland, New Zealand',
    crawl_evidence: {
      accessible: true,
      has_viewport: true,
      has_contact_cta: true,
      has_booking_form: true,
    },
  };

  const record = qualifyCandidate(fiveStarClinic, profile, 'test_five_star');

  // Because the website is accessible, has viewport, has CTA, and has booking form:
  // There is NO evidence of website need!
  assert.equal(record.assessments.evidence_of_need.level, 'no_evidence_of_need');
  assert.equal(record.assessments.buying_intent.level, 'not_observed');
  // Must NOT qualify for website design when website is fully functional
  assert.notEqual(record.decision, 'QUALIFIED');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Genuine Target Fit: Observable Need & Contact Readiness
// ─────────────────────────────────────────────────────────────────────────────

test('Genuine Target Fit: Trade business with observable mobile-viewport gap and email qualifies', () => {
  const profile = resolveQualificationProfile({
    intentPrompt: 'Trades and home services in Auckland that could benefit from a modern website. Prefer email.',
    location: 'Auckland, New Zealand',
    country: 'New Zealand',
  });

  const localPlumber = {
    business_name: 'Ponsonby Plumbing Works',
    category: 'Plumber',
    website: 'http://ponsonbyplumbing.co.nz',
    phone: '+64 9 376 1111',
    email: 'office@ponsonbyplumbing.co.nz',
    rating: 4.2,
    address: 'Ponsonby, Auckland, New Zealand',
    crawl_evidence: {
      accessible: true,
      has_viewport: false, // Broken/missing mobile viewport = clear observable need
      has_contact_cta: false,
      has_booking_form: false,
    },
  };

  const record = qualifyCandidate(localPlumber, profile, 'test_genuine_1');

  assert.equal(record.decision, 'QUALIFIED');
  assert.equal(record.assessments.identity_confidence.isRealBusiness, true);
  assert.equal(record.assessments.target_fit.isCompetitor, false);
  assert.equal(record.assessments.evidence_of_need.level, 'confirmed_need');
  assert.equal(record.assessments.contact_readiness.channelReadiness, 'email_ready');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Zero Qualified Leads: Honest Reporting & No Silent Criteria Relaxation
// ─────────────────────────────────────────────────────────────────────────────

test('Batch Qualification: Returns zero qualified leads honestly when all candidates fail criteria', () => {
  const profile = resolveQualificationProfile({
    intentPrompt: 'Small businesses in Auckland needing websites with mandatory public email',
    location: 'Auckland, New Zealand',
    requireEmail: true,
  });

  // Batch of 4 candidates: 2 competitors, 1 directory, 1 business without email
  const batchCandidates = [
    {
      business_name: 'Kiwi Web Design',
      category: 'Web design agency',
      website: 'https://kiwiwebdesign.co.nz',
      phone: '+64 9 111 2222',
      email: 'hello@kiwiwebdesign.co.nz',
    },
    {
      business_name: 'authentic digital',
      category: 'Digital marketing agency',
      website: 'https://authenticdigital.co.nz',
      phone: '+64 9 222 3333',
      email: 'team@authenticdigital.co.nz',
    },
    {
      business_name: 'Top 10 Web Designers in Auckland',
      category: 'Directory',
      website: 'https://directory.co.nz/top-10',
      phone: '+64 9 333 4444',
      email: 'admin@directory.co.nz',
    },
    {
      business_name: 'Takapuna Auto Repairs',
      category: 'Car mechanic',
      website: 'https://takapunaauto.co.nz',
      phone: '+64 9 444 5555',
      email: null, // Fails mandatory email
    },
  ];

  const summary = qualifyCandidateBatch(batchCandidates, profile, 'test_batch_zero');

  assert.equal(summary.counts.qualified, 0, 'Zero candidates must be qualified');
  assert.equal(summary.invariantsHold, true, 'Mathematical counts invariant must hold');
  assert.equal(
    summary.counts.qualified +
      summary.counts.reviewNeeded +
      summary.counts.notAFit +
      summary.counts.insufficientData,
    summary.totalAssessed
  );
  assert.ok(summary.explanation.includes('Zero qualified leads'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Query Generator Follows Profile (Translates Sales Pitches to Target Sectors)
// ─────────────────────────────────────────────────────────────────────────────

test('Query Generator: Translates long sales pitch containing "website" into prospective customer categories', () => {
  const rawSalesPitch =
    'Small owner-operated businesses in Auckland, New Zealand that could benefit from a new or improved website. Prefer businesses with weak or absent websites.';

  const profile = resolveQualificationProfile({
    intentPrompt: rawSalesPitch,
    location: 'Auckland, New Zealand',
  });

  const plan = buildDiscoveryQueries(profile, rawSalesPitch, { maxQueries: 3 });

  assert.ok(plan.generatedQueries.length > 0);
  for (const q of plan.generatedQueries) {
    // CRITICAL: The place query MUST NOT search for "website" or competitor terms
    assert.equal(
      /website|web design|digital agency/i.test(q.queryTerm),
      false,
      `Query term "${q.queryTerm}" must not contain competitor or sales pitch keywords`
    );
    assert.ok(q.locationTerm.includes('Auckland'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Tenant Criteria Isolation
// ─────────────────────────────────────────────────────────────────────────────

test('Tenant Isolation: Distinct tenant profiles evaluate the same candidate independently without bleeding', () => {
  const candidate = {
    business_name: 'Mt Eden Dental Clinic',
    category: 'Dentist',
    website: 'https://mtedendental.co.nz',
    phone: '+64 9 630 1111',
    email: null, // Has phone, no email
    address: 'Mt Eden, Auckland, New Zealand',
    crawl_evidence: {
      accessible: true,
      has_viewport: false,
    },
  };

  // Tenant A: Strict email required
  const tenantAProfile = resolveQualificationProfile({
    intentPrompt: 'Auckland clinics. Must have email address.',
    requireEmail: true,
    location: 'Auckland, New Zealand',
  });

  // Tenant B: Phone outreach only
  const tenantBProfile = resolveQualificationProfile({
    intentPrompt: 'Auckland clinics. Phone outreach allowed.',
    requireEmail: false,
    location: 'Auckland, New Zealand',
  });

  const resultA = qualifyCandidate(candidate, tenantAProfile, 'tenant_a_run');
  const resultB = qualifyCandidate(candidate, tenantBProfile, 'tenant_b_run');

  // Tenant A requires email, candidate has no email -> does NOT qualify for Tenant A
  assert.notEqual(resultA.decision, 'QUALIFIED');

  // Tenant B allows phone, candidate has verified phone and observable need -> qualifies for Tenant B
  assert.equal(resultB.decision, 'QUALIFIED');

  // Data isolation: Candidate assessments are strictly isolated
  assert.equal(resultA.assessments.contact_readiness.channelReadiness, 'phone_ready');
  assert.equal(resultB.assessments.contact_readiness.channelReadiness, 'phone_ready');
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Execution Truth: Inner Status COMPLETED Resolves to Outer VERIFIED
// ─────────────────────────────────────────────────────────────────────────────

test('Execution Truth: Inner COMPLETED status and find_ tool prefix resolve to VERIFIED with may_claim_completed=true', () => {
  const innerPayload = {
    ok: true,
    data: {
      search_id: 'lead_search_123',
      raw_count: 4,
      qualified_count: 0,
      execution_truth: {
        status: 'COMPLETED',
        may_claim_completed: true,
      },
    },
  };

  const truth = buildLlmExecutionTruth({
    toolName: 'find_and_qualify_leads',
    parsedResult: innerPayload,
  });

  assert.equal(truth.status, 'VERIFIED');
  assert.equal(truth.verification_state, 'VERIFIED');
  assert.equal(truth.may_claim_completed, true);
  assert.notEqual(truth.status, 'REQUESTED', 'Must never report REQUESTED when execution completed');
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. False Positive Measurement on Labeled Set
// ─────────────────────────────────────────────────────────────────────────────

test('Benchmark: Zero false-positive qualifications on labeled competitor and directory fixtures', () => {
  const profile = resolveQualificationProfile({
    intentPrompt: 'Small businesses in Auckland needing websites',
    location: 'Auckland, New Zealand',
  });

  const negativeControls = [
    { business_name: 'Kiwi Web Design', category: 'Web design' },
    { business_name: 'authentic digital', category: 'Digital marketing' },
    { business_name: 'Auckland SEO Agency', category: 'SEO' },
    { business_name: 'Creative Web Studios', category: 'Website design' },
    { business_name: 'Top 50 Accountants in Auckland', category: 'Directory listicle' },
    { business_name: 'Yellow Pages Auckland Builders', category: 'Aggregator' },
  ];

  let falsePositives = 0;
  for (const control of negativeControls) {
    const res = qualifyCandidate(control, profile, 'control_test');
    if (res.decision === 'QUALIFIED') {
      falsePositives += 1;
    }
  }

  const falsePositiveRate = falsePositives / negativeControls.length;
  assert.equal(
    falsePositiveRate,
    0,
    `False positive rate on negative controls must be 0%, got ${falsePositiveRate * 100}% (${falsePositives}/${negativeControls.length})`
  );
});

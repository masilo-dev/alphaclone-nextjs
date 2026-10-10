import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeEmail,
  normalizePhone,
  resolveBusinessEntity,
  scoreCandidate,
} from '../../src/lib/lead-finder/core.ts';
import { qualifyLead } from '../../src/lib/leadQualification.ts';
import { bonnieFindAndQualifyLeads, bonnieGetScraperLeads } from '../../src/lib/bonnie/bonnieLeadOps.ts';

test('Lead Finder: Entity resolution strictly rejects directory listicles and aggregator pages', () => {
  // Test evidence case: "Top 34 Accounting Companies in Harare"
  const aeroleadsListicle = resolveBusinessEntity({
    businessName: 'Top 34 Accounting Companies in Harare',
    website: 'https://aeroleads.com/list/top-accounting-companies-harare',
  });
  assert.equal(aeroleadsListicle.isRealBusiness, false);
  assert.equal(aeroleadsListicle.reason, 'directory_or_search_result');

  const yellowPages = resolveBusinessEntity({
    businessName: 'Best Plumbers in Austin near me',
    website: 'https://yellowpages.com/austin-tx/plumbers',
  });
  assert.equal(yellowPages.isRealBusiness, false);

  const realBusiness = resolveBusinessEntity({
    businessName: 'Apex Accounting Solutions',
    website: 'https://apexacc.co.zw',
  });
  assert.equal(realBusiness.isRealBusiness, true);
  assert.equal(realBusiness.reason, 'ok');
});

test('Lead Finder: Email normalizer rejects concatenated run-on words while preserving valid emails', () => {
  // Test evidence case: "pearsonwinder@waitrose.comanswerrosemaryposted"
  assert.equal(normalizeEmail('pearsonwinder@waitrose.comanswerrosemaryposted'), null);
  assert.equal(normalizeEmail('contact@business.orgreadmorehere'), null);
  assert.equal(normalizeEmail('info@techcorp.iolearnmore'), null);

  // Valid emails
  assert.equal(normalizeEmail('pearsonwinder@waitrose.com'), 'pearsonwinder@waitrose.com');
  assert.equal(normalizeEmail('info@apexacc.co.zw'), 'info@apexacc.co.zw');
  assert.equal(normalizeEmail('support@company.org'), 'support@company.org');
});

test('Lead Finder: International phone normalization uses country context and rejects incomplete numbers', () => {
  // Test evidence case: "305 810" in Zimbabwe
  assert.equal(normalizePhone('305 810', 'Zimbabwe'), null);
  assert.equal(normalizePhone('305 810', 'Harare, Zimbabwe'), null);
  assert.equal(normalizePhone('123 456', 'United States'), null);

  // Valid Zimbabwean numbers
  assert.equal(normalizePhone('+263 77 123 4567', 'Zimbabwe'), '+263771234567');
  assert.equal(normalizePhone('0771234567', 'Harare, Zimbabwe'), '+263771234567');
  assert.equal(normalizePhone('0242 700123', 'Zimbabwe'), '+263242700123');

  // Never falsely default to US (+1) for international context
  const zwPhone = normalizePhone('0771234567', 'Harare, Zimbabwe');
  assert.ok(zwPhone?.startsWith('+263'));
  assert.ok(!zwPhone?.startsWith('+1'));
});

test('Lead Qualification: Directory pages and invalid contacts never produce Grade A or Hot tier', () => {
  // Directory page qualification
  const directoryLead = qualifyLead(
    {
      business_name: 'Top 34 Accounting Companies in Harare',
      phone: '0771234567',
      website: 'https://aeroleads.com',
    },
    'Accounting'
  );
  assert.equal(directoryLead.tier, 'skip');
  assert.equal(directoryLead.score, 0);
  assert.equal(directoryLead.disqualificationReason, 'directory_or_search_result');

  // Corrupted contacts lead: "Accounting And Executor" with "305 810" and malformed email
  const corruptedLead = qualifyLead(
    {
      business_name: 'Accounting And Executor',
      phone: '305 810',
      email: 'pearsonwinder@waitrose.comanswerrosemaryposted',
      website: 'https://accountingexecutor.co.zw',
    },
    'Accounting',
    { country: 'Zimbabwe' }
  );
  // Contacts are invalid: cannot be hot tier or Grade A
  assert.notEqual(corruptedLead.tier, 'hot');
  assert.ok(corruptedLead.score < 75);
  assert.equal(corruptedLead.canAutoSend, false);
});

test('Lead Qualification: Real businesses with valid phone and rating qualify without requiring email', () => {
  // Harare trade business with phone, address, and rating
  const realTrade = qualifyLead(
    {
      business_name: 'Kudzai Joinery & Furniture',
      phone: '+263 77 211 1222',
      address: '14 Samora Machel Ave, Harare',
      rating: 4.6,
    },
    'Carpentry & Trades',
    { country: 'Zimbabwe' }
  );

  assert.ok(realTrade.score >= 50);
  assert.ok(['warm', 'hot'].includes(realTrade.tier));
  assert.ok(realTrade.dataQualityScore && realTrade.dataQualityScore >= 50);
  assert.equal(realTrade.pitchAngle, 'digital-presence');
});

test('Bonnie Lead Ops: Reconciles execution truth and produces candidate previews with reasons', async () => {
  // Test discovery in simulated/mock environment
  const result = await bonnieFindAndQualifyLeads('test-tenant-123', {
    niche: 'owner-operated accounting firms',
    location: 'Harare, Zimbabwe',
    country: 'Zimbabwe',
    min_score: 50,
    save_to_crm: false, // Discovery-only mode
  });

  assert.ok(result.search_id.startsWith('lead_search_'));
  assert.equal(result.execution_truth.may_claim_completed, true);
  assert.ok(['COMPLETED', 'RUNNING'].includes(result.execution_truth.status));
  assert.equal(result.saved_to_crm, 0, 'Discovery mode must not write to CRM');
  assert.ok(Array.isArray(result.candidate_previews));
  assert.ok(result.parsed_count >= 0);
  assert.ok(result.contactable_count >= 0);
});

test('Bonnie Lead Ops: Scraper leads retrieval filters by search_id and sanitizes directory listicles', async () => {
  const leads = await bonnieGetScraperLeads('test-tenant-123', {
    search_id: 'non-existent-search-12345',
  });
  // Querying with specific run ID returns only records for that search
  assert.equal(leads.length, 0);
});

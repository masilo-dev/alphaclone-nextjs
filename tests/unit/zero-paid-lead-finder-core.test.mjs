import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {
  buildCanonicalBusinessKey,
  calculateCompositeLeadScore,
  normalizeEmail,
  normalizePhone,
} from '../../src/lib/lead-finder/core.ts';
import { validateCrawlUrl } from '../../src/lib/lead-finder/publicWebFetch.ts';

test('normalization rejects placeholders and produces tenant-global business identities', () => {
  assert.equal(normalizeEmail(' SALES@Example.COM '), 'sales@example.com');
  assert.equal(normalizeEmail('example@example.com'), null);
  assert.equal(normalizePhone('+1 (415) 555-2671'), '+14155552671');
  assert.equal(
    buildCanonicalBusinessKey({ website: 'https://www.Example.com/contact', businessName: 'Example Inc', city: 'Zurich' }),
    'domain:example.com',
  );
  assert.equal(
    buildCanonicalBusinessKey({ businessName: 'Example Inc.', city: 'Zurich', country: 'CH', sourceExternalId: 'different-source-id' }),
    'business:example:zurich:ch',
  );
});

test('crawler keeps public-email extraction server-only and provenance-aware', async () => {
  const crawler = await fs.readFile('src/lib/lead-finder/websiteCrawler.ts', 'utf8');
  assert.match(crawler, /import 'server-only'/);
  assert.match(crawler, /mailto:/);
  assert.match(crawler, /verification_status: 'publicly_published'/);
});

test('public crawler blocks private-network and credentialed URLs', () => {
  assert.throws(() => validateCrawlUrl('http://127.0.0.1/admin'), /CRAWL_URL_BLOCKED/);
  assert.throws(() => validateCrawlUrl('http://user:pass@example.com'), /CRAWL_URL_BLOCKED/);
  assert.equal(validateCrawlUrl('https://example.com/contact').hostname, 'example.com');
});

test('composite score uses all quality dimensions and remains bounded', () => {
  assert.equal(calculateCompositeLeadScore({ fit: 100, contactability: 100, quality: 100, confidence: 100, freshness: 100, opportunity: 100 }), 100);
  assert.equal(calculateCompositeLeadScore({ fit: -1, contactability: 0, quality: 0, confidence: 0, freshness: 0, opportunity: 0 }), 0);
});

test('qualification brain remains one evidence-backed canonical service', async () => {
  const engine = await fs.readFile('src/lib/lead-finder/qualificationEngine.ts', 'utf8');
  const migration = await fs.readFile('supabase/migrations/20260909160000_lead_qualification_intelligence.sql', 'utf8');
  assert.match(engine, /buildLeadQualification/);
  assert.match(engine, /observation/);
  assert.match(engine, /inference/);
  assert.match(engine, /relationshipModifier/);
  assert.match(engine, /requalifyLeadCandidate/);
  assert.match(engine, /recommended_role: 'Owner \/ Managing Director'/);
  assert.doesNotMatch(engine, /openai|anthropic|generateText/i);
  assert.match(migration, /lead_signals/);
  assert.match(migration, /lead_qualification_snapshots/);
  assert.match(migration, /get_top_lead_opportunities/);
  assert.match(migration, /business_maturity/);
  assert.match(migration, /decision_maker_confidence/);
});

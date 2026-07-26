import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeCsvFormula, normalizeCompany, normalizeDomain, normalizeEmail, normalizePhone, scoreCandidate,
} from '../../src/lib/lead-finder/core.ts';

test('lead finder normalizes public contact values', () => {
  assert.equal(normalizeDomain('HTTPS://www.Example.COM/contact'), 'example.com');
  assert.equal(normalizeEmail(' Sales@Example.COM '), 'sales@example.com');
  assert.equal(normalizeEmail('not-an-email'), null);
  assert.equal(normalizePhone('+41 44 668 18 00', 'CH'), '+41446681800');
  assert.equal(normalizeCompany(' Example GmbH '), 'example');
});

test('lead finder keeps quality and fit scoring explainable and separate', () => {
  const score = scoreCandidate({
    business_name: 'Harare Accounting Group', website: 'https://hag.example',
    public_email: 'hello@hag.example', public_phone: '+263771234567',
    address_line_1: '1 Main Street', industry: 'Accounting', city: 'Harare',
  }, { industry: 'Accounting', city: 'Harare', business_keywords: ['accounting'] });
  assert.ok(score.qualityScore >= 60);
  assert.ok(score.fitScore >= 80);
  assert.ok(score.explanation.some(item => item.type === 'quality'));
  assert.ok(score.explanation.some(item => item.type === 'fit'));
});

test('exports neutralize spreadsheet formulas', () => {
  assert.equal(escapeCsvFormula('=HYPERLINK("bad")'), '\'=HYPERLINK("bad")');
  assert.equal(escapeCsvFormula('Normal company'), 'Normal company');
});

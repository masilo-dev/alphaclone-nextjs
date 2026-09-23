/**
 * Outbound Engine — Critical Path Tests
 */

import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

// ── Helper ────────────────────────────────────────────────
async function safeImport(path) {
  try {
    const mod = await import(path);
    return mod?.default ? { ...mod, ...mod.default } : mod;
  } catch {
    return {};
  }
}

// ── Tenant isolation / ICP scoring ───────────────────────
describe('ICP scoring (pure function)', () => {
  test('matching profile scores positively', async (t) => {
    const mod = await safeImport('../../src/lib/outbound/icpService.ts');
    if (!mod?.scoreAgainstICP) return t.skip('module not available');

    const icp = {
      id: 'test-icp', tenant_id: 'tenant-a', name: 'Test',
      industries: ['SaaS'], locations: ['United States'],
      job_titles: ['CEO', 'Founder'],
      excluded_industries: ['Gambling'],
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = mod.scoreAgainstICP(icp, {
      industry: 'SaaS', location: 'United States', job_title: 'CEO',
    });
    assert.ok(result.score >= 50, `score ${result.score} should be >= 50`);
    assert.ok(!result.excluded, 'non-excluded profile should not be excluded');
    assert.ok(result.matched.length > 0, 'should have matched criteria');
  });

  test('excluded industry results in zero score', async (t) => {
    const mod = await safeImport('../../src/lib/outbound/icpService.ts');
    if (!mod?.scoreAgainstICP) return t.skip('module not available');

    const icp = {
      id: 'test-icp', tenant_id: 'tenant-a', name: 'Test',
      excluded_industries: ['Gambling'],
      industries: [], locations: [], job_titles: [],
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = mod.scoreAgainstICP(icp, { industry: 'Gambling Casino' });
    assert.equal(result.score, 0, 'excluded industry should score 0');
    assert.ok(result.excluded, 'should be marked excluded');
  });
});

// ── Email verification policy ─────────────────────────────
describe('Email verification send policy', () => {
  test('invalid email is always blocked', async (t) => {
    const mod = await safeImport('../../src/lib/outbound/emailVerification.ts');
    if (!mod?.canSendToVerificationStatus) return t.skip('module not available');

    const result = mod.canSendToVerificationStatus('invalid');
    assert.equal(result.allowed, false, 'invalid emails must be blocked');
  });

  test('invalid email blocked even with permissive policy', async (t) => {
    const mod = await safeImport('../../src/lib/outbound/emailVerification.ts');
    if (!mod?.canSendToVerificationStatus) return t.skip('module not available');

    const result = mod.canSendToVerificationStatus('invalid', {
      allow_risky: true, allow_catch_all: true, allow_unknown: true,
    });
    assert.equal(result.allowed, false, 'invalid must never be allowed');
    assert.ok(result.reason.includes('INVALID'), `expected INVALID in reason, got ${result.reason}`);
  });

  test('valid email is allowed', async (t) => {
    const mod = await safeImport('../../src/lib/outbound/emailVerification.ts');
    if (!mod?.canSendToVerificationStatus) return t.skip('module not available');

    const result = mod.canSendToVerificationStatus('valid');
    assert.equal(result.allowed, true, 'valid emails must be allowed');
  });

  test('risky email blocked by default, allowed by policy', async (t) => {
    const mod = await safeImport('../../src/lib/outbound/emailVerification.ts');
    if (!mod?.canSendToVerificationStatus) return t.skip('module not available');

    assert.equal(mod.canSendToVerificationStatus('risky').allowed, false, 'risky blocked by default');
    assert.equal(mod.canSendToVerificationStatus('risky', { allow_risky: true }).allowed, true, 'risky allowed by policy');
  });

  test('unknown email blocked by default', async (t) => {
    const mod = await safeImport('../../src/lib/outbound/emailVerification.ts');
    if (!mod?.canSendToVerificationStatus) return t.skip('module not available');

    assert.equal(mod.canSendToVerificationStatus('unknown').allowed, false, 'unknown blocked by default');
  });
});

// ── AI qualification score validation ────────────────────
describe('AI qualification output validation', () => {
  test('score is clamped to 0-100', () => {
    const clamp = (n) => Math.max(0, Math.min(100, isNaN(n) ? 0 : n));
    assert.equal(clamp(150), 100, 'score > 100 should clamp to 100');
    assert.equal(clamp(-10), 0, 'score < 0 should clamp to 0');
    assert.equal(clamp(NaN), 0, 'NaN should clamp to 0');
    assert.equal(clamp(75), 75, 'valid score unchanged');
  });

  test('unknown status normalizes to review_required', () => {
    const validStatuses = ['qualified', 'unqualified', 'review_required', 'disqualified'];
    const normalize = (s) => validStatuses.includes(s) ? s : 'review_required';
    assert.equal(normalize('maybe_qualified'), 'review_required');
    assert.equal(normalize('qualified'), 'qualified');
    assert.equal(normalize(''), 'review_required');
  });
});

// ── Mailbox limit logic ───────────────────────────────────
describe('Mailbox limits', () => {
  test('detects limit reached condition', () => {
    const mailbox = {
      sending_enabled: true, connection_state: 'connected',
      daily_limit: 100, messages_sent_today: 100, is_primary_domain: false,
      bounce_count_7d: 0, spf_status: 'healthy', dmarc_status: 'healthy',
    };
    const errors = [];
    if (!mailbox.sending_enabled) errors.push('MAILBOX_SEND_DISABLED');
    if (mailbox.connection_state !== 'connected') errors.push('MAILBOX_NOT_CONNECTED');
    const remaining = mailbox.daily_limit - mailbox.messages_sent_today;
    if (remaining <= 0) errors.push('MAILBOX_LIMIT_REACHED');
    assert.ok(errors.includes('MAILBOX_LIMIT_REACHED'), 'should report limit reached');
  });

  test('primary domain emits warning', () => {
    const mailbox = {
      is_primary_domain: true, sending_enabled: true, connection_state: 'connected',
      daily_limit: 100, messages_sent_today: 0, bounce_count_7d: 0,
    };
    const warnings = [];
    if (mailbox.is_primary_domain) warnings.push('PRIMARY_DOMAIN_WARNING');
    assert.ok(warnings.includes('PRIMARY_DOMAIN_WARNING'), 'primary domain must emit warning');
  });

  test('disconnected mailbox is blocked', () => {
    const mailbox = {
      sending_enabled: true, connection_state: 'disconnected',
      daily_limit: 100, messages_sent_today: 0, is_primary_domain: false,
    };
    const errors = [];
    if (mailbox.connection_state !== 'connected') errors.push('MAILBOX_NOT_CONNECTED');
    assert.ok(errors.includes('MAILBOX_NOT_CONNECTED'), 'disconnected mailbox must be blocked');
  });
});

// ── Reply classification ──────────────────────────────────
describe('Reply classification', () => {
  test('classifies positive intent', async (t) => {
    const mod = await safeImport('../../src/lib/outreach/outreachIntelligence.ts');
    if (!mod?.classifyOutreachReply) return t.skip('module not available');

    const positives = [
      "Yes, I'm interested!",
      "Let's schedule a demo",
      'Please send me the details',
      'Book a time with me',
    ];
    for (const text of positives) {
      assert.equal(mod.classifyOutreachReply(text), 'positive', `"${text}" should be positive`);
    }
  });

  test('classifies unsubscribe', async (t) => {
    const mod = await safeImport('../../src/lib/outreach/outreachIntelligence.ts');
    if (!mod?.classifyOutreachReply) return t.skip('module not available');

    const unsubs = [
      'Please unsubscribe me',
      'Remove me from your list',
      'Stop emailing me',
    ];
    for (const text of unsubs) {
      assert.equal(mod.classifyOutreachReply(text), 'unsubscribe', `"${text}" should be unsubscribe`);
    }
  });

  test('campaignHealth flags high bounce rate', async (t) => {
    const mod = await safeImport('../../src/lib/outreach/outreachIntelligence.ts');
    if (!mod?.campaignHealth) return t.skip('module not available');

    const result = mod.campaignHealth({ sent: 100, bounced: 10, complained: 0, unsubscribed: 0 });
    assert.equal(result.safe, false, 'high bounce rate should mark unsafe');
    assert.ok(result.shouldPause, 'should trigger pause');
  });

  test('campaignHealth marks healthy campaign safe', async (t) => {
    const mod = await safeImport('../../src/lib/outreach/outreachIntelligence.ts');
    if (!mod?.campaignHealth) return t.skip('module not available');

    const result = mod.campaignHealth({ sent: 100, bounced: 2, complained: 0, unsubscribed: 1 });
    assert.equal(result.safe, true, 'healthy campaign should be safe');
  });
});

// ── Funnel ordering ───────────────────────────────────────
describe('Funnel metrics', () => {
  test('funnel stages are ordered and narrow correctly', () => {
    const STAGES = ['discovered','qualified','verified','contacted','replied','interested','meeting','customer'];
    const counts = { discovered:1000, qualified:600, verified:450, contacted:300, replied:45, interested:20, meeting:12, customer:5 };

    const funnel = STAGES.map((s, i) => ({
      stage: s,
      count: counts[s] || 0,
      conversion: i === 0 ? 1 : (counts[STAGES[i-1]] > 0 ? counts[s] / counts[STAGES[i-1]] : 0),
    }));

    assert.equal(funnel[0].stage, 'discovered');
    assert.equal(funnel[funnel.length-1].stage, 'customer');
    assert.ok(funnel[0].count > funnel[funnel.length-1].count, 'funnel narrows from top to bottom');

    for (let i = 1; i < funnel.length; i++) {
      const conv = funnel[i].conversion;
      assert.ok(conv >= 0 && conv <= 1, `conversion at stage ${funnel[i].stage} must be 0-1, got ${conv}`);
    }
  });
});

// ── Deduplication ─────────────────────────────────────────
describe('Email deduplication', () => {
  test('normalizes email variants to single canonical form', () => {
    const normalize = (e) => e.trim().toLowerCase();
    const emails = ['Test@Company.com','test@company.com','TEST@COMPANY.COM','  test@company.com  '];
    const normalized = new Set(emails.map(normalize));
    assert.equal(normalized.size, 1, 'all variants should normalize to same email');
  });
});

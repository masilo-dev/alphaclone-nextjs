import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = process.cwd();
const read = (file) => fs.readFileSync(path.join(projectRoot, file), 'utf8');

test('Area A & O: TurnstileWidget resiliency and registration plan summary', () => {
  const turnstileSrc = read('src/components/security/TurnstileWidget.tsx');
  assert.match(turnstileSrc, /resetTurnstileScriptCache/, 'Exports resetTurnstileScriptCache');
  assert.match(turnstileSrc, /15000/, 'Uses 15,000ms timeout for script and challenge');

  const loginSrc = read('src/app/auth/login/page.tsx');
  assert.match(loginSrc, /Plan Selected/, 'Renders selected plan summary banner');
  assert.match(loginSrc, /resetTurnstileScriptCache/, 'Resets script cache on manual retry');
  assert.match(loginSrc, /45-day free trial/i, 'Mentions 45-day free trial on signup');
  assert.match(loginSrc, /No card required/i, 'States no card required on signup');
});

test('Area B: Copy clarification and pricing tier reconciliation', () => {
  const socialAuthSrc = read('src/components/auth/SocialAuthButtons.tsx');
  assert.doesNotMatch(
    socialAuthSrc,
    /Workspace created automatically — no form required/,
    'Removes misleading no-form claim before email registration'
  );
  assert.match(
    socialAuthSrc,
    /Fast 1-click workspace setup with your business account/,
    'Uses accurate 1-click account copy'
  );

  const pricingSrc = read('src/components/marketing/system/PricingPage.tsx');
  assert.doesNotMatch(
    pricingSrc,
    /\$80\/month/,
    'Removes outdated $80/month pricing inconsistency'
  );
  assert.match(
    pricingSrc,
    /\$85\/month/,
    'Table header displays authoritative $85/month Enterprise rate'
  );
});

test('Area B: Authoritative trial entitlement engine logic', async () => {
  const trialEngineSrc = read('src/lib/billing/trialEntitlement.ts');
  const compiled = ts.transpileModule(trialEngineSrc, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const moduleExports = {};
  const fn = new Function('exports', compiled);
  fn(moduleExports);
  const { getTrialEntitlement } = moduleExports;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Active paid customer
  const paidTenant = {
    id: 't-1',
    subscription_status: 'active',
    subscription_plan: 'pro',
    created_at: new Date(now - 30 * dayMs).toISOString(),
  };
  const paidRes = getTrialEntitlement(paidTenant);
  assert.equal(paidRes.status, 'paid');
  assert.equal(paidRes.isExpired, false);

  // Active trial within 14 days
  const activeTrialTenant = {
    id: 't-2',
    subscription_status: 'trialing',
    subscription_plan: 'starter',
    trial_start: new Date(now - 4 * dayMs).toISOString(),
    trial_end: new Date(now + 10 * dayMs).toISOString(),
    created_at: new Date(now - 4 * dayMs).toISOString(),
  };
  const activeTrialRes = getTrialEntitlement(activeTrialTenant);
  assert.equal(activeTrialRes.status, 'active');
  assert.equal(activeTrialRes.isExpired, false);
  assert.ok(activeTrialRes.daysRemaining >= 9 && activeTrialRes.daysRemaining <= 10);

  // Expired trial past 14 days
  const expiredTrialTenant = {
    id: 't-3',
    subscription_status: 'trialing',
    subscription_plan: 'starter',
    trial_start: new Date(now - 20 * dayMs).toISOString(),
    trial_end: new Date(now - 6 * dayMs).toISOString(),
    created_at: new Date(now - 20 * dayMs).toISOString(),
  };
  const expiredTrialRes = getTrialEntitlement(expiredTrialTenant);
  assert.equal(expiredTrialRes.status, 'expired');
  assert.equal(expiredTrialRes.isExpired, true);
  assert.equal(expiredTrialRes.daysRemaining, 0);

  // Tenant with no explicit subscription status created 50 days ago (implicit trial)
  const legacyExpiredTenant = {
    id: 't-4',
    created_at: new Date(now - 50 * dayMs).toISOString(),
  };
  const legacyRes = getTrialEntitlement(legacyExpiredTenant);
  assert.equal(legacyRes.status, 'expired');
  assert.equal(legacyRes.isExpired, true);
});

test('Area H: Multi-service platform status pill', () => {
  const pillSrc = read('src/components/status/PublicStatusPill.tsx');
  assert.match(
    pillSrc,
    /\/api\/platform-status/,
    'PublicStatusPill queries /api/platform-status aggregator as primary source of truth'
  );
  assert.match(pillSrc, /Operational/i);
  assert.match(pillSrc, /Degraded/i);
});

test('Area C & N: Module and lead deep link routing', () => {
  const routeSrc = read('src/lib/normalizeDashboardRoute.ts');
  const compiled = ts.transpileModule(routeSrc, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const moduleExports = {};
  const fn = new Function('exports', 'require', compiled);
  fn(moduleExports, (mod) => {
    if (mod === '@/lib/dashboard/canonicalRoutes') {
      return { resolveCanonicalPath: (p) => p };
    }
    return {};
  });

  const { normalizeBusinessRoute } = moduleExports;

  assert.equal(
    normalizeBusinessRoute('/dashboard?module=crm&lead=uuid-test-123'),
    '/dashboard/crm',
    '?module=crm normalizes to /dashboard/crm'
  );
  assert.equal(
    normalizeBusinessRoute('/dashboard?module=leads'),
    '/dashboard/leads',
    '?module=leads normalizes to /dashboard/leads'
  );
  assert.equal(
    normalizeBusinessRoute('/dashboard?tab=invoices'),
    '/dashboard/business/billing/manage',
    '?tab=invoices normalizes to billing manager'
  );

  const clientsPageSrc = read('src/components/dashboard/business/ClientsPage.tsx');
  assert.match(
    clientsPageSrc,
    /searchParams\?\.get\('lead'\)/,
    'ClientsPage extracts lead parameter'
  );
  assert.match(
    clientsPageSrc,
    /searchParams\?\.get\('leadId'\)/,
    'ClientsPage extracts leadId parameter'
  );
});

test('Area N: Attention counters, action center, and notification badges', () => {
  const attentionSrc = read('src/components/dashboard/AttentionFirstDashboard.tsx');
  assert.doesNotMatch(
    attentionSrc,
    /Math\.min\(attentionItems\.length, 6\) open/,
    'Removes hardcoded/capped "open" count in attention header'
  );
  assert.match(
    attentionSrc,
    /\{attentionItems\.length\}\s*\{attentionItems\.length === 1 \? t\('item'\) : t\('items'\)\}/,
    'Displays items count in attention header'
  );
  assert.match(
    attentionSrc,
    /in backlog/,
    'Clarifies task backlog detail label'
  );

  const actionCenterSrc = read('src/components/dashboard/bonnie/UnifiedActionCenter.tsx');
  assert.match(
    actionCenterSrc,
    /approvalItems\.length === 0/,
    'Suppresses "No urgent items" when approvals are pending'
  );

  const notifBellSrc = read('src/components/dashboard/Layout/NotificationBell.tsx');
  assert.match(notifBellSrc, /unreadCount > 99 \? '99\+' : unreadCount/);
  assert.match(notifBellSrc, /count:\s*'exact'/);

  const notifCenterSrc = read('src/components/dashboard/NotificationCenter.tsx');
  assert.match(notifCenterSrc, /unreadCount > 99 \? '99\+' : unreadCount/);
  assert.match(notifCenterSrc, /min-w-4/);
});

test('Area K & L: Integration status truth and legal retention harmonization', () => {
  const integrationsSrc = read('src/config/integrations.ts');
  assert.match(
    integrationsSrc,
    /integration\('stripe',\s*'Stripe',\s*'Payment processing and connected billing',\s*'AVAILABLE',\s*'payments'\)/,
    'Stripe integration is marked AVAILABLE'
  );

  const legalSrc = read('src/components/pages/LegalDocs.tsx');
  assert.match(
    legalSrc,
    /Personal data deleted within 72 hours of deletion request/,
    'Privacy policy preserves 72h GDPR/POPIA erasure requirement'
  );
  assert.match(
    legalSrc,
    /90 days of subscription termination \(or within 72 hours of an explicit erasure or account deletion request/,
    'DPA reconciles 90-day subscription cancellation grace period with 72-hour erasure timeline'
  );
});

test('Area V: Recorded demo player skeleton and external fallback', () => {
  const demoSrc = read('src/app/demo/page.tsx');
  assert.match(demoSrc, /iframeLoaded/, 'Tracks iframe loaded state');
  assert.match(demoSrc, /Loading recorded walkthrough\.\.\./, 'Shows loading skeleton placeholder');
  assert.match(demoSrc, /https:\/\/www\.loom\.com\/share\/3a7000c925c145b7882089688b0ceb5d/, 'Provides direct Loom fallback link');
});

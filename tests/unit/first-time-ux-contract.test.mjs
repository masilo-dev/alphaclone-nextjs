/**
 * First-time experience regression contracts.
 *
 * These source-level tests protect the outcome-led entry path and campaign
 * feedback without relying on a database, provider credentials, or browser
 * storage state. They are deliberately narrow so tenant and approval behavior
 * remains covered by the existing integration contracts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const onboarding = read('../../src/components/onboarding/OnboardingFlow.tsx');
const welcome = read('../../src/components/dashboard/business/BusinessWelcomeModal.tsx');
const dashboard = read('../../src/components/dashboard/business/BusinessDashboard.tsx');
const home = read('../../src/components/dashboard/business/BusinessHome.tsx');
const guide = read('../../src/components/pages/PlatformGuide.tsx');
const campaignPage = read('../../src/components/dashboard/marketing/EmailCampaignsPage.tsx');
const campaignBuilder = read('../../src/components/dashboard/business/CampaignBuilder.tsx');
const campaignSendRoute = read('../../src/app/api/email/campaigns/send/route.ts');
const campaignSender = read('../../src/lib/server/sendScheduledCampaignServer.ts');
const campaignService = read('../../src/services/emailCampaignService.ts');
const bottomNav = read('../../src/components/dashboard/BottomNav.tsx');
const translations = read('../../src/i18n/uiTranslate.ts');

test('first-use onboarding starts with a business outcome, not a persona', () => {
  assert.match(onboarding, /What do you want AlphaClone to do for your business\?/);
  assert.doesNotMatch(onboarding, /Solopreneur|Agency Founder|Customize Your Command Center/);
  for (const expectedGoal of [
    'Get more customers',
    'Post to social media',
    'Send emails and promotions',
    'Manage customers and enquiries',
    'Create quotes and invoices',
    'Manage projects and tasks',
  ]) {
    assert.match(onboarding, new RegExp(expectedGoal));
  }
  assert.match(onboarding, /href: '\/dashboard\/leads\/campaigns'/);
  assert.match(onboarding, /href: '\/dashboard\/business\/social\/compose'/);
  assert.match(onboarding, /href: '\/dashboard\/business\/campaigns'/);
  assert.match(onboarding, /href: '\/dashboard\/crm\/workspace\?quickAdd=true'/);
  assert.match(onboarding, /onComplete: \(nextPath\?: string\) => void/);
  assert.match(dashboard, /const handleOnboardingComplete = \(nextPath\?: string\)/);
  assert.match(dashboard, /if \(nextPath\) \{\s*setActiveTab\(nextPath\);\s*return;/);
});

test('onboarding is durably saved before it is locally cached or routed', () => {
  assert.match(onboarding, /fetch\('\/api\/account\/profile'/);
  assert.match(onboarding, /if \(!profileResponse\.ok\)/);
  assert.match(onboarding, /supabase\.auth\.updateUser/);
  assert.match(onboarding, /localStorage\.setItem\(`onboarding_completed_\$\{user\.id\}`, 'true'\)/);
  assert.match(onboarding, /Nothing has been changed/);
  assert.doesNotMatch(onboarding, /Moving to dashboard/);
});

test('welcome and dashboard setup avoid a second competing first-use checklist', () => {
  assert.match(welcome, /Choose my first goal/);
  assert.match(welcome, /You do not need to set up everything today/);
  assert.match(home, /const \[onboardingComplete, setOnboardingComplete\]/);
  assert.match(home, /const showSetup = !onboardingComplete/);
  assert.match(home, /alphaclone:onboarding-updated/);
});

test('guide module cards are keyboard-accessible deep links and signup directions are current', () => {
  assert.match(guide, /import Link from 'next\/link'/);
  assert.match(guide, /href: '\/dashboard\/leads\/campaigns'/);
  assert.match(guide, /href: '\/dashboard\/business\/social\/compose'/);
  assert.match(guide, /href: '\/dashboard\/business\/campaigns'/);
  assert.match(guide, /aria-label=\{`Open \$\{item\.area\}`\}/);
  assert.match(guide, /aria-label=\{`Open \$\{title\}`\}/);
  assert.match(guide, /focus-visible:ring-2/);
  assert.match(guide, /href="\/auth\/login\?register=true"/);
  assert.match(guide, /Choose one business outcome/);
  assert.match(guide, /Review before anything leaves AlphaClone/);
  assert.doesNotMatch(guide, /10 steps|14-day free trial|under 30 minutes|\$45\/month/);
});

test('campaign setup presents one real four-step path and blocks absent sender identity', () => {
  assert.match(campaignPage, /const CAMPAIGN_STEPS = \[/);
  assert.match(campaignPage, /Send a clear message in four steps/);
  assert.match(campaignPage, /Name your message and sender/);
  assert.match(campaignPage, /Choose who you are contacting/);
  assert.match(campaignPage, /Review, then send or schedule/);
  assert.doesNotMatch(campaignPage, /16-step wizard|zero-tech, 16 guided steps/);
  assert.match(campaignBuilder, /activeStep === 1 \? 'Name & sender'/);
  assert.match(campaignBuilder, /activeStep === 2 \? 'Who are you contacting\?'/);
  assert.match(campaignBuilder, /id="campaign-from-email"/);
  assert.match(campaignBuilder, /Add the business email address customers can reply to\./);
  assert.match(campaignBuilder, /Choose a date and time, or turn off scheduling to send after review\./);
  assert.match(campaignBuilder, /label: 'Promote an offer'/);
  assert.doesNotMatch(campaignBuilder, /Sender email is empty in the builder/);
});

test('campaign submission acknowledges work immediately and reports verified outcomes', () => {
  assert.match(campaignBuilder, /const \[isSubmitting, setIsSubmitting\] = useState\(false\)/);
  assert.match(campaignBuilder, /setSubmissionStatus\('Creating a saved campaign draft\.\.\.'/);
  assert.match(campaignBuilder, /role="status"/);
  assert.match(campaignBuilder, /aria-live="polite"/);
  assert.match(campaignBuilder, /disabled=\{isSubmitting \|\| composeAudit\.issues\.length > 0\}/);
  assert.match(campaignBuilder, /Campaign finished with \$\{delivery\.sent \?\? 0\} sent and \$\{delivery\.failed \?\? 0\} needing attention/);
  assert.match(campaignSender, /status: failedCount > 0 \? "partial" : "completed"/);
  assert.match(campaignSendRoute, /delivery: \{\s*status: result\.status \|\| 'completed'/);
  assert.match(campaignSendRoute, /delivery: \{ status: 'queued' \}/);
  assert.match(campaignService, /delivery\?: \{ status: 'completed' \| 'partial' \| 'queued'/);
});

test('mobile navigation asks its parent to navigate exactly once', () => {
  assert.match(bottomNav, /onNavigate\(href\);/);
  assert.doesNotMatch(bottomNav, /router\.push\(href\)/);
  assert.doesNotMatch(bottomNav, /useRouter/);
});

test('plain-language navigation remains translated for Spanish and Polish', () => {
  for (const translatedLabel of [
    'Business activity',
    'Automation & insights',
    'Follow-up inbox',
  ]) {
    const occurrences = translations.match(new RegExp(`'${translatedLabel}':`, 'g')) ?? [];
    assert.equal(occurrences.length, 2, `${translatedLabel} needs Spanish and Polish translations`);
  }
});

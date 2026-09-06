/**
 * Overdue-task alarm clarity + language switching coverage.
 *
 *  - The countdown must explain itself ("Due in …" / "Overdue by …") in every
 *    supported language, so the deadline chime is never an unexplained noise.
 *  - The chime must only fire when a deadline passes while the page is open,
 *    never for items already overdue on mount.
 *  - Every string the dashboard shell / countdown translates must exist in both
 *    the Spanish and Polish tables so switching language never leaves a mix.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.resolve(here, rel), 'utf8');

const { uiTranslate } = await import('../../src/i18n/uiTranslate.ts');
const { LANGUAGES, formatLocaleDate, languageToBcp47 } = await import('../../src/i18n/languages.ts');

const COUNTDOWN_STRINGS = [
  'Due',
  'Due in',
  'Overdue by',
  'Deadline passed on',
  'No deadline',
  '{name} is now overdue',
  'A deadline was just reached',
];

describe('TaskCountdown alarm clarity', () => {
  it('formats remaining / overdue durations readably', async () => {
    const { formatDurationParts } = await import('../../src/components/dashboard/tasks/TaskCountdown.tsx');
    const MIN = 60_000;
    assert.equal(formatDurationParts(2 * 24 * 60 * MIN + 3 * 60 * MIN + 4 * MIN), '2d 3h 4m');
    assert.equal(formatDurationParts(3 * 60 * MIN + 4 * MIN + 5_000), '3h 4m 5s');
    assert.equal(formatDurationParts(4 * MIN + 5_000), '4m 5s');
    // Overdue values are negative; the label shows the magnitude.
    assert.equal(formatDurationParts(-(4 * MIN + 5_000)), '4m 5s');
  });

  it('never chimes for deadlines that were already overdue on mount', () => {
    const source = read('../../src/components/dashboard/tasks/TaskCountdown.tsx');
    // Seed the "already fired" ref from the initial overdue state...
    assert.match(source, /useRef<boolean>\(new Date\(dueDate\)\.getTime\(\) <= Date\.now\(\)\)/);
    // ...and only chime on the not-overdue -> overdue transition.
    assert.match(source, /diff <= 0 && !alarmFiredRef\.current/);
    // The chime is always paired with a toast that names the item.
    assert.match(source, /playDeadlineChime\(\);[\s\S]*?toast\(/);
    // No third-party audio asset that can 404 or be ad-blocked.
    assert.doesNotMatch(source, /mixkit|new Audio\(/);
  });

  it('passes the project name so the toast can say which deadline was reached', () => {
    const source = read('../../src/components/dashboard/business/ProjectsPage.tsx');
    const usages = source.match(/<TaskCountdown[^>]*>/g) ?? [];
    assert.ok(usages.length >= 2, 'ProjectsPage should render TaskCountdown in card + list views');
    for (const usage of usages) {
      assert.match(usage, /label=\{project\.name\}/);
    }
  });
});

describe('language switching', () => {
  it('supports en/es/pl with matching BCP-47 locales', () => {
    assert.deepEqual(LANGUAGES.map((l) => l.code), ['en', 'es', 'pl']);
    assert.deepEqual(languageToBcp47('es'), ['es-ES', 'es']);
    assert.deepEqual(languageToBcp47('pl'), ['pl-PL', 'pl']);
    assert.deepEqual(languageToBcp47('en'), ['en-US', 'en']);
  });

  it('translates every countdown string into Spanish and Polish', () => {
    for (const key of COUNTDOWN_STRINGS) {
      assert.equal(uiTranslate('en', key), key);
      assert.notEqual(uiTranslate('es', key), key, `missing ES translation for "${key}"`);
      assert.notEqual(uiTranslate('pl', key), key, `missing PL translation for "${key}"`);
    }
    assert.equal(uiTranslate('es', '{name} is now overdue').replace('{name}', 'Sitio web'), 'Sitio web ahora está atrasado');
    assert.equal(uiTranslate('pl', '{name} is now overdue').replace('{name}', 'Strona'), 'Strona jest teraz po terminie');
  });

  it('keeps the Spanish and Polish tables in sync (no half-translated UI after switching)', () => {
    const source = read('../../src/i18n/uiTranslate.ts');
    const esBlock = source.slice(source.indexOf('const ES:'), source.indexOf('const PL:'));
    const plBlock = source.slice(source.indexOf('const PL:'), source.indexOf('export function uiTranslate'));
    const keysOf = (block) =>
      new Set(
        [...block.matchAll(/^\s+(?:'((?:[^'\\]|\\.)*)'|([A-Za-z][\w-]*)):/gm)].map((m) => (m[1] ?? m[2]).replace(/\\'/g, "'")),
      );
    const es = keysOf(esBlock);
    const pl = keysOf(plBlock);
    const missingInPl = [...es].filter((k) => !pl.has(k));
    const missingInEs = [...pl].filter((k) => !es.has(k));
    assert.deepEqual(missingInPl, [], `keys translated to ES but not PL: ${missingInPl.join(', ')}`);
    assert.deepEqual(missingInEs, [], `keys translated to PL but not ES: ${missingInEs.join(', ')}`);
  });

  it('formats dates for the active language', () => {
    const date = new Date('2026-09-06T10:30:00Z');
    const en = formatLocaleDate(date, 'en', { dateStyle: 'long', timeZone: 'UTC' });
    const es = formatLocaleDate(date, 'es', { dateStyle: 'long', timeZone: 'UTC' });
    const pl = formatLocaleDate(date, 'pl', { dateStyle: 'long', timeZone: 'UTC' });
    assert.match(en, /September/);
    assert.match(es, /septiembre/);
    assert.match(pl, /września/);
  });

  it('translates the whole dashboard shell (sidebar hubs, home screen, KPI cards, date ranges)', async () => {
    // Every sidebar label passes through t() in Sidebar.tsx, so each one needs a dictionary entry.
    const navSource = read('../../src/constants.ts');
    const navLabels = [...navSource.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
    // Period presets + comparison labels are rendered by MetricDateRangeSelector / IntelligentKpiCard.
    const { METRIC_PERIOD_OPTIONS } = await import('../../src/lib/metrics/dateRange.ts');
    const rangeSource = read('../../src/lib/metrics/dateRange.ts');
    const comparisonLabels = [...rangeSource.matchAll(/comparisonLabel: '([^']+)'/g)].map((m) => m[1]);
    const homeStrings = [
      'Good morning', 'Good afternoon', 'Good evening',
      'Here is what needs your attention across', 'today.',
      'Customise', 'Add contact', 'Attention', 'Full OS',
      'Total revenue', 'New leads', 'Conversion rate', 'Outstanding invoices',
      'Upcoming meetings', 'Tasks requiring attention', 'Deals won', 'Overdue invoices',
      'Improving', 'At risk', 'Stagnant', 'New', 'No data available.',
      'Key metrics', 'Status signals', 'Platform health', 'Needs attention',
      'Business overview', 'Your modules', 'Today', 'Meetings, tasks, and deadlines.',
      'Welcome to AlphaClone Systems', 'Take a quick tour', 'Dismiss',
    ];
    const all = [...new Set([...navLabels, ...METRIC_PERIOD_OPTIONS.map((o) => o.label), ...comparisonLabels, ...homeStrings])];
    for (const lang of ['es', 'pl']) {
      // Loan words / brand names that are legitimately identical in the target language.
      const sameInTarget = /^(CRM|SMS|WhatsApp|MCP monitor|AI Studio|Bonnie AI|Nexus|Gmail|SEO|Est\.|Tickets|Leads)$/;
      const untranslated = all.filter((s) => uiTranslate(lang, s) === s && !sameInTarget.test(s));
      assert.deepEqual(untranslated, [], `${lang} is missing: ${untranslated.join(' | ')}`);
    }
  });

  it('wires t() into the shared home-screen components', () => {
    const files = [
      '../../src/components/dashboard/OperatingSystemHome.tsx',
      '../../src/components/dashboard/AttentionFirstDashboard.tsx',
      '../../src/components/dashboard/PlatformExecutionWelcome.tsx',
      '../../src/components/dashboard/DashboardHomeLayoutToggle.tsx',
      '../../src/components/dashboard/metrics/MetricDateRangeSelector.tsx',
      '../../src/components/dashboard/metrics/ModuleKpiRichSections.tsx',
      '../../src/components/dashboard/metrics/PlatformKpiCard.tsx',
      '../../src/components/ui/intelligence/IntelligentKpiCard.tsx',
      '../../src/components/ui/os/AttentionPanel.tsx',
      '../../src/components/ui/os/TodayPanel.tsx',
      '../../src/components/ui/os/OverviewChartCard.tsx',
      '../../src/components/ui/os/ModuleLauncher.tsx',
    ];
    for (const rel of files) {
      assert.match(read(rel), /useLanguage\(\)/, `${rel} must read the active language`);
    }
    // KPI cards translate label + badge + comparison period so every module benefits.
    const kpi = read('../../src/components/ui/intelligence/IntelligentKpiCard.tsx');
    assert.match(kpi, /\{t\(vm\.label\)\}/);
    assert.match(kpi, /\{t\(labels\[status\]\)\}/);
    assert.match(kpi, /t\(vm\.referencePeriod\)/);
  });

  it('translates module hubs, execution guides, settings categories and the product tour', async () => {
    // HubShell renders every hub title / description / tab through t().
    const hubDir = path.resolve(here, '../../src/components/dashboard/hubs');
    const { readdirSync } = await import('node:fs');
    const hubStrings = readdirSync(hubDir)
      .filter((f) => f.endsWith('.tsx'))
      .flatMap((f) => {
        const src = readFileSync(path.join(hubDir, f), 'utf8');
        return [
          ...[...src.matchAll(/title="([^"]+)"/g)].map((m) => m[1]),
          ...[...src.matchAll(/description="([^"]+)"/g)].map((m) => m[1]),
          ...[...src.matchAll(/label: '([^']+)'/g)].map((m) => m[1]),
        ];
      });
    // ExecutionDecisionGuide renders each step label / title / description through t().
    const stepsSource = read('../../src/lib/ui/dashboardExecutionSteps.ts');
    const stepStrings = [...stepsSource.matchAll(/(?:label|title|description): '((?:[^'\\]|\\.)+)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
    const statusSource = read('../../src/lib/ui/statusSemantics.ts');
    const statusLabels = [...statusSource.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
    const settingsSource = read('../../src/components/dashboard/settings/SettingsCategoryNav.tsx');
    const settingsStrings = [...settingsSource.matchAll(/(?:label|description): '([^']+)'/g)].map((m) => m[1]);
    const tourSource = read('../../src/components/onboarding/ProductTour.tsx');
    const tourStrings = [...tourSource.matchAll(/content: t\('((?:[^'\\]|\\.)+)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
    assert.ok(tourStrings.length >= 20, 'tour steps must be wrapped in t()');
    assert.match(tourSource, /nextLabelWithProgress: t\(/);

    const all = [...new Set([...hubStrings, ...stepStrings, ...statusLabels, ...settingsStrings, ...tourStrings,
      'Execution guide', 'Follow the steps in order. Colors mean the same thing across the workspace.'])];
    const sameInTarget = /^(CRM|SMS|WhatsApp|Teams|Marketplace|Zoho CRM|Bonnie AI|Tickets|Leads|Mail|Marketing|Onboarding|Pipeline|Console|Analytics|Forecast)$/;
    for (const lang of ['es', 'pl']) {
      const untranslated = all.filter((s) => uiTranslate(lang, s) === s && !sameInTarget.test(s));
      assert.deepEqual(untranslated, [], `${lang} is missing: ${untranslated.join(' | ')}`);
    }

    for (const rel of [
      '../../src/components/dashboard/hubs/HubShell.tsx',
      '../../src/components/dashboard/ExecutionDecisionGuide.tsx',
      '../../src/components/dashboard/settings/SettingsCategoryNav.tsx',
      '../../src/components/documents/SharedDocumentsWorkspace.tsx',
    ]) {
      assert.match(read(rel), /useLanguage\(\)/, `${rel} must read the active language`);
    }
  });
});

#!/usr/bin/env node
/**
 * Production design-system + data-trust static guards.
 * Fails CI when dashboard production surfaces reintroduce known anti-patterns.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const failures = [];

// Keep migrated dashboard surfaces on semantic, theme-aware color tokens.
for (const rel of [
  'src/components/dashboard/AttentionFirstDashboard.tsx',
  'src/components/dashboard/business/ClientPortalAccessPanel.tsx',
]) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  if (/(?:bg|text|border)-(?:slate|gray|zinc|emerald|amber|red|green|blue|sky|teal)-\d{2,3}|#[\da-fA-F]{3,8}\b/.test(source)) {
    failures.push(`${rel}: use workspace/status tokens for component colors`);
  }
}
const projectsSource = fs.readFileSync(path.join(root, 'src/components/dashboard/business/ProjectsPage.tsx'), 'utf8');
const projectModalSource = projectsSource.split('const ProjectModal =')[1]?.split('const ProjectTimeline =')[0] || '';
if (/(?:bg|text|border)-(?:slate|gray|zinc|emerald|amber|red|green|blue|sky|teal)-\d{2,3}|#[\da-fA-F]{3,8}\b/.test(projectModalSource)) {
  failures.push('src/components/dashboard/business/ProjectsPage.tsx: project dialog must use workspace/status tokens');
}
const clientsSource = fs.readFileSync(path.join(root, 'src/components/dashboard/business/ClientsPage.tsx'), 'utf8');
if (/ac-workspace-panel rounded-xl p-5 border border-slate-700\/60 bg-gradient-to-br/.test(clientsSource)) {
  failures.push('src/components/dashboard/business/ClientsPage.tsx: client portal panel must use workspace tokens');
}
const billingSource = fs.readFileSync(path.join(root, 'src/components/dashboard/business/EnhancedBillingPage.tsx'), 'utf8');
const invoiceSheet = billingSource.split('{/* Invoice Options Bottom Sheet */}')[1]?.split('{/* PDF Preview Modal */}')[0] || '';
if (/(?:bg|text|border)-(?:slate|gray|zinc|emerald|amber|red|green|blue|sky|teal|indigo|violet|purple)-\d{2,3}|bg-black\/80/.test(invoiceSheet)) {
  failures.push('src/components/dashboard/business/EnhancedBillingPage.tsx: invoice options sheet must use workspace/status tokens');
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assertNotMatch(rel, re, message) {
  const src = read(rel);
  if (re.test(src)) failures.push(`${rel}: ${message}`);
}

function assertMatch(rel, re, message) {
  const src = read(rel);
  if (!re.test(src)) failures.push(`${rel}: ${message}`);
}

// --- Data trust ---
assertNotMatch(
  'src/components/dashboard/ExecutiveDashboard.tsx',
  /\+12%|'-5%'/,
  'must not hardcode revenue trend deltas'
);
assertNotMatch(
  'src/components/dashboard/AnalyticsDashboard.tsx',
  /\+72/,
  'must not hardcode NPS'
);
assertNotMatch(
  'src/components/dashboard/accounting/CashFlowStatement.tsx',
  /investing\s*=\s*0|financing\s*=\s*0/,
  'must not present untracked cash-flow as zero'
);
assertNotMatch(
  'src/components/dashboard/crm/CRMReportsTab.tsx',
  /status === 'qualified' \|\| l\.client_id/,
  'must not treat qualified/client_id as conversion wins'
);
assertNotMatch(
  'src/components/dashboard/business/BusinessPerformanceDashboard.tsx',
  /Revenue Momentum \+12%/,
  'must not hardcode revenue momentum copy'
);
assertNotMatch(
  'src/components/dashboard/business/EngagingDashboard.tsx',
  /\[78,\s*64,\s*52,\s*70\]/,
  'must not use decorative KPI progress widths'
);
assertNotMatch(
  'src/components/dashboard/BusinessHomeDashboard.tsx',
  /78 \+ Math\.round/,
  'must not fabricate business health scores'
);

// --- Canonical home / orphans are shims ---
assertMatch(
  'src/components/dashboard/BusinessHomeDashboard.tsx',
  /AttentionFirstDashboard/,
  'orphaned BusinessHomeDashboard must re-export AttentionFirstDashboard'
);
assertMatch(
  'src/components/dashboard/business/EngagingDashboard.tsx',
  /AttentionFirstDashboard/,
  'orphaned EngagingDashboard must re-export AttentionFirstDashboard'
);
assertMatch(
  'src/components/dashboard/AnalyticsDashboard.tsx',
  /AnalyticsTab/,
  'orphaned AnalyticsDashboard must re-export AnalyticsTab'
);

// --- Accessibility foundations ---
assertMatch(
  'src/components/dashboard/business/BusinessDashboard.tsx',
  /id="main-content"/,
  'BusinessDashboard main landmark must have id=main-content'
);
assertMatch(
  'src/components/dashboard/business/BusinessDashboard.tsx',
  /SkipToMainContent/,
  'BusinessDashboard must wire SkipToMainContent'
);
assertMatch(
  'src/components/Dashboard.tsx',
  /SkipToMainContent/,
  'Dashboard must wire SkipToMainContent'
);
assertMatch(
  'src/components/ui/UIComponents.tsx',
  /role="dialog"/,
  'Modal must expose dialog role'
);
assertMatch(
  'src/components/dashboard/CommandPalette.tsx',
  /role="dialog"/,
  'CommandPalette must expose dialog role'
);
assertMatch(
  'src/components/ui/workspace/WorkspaceSwitcher.tsx',
  /createPortal\([\s\S]*ac-layer-menu[\s\S]*document\.body/,
  'module switcher menu must render above module content, outside clipped toolbar layers'
);

// --- Canonical finance ---
assertMatch(
  'src/components/Dashboard.tsx',
  /EnhancedBillingPage/,
  'admin/client finance/manage must use EnhancedBillingPage'
);
assertMatch(
  'src/lib/dashboard/canonicalRoutes.ts',
  /\/dashboard\/business\/billing\/manage/,
  'canonical invoice route must be registered'
);

// --- Mobile dead actions ---
assertMatch(
  'mobile/src/screens/DashboardScreen.tsx',
  /navigation\.navigate\('Projects'/,
  'mobile Quick Actions must navigate'
);

// --- Duplicate alias ownership ---
const { findDuplicateAliases } = await import('../src/lib/dashboard/canonicalRoutes.ts');
const dupes = findDuplicateAliases();
if (dupes.length) {
  failures.push(`canonicalRoutes duplicate aliases: ${dupes.join('; ')}`);
}

if (failures.length) {
  console.error('design-system-guard FAILED:\n' + failures.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}

console.log('design-system-guard OK');

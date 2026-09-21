import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { resolveAppSurface } from '../../src/lib/pwa/appSurface.ts';

const read = (relativePath) => readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

test('all requested phone widths resolve to the installed mobile surface', () => {
  for (const width of [320, 360, 375, 390, 412, 430]) {
    assert.equal(resolveAppSurface({ isPwa: true, width, coarsePointer: true }), 'pwa-mobile');
  }
});

test('installed touch tablets use companion behavior through 1366px', () => {
  for (const width of [768, 820, 1024, 1100, 1280, 1366]) {
    assert.equal(resolveAppSurface({ isPwa: true, width, coarsePointer: true }), 'pwa-tablet');
  }
  assert.equal(resolveAppSurface({ isPwa: true, width: 1367, coarsePointer: true }), 'pwa-desktop');
  assert.equal(resolveAppSurface({ isPwa: true, width: 1280, coarsePointer: false }), 'pwa-desktop');
});

test('browser surfaces never inherit installed companion behavior', () => {
  for (const width of [320, 768, 1440]) {
    assert.equal(resolveAppSurface({ isPwa: false, width, coarsePointer: true }), 'browser');
  }
});

test('desktop handoff adds and honors an explicit desktop experience override', () => {
  const handoff = read('src/components/ui/os/DesktopRequired.tsx');
  const boundary = read('src/components/pwa/CompanionCapabilityBoundary.tsx');
  assert.match(handoff, /searchParams\.set\('experience', 'desktop'\)/);
  assert.match(boundary, /requestedDesktopExperience/);
  assert.match(boundary, /capability\.level !== 'DESKTOP' \|\| requestedDesktopExperience/);
});

test('mobile More navigation delegates exactly once to its dashboard owner', () => {
  const source = read('src/components/dashboard/responsive/MobileMoreSheet.tsx');
  assert.match(source, /onNavigate\?\.\(href\)/);
  assert.doesNotMatch(source, /router\.push|useRouter/);
  assert.doesNotMatch(source, /Mobile ready|Quick actions|View on mobile/);
  assert.match(source, /capability\.level === 'DESKTOP'/);
  assert.match(source, /Use on laptop/);
});

test('mobile headers use the AlphaClone mark and icon-only native actions', () => {
  const dashboard = read('src/components/Dashboard.tsx');
  const businessDashboard = read('src/components/dashboard/business/BusinessDashboard.tsx');
  const accountMenu = read('src/components/dashboard/DashboardAccountMenu.tsx');
  for (const source of [dashboard, businessDashboard]) {
    assert.match(source, /alt="AlphaClone"/);
    assert.match(source, /aria-label=\{t\('Open Bonnie AI'\)\}/);
  }
  assert.match(accountMenu, /inset-x-3 bottom-/);
  assert.match(accountMenu, /md:h-auto md:w-auto/);
});

test('CRM and Social stay on phone while Contracts hand off to a laptop', () => {
  const capabilities = read('src/config/pwaCompanionCapabilities.ts');
  assert.match(capabilities, /crm: \{ level: 'COMPANION'/);
  assert.match(capabilities, /social: \{ level: 'COMPANION'/);
  assert.match(capabilities, /contracts: \{ level: 'DESKTOP', quickActions: \[\]/);
  assert.match(capabilities, /Contracts are best managed on a laptop or desktop/);
});

test('installed PWA exposes native create actions without desktop navigation', () => {
  const navigation = read('src/components/dashboard/BottomNav.tsx');
  const createSheet = read('src/components/dashboard/responsive/MobileCreateSheet.tsx');
  const globalStyles = read('src/app/globals.css');
  assert.match(navigation, /moduleId: 'create'/);
  for (const action of ['Add client', 'Email client', 'New task', 'New meeting', 'New deal', 'New invoice', 'New project', 'Social post']) {
    assert.match(createSheet, new RegExp(action));
  }
  assert.match(createSheet, /quickAdd=true/);
  assert.match(createSheet, /compose=true/);
  assert.match(globalStyles, /ac-responsive-create-sheet/);
  assert.match(globalStyles, /ac-pwa-desktop-only/);
  assert.match(globalStyles, /ac-pwa-touch-flex/);
});

test('push deep links retain tenant routing and prefer an exact open client', () => {
  const worker = read('src/app/sw.ts');
  const bootstrap = read('src/components/pwa/PwaPushBootstrap.tsx');
  assert.match(worker, /notificationTenant/);
  assert.match(worker, /exactClient/);
  assert.match(bootstrap, /switchTenant\(requestedTenantId\)/);
  assert.match(bootstrap, /userTenants\.some/);
});

test('dashboard shell has one page-scroll owner', () => {
  const shell = read('src/components/shells/AppShell.tsx');
  const scrollRegion = read('src/components/common/DashboardScrollRegion.tsx');
  assert.match(shell, /isDashboardRoute \? 'overflow-hidden'/);
  assert.match(scrollRegion, /data-dashboard-scroll-region/);
  assert.match(scrollRegion, /isTouchCompanion/);
});

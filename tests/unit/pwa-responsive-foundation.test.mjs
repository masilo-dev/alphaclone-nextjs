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
  assert.doesNotMatch(boundary, /useSearchParams/);
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

test('installed module dashboards use an action-first native workspace', () => {
  const dashboard = read('src/components/dashboard/views/ModuleDashboardView.tsx');
  const chrome = read('src/components/ui/os/ModuleOverviewChrome.tsx');
  assert.match(dashboard, /isInstalledMobileCompanion/);
  assert.match(dashboard, /NativeModuleWorkspace/);
  assert.match(dashboard, /data-native-module-workspace/);
  assert.match(dashboard, /NativeListTile/);
  assert.match(dashboard, /DesktopModuleOnly/);
  assert.match(chrome, /data-native-module/);
  assert.match(chrome, /if \(isInstalledMobileCompanion\)/);
});

test('installed module interiors remove desktop chrome and learning guides', () => {
  const frame = read('src/components/ui/os/ModuleFrame.tsx');
  const layout = read('src/components/ui/ModulePageLayout.tsx');
  const hub = read('src/components/dashboard/hubs/HubShell.tsx');
  const guidance = read('src/hooks/useProgressiveGuidance.ts');
  const executionHeader = read('src/components/dashboard/common/UniversalModuleExecutionHeader.tsx');
  for (const source of [frame, layout, hub]) assert.match(source, /isInstalledMobileCompanion/);
  assert.match(frame, /data-native-module-frame/);
  assert.match(layout, /header && !isInstalledMobileCompanion/);
  assert.match(layout, /stats && !isInstalledMobileCompanion/);
  assert.match(guidance, /7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(executionHeader, /if \(!showGuidance\)/);
});

test('deep CRM and billing workspaces use native detail and compact manager patterns', () => {
  const drawer = read('src/components/ui/DetailDrawer.tsx');
  const crm = read('src/components/dashboard/CRMTab.tsx');
  const billing = read('src/components/dashboard/business/EnhancedBillingPage.tsx');
  const timeline = read('src/components/communication/CustomerTimeline.tsx');
  assert.match(drawer, /size === 'fullscreen' \|\| isInstalledMobileCompanion/);
  assert.match(crm, /maxItems=\{isInstalledMobileCompanion \? 8 : 50\}/);
  assert.match(billing, /!isInstalledMobileCompanion && \(stats\.totalInvoiced/);
  assert.match(timeline, /'undefined', 'null'/);
});

test('all installed module interiors inherit compact native density and scrollable tabs', () => {
  const styles = read('src/styles/alphaclone-os-v3-pwa.css');
  assert.match(styles, /html:is\(\.ac-pwa-mobile, \.ac-pwa-tablet\) \.ac-module-frame/);
  assert.match(styles, /\.ac-module-frame \[role='tablist'\]/);
  assert.match(styles, /overflow-x: auto/);
  assert.match(styles, /\.grid-cols-3, \.grid-cols-4, \.grid-cols-5, \.grid-cols-6/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.text-4xl, \.text-5xl, \.text-6xl/);
});

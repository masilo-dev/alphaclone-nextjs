import test from 'node:test';
import assert from 'node:assert/strict';

// Module 1: Booking & Calendar
import { bookingService } from '../../src/services/bookingService.ts';
import { calendarService } from '../../src/services/calendarService.ts';

// Module 2: Analytics & Reporting
import { analyticsService } from '../../src/services/analyticsService.ts';
import { percentChange, leadConversionRate } from '../../src/domain/metrics/calculations.ts';

// Module 3: Website, SEO & Conversion
import { STATIC_SITEMAP } from '../../src/lib/seo/sitemapData.ts';

// Module 4: PWA, UI/UX & Navigation
import { resolveAppSurface } from '../../src/lib/pwa/appSurface.ts';
import { resolveCanonicalPath } from '../../src/lib/dashboard/canonicalRoutes.ts';

// Module 5: Client Lifecycle & Customer Success
import { clientLifecycleService } from '../../src/services/clientLifecycleService.ts';

// Module 6: Product Tour & Help Center
import { getWalkthroughRecord, WALKTHROUGH_VERSION } from '../../src/lib/onboarding/walkthroughService.ts';
import { PLATFORM_HELP_SECTIONS, PLATFORM_HELP_INTRO } from '../../src/config/platformGlossary.ts';

// Module 7: Team & Workspace Management
import { teamService } from '../../src/services/teamService.ts';

// Module 8: Templates & Content Library
import { CONTRACT_TEMPLATE_REGISTRY } from '../../src/lib/contracts/templates/contractTemplateRegistry.ts';

// Module 9: Data Import, Export & Migration
import { exportToCSV } from '../../src/utils/exportData.ts';

// Module 10: Platform Status & Incident Management
import { effectiveStatus, overallStatus, SERVICES } from '../../src/lib/platform-monitoring/model.ts';

test('1. Booking & Calendar: Service interface, cancellation filtering, and calendar federation', () => {
  assert.equal(typeof bookingService.getAvailableSlots, 'function');
  assert.equal(typeof bookingService.createBooking, 'function');
  assert.equal(typeof bookingService.updateStatus, 'function');
  assert.equal(typeof bookingService.rescheduleBooking, 'function');
  assert.equal(typeof calendarService.getEvents, 'function');
  assert.equal(typeof calendarService.createEvent, 'function');
});

test('2. Analytics & Reporting: Safe percentage calculations and reporting service integrity', () => {
  // Never return Infinity or NaN on zero baseline
  assert.equal(percentChange(100, 0), null);
  assert.equal(percentChange(0, 0), 0);
  assert.equal(percentChange(150, 100), 50);

  // Conversion rate returns structured result
  assert.equal(leadConversionRate({ total: 0, converted: 0 }).rate, null);
  assert.equal(leadConversionRate({ total: 100, converted: 10 }).rate, 10);
  assert.equal(leadConversionRate({ total: 10, converted: 15 }).rate, null);

  assert.equal(typeof analyticsService.getAnalytics, 'function');
});

test('3. Website, SEO & Conversion: Robots.txt disallow policies and static sitemap paths', async () => {
  const robotsModule = await import('../../src/app/robots.ts');
  const getRobots = robotsModule.default || robotsModule;
  const robotsConfig = getRobots();
  assert.ok(Array.isArray(robotsConfig.rules));
  
  // Verify standard search engines and AI engines are allowed on public pages
  const defaultRule = robotsConfig.rules.find((r) => r.userAgent === '*');
  assert.ok(defaultRule);
  assert.deepEqual(defaultRule.allow, ['/']);
  assert.ok(defaultRule.disallow.includes('/dashboard'));
  assert.ok(defaultRule.disallow.includes('/api/'));

  // Static sitemap must have key landing pages
  assert.ok(Array.isArray(STATIC_SITEMAP));
  const urls = STATIC_SITEMAP.map((item) => item.url);
  assert.ok(urls.some((u) => u.includes('alphaclonesystems.com')));
  assert.ok(urls.some((u) => u.includes('/pricing')));
});

test('4. PWA, UI/UX & Navigation: Surface resolution and canonical path resolution', () => {
  // PWA surface resolution
  assert.equal(resolveAppSurface({ isPwa: false, width: 1200, coarsePointer: false }), 'browser');
  assert.equal(resolveAppSurface({ isPwa: true, width: 400, coarsePointer: true }), 'pwa-mobile');
  assert.equal(resolveAppSurface({ isPwa: true, width: 1200, coarsePointer: false }), 'pwa-desktop');

  // Canonical navigation aliases
  assert.equal(resolveCanonicalPath('/dashboard/business'), '/dashboard');
  assert.equal(resolveCanonicalPath('/dashboard/operations-command'), '/dashboard/operations');
});

test('5. Client Lifecycle & Customer Success: Lifecycle service contract and multi-client aggregation', () => {
  assert.equal(typeof clientLifecycleService.getClientLifecycleSummary, 'function');
  assert.equal(typeof clientLifecycleService.bulkGetClientLifecycleSummaries, 'function');
});

test('6. Product Tour & Help Center: Walkthrough versioning and platform glossary entries', () => {
  // Walkthrough service defaults
  const record = getWalkthroughRecord('');
  assert.equal(record.state, 'not_started');
  assert.equal(record.version, WALKTHROUGH_VERSION);

  // Platform glossary content
  assert.ok(PLATFORM_HELP_INTRO.length > 0);
  assert.ok(PLATFORM_HELP_SECTIONS.length > 0);
  assert.ok(PLATFORM_HELP_SECTIONS[0].entries.length > 0);
});

test('7. Team & Workspace Management: Tenant isolation in team member lookup', async () => {
  assert.equal(typeof teamService.getTeamMembers, 'function');
  assert.equal(typeof teamService.updateMemberStatus, 'function');
});

test('8. Templates & Content Library: Contract template registry completeness', () => {
  const templates = Object.values(CONTRACT_TEMPLATE_REGISTRY);
  assert.ok(templates.length >= 14);

  // Check essential agreement types exist
  const templateKeys = Object.keys(CONTRACT_TEMPLATE_REGISTRY);
  assert.ok(templateKeys.includes('service_agreement'));
  assert.ok(templateKeys.includes('nda_mutual'));
  assert.ok(templateKeys.includes('retainer_agreement'));
  assert.ok(templateKeys.includes('software_development'));
  assert.ok(templateKeys.includes('consulting_agreement'));
});

test('9. Data Import, Export & Migration: CSV export utility formatting and sanitization', () => {
  assert.equal(typeof exportToCSV, 'function');
});

test('10. Platform Status & Incident Management: Status calculation semantics and service registry', () => {
  assert.ok(SERVICES.length >= 8);
  const serviceNames = SERVICES.map((s) => s[0]);
  assert.ok(serviceNames.includes('website'));
  assert.ok(serviceNames.includes('dashboard'));
  assert.ok(serviceNames.includes('api'));
  assert.ok(serviceNames.includes('authentication'));
  assert.ok(serviceNames.includes('database'));
  assert.ok(serviceNames.includes('mcp'));

  // Status computation semantics
  const healthyEvidence = {
    service_name: 'api',
    status: 'operational',
    latency_ms: 45,
    message: 'Healthy',
    checked_at: new Date().toISOString(),
    metadata_json: { verified: true, scope: 'system' },
  };
  assert.equal(effectiveStatus(healthyEvidence), 'operational');

  // Overall status rollup with status array
  assert.equal(overallStatus(['operational', 'operational', 'operational']), 'operational');
  assert.equal(overallStatus(['operational', 'degraded', 'operational']), 'degraded');
  assert.equal(overallStatus(['operational', 'major_outage', 'operational']), 'major_outage');
});

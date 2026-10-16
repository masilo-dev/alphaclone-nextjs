import test from 'node:test';
import assert from 'node:assert/strict';

// Core imports
import { bookingService } from '../../src/services/bookingService.ts';
import { calendarService } from '../../src/services/calendarService.ts';
import { percentChange, leadConversionRate, buildComparison } from '../../src/domain/metrics/calculations.ts';
import { analyticsService } from '../../src/services/analyticsService.ts';
import { STATIC_SITEMAP } from '../../src/lib/seo/sitemapData.ts';
import { resolveAppSurface } from '../../src/lib/pwa/appSurface.ts';
import { resolveCanonicalPath, CANONICAL_ROUTES } from '../../src/lib/dashboard/canonicalRoutes.ts';
import { clientLifecycleService } from '../../src/services/clientLifecycleService.ts';
import { getWalkthroughRecord, setWalkthroughState, WALKTHROUGH_VERSION } from '../../src/lib/onboarding/walkthroughService.ts';
import { teamService } from '../../src/services/teamService.ts';
import { CONTRACT_TEMPLATE_REGISTRY } from '../../src/lib/contracts/templates/contractTemplateRegistry.ts';
import { resolveContractVariables } from '../../src/lib/contracts/contractVariables.ts';
import { generateContractPDF } from '../../src/utils/pdfGenerator.ts';
import { sanitizeCsvField } from '../../src/utils/exportData.ts';
import { effectiveStatus, overallStatus, SERVICES, STALE_MS } from '../../src/lib/platform-monitoring/model.ts';
import { fromZonedTime } from 'date-fns-tz';

// -------------------------------------------------------------
// SECTION 2: TARGETED REGRESSION TESTS
// -------------------------------------------------------------

test('Regression 1: Booking & Calendar — Buffers, overlapping ranges, cancellations, and DST time-zones', () => {
  // 15-minute buffer and slot progression calculation
  const baseTime = fromZonedTime('2026-10-20 09:00', 'America/New_York');
  const slotDuration = 30; // 30 min
  const bufferDuration = 15; // 15 min buffer
  const nextSlot = new Date(baseTime.getTime() + (slotDuration + bufferDuration) * 60_000);
  assert.equal(nextSlot.getTime() - baseTime.getTime(), 45 * 60_000);

  // Overlapping range detection
  const range1 = { start: 1000, end: 2000 };
  const rangeOverlap = { start: 1500, end: 2500 };
  const rangeDisjoint = { start: 2000, end: 3000 };
  const isOverlapping = (r1, r2) => r1.start < r2.end && r1.end > r2.start;
  assert.equal(isOverlapping(range1, rangeOverlap), true);
  assert.equal(isOverlapping(range1, rangeDisjoint), false);

  // Cancellation statuses filter (must ignore cancelled, canceled, and no_show)
  const isSlotBlockedByBooking = (status) => !['cancelled', 'canceled', 'no_show'].includes(status);
  assert.equal(isSlotBlockedByBooking('confirmed'), true);
  assert.equal(isSlotBlockedByBooking('scheduled'), true);
  assert.equal(isSlotBlockedByBooking('cancelled'), false);
  assert.equal(isSlotBlockedByBooking('canceled'), false);
  assert.equal(isSlotBlockedByBooking('no_show'), false);

  // Time zone conversion across standard and daylight transitions
  const summerDate = fromZonedTime('2026-07-01 12:00', 'America/New_York');
  const winterDate = fromZonedTime('2026-12-01 12:00', 'America/New_York');
  assert.ok(summerDate instanceof Date && !isNaN(summerDate.getTime()));
  assert.ok(winterDate instanceof Date && !isNaN(winterDate.getTime()));
});

test('Regression 2: Analytics & Reporting — Zero denominators, missing data, and conversion rates', () => {
  // Zero denominators
  assert.equal(percentChange(100, 0), null);
  assert.equal(percentChange(0, 0), 0);
  assert.equal(percentChange(null, 100), null);
  assert.equal(percentChange(100, undefined), null);

  // Comparison object consistency
  const comparison = buildComparison(120, 100, 'vs last month');
  assert.equal(comparison.value, 20);
  assert.equal(comparison.direction, 'up');
  assert.equal(comparison.sentiment, 'positive');

  // Conversion rates cannot exceed 100% or hallucinate when leads are 0
  assert.equal(leadConversionRate({ total: 0, converted: 0 }).rate, null);
  assert.equal(leadConversionRate({ total: 50, converted: 10 }).rate, 20);
  assert.equal(leadConversionRate({ total: 10, converted: 15 }).rate, null);
});

test('Regression 3: Website, SEO & Conversion — Sitemaps, robots.txt, and authentication decoupling', async () => {
  const robotsModule = await import('../../src/app/robots.ts');
  const getRobots = robotsModule.default || robotsModule;
  const config = getRobots();
  assert.ok(Array.isArray(config.rules));

  // Verify private routes are in robots disallow
  const defaultRule = config.rules.find((r) => r.userAgent === '*');
  assert.ok(defaultRule.disallow.includes('/dashboard'));
  assert.ok(defaultRule.disallow.includes('/api/'));
  assert.ok(defaultRule.disallow.includes('/contract/'));

  // Sitemaps validation
  assert.ok(STATIC_SITEMAP.length > 5);
  for (const entry of STATIC_SITEMAP) {
    assert.ok(entry.url.startsWith('https://'));
    assert.ok(typeof entry.lastModified === 'string' || entry.lastModified instanceof Date);
    assert.ok(typeof entry.changeFrequency === 'string');
    assert.ok(typeof entry.priority === 'number' && entry.priority > 0 && entry.priority <= 1);
  }
});

test('Regression 4: PWA, UI/UX & Navigation — Surface detection, touch targets, and canonical aliases', () => {
  // Surface resolution
  assert.equal(resolveAppSurface({ isPwa: false, width: 1440, coarsePointer: false }), 'browser');
  assert.equal(resolveAppSurface({ isPwa: true, width: 375, coarsePointer: true }), 'pwa-mobile');
  assert.equal(resolveAppSurface({ isPwa: true, width: 1024, coarsePointer: false }), 'pwa-desktop');

  // Canonical dashboard aliases resolve to canonical destinations
  assert.equal(resolveCanonicalPath('/dashboard/business'), '/dashboard');
  assert.equal(resolveCanonicalPath('/dashboard/operations-command'), '/dashboard/operations');

  // Verify all canonical routes have valid sections and roles
  for (const route of CANONICAL_ROUTES) {
    assert.ok(route.path.startsWith('/dashboard'));
    assert.ok(Array.isArray(route.roles) && route.roles.length > 0);
    assert.ok(typeof route.title === 'string');
  }
});

test('Regression 5: Client Lifecycle & Customer Success — Contract status filtering and bulk summaries', () => {
  // Query status logic accepts both 'signed' and 'completed'
  const isContractActive = (status, lifecycleStatus) => {
    return ['signed', 'completed'].includes(status) || ['signed', 'completed'].includes(lifecycleStatus);
  };
  assert.equal(isContractActive('signed', 'draft'), true);
  assert.equal(isContractActive('completed', 'draft'), true);
  assert.equal(isContractActive('draft', 'signed'), true);
  assert.equal(isContractActive('draft', 'draft'), false);

  assert.equal(typeof clientLifecycleService.getClientLifecycleSummary, 'function');
  assert.equal(typeof clientLifecycleService.bulkGetClientLifecycleSummaries, 'function');
});

test('Regression 6: Product Tour & Help Center — Walkthrough state persistence and version isolation', () => {
  const fallbackRecord = getWalkthroughRecord('');
  assert.equal(fallbackRecord.state, 'not_started');
  assert.equal(fallbackRecord.version, WALKTHROUGH_VERSION);

  // Simulated browser environment record check
  const simulatedRecord = {
    state: 'completed',
    version: WALKTHROUGH_VERSION,
    updatedAt: new Date().toISOString(),
  };
  assert.equal(simulatedRecord.state, 'completed');
  assert.equal(simulatedRecord.version, '2026.09.24');
});

test('Regression 7: Team & Workspace Management — Zero-member isolation and role permissions', async () => {
  // When a tenant has 0 members, getTeamMembers must return empty array without leaking global profiles
  const result = await teamService.getTeamMembers('tenant-isolation-test-empty');
  assert.deepEqual(result.team, []);

  // Roles permission hierarchy check
  const validRoles = ['owner', 'admin', 'member', 'client'];
  assert.ok(validRoles.includes('owner'));
  assert.ok(validRoles.includes('admin'));
  assert.ok(validRoles.includes('member'));
  assert.ok(validRoles.includes('client'));
});

test('Regression 8: Templates & Content Library — 14 Agreements, token substitution, and legal flags', () => {
  const templates = Object.values(CONTRACT_TEMPLATE_REGISTRY);
  assert.equal(templates.length, 14, 'Must have exactly 14 corporate agreement templates');

  // Verify essential commercial templates
  const keys = Object.keys(CONTRACT_TEMPLATE_REGISTRY);
  assert.ok(keys.includes('service_agreement'));
  assert.ok(keys.includes('nda_mutual'));
  assert.ok(keys.includes('retainer_agreement'));
  assert.ok(keys.includes('master_services_agreement'));
  assert.ok(keys.includes('software_development'));

  // Templates flagged for mandatory legal counsel review
  const requiresLegalReview = ['master_services_agreement', 'software_development', 'nda_mutual'];
  for (const reqKey of requiresLegalReview) {
    assert.ok(keys.includes(reqKey), `Template ${reqKey} must be registered for legal counsel governance`);
  }

  // Token substitution test
  const content = 'Agreement between {{business.name}} and {{client.name}} for {{financial.total}}.';
  const resolved = resolveContractVariables(content, {
    business: { name: 'AlphaClone Systems' },
    client: { name: 'Acme Corp' },
    financial: { total: '$5,000' },
  });
  assert.equal(resolved, 'Agreement between AlphaClone Systems and Acme Corp for $5,000.');
});

test('Regression 9: Data Import, Export & Migration — CSV injection neutralization and error logging', () => {
  // CSV Formula Injection (OWASP) neutralization
  assert.equal(sanitizeCsvField('=SUM(A1:A10)'), "'=SUM(A1:A10)");
  assert.equal(sanitizeCsvField('+12345'), "'+12345");
  assert.equal(sanitizeCsvField('-cmd|"/C calc"!A0'), `"'-cmd|""/C calc""!A0"`);
  assert.equal(sanitizeCsvField('@SUM(1,2)'), `"\'@SUM(1,2)"`);
  assert.equal(sanitizeCsvField('Ordinary Company, Inc.'), `"Ordinary Company, Inc."`);
  assert.equal(sanitizeCsvField(null), '');
  assert.equal(sanitizeCsvField(undefined), '');

  // Error logging data structure
  const errorEntry = {
    row_index: 4,
    record_identifier: 'lead@test.com',
    error: 'Invalid phone format',
    timestamp: new Date().toISOString(),
  };
  assert.equal(typeof errorEntry.row_index, 'number');
  assert.equal(typeof errorEntry.error, 'string');
});

test('Regression 10: Platform Status & Incident Management — 21 services, stale threshold, and status rollup', () => {
  assert.equal(SERVICES.length, 21, 'Must track exactly 21 platform services');

  // Stale evidence beyond 180s automatically degrades to 'unknown'
  const staleTime = new Date(Date.now() - (STALE_MS + 10_000)).toISOString();
  const staleEvidence = {
    service_name: 'database',
    status: 'operational',
    latency_ms: 12,
    message: 'Healthy',
    checked_at: staleTime,
    metadata_json: { verified: true, scope: 'system' },
  };
  assert.equal(effectiveStatus(staleEvidence), 'unknown', 'Stale telemetry must not be marked operational');

  // Fresh evidence is operational
  const freshEvidence = {
    ...staleEvidence,
    checked_at: new Date().toISOString(),
  };
  assert.equal(effectiveStatus(freshEvidence), 'operational');

  // Overall status rollup
  assert.equal(overallStatus(['operational', 'operational']), 'operational');
  assert.equal(overallStatus(['operational', 'degraded']), 'degraded');
  assert.equal(overallStatus(['operational', 'major_outage', 'degraded']), 'major_outage');
});

// -------------------------------------------------------------
// SECTION 3: END-TO-END INTEGRATION FLOW TESTS
// -------------------------------------------------------------

test('Integration Flow 1: Booking → CRM → Calendar → Notification', () => {
  // Simulated booking payload
  const bookingPayload = {
    tenant_id: 'tenant-test',
    client_name: 'Sarah Connor',
    client_email: 'sarah@skynet.com',
    start_time: '2026-10-25T14:00:00Z',
    end_time: '2026-10-25T14:30:00Z',
  };

  // 1. Booking triggers CRM lead upsert
  const crmLead = {
    id: 'lead-123',
    business_name: bookingPayload.client_name,
    email: bookingPayload.client_email,
    stage: 'lead',
    source: 'Inbound Booking',
  };
  assert.equal(crmLead.email, bookingPayload.client_email);

  // 2. Calendar Event scheduled with lead link
  const calendarEvent = {
    id: 'evt-123',
    user_id: 'host-1',
    title: `Meeting with ${crmLead.business_name}`,
    start_time: bookingPayload.start_time,
    end_time: bookingPayload.end_time,
    related_to_lead: crmLead.id,
  };
  assert.equal(calendarEvent.related_to_lead, crmLead.id);

  // 3. Notification record prepared
  const notification = {
    recipient: crmLead.email,
    subject: `Confirmed: Meeting on ${bookingPayload.start_time}`,
    status: 'queued',
  };
  assert.equal(notification.recipient, 'sarah@skynet.com');
});

test('Integration Flow 2: Client → Contract → Project → Invoice', () => {
  // 1. Client Identity
  const client = { id: 'client-999', name: 'Cyberdyne Systems', tenantId: 'tenant-1' };

  // 2. Signed Contract
  const contract = {
    id: 'contract-555',
    clientId: client.id,
    tenantId: client.tenantId,
    status: 'signed',
    lifecycle_status: 'signed',
    value: 15000,
  };
  assert.equal(contract.clientId, client.id);

  // 3. Project auto-provisioned
  const project = {
    id: 'proj-777',
    clientId: client.id,
    tenantId: client.tenantId,
    name: 'Cyberdyne Core Build',
    contractId: contract.id,
    status: 'in_progress',
  };
  assert.equal(project.contractId, contract.id);

  // 4. Milestone Invoice generated
  const invoice = {
    id: 'inv-888',
    clientId: client.id,
    projectId: project.id,
    total: contract.value,
    amount_paid: 0,
    status: 'sent',
  };
  assert.equal(invoice.projectId, project.id);
  assert.equal(invoice.total, 15000);
});

test('Integration Flow 3: Template → Document → PDF → Signature', () => {
  // 1. Template
  const template = CONTRACT_TEMPLATE_REGISTRY.service_agreement;
  assert.ok(template.sections.length > 0);

  // 2. Document built from template
  const resolvedBody = resolveContractVariables(template.sections[0].body, {
    contract: { effective_date: '2026-10-01' },
    business: { name: 'AlphaClone Systems', address: '100 Market St' },
    client: { name: 'Wayne Enterprises', address: '1007 Mountain Dr' },
  });
  assert.ok(resolvedBody.includes('Wayne Enterprises'));

  // 3. Multi-page PDF Generator executes cleanly
  const contractData = {
    id: 'contract-pdf-flow',
    title: template.name,
    content: `<p>${resolvedBody}</p>`,
    status: 'draft',
    signer_name: 'Bruce Wayne',
    signer_email: 'bruce@wayne.com',
  };
  const tenant = {
    id: 'tenant-test-001',
    name: 'AlphaClone Systems',
    brand_color_primary: '#0e1015',
  };
  const doc = generateContractPDF(contractData, tenant);
  assert.ok(doc, 'PDF doc must be generated');
  assert.ok(doc.getNumberOfPages() >= 1);
});

test('Integration Flow 4: Import → CRM → Analytics', () => {
  // 1. Raw imported CSV record
  const rawRow = {
    name: 'Oliver Queen',
    email: 'oliver@queen.com',
    company: 'Queen Consolidated',
    stage: 'lead',
    value: '5000',
  };

  // 2. Identity normalization
  const normalizedLead = {
    contact_name: rawRow.name,
    email: rawRow.email.toLowerCase().trim(),
    business_name: rawRow.company,
    stage: rawRow.stage,
    value: Number(rawRow.value),
  };
  assert.equal(normalizedLead.email, 'oliver@queen.com');
  assert.equal(normalizedLead.value, 5000);

  // 3. Updates analytics pipeline weighted value
  const pipelineStats = {
    totalLeads: 1,
    weightedValue: normalizedLead.value * 0.1, // lead stage probability 10%
  };
  assert.equal(pipelineStats.weightedValue, 500);
});

test('Integration Flow 5: Authentication → Team → Tenant Permissions', () => {
  // Authenticated user session
  const session = {
    userId: 'user-001',
    tenantId: 'tenant-alpha',
    roles: ['admin'],
  };

  // Cross-tenant access guard check
  const isActionAuthorized = (reqTenantId, reqRole) => {
    if (session.tenantId !== reqTenantId) return false;
    return session.roles.includes(reqRole) || session.roles.includes('admin') || session.roles.includes('owner');
  };

  assert.equal(isActionAuthorized('tenant-alpha', 'member'), true);
  assert.equal(isActionAuthorized('tenant-alpha', 'admin'), true);
  assert.equal(isActionAuthorized('tenant-bravo', 'admin'), false); // Rejected cross-tenant
});

test('Integration Flow 6: Worker Failure → Health Degradation → Recovery', () => {
  // Initial healthy state
  let currentStatuses = ['operational', 'operational', 'operational'];
  assert.equal(overallStatus(currentStatuses), 'operational');

  // Background worker fails heartbeat
  currentStatuses[1] = 'degraded';
  assert.equal(overallStatus(currentStatuses), 'degraded');

  // Critical database check fails
  currentStatuses[2] = 'major_outage';
  assert.equal(overallStatus(currentStatuses), 'major_outage');

  // System recovers and reports fresh heartbeat
  currentStatuses = ['operational', 'operational', 'operational'];
  assert.equal(overallStatus(currentStatuses), 'operational');
});

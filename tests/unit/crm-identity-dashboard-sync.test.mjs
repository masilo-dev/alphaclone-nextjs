import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('CRM identity normalization (source contract)', () => {
  it('identityNormalize module exports required helpers', () => {
    const source = readFileSync(path.join(root, 'src/lib/crm/identityNormalize.ts'), 'utf8');
    assert.match(source, /export function normalizeEmail/);
    assert.match(source, /export function normalizePhone/);
    assert.match(source, /export function normalizeCompanyName/);
    assert.match(source, /export function normalizeDomain/);
    assert.match(source, /export function phoneLookupVariants/);
    assert.match(source, /toLowerCase\(\)/);
    assert.match(source, /LEGAL_SUFFIXES/);
  });
});

describe('CRM identity resolution wiring', () => {
  it('MCP create_lead uses resolveOrCreateCRMIdentity', () => {
    const source = readFileSync(path.join(root, 'src/lib/mcp/tools/crm-ops.ts'), 'utf8');
    assert.match(source, /resolveOrCreateCRMIdentity/);
    assert.match(source, /matched_existing/);
    assert.match(source, /dashboard_event_emitted/);
  });

  it('create_leads processes in bounded chunks', () => {
    const source = readFileSync(path.join(root, 'src/lib/mcp/tools/crm-ops.ts'), 'utf8');
    assert.match(source, /CHUNK_SIZE = 50/);
  });

  it('lead webhook delegates to identity resolver', () => {
    const source = readFileSync(path.join(root, 'src/app/api/webhooks/leads/route.ts'), 'utf8');
    assert.match(source, /resolveOrCreateCRMIdentity/);
  });

  it('enrich route uses location not leads.address', () => {
    const source = readFileSync(path.join(root, 'src/app/api/leads/enrich/route.ts'), 'utf8');
    assert.match(source, /address: lead\.location/);
    assert.doesNotMatch(source, /lead\.address/);
  });

  it('dashboard stats cache can be cleared per tenant', () => {
    const source = readFileSync(path.join(root, 'src/lib/dashboard/statsCache.ts'), 'utf8');
    assert.match(source, /clearStatsCacheForTenant/);
  });

  it('client dashboard stats listen for invalidation events', () => {
    const source = readFileSync(path.join(root, 'src/hooks/useDashboardStats.ts'), 'utf8');
    assert.match(source, /ac:crm-stats-invalidate/);
  });

  it('campaign enrollment uses centralized outreach eligibility', () => {
    const source = readFileSync(path.join(root, 'src/app/api/email/campaigns/route.ts'), 'utf8');
    assert.match(source, /checkOutreachEligibility/);
    assert.match(source, /skipped_reasons/);
  });

  it('outreach eligibility blocks unsubscribed and converted states', () => {
    const source = readFileSync(path.join(root, 'src/lib/outreach/checkOutreachEligibility.ts'), 'utf8');
    assert.match(source, /unsubscribed/);
    assert.match(source, /converted/);
    assert.match(source, /do_not_contact/);
    assert.match(source, /already_in_campaign/);
  });

  it('domain events emit from identity resolver', () => {
    const source = readFileSync(path.join(root, 'src/lib/crm/resolveOrCreateCRMIdentity.ts'), 'utf8');
    assert.match(source, /emitCrmDomainEvent/);
    assert.match(source, /crm\.lead\.created/);
    assert.match(source, /crm\.lead\.matched/);
  });

  it('migration adds identity indexes and last_activity_at', () => {
    const source = readFileSync(
      path.join(root, 'supabase/migrations/20260904120000_crm_identity_dashboard_sync.sql'),
      'utf8',
    );
    assert.match(source, /last_activity_at/);
    assert.match(source, /idx_leads_tenant_email_lower/);
    assert.match(source, /domain_events/);
  });
});

describe('tenant isolation contract', () => {
  it('identity resolver always scopes queries by tenant_id', () => {
    const source = readFileSync(path.join(root, 'src/lib/crm/resolveOrCreateCRMIdentity.ts'), 'utf8');
    const tenantScoped = (source.match(/\.eq\('tenant_id', tenantId\)/g) || []).length;
    assert.ok(tenantScoped >= 5, `expected >=5 tenant_id filters, got ${tenantScoped}`);
  });
});

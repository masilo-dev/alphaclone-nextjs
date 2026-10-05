import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

test('SUP-RLS-001 migration enables RLS and revokes anon/authenticated', () => {
  const sql = readFileSync(
    join(root, 'supabase/migrations/20260727160000_close_public_compliance_and_quarantine_tables.sql'),
    'utf8'
  );
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /data_requests/);
  assert.match(sql, /tenant_isolation_quarantine/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.data_requests FROM anon, authenticated/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.tenant_isolation_quarantine FROM anon, authenticated/);
  assert.doesNotMatch(sql, /USING\s*\(\s*true\s*\)/i);
});

test('portal signing uses only CLIENT_PORTAL_SESSION_SIGNING_SECRET', () => {
  const src = readFileSync(join(root, 'src/lib/auth/clientPortalAuth.ts'), 'utf8');
  assert.match(src, /CLIENT_PORTAL_SESSION_SIGNING_SECRET/);
  assert.doesNotMatch(src, /SHARED_SECRET_CANDIDATE_ENVS/);
  // Secret resolver must read only CLIENT_PORTAL_SESSION_SIGNING_SECRET (error text may mention banned keys).
  const secretFn = src.slice(src.indexOf('export function getSessionSigningSecret'), src.indexOf('function base64UrlEncode'));
  assert.match(secretFn, /CLIENT_PORTAL_SIGNING_SECRET_ENV/);
  assert.doesNotMatch(secretFn, /process\.env\[.ENCRYPTION_SECRET/);
  assert.doesNotMatch(secretFn, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(secretFn, /process\.env\.ENCRYPTION_SECRET/);
  assert.doesNotMatch(secretFn, /for \(const name of/);
});

test('portal signing rejects missing secret in production', async () => {
  const prevNode = process.env.NODE_ENV;
  const prevSecret = process.env.CLIENT_PORTAL_SESSION_SIGNING_SECRET;
  const prevRailway = process.env.RAILWAY_ENVIRONMENT;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.CLIENT_PORTAL_SESSION_SIGNING_SECRET;
    delete process.env.RAILWAY_ENVIRONMENT;
    // Dynamic import after env mutation — clear module cache by importing via path with query not possible;
    // call exported helpers that re-read process.env each time.
    const mod = await import('../../src/lib/auth/clientPortalAuth.ts');
    assert.throws(() => mod.getSessionSigningSecret(), /CLIENT_PORTAL_SESSION_SIGNING_SECRET/);
  } finally {
    process.env.NODE_ENV = prevNode;
    if (prevSecret === undefined) delete process.env.CLIENT_PORTAL_SESSION_SIGNING_SECRET;
    else process.env.CLIENT_PORTAL_SESSION_SIGNING_SECRET = prevSecret;
    if (prevRailway === undefined) delete process.env.RAILWAY_ENVIRONMENT;
    else process.env.RAILWAY_ENVIRONMENT = prevRailway;
  }
});

test('portal token sign/verify round-trip and rejects tampering', async () => {
  process.env.CLIENT_PORTAL_SESSION_SIGNING_SECRET =
    process.env.CLIENT_PORTAL_SESSION_SIGNING_SECRET || 'phase2-portal-signing-secret-32chars!!';
  process.env.NODE_ENV = 'test';
  const mod = await import('../../src/lib/auth/clientPortalAuth.ts');
  const token = mod.signClientPortalSession({
    clientId: '11111111-1111-1111-1111-111111111111',
    tenantId: '22222222-2222-2222-2222-222222222222',
    sessionSalt: 'abc123',
    sessionJti: 'jti1',
  });
  const ok = mod.verifyClientPortalSessionToken(token);
  assert.equal(ok.ok, true);

  const parts = token.split('.');
  parts[2] = parts[2].slice(0, -2) + 'aa';
  const bad = mod.verifyClientPortalSessionToken(parts.join('.'));
  assert.equal(bad.ok, false);

  const expiredPayload = Buffer.from(
    JSON.stringify({
      sub: '11111111-1111-1111-1111-111111111111',
      tid: '22222222-2222-2222-2222-222222222222',
      jti: 'jti1',
      salt: 'abc123',
      iat: 1,
      exp: 2,
      iss: mod.CLIENT_PORTAL_JWT_ISS,
      aud: mod.CLIENT_PORTAL_JWT_AUD,
    })
  ).toString('base64url');
  const header = token.split('.')[0];
  const forged = `${header}.${expiredPayload}.fakesig`;
  const expired = mod.verifyClientPortalSessionToken(forged);
  assert.equal(expired.ok, false);
});

test('portalOwnsResource rejects cross-client and cross-tenant IDs', async () => {
  const { portalOwnsResource, portalResourceOwnershipFilters } = await import(
    '../../src/lib/auth/portalResourceOwnership.ts'
  );
  const actor = { clientId: 'client-a', tenantId: 'tenant-a' };
  assert.equal(
    portalOwnsResource(actor, { id: 'doc-1', tenant_id: 'tenant-a', client_id: 'client-a' }),
    true
  );
  assert.equal(
    portalOwnsResource(actor, { id: 'doc-1', tenant_id: 'tenant-a', client_id: 'client-b' }),
    false
  );
  assert.equal(
    portalOwnsResource(actor, { id: 'doc-1', tenant_id: 'tenant-b', client_id: 'client-a' }),
    false
  );
  assert.equal(portalOwnsResource(actor, null), false);
  assert.deepEqual(portalResourceOwnershipFilters(actor, 'inv-1'), {
    id: 'inv-1',
    tenant_id: 'tenant-a',
    client_id: 'client-a',
  });
});

test('client-finance document and contract routes enforce tenant+client filters', () => {
  const doc = readFileSync(join(root, 'src/app/api/client-finance/document/route.ts'), 'utf8');
  const contract = readFileSync(join(root, 'src/app/api/client-finance/contract/route.ts'), 'utf8');
  assert.match(doc, /entity_id',\s*client\.id/);
  assert.match(doc, /tenant_id',\s*client\.tenant_id/);
  assert.match(doc, /portalOwnsResource/);
  assert.match(contract, /client_id',\s*client\.id/);
  assert.match(contract, /portalOwnsResource/);
});

test('Instagram integration lookup requires tenantId', () => {
  const src = readFileSync(
    join(root, 'src/services/instagram/instagramIntegrationService.ts'),
    'utf8'
  );
  assert.match(src, /if \(!query\.tenantId/);
  assert.match(src, /return null/);
  assert.match(src, /eq\('tenant_id'/);
});

test('Facebook integration lookup requires tenantId', () => {
  const src = readFileSync(
    join(root, 'src/services/facebook/facebookIntegrationService.ts'),
    'utf8'
  );
  assert.match(src, /if \(!query\.tenantId\)/);
  assert.match(src, /eq\('tenant_id', query\.tenantId\)/);
});

test('production rate limiting fails closed for sensitive paths without Redis', async () => {
  const { isSensitiveRateLimitPath } = await import('../../src/lib/rateLimit.ts');
  assert.equal(isSensitiveRateLimitPath('/api/mcp'), true);
  assert.equal(isSensitiveRateLimitPath('/api/email/send'), true);
  assert.equal(isSensitiveRateLimitPath('/api/client-portal-auth/login'), true);
  assert.equal(isSensitiveRateLimitPath('/api/health'), false);

  const rl = readFileSync(join(root, 'src/lib/rateLimit.ts'), 'utf8');
  assert.match(rl, /failing closed/);
  assert.match(rl, /denyDistributedUnavailable/);
});

test('readiness exposes rate_limit distributed status', () => {
  const src = readFileSync(join(root, 'src/app/api/readiness/route.ts'), 'utf8');
  assert.match(src, /rate_limit/);
  assert.match(src, /distributed/);
});

test('MCP tool risk tiers classify external writes and require idempotency', async () => {
  const {
    classifyMcpToolTier,
    mcpToolRequiresIdempotency,
    mcpToolRequiresApproval,
    deriveStableMcpIdempotencyKey,
    ensureMcpIdempotencyKey,
  } = await import('../../src/lib/mcp/toolRiskTiers.ts');
  assert.equal(classifyMcpToolTier('list_leads'), 'READ');
  assert.equal(classifyMcpToolTier('create_lead'), 'INTERNAL_WRITE');
  assert.equal(classifyMcpToolTier('send_email'), 'EXTERNAL_WRITE');
  assert.equal(classifyMcpToolTier('publish_social_post'), 'EXTERNAL_WRITE');
  assert.equal(classifyMcpToolTier('bulk_outreach'), 'HIGH_RISK_EXTERNAL_WRITE');
  assert.equal(mcpToolRequiresIdempotency('send_invoice'), true);
  assert.equal(mcpToolRequiresApproval('void_invoice'), true);
  assert.equal(mcpToolRequiresIdempotency('list_invoices'), false);

  const args = { to: 'a@b.com', subject: 'Hi', body: 'x', correlation_id: 'volatile-1' };
  const key1 = deriveStableMcpIdempotencyKey({
    tenantId: 'tenant-a',
    toolName: 'send_email',
    args,
  });
  const key2 = deriveStableMcpIdempotencyKey({
    tenantId: 'tenant-a',
    toolName: 'send_email',
    args: { ...args, correlation_id: 'volatile-2' },
  });
  assert.equal(key1, key2, 'volatile correlation_id must not change idempotency key');
  const otherTenant = deriveStableMcpIdempotencyKey({
    tenantId: 'tenant-b',
    toolName: 'send_email',
    args,
  });
  assert.notEqual(key1, otherTenant);

  const mutable = { invoice_id: 'inv-1', recipients: ['a@b.com'] };
  const ensured = ensureMcpIdempotencyKey({
    tenantId: 'tenant-a',
    toolName: 'send_invoice',
    args: mutable,
  });
  assert.ok(ensured);
  assert.equal(mutable.idempotency_key, ensured);
  const again = ensureMcpIdempotencyKey({
    tenantId: 'tenant-a',
    toolName: 'send_invoice',
    args: mutable,
  });
  assert.equal(again, ensured, 'caller-supplied/derived key must be reused');
});

test('ToolPolicyGate maps MCP tiers into risk classes', async () => {
  const { classifyToolRisk } = await import('../../src/lib/ai/ToolPolicyGate.ts');
  assert.equal(classifyToolRisk('send_email'), 'send');
  assert.equal(classifyToolRisk('publish_social_post'), 'send');
  assert.equal(classifyToolRisk('bulk_outreach'), 'bulk');
  assert.equal(classifyToolRisk('list_leads'), 'read');
});

test('toolExecutionGuard derives idempotency keys for external writes', () => {
  const src = readFileSync(join(root, 'src/lib/execution/toolExecutionGuard.ts'), 'utf8');
  assert.match(src, /ensureMcpIdempotencyKey/);
  assert.match(src, /Prefer caller-supplied key/);
});

test('domain capability guard uses MCP risk tiers for idempotency', () => {
  const src = readFileSync(join(root, 'src/lib/execution/domainCapabilityGuard.ts'), 'utf8');
  assert.match(src, /mcpToolRequiresIdempotency/);
});

test('production env requires portal signing secret and redis', () => {
  const src = readFileSync(join(root, 'scripts/production-env.mjs'), 'utf8');
  assert.match(src, /CLIENT_PORTAL_SESSION_SIGNING_SECRET/);
  assert.match(src, /Distributed Redis is required in production/);
  assert.match(src, /must not be the Supabase service_role JWT/);
});

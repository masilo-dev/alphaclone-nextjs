#!/usr/bin/env node

const baseUrl = String(process.env.ALPHACLONE_BASE_URL || '').replace(/\/$/, '');
const token = String(process.env.ALPHACLONE_TEST_BEARER || '').trim();
const tenantId = String(process.env.ALPHACLONE_TEST_TENANT_ID || '').trim();
const projectId = String(process.env.ALPHACLONE_TEST_PROJECT_ID || '').trim();
const clientId = String(process.env.ALPHACLONE_TEST_CLIENT_ID || '').trim();

if (!baseUrl || !token || !tenantId || !projectId || !clientId) {
  console.error('Required: ALPHACLONE_BASE_URL, ALPHACLONE_TEST_BEARER, ALPHACLONE_TEST_TENANT_ID, ALPHACLONE_TEST_PROJECT_ID, ALPHACLONE_TEST_CLIENT_ID');
  process.exit(2);
}

const headers = { Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId };
async function get(path) {
  const started = Date.now();
  const res = await fetch(`${baseUrl}${path}`, { headers });
  const body = await res.json().catch(() => ({}));
  return { path, status: res.status, ok: res.ok, ms: Date.now() - started, body };
}
function assert(condition, message) { if (!condition) throw new Error(message); }

const checks = [];
checks.push(await get(`/api/tenant/${tenantId}/projects/${projectId}/summary`));
checks.push(await get(`/api/tenant/${tenantId}/projects/${projectId}/financials`));
checks.push(await get(`/api/tenant/${tenantId}/clients/${clientId}/timeline?limit=100`));
checks.push(await get(`/api/tenant/${tenantId}/projects/${projectId}/approvals`));
checks.push(await get(`/api/tenant/${tenantId}/projects/${projectId}/designs`));
checks.push(await get(`/api/tenant/${tenantId}/marketing/listmonk/health`));

for (const check of checks) {
  // 404 is allowed only for feature-gated optional integrations; core Projects V2 endpoints must respond.
  if (check.path.endsWith('/designs') || check.path.endsWith('/health')) {
    assert(check.status < 500, `${check.path} returned ${check.status}`);
  } else {
    assert(check.ok, `${check.path} returned ${check.status}: ${JSON.stringify(check.body).slice(0, 500)}`);
  }
}

const summary = checks[0].body;
assert(summary?.project?.id === projectId, 'Project summary returned wrong project');
assert(Array.isArray(summary?.activity), 'Project summary activity missing');
const financials = checks[1].body;
assert(financials?.project?.id === projectId, 'Financials returned wrong project');
assert(typeof financials?.financials?.invoiced === 'number', 'Financial invoiced total missing');
assert(typeof financials?.financials?.paid === 'number', 'Financial paid total missing');
const timeline = checks[2].body;
assert(timeline?.client?.id === clientId, 'Client timeline returned wrong client');
assert(Array.isArray(timeline?.timeline), 'Client timeline missing');

console.log(JSON.stringify({ ok: true, checks: checks.map(({ path, status, ms }) => ({ path, status, ms })) }, null, 2));

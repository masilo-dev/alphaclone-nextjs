#!/usr/bin/env node

const baseUrl = String(process.env.ALPHACLONE_BASE_URL || '').replace(/\/$/, '');
const token = String(process.env.ALPHACLONE_TEST_BEARER || '').trim();
const tenantId = String(process.env.ALPHACLONE_TEST_TENANT_ID || '').trim();
const projectId = String(process.env.ALPHACLONE_TEST_PROJECT_ID || '').trim();
if (!baseUrl || !token || !tenantId || !projectId) process.exit(2);

const headers = { Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId };
async function request(path) {
  const res = await fetch(`${baseUrl}${path}`, { headers });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// These checks are designed to be run while Listmonk and/or Penpot are intentionally unavailable.
// Core AlphaClone paths must remain healthy; optional integration endpoints may degrade with 404/503.
const core = [
  ['/api/health', [200]],
  [`/api/tenant/${tenantId}/projects/${projectId}/summary`, [200]],
  [`/api/tenant/${tenantId}/projects/${projectId}/financials`, [200]],
];
const optional = [
  [`/api/tenant/${tenantId}/projects/${projectId}/designs`, [200, 404, 503]],
  [`/api/tenant/${tenantId}/marketing/listmonk/health`, [200, 404, 503]],
];

const results = [];
for (const [path, allowed] of [...core, ...optional]) {
  const result = await request(path);
  results.push({ path, status: result.status });
  if (!allowed.includes(result.status)) {
    console.error(JSON.stringify({ ok: false, path, status: result.status, body: result.body }, null, 2));
    process.exit(1);
  }
}
console.log(JSON.stringify({ ok: true, mode: 'failure-isolation', results }, null, 2));

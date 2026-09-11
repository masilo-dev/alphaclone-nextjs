#!/usr/bin/env node

const baseUrl = String(process.env.ALPHACLONE_BASE_URL || '').replace(/\/$/, '');
const token = String(process.env.ALPHACLONE_TEST_BEARER || '').trim();
const tenantId = String(process.env.ALPHACLONE_TEST_TENANT_ID || '').trim();
const projectId = String(process.env.ALPHACLONE_TEST_PROJECT_ID || '').trim();
const clientId = String(process.env.ALPHACLONE_TEST_CLIENT_ID || '').trim();
const concurrency = Math.max(1, Math.min(50, Number(process.env.LOAD_CONCURRENCY || 10)));
const requests = Math.max(concurrency, Math.min(2000, Number(process.env.LOAD_REQUESTS || 100)));
if (!baseUrl || !token || !tenantId || !projectId || !clientId) process.exit(2);

const headers = { Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId };
const paths = [
  `/api/tenant/${tenantId}/projects/${projectId}/summary`,
  `/api/tenant/${tenantId}/projects/${projectId}/financials`,
  `/api/tenant/${tenantId}/clients/${clientId}/timeline?limit=100`,
];
const results = [];
let cursor = 0;

async function worker() {
  while (true) {
    const i = cursor++;
    if (i >= requests) return;
    const path = paths[i % paths.length];
    const start = performance.now();
    try {
      const res = await fetch(`${baseUrl}${path}`, { headers });
      await res.arrayBuffer();
      results.push({ status: res.status, ms: performance.now() - start, path });
    } catch (error) {
      results.push({ status: 0, ms: performance.now() - start, path, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
const times = results.map((r) => r.ms).sort((a, b) => a - b);
const percentile = (p) => times[Math.min(times.length - 1, Math.floor(times.length * p))] || 0;
const failures = results.filter((r) => r.status < 200 || r.status >= 400);
const report = {
  requests: results.length,
  concurrency,
  failures: failures.length,
  p50Ms: Math.round(percentile(0.50)),
  p95Ms: Math.round(percentile(0.95)),
  p99Ms: Math.round(percentile(0.99)),
  maxMs: Math.round(times.at(-1) || 0),
  statusCounts: Object.fromEntries([...new Set(results.map((r) => r.status))].map((s) => [s, results.filter((r) => r.status === s).length])),
};
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);

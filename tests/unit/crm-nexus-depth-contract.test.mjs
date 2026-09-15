import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('CRM reports never fabricate funnel counts, comparisons, or benchmarks', async () => {
  const source = await read('src/components/dashboard/crm/CRMReportsTab.tsx');

  assert.doesNotMatch(source, /leads\.length \* 0\.62/);
  assert.doesNotMatch(source, /Math\.round\(leadStats\.total \* 0\.55\)/);
  assert.doesNotMatch(source, /benchmarkConversion/);
  assert.doesNotMatch(source, /62% of underperforming pipelines/);
  assert.match(source, /isLeadConverted\(l\.status, l\.client_id\)/);
  assert.match(source, /showBenchmarks=\{false\}/);
});

test('Nexus tools expose bounded scope and require an explicit execute mode for mutation', async () => {
  const manifest = await read('src/services/mcp/toolManifest.ts');
  const nexus = await read('src/lib/social/alphaNexus.ts');
  const server = await read('src/services/mcp/MCPServer.ts');

  assert.match(manifest, /NEXUS_COMMON_PROPERTIES/);
  assert.match(manifest, /enum: \['inspect', 'execute'\]/);
  assert.match(manifest, /record_ids/);
  assert.match(manifest, /date_from/);
  assert.match(manifest, /minimum_days_overdue/);
  assert.match(manifest, /include_dependencies/);
  assert.match(server, /tenant_id: _ignoredTenant, \.\.\.nexusParams/);
  assert.match(nexus, /params\.mode === 'execute'/);
  assert.match(nexus, /auto_send_outreach === true && nexusExecuteRequested\(params\)/);
  assert.match(nexus, /execution_mode: execute \? 'execute' : 'inspect'/);
});

test('enterprise CRM workflow uses its canonical tenant-scoped execution ledger', async () => {
  const source = await read('src/lib/crm/crmEnterpriseWorkflowRunner.ts');

  assert.doesNotMatch(source, /\.from\('workflow_executions'\)/);
  assert.match(source, /\.from\('automation_workflow_executions'\)/);
  assert.match(source, /tenant_id: tenantId/);
  assert.match(source, /\.eq\('tenant_id', tenantId\)/);
  assert.match(source, /isPlatformNotification: false/);
});

test('CRM reporting exposes evidence-based pipeline and source analytics', async () => {
  const source = await read('src/lib/mcp/tools/reports-ops.ts');

  assert.match(source, /name: 'crm_pipeline_report'/);
  assert.match(source, /source_conversion/);
  assert.match(source, /win_rate_unavailable_reason/);
  assert.match(source, /No benchmark, prior-period, or funnel values are inferred/);
});

/**
 * AlphaClone MCP Full Execution Audit (Phases 1–4)
 *
 * Generates authoritative inventory, static contract checks, and safe local execution
 * evidence for every tool in the unified full catalog.
 *
 * Usage:
 *   npx tsx scripts/mcp-full-execution-audit.ts
 *   npx tsx scripts/mcp-full-execution-audit.ts --execute-read
 *   npx tsx scripts/mcp-full-execution-audit.ts --execute-read --http --base-url=https://alphaclonesystems.com
 */

import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as dotenv from 'dotenv';
import {
  classifyReadWrite,
  classifyRisk,
  ensureAuditDir,
  inferIntegrationDependency,
  loadMcpCatalogs,
  normalizeModule,
  requiresApproval,
  ROUTE_EXECUTED_TOOL_NAMES,
} from './mcp-audit-common';

createRequire(import.meta.url)('./stub-server-only.cjs');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const TEST_TENANT_ID = process.env.MCP_AUDIT_TENANT_ID || '00000000-0000-0000-0000-000000000001';
const TEST_USER_ID = process.env.MCP_AUDIT_USER_ID || '00000000-0000-0000-0000-000000000001';
const AUDIT_PREFIX = 'MCP_AUDIT_20260826';

type TestResult =
  | 'PASS'
  | 'FAIL'
  | 'BLOCKED_BY_SAFETY'
  | 'BLOCKED_MISSING_CREDENTIALS'
  | 'BLOCKED_PROVIDER'
  | 'NOT_EXECUTABLE'
  | 'STATIC_FAIL';

type AuditRow = {
  index: number;
  tool: string;
  tool_id: string;
  module: string;
  risk: string;
  test_performed: string;
  result: TestResult;
  duration_ms: number;
  evidence_id: string;
  root_cause: string | null;
  repair: string | null;
  retest: string;
  mcp_server: string;
  downstream_service: string | null;
  read_write: string;
  executable_via: string | null;
};

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function evidenceId(tool: string, suffix: string): string {
  const hash = crypto.createHash('sha256').update(`${tool}:${suffix}:${AUDIT_PREFIX}`).digest('hex').slice(0, 12);
  return `ev-${hash}`;
}

function parseEnvelope(text: string): { standard: boolean; parsed: Record<string, unknown> | null } {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const standard =
      typeof parsed === 'object' &&
      parsed !== null &&
      ('success' in parsed ||
        'ok' in parsed ||
        'data' in parsed ||
        'error' in parsed ||
        Array.isArray(parsed.results) ||
        Array.isArray(parsed.identities) ||
        Array.isArray(parsed.items));
    return { standard, parsed };
  } catch {
    return { standard: false, parsed: null };
  }
}

function classifyFailure(text: string): string {
  const lower = text.toLowerCase();
  if (/supabase|database|postgres|relation|column|sql|connection/.test(lower)) return 'database_unavailable';
  if (/quota|rate limit|429/.test(lower)) return 'quota_or_rate_limit';
  if (/auth|unauthorized|forbidden|membership|credential|token|oauth|connect/.test(lower)) return 'auth_or_credentials';
  if (/required|invalid|validation|zod|expected/.test(lower)) return 'validation';
  if (/not found|404/.test(lower)) return 'routing_or_not_found';
  if (/provider|api error|external/.test(lower)) return 'provider';
  if (/timeout|econnreset|network/.test(lower)) return 'transient_network';
  return 'execution_error';
}

function defaultMinimalArgs(toolName: string, schema: Record<string, unknown>): Record<string, unknown> {
  const props = (schema.properties || {}) as Record<string, Record<string, unknown>>;
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  const args: Record<string, unknown> = {};

  if ('tenant_id' in props || required.includes('tenant_id')) {
    args.tenant_id = TEST_TENANT_ID;
  }
  if ('limit' in props) args.limit = 1;
  if ('query' in props) args.query = AUDIT_PREFIX;
  if ('search' in props) args.search = AUDIT_PREFIX;
  if ('module' in props && toolName === 'load_module_tools') args.module = 'crm';
  if ('id' in props && toolName === 'fetch') args.id = 'mcp://audit/nonexistent';
  if ('items' in props && toolName === 'create_leads') {
    args.items = [
      {
        business_name: `${AUDIT_PREFIX}_lead`,
        email: `${AUDIT_PREFIX}@audit.invalid`,
        source: 'mcp_execution_audit',
      },
    ];
    args.options = { skip_duplicates: true, continue_on_error: true, idempotency_key: `${AUDIT_PREFIX}_create_leads` };
  }
  if ('idempotency_key' in props) {
    args.idempotency_key = `${AUDIT_PREFIX}_${toolName}`;
  }

  for (const key of required) {
    if (args[key] !== undefined) continue;
    const field = props[key];
    if (!field) continue;
    const type = field.type;
    if (type === 'string') args[key] = `${AUDIT_PREFIX}_${key}`;
    else if (type === 'number' || type === 'integer') args[key] = 1;
    else if (type === 'boolean') args[key] = false;
    else if (type === 'array') args[key] = [];
    else if (type === 'object') args[key] = {};
  }

  return args;
}

function staticSchemaValid(schema: unknown): { ok: boolean; detail: string } {
  if (!schema || typeof schema !== 'object') return { ok: false, detail: 'missing_schema' };
  const s = schema as Record<string, unknown>;
  if (s.type !== 'object') return { ok: false, detail: 'root_not_object' };
  if (!s.properties || typeof s.properties !== 'object') return { ok: false, detail: 'missing_properties' };
  return { ok: true, detail: 'ok' };
}

async function callHttpTool(
  baseUrl: string,
  token: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; text: string; duration_ms: number }> {
  const start = Date.now();
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'AlphaClone MCP Full Execution Audit',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: evidenceId(toolName, 'http'),
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  });
  const payload = await res.json().catch(() => ({}));
  const text =
    payload?.result?.content?.[0]?.text ||
    payload?.error?.message ||
    JSON.stringify(payload).slice(0, 2000);
  const duration_ms = Date.now() - start;
  return { ok: res.ok && !payload?.error && !payload?.result?.isError, status: res.status, text: String(text), duration_ms };
}

async function main() {
  const executeRead = hasFlag('--execute-read');
  const executeWrite = hasFlag('--execute-write');
  const useHttp = hasFlag('--http');
  const baseUrl = process.argv.includes('--base-url')
    ? process.argv[process.argv.indexOf('--base-url') + 1]
    : process.env.MCP_BASE_URL || 'https://alphaclonesystems.com';
  const token = process.env.MCP_TOKEN || process.env.MCP_API_KEY || '';

  const catalogs = await loadMcpCatalogs();
  const expectedBaseline = 518;
  const discovered = catalogs.fullTools.length;

  const duplicateNames = catalogs.fullTools
    .map((t) => t.name)
    .filter((name, i, all) => all.indexOf(name) !== i);

  const submissionPath = path.join(process.cwd(), 'chatgpt-app-submission.json');
  let submissionCount: number | null = null;
  let submissionDrift: string[] = [];
  if (fs.existsSync(submissionPath)) {
    const submission = JSON.parse(fs.readFileSync(submissionPath, 'utf8')) as { tools?: Record<string, unknown> };
    submissionCount = Object.keys(submission.tools || {}).length;
    const subNames = new Set(Object.keys(submission.tools || {}));
    submissionDrift = catalogs.fullTools.map((t) => t.name).filter((n) => !subNames.has(n));
  }

  const { executeTool } = await import('../src/lib/mcp/tool-registry');

  const rows: AuditRow[] = [];
  const executionLog: Array<Record<string, unknown>> = [];

  for (let i = 0; i < catalogs.fullTools.length; i++) {
    const tool = catalogs.fullTools[i];
    const schema = (tool.inputSchema || tool.jsonSchema || {}) as Record<string, unknown>;
    const annotations = catalogs.inferToolAnnotations(tool.name);
    const readWrite = classifyReadWrite(tool.name, annotations);
    const risk = classifyRisk(tool.name, annotations);
    const module = normalizeModule(tool.name, catalogs.moduleForTool(tool.name));
    const executable =
      catalogs.registryNames.has(tool.name) || ROUTE_EXECUTED_TOOL_NAMES.has(tool.name);
    const executableVia = catalogs.registryNames.has(tool.name)
      ? 'tool-registry'
      : ROUTE_EXECUTED_TOOL_NAMES.has(tool.name)
        ? 'mcp-route'
        : null;
    const integration = inferIntegrationDependency(tool.name, schema);

    const staticCheck = staticSchemaValid(schema);
    let result: TestResult = staticCheck.ok ? 'PASS' : 'STATIC_FAIL';
    let testPerformed = 'static_contract_only';
    let duration_ms = 0;
    let rootCause: string | null = staticCheck.ok ? null : staticCheck.detail;
    let repair: string | null = null;
    let retest = 'pending';

    if (!executable) {
      result = 'NOT_EXECUTABLE';
      rootCause = 'catalog_entry_without_handler';
      repair = 'Register handler or remove from full catalog';
    } else if (risk === 'critical' && !executeWrite) {
      result = 'BLOCKED_BY_SAFETY';
      testPerformed = 'static_contract_destructive_blocked';
      rootCause = 'destructive_tool_requires_--execute-write_in_staging';
    } else if (readWrite === 'write' && !executeWrite) {
      result = 'BLOCKED_BY_SAFETY';
      testPerformed = 'static_contract_write_blocked';
      rootCause = requiresApproval(tool.name, risk)
        ? 'write_tool_requires_approval_and_--execute-write'
        : 'write_tool_blocked_by_audit_policy';
    } else if (executeRead || executeWrite) {
      const minimalArgs = defaultMinimalArgs(tool.name, schema);
      const start = Date.now();

      try {
        let text = '';
        let ok = false;

        if (useHttp) {
          if (!token) {
            result = 'BLOCKED_MISSING_CREDENTIALS';
            rootCause = 'MCP_TOKEN_or_MCP_API_KEY_missing_for_http_mode';
            testPerformed = 'http_execution_skipped_no_token';
          } else {
            testPerformed = 'http_minimal_valid_request';
            const httpRes = await callHttpTool(baseUrl, token, tool.name, minimalArgs);
            duration_ms = httpRes.duration_ms;
            text = httpRes.text;
            ok = httpRes.ok;
          }
        } else {
          testPerformed = 'local_registry_minimal_valid_request';
          const execRes = await executeTool(TEST_TENANT_ID, TEST_USER_ID, tool.name, minimalArgs);
          duration_ms = Date.now() - start;
          text = execRes.content?.[0]?.text || '';
          ok = !execRes.isError;
        }

        if (result !== 'BLOCKED_MISSING_CREDENTIALS') {
          if (ok) {
            const envelope = parseEnvelope(text);
            result = envelope.standard ? 'PASS' : 'FAIL';
            if (!envelope.standard) {
              rootCause = 'non_standard_response_envelope';
              repair = 'Wrap handler output in standard success/error envelope';
            }
          } else {
            const cause = classifyFailure(text);
            if (cause === 'database_unavailable') {
              result = 'BLOCKED_MISSING_CREDENTIALS';
              rootCause = 'supabase_not_configured_or_unreachable';
              repair = 'Configure SUPABASE_* for audit runner or use --http with production token';
            } else if (cause === 'auth_or_credentials') {
              result = 'BLOCKED_MISSING_CREDENTIALS';
              rootCause = cause;
            } else if (cause === 'provider') {
              result = 'BLOCKED_PROVIDER';
              rootCause = cause;
            } else if (cause === 'validation') {
              result = 'FAIL';
              rootCause = 'minimal_args_failed_validation';
              repair = 'Improve defaultMinimalArgs or document required fields';
            } else {
              result = 'FAIL';
              rootCause = cause;
            }
          }
        }

        executionLog.push({
          evidence_id: evidenceId(tool.name, testPerformed),
          tool: tool.name,
          sanitized_input: minimalArgs,
          duration_ms,
          result,
          root_cause: rootCause,
          response_preview: text.slice(0, 300),
        });
      } catch (err: unknown) {
        duration_ms = Date.now() - start;
        result = 'FAIL';
        rootCause = err instanceof Error ? err.message : String(err);
      }

      retest = result === 'PASS' ? 'not_required' : 'required_after_repair';
    } else {
      testPerformed = 'static_contract_registry_parity';
      if (executable && staticCheck.ok) {
        result = 'PASS';
      }
    }

    rows.push({
      index: i + 1,
      tool: tool.name,
      tool_id: `alphaclone.mcp.${tool.name}`,
      module,
      risk,
      test_performed: testPerformed,
      result,
      duration_ms,
      evidence_id: evidenceId(tool.name, testPerformed),
      root_cause: rootCause,
      repair,
      retest,
      mcp_server: 'alphaclone-systems',
      downstream_service: integration,
      read_write: readWrite,
      executable_via: executableVia,
    });
  }

  const totals = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.result] = (acc[row.result] || 0) + 1;
    return acc;
  }, {});

  const passed = totals.PASS || 0;
  const passPct = discovered > 0 ? Math.round((passed / discovered) * 1000) / 10 : 0;

  const failuresByCause = rows
    .filter((r) => r.result !== 'PASS' && r.result !== 'BLOCKED_BY_SAFETY')
    .reduce<Record<string, number>>((acc, row) => {
      const key = row.root_cause || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  const report = {
    generated_at: new Date().toISOString(),
    audit_prefix: AUDIT_PREFIX,
    phase: '1-4_inventory_static_safe_execution',
    expected_tools_baseline: expectedBaseline,
    discovered_tools: discovered,
    implemented_tools: catalogs.registryNames.size,
    registry_route_tools: ROUTE_EXECUTED_TOOL_NAMES.size,
    count_reconciliation: {
      expected_baseline: expectedBaseline,
      runtime_discovered: discovered,
      delta: discovered - expectedBaseline,
      delta_tools: submissionDrift,
      explanation:
        discovered !== expectedBaseline
          ? `Runtime catalog has ${discovered} tools; baseline ${expectedBaseline} reflects chatgpt-app-submission.json (${submissionCount ?? 'n/a'} entries). Delta: ${submissionDrift.join(', ') || 'none'}.`
          : 'Counts reconcile.',
      duplicate_names: duplicateNames,
      orphaned_registry_tools: catalogs.registryTools
        .filter((t) => !catalogs.fullTools.some((f) => f.name === t.name))
        .map((t) => t.name),
      catalog_only_tools: rows.filter((r) => r.result === 'NOT_EXECUTABLE').map((r) => r.tool),
    },
    mode: {
      execute_read: executeRead,
      execute_write: executeWrite,
      transport: useHttp ? 'http' : executeRead ? 'local_registry' : 'static_only',
      base_url: useHttp ? baseUrl : null,
      test_tenant_id: TEST_TENANT_ID,
    },
    totals: {
      tools_executed: executeRead || executeWrite ? rows.filter((r) => !r.test_performed.includes('static')).length : 0,
      tools_passed: passed,
      tools_failed: totals.FAIL || 0,
      tools_blocked_by_safety: totals.BLOCKED_BY_SAFETY || 0,
      tools_blocked_missing_credentials: totals.BLOCKED_MISSING_CREDENTIALS || 0,
      tools_blocked_provider: totals.BLOCKED_PROVIDER || 0,
      tools_not_executable: totals.NOT_EXECUTABLE || 0,
      tools_static_fail: totals.STATIC_FAIL || 0,
      pass_percentage: passPct,
      ...totals,
    },
    failures_by_root_cause: failuresByCause,
    execution_log_sample: executionLog.slice(0, 50),
    tools: rows,
  };

  const outDir = ensureAuditDir();
  const jsonPath = path.join(outDir, 'mcp-full-execution-audit.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const mdLines = [
    '# AlphaClone MCP Full Execution Audit',
    '',
    `Generated: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `| --- | ---: |`,
    `| Expected baseline | ${expectedBaseline} |`,
    `| Discovered (runtime) | ${discovered} |`,
    `| Implemented (registry) | ${catalogs.registryNames.size} |`,
    `| Passed | ${passed} |`,
    `| Failed | ${totals.FAIL || 0} |`,
    `| Blocked (safety) | ${totals.BLOCKED_BY_SAFETY || 0} |`,
    `| Blocked (credentials/DB) | ${totals.BLOCKED_MISSING_CREDENTIALS || 0} |`,
    `| Blocked (provider) | ${totals.BLOCKED_PROVIDER || 0} |`,
    `| Pass % | ${passPct}% |`,
    '',
    '## Count reconciliation',
    '',
    report.count_reconciliation.explanation,
    '',
    ...(submissionDrift.length ? [`**Drift tools:** ${submissionDrift.join(', ')}`, ''] : []),
    '## Failures by root cause',
    '',
    ...Object.entries(failuresByCause).map(([k, v]) => `- \`${k}\`: ${v}`),
    '',
    '## Per-tool results',
    '',
    '| # | Tool | Module | Risk | Test performed | Result | Duration | Evidence ID | Root cause | Repair | Retest |',
    '| - | ---- | ------ | ---- | -------------- | ------ | -------: | ----------- | ---------- | ------ | ------ |',
    ...rows.map(
      (r) =>
        `| ${r.index} | ${r.tool} | ${r.module} | ${r.risk} | ${r.test_performed} | ${r.result} | ${r.duration_ms} | ${r.evidence_id} | ${r.root_cause ?? ''} | ${r.repair ?? ''} | ${r.retest} |`,
    ),
  ];

  const mdPath = path.join(outDir, 'mcp-full-execution-audit.md');
  fs.writeFileSync(mdPath, `${mdLines.join('\n')}\n`);

  console.log(
    JSON.stringify(
      {
        jsonPath,
        mdPath,
        discovered,
        expectedBaseline,
        delta: discovered - expectedBaseline,
        submissionDrift,
        totals: report.totals,
        failures_by_root_cause: failuresByCause,
      },
      null,
      2,
    ),
  );

  if ((totals.FAIL || 0) > 0 || (totals.NOT_EXECUTABLE || 0) > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

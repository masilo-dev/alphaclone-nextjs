/**
 * Unit tests for Alphaclone ChatGPT MCP connector surface.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_CONNECTOR_TOOLS = [
  'get_platform_status',
  'get_system_health',
  'get_version',
  'get_environment',
  'get_feature_flags',
  'get_recent_errors',
  'get_audit_logs',
  'restart_service',
  'audit_platform',
  'list_conversations',
  'get_conversation',
  'list_workflows',
  'get_workflow',
  'run_workflow',
  'stop_workflow',
  'inspect_agent_reasoning',
  'inspect_memory',
  'inspect_tools',
  'inspect_prompts',
  'inspect_vector_store',
  'inspect_embeddings',
  'inspect_rag',
  'inspect_planner',
  'inspect_executor',
  'inspect_scheduler',
  'inspect_task_queue',
  'list_leads',
  'search_leads',
  'create_lead',
  'update_lead',
  'delete_lead',
  'list_contacts',
  'list_companies',
  'pipeline_status',
  'opportunities',
  'connected_accounts',
  'scheduled_posts',
  'drafts',
  'analytics',
  'publish_post',
  'delete_post',
  'engagement_report',
  'campaigns',
  'campaign_metrics',
  'email_campaigns',
  'funnels',
  'landing_pages',
  'conversions',
  'invoices',
  'quotes',
  'payments',
  'subscriptions',
  'revenue_dashboard',
  'events',
  'tasks',
  'reminders',
  'appointments',
  'search_documents',
  'upload_document',
  'retrieve_document',
  'document_versions',
  'dashboard_metrics',
  'revenue_report',
  'growth_report',
  'customer_report',
  'AI_usage_report',
  'github_health',
  'gmail_health',
  'google_calendar_health',
  'zoho_health',
  'stripe_health',
  'calendly_health',
  'railway_health',
  'supabase_health',
  'openai_health',
  'deepseek_health',
  'integrations_status',
];

const CONNECTOR_FILES = [
  'platform-ops.ts',
  'bonnie-inspect.ts',
  'crm-ops.ts',
  'social-ops.ts',
  'marketing-ops.ts',
  'sales-ops.ts',
  'calendar-ops.ts',
  'documents-ops.ts',
  'reports-ops.ts',
  'integrations-health.ts',
];

describe('mcp connector helpers', () => {
  it('normalizes pagination with defaults and caps', async () => {
    const { normalizePagination, buildPaginationMeta } = await import(
      '../../src/lib/mcp/connector/pagination.ts'
    );

    const a = normalizePagination({});
    assert.equal(a.limit, 25);
    assert.equal(a.offset, 0);

    const b = normalizePagination({ limit: 999, offset: -5 });
    assert.equal(b.limit, 100);
    assert.equal(b.offset, 0);

    const meta = buildPaginationMeta({ limit: 25, offset: 0, returned: 25, total: 100 });
    assert.equal(meta.has_more, true);
    assert.equal(meta.next_offset, 25);
  });

  it('builds structured success and error envelopes', async () => {
    const { okResult, errorResult, toMcpContent } = await import(
      '../../src/lib/mcp/connector/response.ts'
    );

    const ok = okResult('list_leads', { leads: [] });
    assert.equal(ok.ok, true);
    assert.equal(ok.tool, 'list_leads');

    const err = errorResult('list_leads', 'PERMISSION_DENIED', 'nope');
    assert.equal(err.ok, false);
    assert.equal(err.error.code, 'PERMISSION_DENIED');

    const content = toMcpContent(ok);
    assert.equal(content.isError, false);
    assert.match(content.content[0].text, /"ok": true/);
  });

  it('defines every ChatGPT connector tool in module sources', () => {
    const toolsDir = path.join(process.cwd(), 'src/lib/mcp/tools');
    const names = new Set();

    for (const file of CONNECTOR_FILES) {
      const src = fs.readFileSync(path.join(toolsDir, file), 'utf8');
      for (const match of src.matchAll(/name:\s*'([A-Za-z0-9_]+)'/g)) {
        names.add(match[1]);
      }
    }

    const missing = REQUIRED_CONNECTOR_TOOLS.filter((name) => !names.has(name));
    assert.deepEqual(missing, [], `Missing connector tools: ${missing.join(', ')}`);
  });

  it('wires connector modules into tool-registry initializeRegistry', () => {
    const registrySrc = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/mcp/tool-registry.ts'),
      'utf8'
    );
    for (const file of CONNECTOR_FILES) {
      const modulePath = `./tools/${file.replace(/\.ts$/, '')}`;
      assert.ok(
        registrySrc.includes(`require('${modulePath}')`),
        `registry missing ${modulePath}`
      );
    }
    assert.ok(
      registrySrc.includes("require('./tools/chatgpt-aliases')"),
      'registry missing chatgpt-aliases'
    );
  });

  it('exports platform audit engine', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/mcp/audit/platformAuditEngine.ts'),
      'utf8'
    );
    assert.match(src, /export async function runPlatformAudit/);
    assert.match(src, /PlatformHealthScore/);
    assert.match(src, /recommendations/);
  });

  it('includes connector tools in chatgpt-app-submission.json', () => {
    const doc = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'chatgpt-app-submission.json'), 'utf8')
    );
    const missing = REQUIRED_CONNECTOR_TOOLS.filter((name) => !doc.tools?.[name]);
    assert.deepEqual(missing, [], `Missing ChatGPT annotations: ${missing.join(', ')}`);
  });

  it('attaches OpenAI-required annotations on unified tools/list output', () => {
    const listSrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/mcp/listAllTools.ts'), 'utf8');
    const annSrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/mcp/toolAnnotations.ts'), 'utf8');
    const routeSrc = fs.readFileSync(path.join(process.cwd(), 'src/app/api/mcp/route.ts'), 'utf8');
    const aliasSrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/mcp/tools/chatgpt-aliases.ts'), 'utf8');

    assert.match(listSrc, /resolveToolAnnotations/);
    assert.match(listSrc, /annotations:/);
    assert.match(listSrc, /forChatGPT/);
    assert.match(listSrc, /name: 'search'/);
    assert.match(listSrc, /name: 'fetch'/);
    assert.match(annSrc, /readOnlyHint/);
    assert.match(annSrc, /openWorldHint/);
    assert.match(annSrc, /destructiveHint/);
    assert.match(annSrc, /chatgpt-app-submission\.json/);
    assert.match(routeSrc, /getUnifiedMcpTools\(\{/);
    assert.match(aliasSrc, /name: 'search'/);
    assert.match(aliasSrc, /name: 'fetch'/);
  });

  it('documents deployment and ChatGPT compatibility', () => {
    const doc = fs.readFileSync(
      path.join(process.cwd(), 'docs/CHATGPT_MCP_CONNECTOR.md'),
      'utf8'
    );
    assert.match(doc, /\/api\/mcp/);
    assert.match(doc, /audit_platform/);
    assert.match(doc, /OAuth/);
    assert.ok(fs.existsSync(path.join(process.cwd(), 'Dockerfile.mcp')));
    assert.ok(fs.existsSync(path.join(process.cwd(), 'docker-compose.mcp.yml')));
  });
});

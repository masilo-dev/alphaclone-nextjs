/**
 * Production platform audit engine for Alphaclone MCP connector.
 * Inspects modules, integrations, workflows, security posture, and AI risks.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getIntegrationEncryptionSecret } from '@/lib/integration/integrationTokenCrypto';
import { getUnifiedMcpToolCount } from '@/lib/mcp/listAllTools';
import { buildApiHealthReport } from '@/lib/mcp/apiHealthReport';
import type { AuditFinding, PlatformHealthScore } from '@/lib/mcp/connector/types';

const REQUIRED_INTEGRATIONS = [
  'google_calendar',
  'zoho',
  'stripe',
  'calendly',
  'railway',
  'supabase',
  'openai',
  'deepseek',
] as const;

function severityWeight(severity: AuditFinding['severity']): number {
  switch (severity) {
    case 'critical':
      return 25;
    case 'high':
      return 15;
    case 'medium':
      return 8;
    case 'low':
      return 3;
    default:
      return 0;
  }
}

function gradeFromScore(score: number): PlatformHealthScore['grade'] {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 55) return 'D';
  return 'F';
}

async function safeCount(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  tenantId: string,
  filters?: (q: any) => any
): Promise<{ count: number; error?: string; latencyMs: number }> {
  const start = Date.now();
  try {
    let q = supabase.from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
    if (filters) q = filters(q);
    const { count, error } = await q;
    return {
      count: count ?? 0,
      error: error?.message,
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return { count: 0, error: err?.message || String(err), latencyMs: Date.now() - start };
  }
}

function envPresent(...keys: string[]): boolean {
  return keys.some((k) => Boolean(process.env[k] && String(process.env[k]).trim()));
}

function envConfigured(keys: string[]): boolean {
  return keys.every((k) => Boolean(process.env[k] && String(process.env[k]).trim()));
}

export async function runPlatformAudit(params: {
  tenantId: string;
  userId?: string;
  includeSlowQueries?: boolean;
}): Promise<PlatformHealthScore> {
  const supabase = createSupabaseAdminClient();
  const findings: AuditFinding[] = [];
  const moduleScores: PlatformHealthScore['modules'] = {};
  const generatedAt = new Date().toISOString();

  const markModule = (
    name: string,
    status: PlatformHealthScore['modules'][string]['status'],
    score: number,
    findingCount: number
  ) => {
    moduleScores[name] = { status, score, finding_count: findingCount };
  };

  // ── Platform / deployment ──────────────────────────────────────────────
  const platformFindingsBefore = findings.length;
  const version = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv !== 'production') {
    findings.push({
      id: 'deploy-nonprod',
      module: 'platform',
      severity: 'medium',
      title: 'Non-production environment',
      detail: `NODE_ENV is "${nodeEnv}".`,
      recommendation: 'Ensure production deployments set NODE_ENV=production.',
    });
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    findings.push({
      id: 'deploy-missing-app-url',
      module: 'platform',
      severity: 'high',
      title: 'Missing NEXT_PUBLIC_APP_URL',
      detail: 'Public app URL is not configured.',
      recommendation: 'Set NEXT_PUBLIC_APP_URL for OAuth, MCP well-known, and email links.',
    });
  }
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  if (heapUsedMb > 700) {
    findings.push({
      id: 'deploy-high-memory',
      module: 'platform',
      severity: 'medium',
      title: 'Elevated heap usage',
      detail: `Process heapUsed is ${heapUsedMb}MB.`,
      recommendation: 'Review memory leaks and NODE_OPTIONS heap limits on Railway.',
      evidence: { heapUsedMb, version },
    });
  }
  markModule(
    'platform',
    findings.length - platformFindingsBefore > 1 ? 'degraded' : 'healthy',
    Math.max(40, 100 - (findings.length - platformFindingsBefore) * 10),
    findings.length - platformFindingsBefore
  );

  // ── Database / slow queries ────────────────────────────────────────────
  const dbFindingsBefore = findings.length;
  const tablesToProbe = [
    'leads',
    'contacts',
    'business_clients',
    'invoices',
    'deals',
    'social_posts',
    'audit_logs',
    'mcp_sessions',
  ];
  const latencies: Array<{ table: string; latencyMs: number; error?: string }> = [];
  for (const table of tablesToProbe) {
    const result = await safeCount(supabase, table, params.tenantId);
    latencies.push({ table, latencyMs: result.latencyMs, error: result.error });
    if (result.error) {
      findings.push({
        id: `db-broken-${table}`,
        module: 'database',
        severity: 'critical',
        title: `Broken API / table access: ${table}`,
        detail: result.error,
        recommendation: `Verify schema, RLS, and migrations for ${table}.`,
      });
    } else if (params.includeSlowQueries !== false && result.latencyMs > 1500) {
      findings.push({
        id: `db-slow-${table}`,
        module: 'database',
        severity: 'high',
        title: `Slow query on ${table}`,
        detail: `Count query took ${result.latencyMs}ms.`,
        recommendation: `Add indexes / optimize queries for ${table}.`,
        evidence: { latencyMs: result.latencyMs },
      });
    }
  }
  markModule(
    'database',
    findings.slice(dbFindingsBefore).some((f) => f.severity === 'critical')
      ? 'failing'
      : findings.length - dbFindingsBefore > 0
        ? 'degraded'
        : 'healthy',
    Math.max(20, 100 - (findings.length - dbFindingsBefore) * 12),
    findings.length - dbFindingsBefore
  );

  // ── Integrations ───────────────────────────────────────────────────────
  const integFindingsBefore = findings.length;
  const [integrationsRes, tenantIntegRes, tenantRes] = await Promise.all([
    supabase.from('integrations').select('type, enabled').eq('tenant_id', params.tenantId),
    supabase.from('tenant_integrations').select('integration_id, status').eq('tenant_id', params.tenantId).eq('status', 'connected'),
    supabase.from('tenants').select('settings').eq('id', params.tenantId).maybeSingle(),
  ]);

  const connectedTypes = new Set<string>();
  (integrationsRes.data || []).forEach((i: any) => {
    if (i.enabled !== false && i.type) connectedTypes.add(String(i.type).toLowerCase());
  });
  (tenantIntegRes.data || []).forEach((i: any) => {
    if (i.integration_id) connectedTypes.add(String(i.integration_id).toLowerCase());
  });
  const settings = (tenantRes.data?.settings || {}) as Record<string, any>;
  if (settings.calendly?.enabled || settings.calendly?.calendlyUserUri) connectedTypes.add('calendly');
  if (settings.google_calendar || settings.googleCalendar) connectedTypes.add('google_calendar');
  if (settings.gmail || settings.google_gmail) connectedTypes.add('gmail');
  if (settings.zoho || settings.zoho_mail) connectedTypes.add('zoho');

  // Env-backed platform integrations
  const envIntegrationStatus: Record<string, boolean> = {
    github: envPresent('GITHUB_TOKEN', 'GITHUB_APP_ID') || connectedTypes.has('github'),
    gmail: connectedTypes.has('gmail') || connectedTypes.has('google_gmail'),
    google_calendar: connectedTypes.has('google_calendar'),
    zoho: connectedTypes.has('zoho') || connectedTypes.has('zoho_mail'),
    stripe: envPresent('STRIPE_SECRET_KEY') || connectedTypes.has('stripe'),
    calendly: connectedTypes.has('calendly'),
    railway: Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) || envPresent('RAILWAY_TOKEN', 'RAILWAY_API_TOKEN') || connectedTypes.has('railway'),
    supabase: (envPresent('SUPABASE_SERVICE_ROLE_KEY') && envPresent('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL')) || connectedTypes.has('supabase'),
    openai: envPresent('OPENAI_API_KEY') || connectedTypes.has('openai'),
    deepseek: envPresent('DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY') || connectedTypes.has('deepseek'),
  };

  for (const name of REQUIRED_INTEGRATIONS) {
    if (!envIntegrationStatus[name] && !connectedTypes.has(name)) {
      findings.push({
        id: `integ-missing-${name}`,
        module: 'integrations',
        severity: name === 'supabase' || name === 'stripe' ? 'high' : 'medium',
        title: `Missing integration: ${name}`,
        detail: `${name} is not connected or configured for this tenant.`,
        recommendation: `Connect ${name} from Integrations or set the required secrets.`,
      });
    }
  }
  markModule(
    'integrations',
    findings.length - integFindingsBefore > 3 ? 'degraded' : findings.length - integFindingsBefore > 0 ? 'degraded' : 'healthy',
    Math.max(30, 100 - (findings.length - integFindingsBefore) * 8),
    findings.length - integFindingsBefore
  );

  // ── CRM ────────────────────────────────────────────────────────────────
  const crmBefore = findings.length;
  const leads = await safeCount(supabase, 'leads', params.tenantId);
  const contacts = await safeCount(supabase, 'contacts', params.tenantId);
  if (!leads.error && leads.count === 0 && !contacts.error && contacts.count === 0) {
    findings.push({
      id: 'crm-empty',
      module: 'crm',
      severity: 'low',
      title: 'CRM has no leads or contacts',
      detail: 'Pipeline is empty.',
      recommendation: 'Import leads or connect lead sources.',
    });
  }
  markModule('crm', 'healthy', Math.max(70, 100 - (findings.length - crmBefore) * 10), findings.length - crmBefore);

  // ── Workflows / Bonnie ─────────────────────────────────────────────────
  const bonnieBefore = findings.length;
  const { data: failedSessions } = await supabase
    .from('mcp_sessions')
    .select('id, tool_name, success, error_message, created_at')
    .eq('tenant_id', params.tenantId)
    .eq('success', false)
    .order('created_at', { ascending: false })
    .limit(25);

  if ((failedSessions || []).length >= 5) {
    findings.push({
      id: 'bonnie-failed-tools',
      module: 'bonnie',
      severity: 'high',
      title: 'Repeated MCP tool failures',
      detail: `${failedSessions!.length} recent failed tool executions.`,
      recommendation: 'Inspect failed tools, fix permissions/integrations, and retry workflows.',
      evidence: {
        sample: failedSessions!.slice(0, 5).map((s: any) => ({
          tool: s.tool_name,
          error: s.error_message,
          at: s.created_at,
        })),
      },
    });
  }

  // Hallucination risk: tools that claim success with empty critical payloads are not detectable here;
  // instead flag missing vector/RAG tables or AI quota exhaustion.
  const { count: aiUsageErrors } = await supabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', params.tenantId)
    .ilike('action', '%ai%error%')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());

  if ((aiUsageErrors || 0) > 10) {
    findings.push({
      id: 'ai-hallucination-risk',
      module: 'bonnie',
      severity: 'medium',
      title: 'Elevated AI error rate (hallucination / failure risk)',
      detail: `${aiUsageErrors} AI-related audit errors in the last 7 days.`,
      recommendation: 'Enable evidence_required agent mode and review Bonnie prompts/RAG coverage.',
    });
  }

  const toolCount = await getUnifiedMcpToolCount();
  if (toolCount < 50) {
    findings.push({
      id: 'bonnie-tool-discovery',
      module: 'bonnie',
      severity: 'critical',
      title: 'MCP tool catalog appears incomplete',
      detail: `Only ${toolCount} tools discovered.`,
      recommendation: 'Verify tool registry initialization and ChatGPT discovery endpoint.',
    });
  }

  markModule(
    'bonnie',
    findings.slice(bonnieBefore).some((f) => f.severity === 'critical') ? 'failing' : findings.length - bonnieBefore > 0 ? 'degraded' : 'healthy',
    Math.max(25, 100 - (findings.length - bonnieBefore) * 12),
    findings.length - bonnieBefore
  );

  // ── Security / permissions ─────────────────────────────────────────────
  const secBefore = findings.length;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    findings.push({
      id: 'sec-missing-service-role',
      module: 'security',
      severity: 'critical',
      title: 'Missing Supabase service role key',
      detail: 'SUPABASE_SERVICE_ROLE_KEY is not set.',
      recommendation: 'Configure the service role secret in the deployment environment.',
    });
  }
  if (!getIntegrationEncryptionSecret()) {
    findings.push({
      id: 'sec-missing-token-encryption',
      module: 'security',
      severity: 'high',
      title: 'Integration token encryption secret missing',
      detail: 'No INTEGRATION_TOKEN_ENCRYPTION_SECRET configured.',
      recommendation: 'Set a strong encryption secret for OAuth tokens at rest.',
    });
  }

  const { data: apiKeys } = await supabase
    .from('mcp_api_keys')
    .select('id, revoked_at, created_at')
    .eq('tenant_id', params.tenantId)
    .is('revoked_at', null)
    .limit(50);

  if (!apiKeys || apiKeys.length === 0) {
    findings.push({
      id: 'sec-no-mcp-keys',
      module: 'security',
      severity: 'medium',
      title: 'No active MCP API keys',
      detail: 'Tenant has no active ac_mcp_* keys (OAuth-only is fine if intentional).',
      recommendation: 'Create an MCP API key or connect via OAuth for ChatGPT.',
    });
  }
  markModule(
    'security',
    findings.slice(secBefore).some((f) => f.severity === 'critical') ? 'failing' : findings.length - secBefore > 0 ? 'degraded' : 'healthy',
    Math.max(20, 100 - (findings.length - secBefore) * 15),
    findings.length - secBefore
  );

  // ── API health ─────────────────────────────────────────────────────────
  const apiBefore = findings.length;
  try {
    const apiHealth = await buildApiHealthReport(params.tenantId, 24);
    const errorRate = Number((apiHealth as any)?.error_rate ?? (apiHealth as any)?.summary?.error_rate ?? 0);
    if (errorRate > 0.15) {
      findings.push({
        id: 'api-high-error-rate',
        module: 'api',
        severity: 'high',
        title: 'High MCP/API error rate',
        detail: `Error rate is ${(errorRate * 100).toFixed(1)}% over 24h.`,
        recommendation: 'Review get_recent_errors and failing integrations.',
        evidence: { errorRate },
      });
    }
  } catch (err: any) {
    findings.push({
      id: 'api-health-unavailable',
      module: 'api',
      severity: 'medium',
      title: 'API health report unavailable',
      detail: err?.message || String(err),
      recommendation: 'Ensure mcp_sessions telemetry table is writable.',
    });
  }
  markModule('api', findings.length - apiBefore > 0 ? 'degraded' : 'healthy', Math.max(50, 100 - (findings.length - apiBefore) * 15), findings.length - apiBefore);

  // ── Score ──────────────────────────────────────────────────────────────
  let score = 100;
  for (const finding of findings) {
    score -= severityWeight(finding.severity);
  }
  score = Math.max(0, Math.min(100, score));

  const recommendations = Array.from(
    new Set(
      findings
        .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
        .map((f) => f.recommendation)
    )
  ).slice(0, 12);

  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;

  return {
    score,
    grade: gradeFromScore(score),
    summary:
      criticalCount > 0
        ? `Platform health score ${score}/100 (${gradeFromScore(score)}). ${criticalCount} critical and ${highCount} high findings require attention.`
        : `Platform health score ${score}/100 (${gradeFromScore(score)}). ${findings.length} findings; ${recommendations.length} actionable recommendations.`,
    findings,
    recommendations,
    modules: moduleScores,
    generated_at: generatedAt,
  };
}

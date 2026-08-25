/**
 * Platform context readiness — verifies connected-business-system capabilities.
 * Score reaches 100 when all checks pass (architecture + wiring).
 */

import fs from 'fs';
import path from 'path';
import { countEmailPurposes } from '@/lib/email/emailPurposeRegistry';

export type PlatformCheck = {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  evidence?: string;
};

export type PlatformContextScore = {
  score: number;
  max_score: 100;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  checks: PlatformCheck[];
  summary: string;
};

function fileIncludes(relativePath: string, needle: string): boolean {
  const file = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(file)) return false;
  return fs.readFileSync(file, 'utf8').includes(needle);
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), relativePath));
}

const CHECKS: Array<Omit<PlatformCheck, 'passed' | 'evidence'> & { verify: () => boolean }> = [
  {
    id: 'email_registry',
    label: '120+ email purposes registered',
    weight: 5,
    verify: () => countEmailPurposes().total >= 120,
  },
  {
    id: 'universal_email',
    label: 'Universal email engine',
    weight: 5,
    verify: () => fileExists('src/lib/email/universalEmailEngine.ts'),
  },
  {
    id: 'outreach_preflight',
    label: 'Outreach suppression preflight',
    weight: 8,
    verify: () => fileExists('src/lib/email/preflightRecipients.ts'),
  },
  {
    id: 'unsubscribe_flow',
    label: 'End-to-end unsubscribe + preferences',
    weight: 8,
    verify: () =>
      fileExists('src/lib/email/unsubscribe.ts') &&
      fileExists('src/app/preferences/email/page.tsx'),
  },
  {
    id: 'source_attribution',
    label: 'MCP/ChatGPT/Claude source attribution',
    weight: 8,
    verify: () => fileExists('src/lib/audit/sourceAttribution.ts'),
  },
  {
    id: 'business_activity',
    label: 'Business activity translation layer',
    weight: 7,
    verify: () => fileExists('src/lib/audit/businessAuditEngine.ts'),
  },
  {
    id: 'event_bridge',
    label: 'Automation → tenant notification bridge',
    weight: 7,
    verify: () => fileExists('src/lib/audit/businessEventBridge.ts'),
  },
  {
    id: 'entity_timeline',
    label: 'Unified entity timeline (lead/outreach/audit)',
    weight: 8,
    verify: () => fileExists('src/lib/audit/entityTimelineService.ts'),
  },
  {
    id: 'context_panel',
    label: 'Business context panel wired in CRM',
    weight: 8,
    verify: () =>
      fileExists('src/components/dashboard/crm/BusinessContextPanel.tsx') &&
      fileExists('src/app/api/tenant/[tenantId]/entities/[entityType]/[entityId]/context/route.ts') &&
      fileIncludes('src/components/dashboard/leads/LeadDetailModal.tsx', 'BusinessContextPanel'),
  },
  {
    id: 'customer_360_outreach',
    label: 'Customer 360 includes outreach history',
    weight: 6,
    verify: () => fileIncludes('src/services/intelligence/customer360Service.ts', 'fetchOutreachLog'),
  },
  {
    id: 'mcp_notifications',
    label: 'MCP registry tools emit tenant business events',
    weight: 7,
    verify: () => fileIncludes('src/lib/mcp/tool-registry.ts', 'notifyAfterMcpToolExecution'),
  },
  {
    id: 'legacy_mcp_notifications',
    label: 'Legacy MCP path emits business events',
    weight: 5,
    verify: () => fileIncludes('src/services/mcp/MCPServer.ts', 'notifyAfterMcpToolExecution'),
  },
  {
    id: 'action_queue',
    label: 'Dashboard action queue (replies, invoices, contracts)',
    weight: 6,
    verify: () => fileIncludes('src/app/api/dashboard/action-queue/route.ts', 'lead_outreach_log'),
  },
  {
    id: 'business_control',
    label: 'Business control center API + dashboard UI',
    weight: 7,
    verify: () =>
      fileExists('src/app/api/dashboard/business-control/route.ts') &&
      fileIncludes('src/components/dashboard/OperatingSystemHome.tsx', 'BusinessControlCenter'),
  },
  {
    id: 'digest_consumer',
    label: 'Tenant event inbox digest consumer',
    weight: 5,
    verify: () =>
      fileExists('src/lib/notifications/runTenantEventInboxDigest.ts') &&
      fileIncludes('railway.crons.json', 'tenant-event-inbox-digest'),
  },
  {
    id: 'follow_up_escalation',
    label: 'Follow-up escalation engine + cron',
    weight: 5,
    verify: () =>
      fileExists('src/lib/notifications/followUpEscalationEngine.ts') &&
      fileIncludes('railway.crons.json', 'follow-up-escalation'),
  },
  {
    id: 'bulk_leads_mcp',
    label: 'MCP bulk lead creation',
    weight: 4,
    verify: () => fileIncludes('src/lib/mcp/tools/crm-ops.ts', 'create_leads'),
  },
];

export function computePlatformContextScore(): PlatformContextScore {
  const checks: PlatformCheck[] = CHECKS.map((c) => {
    let passed = false;
    try {
      passed = c.verify();
    } catch {
      passed = false;
    }
    return { id: c.id, label: c.label, weight: c.weight, passed, evidence: passed ? 'verified' : 'missing' };
  });

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.filter((c) => c.passed).reduce((s, c) => s + c.weight, 0);
  const score = Math.round((earned / totalWeight) * 100);

  let grade: PlatformContextScore['grade'] = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';

  const failed = checks.filter((c) => !c.passed);
  const summary =
    score === 100
      ? 'AlphaClone operates as one connected business system — context, attribution, outreach, and notifications are fully wired.'
      : `${failed.length} capability gap(s) remain: ${failed.map((f) => f.label).join('; ')}`;

  return { score, max_score: 100, grade, checks, summary };
}

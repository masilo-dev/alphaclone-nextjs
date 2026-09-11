/**
 * MCP bulk/parallel capability audit — static inventory for tooling and documentation.
 * Regenerate by scanning src/lib/mcp/tools when adding new connector tools.
 */

export type McpToolExecutionMode =
  | 'single_record'
  | 'bulk_capable'
  | 'parallel_safe'
  | 'ordered_sequence'
  | 'long_running_job';

export interface McpToolCapabilityRow {
  tool: string;
  module: string;
  currentMode: McpToolExecutionMode;
  bulkPossible: boolean;
  parallelSafe: boolean;
  requiredChange: string;
}

export const MCP_BULK_CAPABILITY_AUDIT: McpToolCapabilityRow[] = [
  { tool: 'create_lead', module: 'crm-ops', currentMode: 'single_record', bulkPossible: true, parallelSafe: false, requiredChange: 'Use create_leads for batches' },
  { tool: 'create_leads', module: 'crm-ops', currentMode: 'bulk_capable', bulkPossible: true, parallelSafe: false, requiredChange: 'Implemented — 1–500 per request' },
  { tool: 'bulk_update_records', module: 'bulk-operations', currentMode: 'bulk_capable', bulkPossible: true, parallelSafe: false, requiredChange: 'OK — up to 250 records' },
  { tool: 'send_bulk_email', module: 'bulk-operations', currentMode: 'bulk_capable', bulkPossible: true, parallelSafe: false, requiredChange: 'Preflight + suppression wired; sequential send — queue job for 100+' },
  { tool: 'bulk_upload_media', module: 'bulk-operations', currentMode: 'bulk_capable', bulkPossible: true, parallelSafe: true, requiredChange: 'OK — bounded 50 files' },
  { tool: 'send_batch_outreach', module: 'mcp-event-queue', currentMode: 'long_running_job', bulkPossible: true, parallelSafe: false, requiredChange: 'Job-based via mcp_event_queue + cron worker' },
  { tool: 'list_leads', module: 'crm-ops', currentMode: 'single_record', bulkPossible: false, parallelSafe: true, requiredChange: 'Read-only — pagination sufficient' },
  { tool: 'update_lead', module: 'crm-ops', currentMode: 'single_record', bulkPossible: true, parallelSafe: false, requiredChange: 'Add update_leads batch or use bulk_update_records' },
  { tool: 'create_invoice', module: 'invoicing', currentMode: 'single_record', bulkPossible: true, parallelSafe: false, requiredChange: 'Add create_invoices batch tool' },
  { tool: 'create_contact', module: 'crm', currentMode: 'single_record', bulkPossible: true, parallelSafe: false, requiredChange: 'Add create_contacts batch' },
  { tool: 'qualify_lead', module: 'gap-tools-crm', currentMode: 'single_record', bulkPossible: true, parallelSafe: true, requiredChange: 'Add qualify_leads with bounded concurrency' },
  { tool: 'enrich_lead', module: 'gap-tools-crm', currentMode: 'single_record', bulkPossible: true, parallelSafe: true, requiredChange: 'Parallel-safe with MCP_AI_CONCURRENCY cap' },
  { tool: 'publish_social_post', module: 'social-publishing', currentMode: 'single_record', bulkPossible: true, parallelSafe: false, requiredChange: 'Strict MCP_SOCIAL_CONCURRENCY=3' },
  { tool: 'start_campaign', module: 'campaigns', currentMode: 'long_running_job', bulkPossible: true, parallelSafe: false, requiredChange: 'Must queue recipients — not sequential send_email' },
  { tool: 'job.status', module: 'platform-ops', currentMode: 'single_record', bulkPossible: false, parallelSafe: true, requiredChange: 'Expose for all durable jobs' },
];

export const MCP_CONCURRENCY_DEFAULTS = {
  MCP_DB_CONCURRENCY: 20,
  MCP_EMAIL_CONCURRENCY: 10,
  MCP_SOCIAL_CONCURRENCY: 3,
  MCP_AI_CONCURRENCY: 5,
  MCP_GLOBAL_WORKERS: 50,
  MCP_TENANT_MAX_WORKERS: 10,
} as const;

export const MCP_BULK_LIMITS = {
  create_leads: 500,
  bulk_update_records: 250,
  send_bulk_email: 100,
  bulk_upload_media: 50,
  export_records: 10_000,
} as const;

export function summarizeMcpBulkGaps(): string[] {
  return MCP_BULK_CAPABILITY_AUDIT
    .filter((row) => row.bulkPossible && row.currentMode === 'single_record')
    .map((row) => `${row.module}.${row.tool}: ${row.requiredChange}`);
}

export function countMcpToolModes(): Record<McpToolExecutionMode, number> {
  const counts: Record<McpToolExecutionMode, number> = {
    single_record: 0,
    bulk_capable: 0,
    parallel_safe: 0,
    ordered_sequence: 0,
    long_running_job: 0,
  };
  for (const row of MCP_BULK_CAPABILITY_AUDIT) {
    counts[row.currentMode] += 1;
  }
  return counts;
}

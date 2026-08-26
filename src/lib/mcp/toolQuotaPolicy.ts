import type { QuotaResourceType } from '@/lib/entitlements/planEntitlements';

const EMAIL_READ_TOOLS = new Set([
  'get_zoho_mail_messages',
  'get_zoho_mail_thread',
  'read_emails',
  'read_email_content',
  'search_emails',
  'list_email_accounts',
  'get_action_status',
  'gmail_list_threads',
  'gmail_get_thread',
  'microsoft_get_emails',
  'microsoft_get_email',
  'microsoft_list_folders',
  'sync_all_inboxes',
]);

const EMAIL_SEND_TOOLS = new Set([
  'send_email',
  'reply_to_email',
  'reply_to_zoho_mail',
  'gmail_send_email',
  'microsoft_send_email',
  'create_email_draft',
]);

const HEALTH_TOOLS = new Set([
  'zoho_health',
  'gmail_health',
  'integrations_status',
  'get_platform_status',
  'get_system_health',
]);

export function normalizeToolNameForQuota(toolName: string): string {
  return String(toolName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_');
}

export function isEmailReadTool(toolName: string): boolean {
  const normalized = normalizeToolNameForQuota(toolName);
  if (EMAIL_READ_TOOLS.has(normalized)) return true;
  return (
    normalized.includes('read_email') ||
    normalized.includes('search_email') ||
    normalized.includes('mail_messages') ||
    normalized.includes('mail_thread') ||
    normalized.includes('list_email')
  );
}

export function isEmailSendTool(toolName: string): boolean {
  return EMAIL_SEND_TOOLS.has(normalizeToolNameForQuota(toolName));
}

export function isHealthCheckTool(toolName: string): boolean {
  const normalized = normalizeToolNameForQuota(toolName);
  return HEALTH_TOOLS.has(normalized) || normalized.endsWith('_health');
}

export function isReadOnlyMcpTool(toolName: string): boolean {
  const normalized = normalizeToolNameForQuota(toolName);
  if (EMAIL_READ_TOOLS.has(normalized)) return true;
  if (isHealthCheckTool(normalized)) return true;
  if (
    /^(get|list|search|fetch|inspect|audit|analyze|validate|verify|status|health|report|dashboard|connected|scheduled|drafts|campaigns|events|tasks|appointments|invoices|quotes|payments|subscriptions|view)_/.test(
      normalized,
    )
  ) {
    return true;
  }
  if (normalized.includes('_status') || normalized.endsWith('_health') || normalized.startsWith('check_')) {
    return true;
  }
  return false;
}

export function shouldPreChargeMcpExecution(toolName: string): boolean {
  if (isReadOnlyMcpTool(toolName)) return false;
  return true;
}

export function determinePreExecutionQuotaMetric(toolName: string): QuotaResourceType | null {
  const normalized = normalizeToolNameForQuota(toolName);
  if (isReadOnlyMcpTool(normalized) || isEmailSendTool(normalized)) return null;
  if (/^create_leads?$|^import_leads|^bulk.*lead/.test(normalized)) return 'leads';
  if (normalized.includes('lead')) return 'leads';
  if (/^publish_|^post_/.test(normalized) || normalized.includes('linkedin')) return 'linkedin_posts';
  if (normalized.includes('facebook')) return 'facebook_posts';
  if (normalized.includes('instagram')) return 'instagram_posts';
  if (normalized.includes('contract') || normalized.includes('proposal')) return 'contracts';
  if (normalized.includes('invoice') || normalized.includes('quote')) return 'invoices';
  if (normalized.includes('receipt')) return 'receipts';
  if (/^create_contact|^update_contact|^update_lead|^create_client|^update_client|^create_deal|^update_deal/.test(normalized)) {
    return 'mcp_executions';
  }
  if (normalized.includes('outreach') || normalized.startsWith('contact_')) return 'outreach_actions';
  if (/^run_|^execute_|^trigger_|workflow|automation|orchestrat/.test(normalized)) return 'mcp_executions';
  if (/^create_|^update_|^delete_|^send_|^publish_|^schedule_|^import_|^generate_/.test(normalized)) {
    return 'mcp_executions';
  }
  return null;
}

export function shouldChargeEmailOnSuccessOnly(toolName: string): boolean {
  return isEmailSendTool(toolName);
}

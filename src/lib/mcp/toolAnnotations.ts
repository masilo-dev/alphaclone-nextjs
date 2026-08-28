import fs from 'node:fs';
import path from 'node:path';

export type McpToolAnnotations = {
  readOnlyHint: boolean;
  openWorldHint: boolean;
  destructiveHint: boolean;
};

type SubmissionDoc = {
  tools?: Record<string, { annotations?: Partial<McpToolAnnotations> }>;
};

let submissionAnnotations: Map<string, McpToolAnnotations> | null = null;

function loadSubmissionAnnotations(): Map<string, McpToolAnnotations> {
  if (submissionAnnotations) return submissionAnnotations;
  const map = new Map<string, McpToolAnnotations>();
  try {
    const filePath = path.join(process.cwd(), 'chatgpt-app-submission.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const doc = JSON.parse(raw) as SubmissionDoc;
    for (const [name, entry] of Object.entries(doc.tools || {})) {
      const a = entry?.annotations;
      if (!a) continue;
      map.set(name, {
        readOnlyHint: Boolean(a.readOnlyHint),
        openWorldHint: Boolean(a.openWorldHint),
        destructiveHint: Boolean(a.destructiveHint),
      });
    }
  } catch (err) {
    console.warn('[mcp] Failed to load chatgpt-app-submission.json annotations:', err);
  }
  submissionAnnotations = map;
  return map;
}

/** Heuristic defaults when a tool is not in the ChatGPT submission file. */
export function inferToolAnnotations(toolName: string): McpToolAnnotations {
  const name = toolName.toLowerCase();

  const destructive =
    /^(delete|remove|destroy|purge|drop|revoke|cancel|void)_/.test(name) ||
    /(^|_)(delete|remove|destroy|purge|drop|revoke)(_|$)/.test(name);

  const openWorld =
    /(publish|send|email|sms|whatsapp|tweet|post_to|social|stripe|zoho|gmail|webhook|notify)/.test(
      name
    );

  const readOnly =
    !destructive &&
    !openWorld &&
    (/^(get|list|search|fetch|find|inspect|analyze|audit|status|health|report|dashboard|pipeline|opportunities|analytics|drafts|campaigns|funnels|conversions|events|tasks|reminders|appointments|quotes|invoices|payments|subscriptions|connected|scheduled|integrations)_/.test(
      name
    ) ||
      /(^|_)(status|health|snapshot|metrics|report|inspect|audit)(_|$)/.test(name));

  return {
    readOnlyHint: readOnly,
    openWorldHint: openWorld,
    destructiveHint: destructive,
  };
}

export function resolveToolAnnotations(toolName: string): McpToolAnnotations {
  const fromSubmission = loadSubmissionAnnotations().get(toolName);
  if (fromSubmission) return fromSubmission;
  return inferToolAnnotations(toolName);
}

/** Size-limited connector tool surface (ChatGPT Apps, Claude.ai, etc.). */
export const CHATGPT_CONNECTOR_TOOL_NAMES = [
  // Stable discovery and dispatch gateway. These keep the full platform
  // reachable even when the Apps client snapshots a bounded tool catalogue.
  'list_tools',
  'list_modules',
  'list_capabilities',
  'search_tools',
  'load_module_tools',
  'dispatch_tool',
  'execute_action',
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
  'list_scheduled_social_posts',
  'scheduled_posts',
  'drafts',
  'analytics',
  'publish_post',
  'delete_post',
  'engagement_report',
  // Canonical social publishing (must be callable from ChatGPT, not only inspect_tools)
  'get_social_accounts',
  'get_social_identities',
  'get_facebook_identities',
  'get_facebook_page_capabilities',
  'get_linkedin_identities',
  'upload_media',
  'upload_social_media',
  'get_media',
  'delete_media',
  'create_social_post',
  'create_social_post_with_media',
  'publish_social_post',
  'verify_social_post_published',
  'get_social_post',
  'get_social_posts',
  'retry_social_post',
  'delete_social_post',
  'get_social_post_insights',
  'publish_facebook_multi_photo',
  // Individual email + media library (ChatGPT must discover these)
  'send_email',
  'send_transactional_email',
  'create_email_draft',
  'reply_to_email',
  'list_email_accounts',
  'get_action_status',
  'get_media_asset',
  'list_media_assets',
  'delete_media_asset',
  'publish_facebook_photo',
  'publish_facebook_album',
  'publish_facebook_video',
  'publish_linkedin_image',
  'publish_linkedin_document',
  'publish_instagram_photo',
  'publish_instagram_reel',
  'publish_instagram_carousel',
  'publish_x_image',
  'publish_x_video',
  'get_delivery_status',
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
  // ChatGPT Deep Research / company-knowledge style aliases
  'search',
  'fetch',
  // Autonomous write surface (CRM / email / social / finance / workflow)
  'search_contacts',
  'update_contact',
  'update_company',
  'add_note',
  'change_pipeline_stage',
  'create_follow_up',
  'send_transactional_email',
  'get_delivery_status',
  'upload_media',
  'create_post',
  'publish_now',
  'schedule_post',
  'get_post_status',
  'get_post_analytics',
  'mark_invoice_paid',
  'validate_document',
  'approve_workflow_step',
  'reject_workflow_step',
  'resume_workflow',
  'get_workflow_run',
  'negotiate_capabilities',
] as const;

/**
 * @deprecated Prefer getToolCatalogModeForClient(clientId).
 * Kept for tests that historically sniffed client labels.
 * Only exact registered curated client ids return true — no UA heuristics.
 */
export function isChatgptClient(input?: {
  clientId?: string | null;
  clientLabel?: string | null;
  userAgent?: string | null;
}): boolean {
  const id = (input?.clientId || '').trim().toLowerCase();
  return id === 'chatgpt-connector';
}

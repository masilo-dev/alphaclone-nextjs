import type { UnifiedMcpTool } from '@/lib/mcp/listAllTools';

/**
 * Tools surfaced first for ChatGPT when the Apps client only ingests the opening
 * slice of tools/list. Discovery gateways first, then email, social/LinkedIn, CRM, finance.
 */
export const CHATGPT_PRIORITY_TOOL_ORDER = [
  // Discovery & dispatch (reach full 524-tool catalog)
  'list_tools',
  'list_modules',
  'list_capabilities',
  'search_tools',
  'load_module_tools',
  'dispatch_tool',
  'execute_action',
  'execute_internal_tool',
  'search',
  'fetch',
  // Email & outreach
  'send_email',
  'reply_to_email',
  'create_email_draft',
  'read_emails',
  'search_emails',
  'list_email_accounts',
  'send_outreach_email',
  'generate_outreach_draft',
  'send_transactional_email',
  // Social — Facebook, LinkedIn, scheduling & publish
  'connected_accounts',
  'get_social_identities',
  'get_facebook_identities',
  'get_linkedin_identities',
  'upload_social_media',
  'upload_media',
  'upload_media_asset',
  'get_media',
  'get_media_asset',
  'list_media_assets',
  'delete_media',
  'create_social_post',
  'create_social_post_with_media',
  'create_social_post_with_ai_image',
  'schedule_social_post',
  'schedule_post',
  'publish_social_post',
  'publish_post',
  'publish_now',
  'create_post',
  'publish_linkedin_image',
  'publish_linkedin_document',
  'publish_facebook_photo',
  'publish_facebook_video',
  'publish_facebook_multi_photo',
  'publish_facebook_album',
  'publish_instagram_photo',
  'publish_instagram_reel',
  'publish_instagram_carousel',
  'publish_x_image',
  'publish_x_video',
  'get_post_status',
  'get_post_analytics',
  'verify_social_post',
  'verify_social_post_published',
  'get_social_posts',
  'get_social_post',
  'analytics',
  'engagement_report',
  'upload_document',
  // Leads & CRM — search, add, update, qualify, pipeline
  'list_leads',
  'search_leads',
  'get_leads',
  'create_lead',
  'create_leads',
  'update_lead',
  'delete_lead',
  'add_note',
  'qualify_crm_leads',
  'find_and_qualify_leads',
  'parse_lead_criteria',
  'get_scraper_leads',
  'search_facebook_leads',
  'change_pipeline_stage',
  'create_follow_up',
  'list_contacts',
  'search_contacts',
  'create_contact',
  'update_contact',
  'create_company',
  'update_company',
  'create_deal',
  'score_deal',
  'pipeline_status',
  'opportunities',
  // Tasks, calendar, documents
  'create_task',
  'list_tasks',
  'update_task',
  'create_business_event',
  'events',
  'appointments',
  'search_documents',
  'create_document',
  'retrieve_document',
  // Finance & workflows
  'create_invoice',
  'get_invoices',
  'invoices',
  'run_workflow',
  'list_workflows',
  'get_platform_status',
  'integrations_status',
] as const;

const PRIORITY_RANK = new Map<string, number>(
  CHATGPT_PRIORITY_TOOL_ORDER.map((name, index) => [name, index]),
);

export function isChatGptConnectorClient(clientId?: string | null): boolean {
  return (clientId || '').trim() === 'chatgpt-connector';
}

/** Put high-value business tools first; preserve stable alphabetical order within ties. */
export function prioritizeToolsForChatGpt(tools: UnifiedMcpTool[]): UnifiedMcpTool[] {
  return [...tools].sort((a, b) => {
    const rankA = PRIORITY_RANK.get(a.name) ?? 10_000;
    const rankB = PRIORITY_RANK.get(b.name) ?? 10_000;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Tools Bonnie may invoke directly via POST /api/bonnie/tool.
 * High-risk send/financial tools must go through the agent approval flow instead.
 */
export const BONNIE_DIRECT_INVOKE_TOOLS = new Set([
  'get_contacts',
  'get_deals',
  'get_leads',
  'get_clients',
  'get_projects',
  'get_tasks',
  'get_invoices',
  'campaign_brief',
  'campaign_diagnose',
  'get_business_ai_state',
  'evaluate_business_ai_readiness',
  'solo_owner_operator_brief',
  'recommend_next_steps',
  'get_workspace_widgets',
  'owner_autopilot_queue',
  'revenue_recovery_agent',
  'client_pulse',
  'deal_to_cash_flow',
  'ai_business_readiness_score',
  'business_memory_graph',
  'trust_ledger',
  'solo_owner_time_savings_meter',
  'microsoft_get_emails',
  'microsoft_get_calendar',
  'search_email_lead_context',
  'get_customer_360',
  'get_social_accounts',
  'get_scheduled_posts',
]);

export const BONNIE_BLOCKED_DIRECT_TOOLS = new Set([
  'send_transactional_email',
  'send_invoice',
  'send_whatsapp_message',
  'queue_email_campaign_send',
  'send_bulk_email_campaign',
  'microsoft_send_email',
  'create_bulk_email_campaign',
  'publish_facebook_reel',
  'publish_facebook_multi_photo',
  'store_facebook_token',
]);

export function assertBonnieDirectToolAllowed(tool: string): void {
  if (BONNIE_BLOCKED_DIRECT_TOOLS.has(tool)) {
    throw new Error(`Tool "${tool}" requires Bonnie agent approval. Use instruct/stream instead.`);
  }
  if (!BONNIE_DIRECT_INVOKE_TOOLS.has(tool)) {
    throw new Error(`Tool "${tool}" is not allowed for direct invocation. Use Bonnie chat instead.`);
  }
}

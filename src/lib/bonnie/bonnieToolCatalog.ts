/**
 * Bonnie agent tool catalog — registry tools + MCP-server tools across all dashboard modules.
 */

/** Tools registered in lib/mcp/tool-registry (initializeRegistry) */
export const BONNIE_REGISTRY_TOOLS = [
  // CRM & clients
  'get_contacts', 'create_contact', 'update_contact', 'log_contact_activity',
  'get_deals', 'create_deal', 'update_deal', 'move_deal_stage', 'get_pipeline_summary',
  // Finance
  'get_invoices', 'create_invoice', 'update_invoice_status', 'update_invoice', 'send_invoice',
  'convert_quote_to_invoice', 'get_accounts_receivable_aging', 'get_accounts_payable_aging',
  'accounting_snapshot', 'get_revenue_summary', 'get_finance_snapshot',
  // Projects & tasks
  'get_projects', 'create_project', 'get_project_tasks', 'create_project_task', 'update_project_task',
  // Campaigns & outreach
  'campaign_brief', 'campaign_diagnose',
  'create_email_sequence', 'enroll_contact_in_sequence', 'create_bulk_email_batch', 'get_batch_job_status',
  // Social
  'get_social_accounts', 'get_linkedin_identities', 'schedule_social_post', 'get_scheduled_posts',
  'upload_media_asset', 'create_social_post_with_media',
  'publish_facebook_reel', 'publish_facebook_multi_photo',
  // WhatsApp (registry subset — full send via MCP)
  // Contracts
  'get_contracts', 'create_contract', 'send_contract', 'update_contract_status',
  // Meetings
  'get_meetings', 'create_meeting', 'cancel_meeting',
  // Microsoft 365
  'microsoft_get_emails', 'microsoft_send_email', 'microsoft_create_meeting', 'microsoft_get_calendar',
  'microsoft_create_event', 'microsoft_create_task',
  // Ops & automation
  'get_business_ai_state', 'evaluate_business_ai_readiness',
  'solo_owner_operator_brief', 'recommend_next_steps', 'predict_deal_win_probability',
  'get_workspace_widgets', 'get_dashboard_stats',
  // Messaging
  'get_tenant_messages', 'send_tenant_message', 'create_in_app_notification',
  // Bonnie meta
  'orchestrate_task', 'define_outcome', 'trigger_bonnie_dream',
  'list_skills', 'load_skill', 'activate_skill_for_session',
  'list_pending_approvals', 'approve_pending_action', 'reject_pending_action',
  // Platform advantage
  'owner_autopilot_queue', 'revenue_recovery_agent', 'client_pulse',
  'deal_to_cash_flow', 'ai_business_readiness_score', 'business_memory_graph',
  'trust_ledger', 'solo_owner_time_savings_meter',
] as const;

/** Tools implemented in MCPServer (not in lightweight registry) */
export const BONNIE_MCP_SERVER_TOOLS = [
  // CRM
  'get_leads', 'create_lead', 'update_lead', 'update_lead_status',
  'get_clients', 'create_client', 'search_clients',
  // Tasks
  'get_tasks', 'create_task', 'update_task',
  // Email campaigns — create + publish
  'create_bulk_email_campaign', 'queue_email_campaign_send', 'send_bulk_email_campaign',
  'send_batch_outreach',
  // Social publish
  'create_social_post', 'create_post', 'create_linkedin_post', 'create_post_with_ai_image',
  'publish_social_post', 'publish_post',
  'upload_media_asset',
  // WhatsApp
  'send_whatsapp_message', 'get_whatsapp_status', 'enable_whatsapp_chatbot', 'disable_whatsapp_chatbot',
  'set_lead_auto_outreach', 'set_outreach_rate_limits',
  // Business intel
  'get_business_snapshot', 'get_strategic_plan',
  'run_chief_of_staff_routine', 'get_recent_messages',
  'run_playbook', 'get_automation_health',
  'start_lead_campaign', 'start_lead_nurture',
  'nexus_lead_enrichment', 'nexus_sales_campaign',
  'capture_linkedin_comment_leads', 'auto_create_lead_from_message',
  // Tickets
  'create_ticket', 'get_tickets', 'escalate_ticket',
  // Invoicing actions
  'send_invoice', 'nexus_invoice_chasing', 'reconcile_payment', 'send_receipt', 'start_invoice_lifecycle',
  // Quotes and contracts
  'get_quotes', 'create_quote', 'send_quote', 'start_contract_lifecycle',
  // Platform health
  'get_api_health',
  // Deals scoring
  'score_deal',
] as const;

export const BONNIE_CUSTOM_TOOLS = [
  'get_daily_operations_summary',
  'get_tenant_activity_timeline',
  'get_unreplied_emails_and_sla_risks',
  'delegate_to_hermes',
  'run_autonomous_scan',
  'summarize_workspace',
  'get_account_overview',
  'search_facebook_leads',
  'find_and_qualify_leads',
  'parse_lead_criteria',
  'qualify_crm_leads',
  'get_scraper_leads',
  'get_customer_360',
  'get_integration_health',
  'get_proactive_brief',
  'list_scraper_campaigns',
  'run_scraper_campaign',
  'create_scraper_campaign',
  'search_email_lead_context',
  'ingest_content_to_lead',
  'get_autonomous_rules',
  'draft_reply',
  'summarize_ticket',
  'generate_outreach_draft',
  'list_pending_approvals',
  'approve_pending_action',
  'reject_pending_action',
] as const;

export type BonnieModuleId =
  | 'crm'
  | 'leads'
  | 'deals'
  | 'campaigns'
  | 'whatsapp'
  | 'social'
  | 'mail'
  | 'accounting'
  | 'contracts'
  | 'tasks'
  | 'meetings'
  | 'tickets'
  | 'quotes'
  | 'projects'
  | 'inbox'
  | 'analytics'
  | 'automation'
  | 'general';

export const BONNIE_MODULE_HINTS: Record<
  BonnieModuleId,
  { label: string; tools: string[]; examples: string[] }
> = {
  crm: {
    label: 'CRM',
    tools: ['get_contacts', 'create_contact', 'get_clients', 'log_contact_activity', 'client_pulse', 'owner_autopilot_queue', 'revenue_recovery_agent', 'get_tenant_activity_timeline'],
    examples: ['Show my top contacts', 'Which clients need attention?', 'Recover overdue invoice cash'],
  },
  leads: {
    label: 'Lead Finder',
    tools: [
      'get_leads',
      'create_lead',
      'update_lead_status',
      'find_and_qualify_leads',
      'parse_lead_criteria',
      'qualify_crm_leads',
      'get_scraper_leads',
      'list_scraper_campaigns',
      'create_scraper_campaign',
      'run_scraper_campaign',
      'search_facebook_leads',
      'start_lead_campaign',
      'nexus_lead_enrichment',
      'recommend_next_steps',
      'generate_outreach_draft',
      'send_batch_outreach',
    ],
    examples: [
      'Find plumbers in Austin and qualify them now',
      'Create a scraper campaign for dental clinics in Dallas and run it',
      'Show scraper leads and send outreach to the top 5',
      'Enrich Acme Corp and push next steps into CRM',
    ],
  },
  deals: {
    label: 'Deals',
    tools: ['get_deals', 'move_deal_stage', 'score_deal', 'get_pipeline_summary'],
    examples: ['Show stale deals', 'Move TechCorp deal to proposal'],
  },
  campaigns: {
    label: 'Email campaigns',
    tools: ['campaign_brief', 'campaign_diagnose', 'create_bulk_email_campaign', 'queue_email_campaign_send', 'run_playbook'],
    examples: ['Diagnose my draft campaign', 'Publish campaign {id} now'],
  },
  whatsapp: {
    label: 'WhatsApp',
    tools: ['send_whatsapp_message', 'get_whatsapp_status', 'enable_whatsapp_chatbot', 'search_facebook_leads'],
    examples: ['Check WhatsApp connection', 'Search Facebook leads for John'],
  },
  social: {
    label: 'Social media',
    tools: [
      'upload_media_asset',
      'create_social_post_with_media',
      'create_social_post',
      'create_linkedin_post',
      'publish_social_post',
      'publish_post',
      'schedule_social_post',
      'publish_facebook_reel',
      'publish_facebook_multi_photo',
      'search_facebook_leads',
    ],
    examples: [
      'Publish this caption to Facebook now',
      'Upload media and publish a LinkedIn post about our new service',
      'Schedule tomorrow’s Instagram post and confirm it is live in the calendar',
    ],
  },
  mail: {
    label: 'Mail',
    tools: ['microsoft_get_emails', 'microsoft_send_email', 'send_bulk_email_campaign', 'get_unreplied_emails_and_sla_risks'],
    examples: ['Summarize unread mail', 'Send follow-up email to client', 'Check SLA risks'],
  },
  accounting: {
    label: 'Accounting',
    tools: [
      'get_revenue_summary',
      'accounting_snapshot',
      'get_finance_snapshot',
      'get_accounts_receivable_aging',
      'get_accounts_payable_aging',
      'get_invoices',
      'create_invoice',
      'update_invoice',
      'update_invoice_status',
      'send_invoice',
      'convert_quote_to_invoice',
      'reconcile_payment',
      'send_receipt',
      'start_invoice_lifecycle',
      'nexus_invoice_chasing',
      'revenue_recovery_agent',
      'deal_to_cash_flow',
    ],
    examples: [
      'Chase all overdue invoices now',
      'Show AR aging then send payment reminders',
      'Convert quote to invoice and send it',
    ],
  },
  contracts: {
    label: 'Contracts',
    tools: ['get_contracts', 'create_contract', 'send_contract'],
    examples: ['List pending contracts', 'Send contract for signature'],
  },
  tasks: {
    label: 'Tasks',
    tools: ['get_tasks', 'create_task', 'create_project_task'],
    examples: ['Show my open tasks', 'Create task: follow up invoice'],
  },
  meetings: {
    label: 'Meetings',
    tools: ['get_meetings', 'create_meeting', 'microsoft_create_meeting'],
    examples: ['Schedule a Teams meeting tomorrow 2pm'],
  },
  tickets: {
    label: 'Support tickets',
    tools: ['create_ticket', 'get_tickets', 'escalate_ticket', 'summarize_ticket', 'draft_reply'],
    examples: ['Open a ticket for billing issue', 'Summarize ticket thread'],
  },
  quotes: {
    label: 'Quotes',
    tools: ['get_quotes', 'create_quote', 'send_quote', 'get_deals'],
    examples: ['List draft quotes', 'Send quote to client'],
  },
  projects: {
    label: 'Projects',
    tools: ['get_projects', 'create_project', 'get_project_tasks', 'create_project_task'],
    examples: ['Show active projects', 'Add task to website redesign project'],
  },
  inbox: {
    label: 'Unified inbox',
    tools: ['microsoft_get_emails', 'search_email_lead_context', 'draft_reply', 'get_recent_messages', 'get_unreplied_emails_and_sla_risks'],
    examples: ['Who is this email from?', 'Draft reply to latest client email', 'Check unreplied emails'],
  },
  analytics: {
    label: 'Analytics',
    tools: ['get_dashboard_stats', 'get_revenue_summary', 'get_api_health', 'get_business_snapshot', 'get_daily_operations_summary'],
    examples: ['How is the business performing?', 'Revenue this month vs last', 'What happened in my business today?'],
  },
  automation: {
    label: 'Automation',
    tools: ['delegate_to_hermes', 'run_playbook', 'get_automation_health', 'orchestrate_task', 'get_autonomous_rules', 'run_autonomous_scan'],
    examples: ['Run invoice recovery playbook', 'What automations are unhealthy?', 'Start a background agent task for this workflow'],
  },
  general: {
    label: 'Workspace',
    tools: [
      'get_daily_operations_summary',
      'get_tenant_activity_timeline',
      'get_unreplied_emails_and_sla_risks',
      'get_account_overview',
      'delegate_to_hermes',
      'get_integration_health',
      'get_proactive_brief',
      'get_customer_360',
      'run_autonomous_scan',
      'run_chief_of_staff_routine',
      'get_business_snapshot',
      'orchestrate_task',
      'get_automation_health',
      'summarize_workspace',
      'start_lead_campaign',
      'start_invoice_lifecycle',
      'start_contract_lifecycle',
    ],
    examples: [
      'What happened in my business today?',
      'Give me full account overview',
      'Run full workspace scan',
      'Give me chief of staff briefing',
    ],
  },
};

export function resolveBonnieModuleFromPath(pathname: string): BonnieModuleId {
  const p = (pathname || '').toLowerCase();
  if (p.includes('/whatsapp')) return 'whatsapp';
  if (p.includes('/campaign')) return 'campaigns';
  if (p.includes('/social') || p.includes('/linkedin') || p.includes('/facebook') || p.includes('/instagram')) return 'social';
  if (p.includes('/mail') || p.includes('/zoho/mail')) return 'mail';
  if (p.includes('/accounting') || p.includes('/finance') || p.includes('/billing')) return 'accounting';
  if (p.includes('/contract')) return 'contracts';
  if (p.includes('/task')) return 'tasks';
  if (p.includes('/meeting') || p.includes('/teams') || p.includes('/calendar')) return 'meetings';
  if (p.includes('/ticket') || p.includes('/deep-desk')) return 'tickets';
  if (p.includes('/lead') || p.includes('/sales-agent')) return 'leads';
  if (p.includes('/deal')) return 'deals';
  if (p.includes('/quote')) return 'quotes';
  if (p.includes('/project')) return 'projects';
  if (p.includes('/analytics') || p.includes('/performance')) return 'analytics';
  if (p.includes('/inbox') || p.includes('/messages')) return 'inbox';
  if (p.includes('/automation') || p.includes('/engine') || p.includes('/playbook')) return 'automation';
  if (p.includes('/bonnie')) return 'general';
  if (p.includes('/scraper')) return 'leads';
  if (p.includes('/crm') || p.includes('/client') || p.includes('/contact')) return 'crm';
  return 'general';
}

export function getAllBonnieToolNames(): string[] {
  return [
    ...BONNIE_REGISTRY_TOOLS,
    ...BONNIE_MCP_SERVER_TOOLS,
    ...BONNIE_CUSTOM_TOOLS,
  ];
}

/**
 * Bonnie agent tool catalog — registry tools + MCP-server tools across all dashboard modules.
 */

/** Tools registered in lib/mcp/tool-registry (initializeRegistry) */
export const BONNIE_REGISTRY_TOOLS = [
  // CRM & clients
  'get_contacts', 'create_contact', 'update_contact', 'log_contact_activity',
  'get_deals', 'create_deal', 'update_deal', 'move_deal_stage', 'get_pipeline_summary',
  // Finance
  'get_invoices', 'create_invoice', 'update_invoice_status', 'accounting_snapshot', 'get_revenue_summary', 'get_finance_snapshot',
  // Projects & tasks
  'get_projects', 'create_project', 'get_project_tasks', 'create_project_task', 'update_project_task',
  // Campaigns & outreach
  'campaign_brief', 'campaign_diagnose',
  'create_email_sequence', 'enroll_contact_in_sequence', 'create_bulk_email_batch', 'get_batch_job_status',
  // Social
  'get_social_accounts', 'get_linkedin_identities', 'schedule_social_post', 'get_scheduled_posts',
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
  // Social publish
  'create_social_post', 'create_post', 'create_linkedin_post', 'create_post_with_ai_image',
  // WhatsApp
  'send_whatsapp_message', 'get_whatsapp_status', 'enable_whatsapp_chatbot', 'disable_whatsapp_chatbot',
  'set_lead_auto_outreach', 'set_outreach_rate_limits',
  // Business intel
  'get_business_snapshot', 'get_strategic_plan',
  'run_chief_of_staff_routine', 'get_recent_messages',
  'run_playbook', 'get_automation_health',
  // Tickets
  'create_ticket', 'get_tickets',
  // Invoicing actions
  'send_invoice', 'nexus_invoice_chasing',
  // Deals scoring
  'score_deal',
] as const;

export const BONNIE_CUSTOM_TOOLS = [
  'run_autonomous_scan',
  'summarize_workspace',
  'search_facebook_leads',
  'draft_reply',
  'summarize_ticket',
  'generate_outreach_draft',
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
  | 'general';

export const BONNIE_MODULE_HINTS: Record<
  BonnieModuleId,
  { label: string; tools: string[]; examples: string[] }
> = {
  crm: {
    label: 'CRM',
    tools: ['get_contacts', 'create_contact', 'get_clients', 'log_contact_activity'],
    examples: ['Show my top contacts', 'Log a call with Acme Corp'],
  },
  leads: {
    label: 'Leads',
    tools: ['get_leads', 'create_lead', 'update_lead_status', 'recommend_next_steps'],
    examples: ['List hot leads', 'Create a lead for john@example.com'],
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
    tools: ['create_social_post', 'create_linkedin_post', 'schedule_social_post', 'publish_facebook_reel', 'search_facebook_leads'],
    examples: ['Post to LinkedIn about our new service', 'Search Facebook leads inside the platform'],
  },
  mail: {
    label: 'Mail',
    tools: ['microsoft_get_emails', 'microsoft_send_email', 'send_bulk_email_campaign'],
    examples: ['Summarize unread mail', 'Send follow-up email to client'],
  },
  accounting: {
    label: 'Accounting',
    tools: ['get_revenue_summary', 'accounting_snapshot', 'get_invoices', 'send_invoice'],
    examples: ['What is my revenue this month?', 'Show overdue invoices'],
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
    tools: ['create_ticket', 'get_tickets'],
    examples: ['Open a ticket for billing issue'],
  },
  general: {
    label: 'Workspace',
    tools: ['run_autonomous_scan', 'run_chief_of_staff_routine', 'get_business_snapshot', 'orchestrate_task', 'get_automation_health'],
    examples: ['Run full workspace scan', 'Give me chief of staff briefing'],
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
  if (p.includes('/crm') || p.includes('/client')) return 'crm';
  return 'general';
}

export function getAllBonnieToolNames(): string[] {
  return [
    ...BONNIE_REGISTRY_TOOLS,
    ...BONNIE_MCP_SERVER_TOOLS,
    ...BONNIE_CUSTOM_TOOLS,
  ];
}

/**
 * Shared tenant-data rules injected into every Bonnie prompt.
 * Users own their workspace data — Bonnie reads it without asking permission.
 */
export function buildBonnieTenantDataRulesBlock(tenantId: string): string {
  return `
TENANT DATA (NON-NEGOTIABLE)
- Workspace tenant_id: ${tenantId}
- ALL CRM, leads, deals, tasks, invoices, campaigns, tickets, contracts, mail, and social data belongs to THIS tenant only.
- You already have authorized access to this tenant's data. Never ask "yes/no", "should I look that up?", or "do you want me to check?" — just run the read tool and answer.
- Never mix, reference, or infer data from other tenants or workspaces.
- Do NOT pass tenant_id or user_id in tool arguments — the server binds workspace "${tenantId}" and the signed-in user automatically.
- For questions about "my", "our", or module data (how many, who, what, show, list, status, overview): call get_/list_/search_ tools, get_account_overview, or summarize_workspace / get_business_snapshot immediately.
- For lead discovery: use find_and_qualify_leads (multi-source search + scoring), parse_lead_criteria (save how you want leads qualified), qualify_crm_leads, get_scraper_leads, list_scraper_campaigns, create_scraper_campaign, run_scraper_campaign, search_facebook_leads, or start_lead_campaign for durable workflows.
- In-app Bonnie executes sends, posts, invoice chases, and outreach immediately — do not invent approval or DPA gates. Reading, lead search, and drafting never need permission.`;
}

export const BONNIE_MODULE_DATA_TOOLS: Record<string, string[]> = {
  crm: ['get_contacts', 'get_clients', 'search_clients'],
  leads: ['get_leads', 'get_scraper_leads', 'find_and_qualify_leads', 'qualify_crm_leads', 'list_scraper_campaigns', 'create_scraper_campaign', 'run_scraper_campaign'],
  deals: ['get_deals', 'get_pipeline_summary'],
  campaigns: ['campaign_diagnose', 'campaign_brief'],
  whatsapp: ['get_whatsapp_status', 'get_recent_messages'],
  social: ['get_social_accounts', 'get_scheduled_posts'],
  mail: ['microsoft_get_emails'],
  accounting: ['get_revenue_summary', 'accounting_snapshot', 'get_invoices'],
  contracts: ['get_contracts'],
  tasks: ['get_tasks', 'get_projects'],
  meetings: ['get_meetings', 'microsoft_get_calendar'],
  tickets: ['get_tickets', 'summarize_ticket'],
  quotes: ['get_invoices'],
  projects: ['get_projects', 'get_project_tasks'],
  inbox: ['microsoft_get_emails', 'search_email_lead_context'],
  analytics: ['get_dashboard_stats', 'get_business_snapshot'],
  automation: ['get_automation_health', 'get_autonomous_rules'],
  general: ['summarize_workspace', 'get_business_snapshot', 'solo_owner_operator_brief'],
};

export function suggestToolsForQuestion(text: string, moduleId: string): string[] {
  const t = text.toLowerCase();
  const moduleTools = BONNIE_MODULE_DATA_TOOLS[moduleId] || BONNIE_MODULE_DATA_TOOLS.general;
  const picks = new Set<string>(moduleTools.slice(0, 2));

  if (/\b(invoice|billing|ar|receivable|overdue|unpaid)\b/.test(t)) {
    picks.add('get_invoices');
    picks.add('accounting_snapshot');
  }
  if (/\b(revenue|income|profit|p&l|pnl|earnings|sales|collected|outstanding)\b/.test(t)) {
    picks.add('get_revenue_summary');
    picks.add('accounting_snapshot');
  }
  if (/\b(deal|pipeline|stage|opportunit)\b/.test(t)) {
    picks.add('get_deals');
    picks.add('get_pipeline_summary');
  }
  if (/\b(lead|prospect)\b/.test(t)) {
    picks.add('get_leads');
    picks.add('qualify_crm_leads');
  }
  if (/\b(find lead|search lead|discover|prospect|qualif|scraper|lead finder)\b/.test(t)) {
    picks.add('find_and_qualify_leads');
    picks.add('get_scraper_leads');
    picks.add('parse_lead_criteria');
    picks.add('create_scraper_campaign');
    picks.add('run_scraper_campaign');
  }
  if (/\b(contact|client|crm|customer)\b/.test(t)) {
    picks.add('get_contacts');
    picks.add('get_clients');
  }
  if (/\b(task|todo|backlog)\b/.test(t)) {
    picks.add('get_tasks');
  }
  if (/\b(ticket|support|desk)\b/.test(t)) {
    picks.add('get_tickets');
  }
  if (/\b(campaign|email blast|newsletter)\b/.test(t)) {
    picks.add('campaign_diagnose');
  }
  if (/\b(overview|summary|workspace|how many|what'?s|status|account|integration)\b/.test(t)) {
    picks.add('get_account_overview');
    picks.add('summarize_workspace');
    picks.add('get_business_snapshot');
  }

  return [...picks].slice(0, 4);
}

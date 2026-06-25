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
- Every tool call MUST use tenant_id "${tenantId}" (and the user's user_id when required).
- For questions about "my", "our", or module data (how many, who, what, show, list, status, overview): call get_/list_/search_ tools or summarize_workspace / get_business_snapshot immediately.
- Only external-facing sends (email, WhatsApp, invoice to client, bulk campaign publish) may queue approval — reading and drafting inside the workspace never needs permission.`;
}

export const BONNIE_MODULE_DATA_TOOLS: Record<string, string[]> = {
  crm: ['get_contacts', 'get_clients', 'search_clients'],
  leads: ['get_leads', 'search_clients'],
  deals: ['get_deals', 'get_pipeline_summary'],
  campaigns: ['campaign_diagnose', 'campaign_brief'],
  whatsapp: ['get_whatsapp_status', 'get_recent_messages'],
  social: ['get_social_accounts', 'get_scheduled_posts'],
  mail: ['microsoft_get_emails'],
  accounting: ['get_revenue_summary', 'accounting_snapshot', 'get_invoices'],
  contracts: ['get_contracts'],
  tasks: ['get_tasks', 'get_projects'],
  meetings: ['get_meetings', 'microsoft_get_calendar'],
  tickets: ['get_tickets'],
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
  if (/\b(overview|summary|workspace|how many|what'?s|status)\b/.test(t)) {
    picks.add('summarize_workspace');
    picks.add('get_business_snapshot');
  }

  return [...picks].slice(0, 4);
}

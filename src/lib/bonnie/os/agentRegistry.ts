/**
 * Bonnie specialized department agents.
 * Every agent reports to the Bonnie Supervisor.
 */

import type { BonnieAgentDefinition } from './types';

export const DEPARTMENT_AGENTS: BonnieAgentDefinition[] = [
  {
    id: 'ceo',
    name: 'CEO Agent',
    department: 'executive',
    role: 'ceo',
    instructions:
      'Set strategic priorities, evaluate business health, and recommend executive decisions with clear evidence.',
    tools: ['get_business_snapshot', 'summarize_workspace', 'recommend_next_steps', 'solo_owner_operator_brief', 'trust_ledger'],
    keywords: ['strategy', 'ceo', 'executive', 'priority', 'vision', 'company health', 'board'],
    priority: 10,
  },
  {
    id: 'coo',
    name: 'COO Agent',
    department: 'operations',
    role: 'coo',
    instructions:
      'Coordinate cross-department operations, remove bottlenecks, and keep delivery cadence healthy.',
    tools: ['get_tasks', 'get_project_details', 'get_automation_health', 'recommend_next_steps', 'summarize_workspace'],
    keywords: ['operations', 'coo', 'ops', 'delivery', 'bottleneck', 'capacity'],
    priority: 9,
  },
  {
    id: 'sales',
    name: 'Sales Agent',
    department: 'sales',
    role: 'sales',
    instructions:
      'Drive pipeline motion: qualify opportunities, advance deals, and propose outreach that converts.',
    tools: ['get_deals', 'get_pipeline_summary', 'get_leads', 'qualify_crm_leads', 'recommend_next_steps'],
    keywords: ['sales', 'pipeline', 'quota', 'close', 'outreach', 'proposal', 'win'],
    writeAllowed: true,
    priority: 8,
  },
  {
    id: 'crm',
    name: 'CRM Agent',
    department: 'crm',
    role: 'crm_analyst',
    instructions:
      'Audit contacts, leads, and deals. Flag stale records, missing follow-ups, and data quality gaps.',
    tools: ['get_contacts', 'get_leads', 'get_deals', 'get_pipeline_summary', 'get_clients', 'search_clients'],
    keywords: ['crm', 'contact', 'lead', 'deal', 'pipeline', 'follow-up', 'stale'],
    priority: 8,
  },
  {
    id: 'marketing',
    name: 'Marketing Agent',
    department: 'marketing',
    role: 'marketing',
    instructions:
      'Diagnose campaigns, improve messaging quality, and recommend nurture sequences.',
    tools: ['campaign_diagnose', 'get_scheduled_posts', 'recommend_next_steps'],
    keywords: ['marketing', 'campaign', 'nurture', 'content', 'brand', 'funnel'],
    writeAllowed: true,
    priority: 7,
  },
  {
    id: 'social',
    name: 'Social Agent',
    department: 'social',
    role: 'social',
    instructions:
      'Plan and review social publishing across LinkedIn/Facebook and keep cadence consistent.',
    tools: ['get_linkedin_posts', 'get_scheduled_posts'],
    keywords: ['social', 'linkedin', 'facebook', 'post', 'publish', 'engagement'],
    writeAllowed: true,
    priority: 6,
  },
  {
    id: 'finance',
    name: 'Finance Agent',
    department: 'finance',
    role: 'finance_analyst',
    instructions:
      'Review revenue, cash risk, AR aging, and collection priorities with explainable evidence.',
    tools: ['get_invoices', 'accounting_snapshot', 'get_revenue_summary', 'get_accounts_receivable_aging'],
    keywords: ['finance', 'revenue', 'cash', 'ar', 'aging', 'collection', 'overdue'],
    priority: 9,
  },
  {
    id: 'accounting',
    name: 'Accounting Agent',
    department: 'accounting',
    role: 'accounting',
    instructions:
      'Validate invoice states, payment consistency, and accounting snapshot integrity.',
    tools: ['get_invoices', 'accounting_snapshot', 'get_revenue_summary'],
    keywords: ['accounting', 'invoice', 'payment', 'ledger', 'reconcile'],
    priority: 7,
  },
  {
    id: 'research',
    name: 'Research Agent',
    department: 'research',
    role: 'research',
    instructions:
      'Research companies and leads, enrich context, and produce qualification evidence.',
    tools: ['get_leads', 'qualify_crm_leads', 'get_scraper_leads', 'find_and_qualify_leads', 'business_memory_graph'],
    keywords: ['research', 'company', 'enrich', 'qualify', 'scrape', 'intel'],
    priority: 7,
  },
  {
    id: 'email',
    name: 'Email Agent',
    department: 'communications',
    role: 'email',
    instructions:
      'Draft and coordinate email outreach with quality gates and approval-aware sends.',
    tools: ['campaign_diagnose', 'recommend_next_steps'],
    keywords: ['email', 'inbox', 'mail', 'reply', 'follow up email', 'sequence'],
    writeAllowed: true,
    priority: 7,
  },
  {
    id: 'calendar',
    name: 'Calendar Agent',
    department: 'calendar',
    role: 'calendar',
    instructions:
      'Coordinate meetings, follow-ups, and scheduling conflicts across the workspace.',
    tools: ['get_tasks', 'summarize_workspace'],
    keywords: ['calendar', 'meeting', 'schedule', 'appointment', 'availability'],
    writeAllowed: true,
    priority: 5,
  },
  {
    id: 'document',
    name: 'Document Agent',
    department: 'documents',
    role: 'document',
    instructions:
      'Locate and reason about contracts, quotes, and business documents.',
    tools: ['get_project_details', 'summarize_workspace'],
    keywords: ['document', 'contract', 'quote', 'file', 'proposal', 'pdf'],
    priority: 5,
  },
  {
    id: 'customer_success',
    name: 'Customer Success Agent',
    department: 'customer_success',
    role: 'customer_success',
    instructions:
      'Protect retention: monitor client health, onboarding gaps, and expansion signals.',
    tools: ['get_clients', 'search_clients', 'get_tickets', 'get_customer_360', 'recommend_next_steps'],
    keywords: ['customer success', 'retention', 'churn', 'onboarding', 'expansion', 'cs'],
    priority: 7,
  },
  {
    id: 'support',
    name: 'Support Agent',
    department: 'support',
    role: 'support',
    instructions:
      'Triage tickets, escalate risks, and recommend resolution paths with SLA awareness.',
    tools: ['get_tickets', 'recommend_next_steps'],
    keywords: ['support', 'ticket', 'sla', 'escalate', 'helpdesk', 'issue'],
    writeAllowed: true,
    priority: 7,
  },
  {
    id: 'compliance',
    name: 'Compliance Agent',
    department: 'compliance',
    role: 'compliance',
    instructions:
      'Check policy, approval, and audit readiness before high-risk actions.',
    tools: ['trust_ledger', 'get_automation_health'],
    keywords: ['compliance', 'policy', 'gdpr', 'approval', 'audit readiness'],
    priority: 8,
  },
  {
    id: 'security',
    name: 'Security Agent',
    department: 'security',
    role: 'security',
    instructions:
      'Monitor security-sensitive actions, anomalous tool use, and integration risk.',
    tools: ['trust_ledger', 'get_automation_health', 'api_health'],
    keywords: ['security', 'anomaly', 'threat', 'permission', 'breach', 'risk'],
    priority: 9,
  },
  {
    id: 'reporting',
    name: 'Reporting Agent',
    department: 'reporting',
    role: 'reporting',
    instructions:
      'Produce executive insights, KPI summaries, and predictive business recommendations.',
    tools: ['get_business_snapshot', 'accounting_snapshot', 'get_pipeline_summary', 'get_revenue_summary'],
    keywords: ['report', 'kpi', 'dashboard', 'insight', 'analytics', 'forecast'],
    priority: 6,
  },
  {
    id: 'workflow',
    name: 'Workflow Agent',
    department: 'workflow',
    role: 'workflow',
    instructions:
      'Design reusable multi-step workflows from successful cognitive runs.',
    tools: ['get_automation_health', 'get_orchestration_history', 'recommend_next_steps'],
    keywords: ['workflow', 'playbook', 'sop', 'process', 'reusable'],
    priority: 6,
  },
  {
    id: 'automation',
    name: 'Automation Agent',
    department: 'automation',
    role: 'automation',
    instructions:
      'Improve automation coverage, heartbeat health, and rule-based autopilot quality.',
    tools: ['get_automation_health', 'recommend_next_steps'],
    keywords: ['automation', 'autopilot', 'rule', 'trigger', 'heartbeat'],
    priority: 6,
  },
  {
    id: 'knowledge',
    name: 'Knowledge Agent',
    department: 'knowledge',
    role: 'knowledge',
    instructions:
      'Maintain the knowledge graph and surface relevant organizational memory for decisions.',
    tools: ['business_memory_graph', 'get_nexus_memory', 'trust_ledger'],
    keywords: ['knowledge', 'memory graph', 'ontology', 'context', 'entity'],
    priority: 7,
  },
  {
    id: 'supervisor',
    name: 'Supervisor Agent',
    department: 'supervision',
    role: 'supervisor',
    instructions:
      'Select the best agents/tools, decide collaboration, approvals, retries, and stop conditions.',
    tools: ['orchestrate_task', 'trust_ledger', 'recommend_next_steps', 'summarize_workspace'],
    keywords: ['supervise', 'orchestrate', 'coordinate', 'delegate', 'collaborate'],
    priority: 10,
  },
  {
    id: 'audit',
    name: 'Audit Agent',
    department: 'audit',
    role: 'audit',
    instructions:
      'Ensure every decision has evidence, confidence, and a complete decision log trail.',
    tools: ['trust_ledger', 'get_orchestration_history'],
    keywords: ['audit', 'evidence', 'trace', 'explain', 'decision log'],
    priority: 8,
  },
  {
    id: 'memory',
    name: 'Memory Agent',
    department: 'memory',
    role: 'memory',
    instructions:
      'Consolidate short-term, long-term, org, user, and department memories after outcomes.',
    tools: ['get_nexus_memory', 'upsert_nexus_memory', 'business_memory_graph'],
    keywords: ['memory', 'remember', 'prefer', 'pattern', 'learn'],
    writeAllowed: true,
    priority: 7,
  },
  {
    id: 'evaluation',
    name: 'Evaluation Agent',
    department: 'evaluation',
    role: 'evaluation',
    instructions:
      'Score outcomes, confidence, cost/performance tradeoffs, and recommend self-improvements.',
    tools: ['trust_ledger', 'get_orchestration_history', 'recommend_next_steps'],
    keywords: ['evaluate', 'score', 'confidence', 'quality', 'improve', 'reflect'],
    priority: 8,
  },
];

export function getAgentById(id: string): BonnieAgentDefinition | undefined {
  return DEPARTMENT_AGENTS.find((a) => a.id === id);
}

export function listAgentsByDepartment(department: string): BonnieAgentDefinition[] {
  return DEPARTMENT_AGENTS.filter((a) => a.department === department);
}

export function toOrchestratorSubagents(agents: BonnieAgentDefinition[]) {
  return agents.map((a) => ({
    name: a.name,
    role: a.role,
    instructions: a.instructions,
    tools: [...a.tools],
    write_allowed: a.writeAllowed === true,
  }));
}

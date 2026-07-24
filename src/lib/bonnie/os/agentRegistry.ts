/**
 * Bonnie specialized department agents.
 * Every agent reports to the Bonnie Supervisor / Executive coordinator.
 */

import type {
  AgentHealthStatus,
  BonnieAgentDefinition,
  ExecutionMode,
} from './types';

const READ_MODES: ExecutionMode[] = ['ask_only', 'plan_only', 'semi_autonomous', 'fully_autonomous'];
const WRITE_MODES: ExecutionMode[] = [
  'ask_only',
  'plan_only',
  'approval_required',
  'semi_autonomous',
];
const HIGH_RISK_MODES: ExecutionMode[] = ['ask_only', 'plan_only', 'approval_required'];

function enrich(agent: BonnieAgentDefinition): BonnieAgentDefinition {
  const write = agent.writeAllowed === true;
  return {
    ...agent,
    capabilities: agent.capabilities || [
      agent.role,
      agent.department,
      ...(write ? ['write_actions'] : ['read_actions']),
    ],
    supportedModes:
      agent.supportedModes ||
      (write ? WRITE_MODES : READ_MODES),
    confidencePrior: agent.confidencePrior ?? Math.min(0.95, 0.55 + (agent.priority || 5) * 0.03),
    supportedActions: agent.supportedActions || agent.tools.slice(0, 8),
    requiredTools: agent.requiredTools || agent.tools,
    healthStatus: agent.healthStatus || 'healthy',
  };
}

const RAW_AGENTS: BonnieAgentDefinition[] = [
  {
    id: 'ceo',
    name: 'Executive Agent',
    department: 'executive',
    role: 'executive',
    instructions:
      'Set strategic priorities, evaluate business health, and coordinate specialist agents toward durable goals.',
    tools: [
      'get_business_snapshot',
      'summarize_workspace',
      'recommend_next_steps',
      'solo_owner_operator_brief',
      'trust_ledger',
    ],
    keywords: [
      'strategy',
      'ceo',
      'executive',
      'priority',
      'vision',
      'company health',
      'board',
      'goal',
      'objective',
    ],
    priority: 10,
    capabilities: ['goal_planning', 'cross_department_coordination', 'executive_briefing'],
    supportedModes: READ_MODES,
    confidencePrior: 0.9,
  },
  {
    id: 'coo',
    name: 'COO Agent',
    department: 'operations',
    role: 'coo',
    instructions:
      'Coordinate cross-department operations, remove bottlenecks, and keep delivery cadence healthy.',
    tools: [
      'get_tasks',
      'get_project_details',
      'get_automation_health',
      'recommend_next_steps',
      'summarize_workspace',
    ],
    keywords: ['operations', 'coo', 'ops', 'delivery', 'bottleneck', 'capacity'],
    priority: 9,
    capabilities: ['operations_coordination', 'bottleneck_detection', 'delivery_cadence'],
  },
  {
    id: 'sales',
    name: 'Sales Agent',
    department: 'sales',
    role: 'sales',
    instructions:
      'Drive pipeline motion: qualify opportunities, advance deals, and propose outreach that converts.',
    tools: [
      'get_deals',
      'get_pipeline_summary',
      'get_leads',
      'qualify_crm_leads',
      'recommend_next_steps',
    ],
    keywords: ['sales', 'pipeline', 'quota', 'close', 'outreach', 'proposal', 'win'],
    writeAllowed: true,
    priority: 8,
    capabilities: ['pipeline_motion', 'qualification', 'outreach_planning'],
  },
  {
    id: 'crm',
    name: 'CRM Agent',
    department: 'crm',
    role: 'crm_analyst',
    instructions:
      'Audit contacts, leads, and deals. Flag stale records, missing follow-ups, and data quality gaps.',
    tools: [
      'get_contacts',
      'get_leads',
      'get_deals',
      'get_pipeline_summary',
      'get_clients',
      'search_clients',
    ],
    keywords: ['crm', 'contact', 'lead', 'deal', 'pipeline', 'follow-up', 'stale'],
    priority: 8,
    capabilities: ['crm_audit', 'stale_record_detection', 'relationship_context'],
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
    capabilities: ['campaign_diagnosis', 'nurture_planning', 'messaging_quality'],
    supportedModes: WRITE_MODES,
  },
  {
    id: 'social',
    name: 'Social Media Agent',
    department: 'social',
    role: 'social',
    instructions:
      'Plan and review social publishing across LinkedIn/Facebook and keep cadence consistent.',
    tools: ['get_linkedin_posts', 'get_scheduled_posts'],
    keywords: ['social', 'linkedin', 'facebook', 'post', 'publish', 'engagement'],
    writeAllowed: true,
    priority: 6,
    capabilities: ['social_planning', 'publish_review', 'engagement_signals'],
    supportedModes: HIGH_RISK_MODES,
  },
  {
    id: 'finance',
    name: 'Finance Agent',
    department: 'finance',
    role: 'finance_analyst',
    instructions:
      'Review revenue, cash risk, AR aging, and collection priorities with explainable evidence.',
    tools: [
      'get_invoices',
      'accounting_snapshot',
      'get_revenue_summary',
      'get_accounts_receivable_aging',
    ],
    keywords: ['finance', 'revenue', 'cash', 'ar', 'aging', 'collection', 'overdue'],
    priority: 9,
    capabilities: ['cash_risk', 'ar_aging', 'collection_priority'],
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
    capabilities: ['invoice_integrity', 'payment_consistency', 'ledger_checks'],
  },
  {
    id: 'research',
    name: 'Research Agent',
    department: 'research',
    role: 'research',
    instructions:
      'Research companies and leads, enrich context, and produce qualification evidence.',
    tools: [
      'get_leads',
      'qualify_crm_leads',
      'get_scraper_leads',
      'find_and_qualify_leads',
      'business_memory_graph',
    ],
    keywords: ['research', 'company', 'enrich', 'qualify', 'scrape', 'intel'],
    priority: 7,
    capabilities: ['company_research', 'lead_enrichment', 'qualification_evidence'],
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
    capabilities: ['email_drafting', 'outreach_sequences', 'reply_classification'],
    supportedModes: HIGH_RISK_MODES,
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
    capabilities: ['scheduling', 'meeting_prep', 'follow_up_timing'],
  },
  {
    id: 'document',
    name: 'Documents Agent',
    department: 'documents',
    role: 'document',
    instructions:
      'Locate and reason about contracts, quotes, and business documents.',
    tools: ['get_project_details', 'summarize_workspace'],
    keywords: ['document', 'quote', 'file', 'proposal', 'pdf'],
    priority: 5,
    capabilities: ['document_retrieval', 'knowledge_extraction', 'file_linking'],
  },
  {
    id: 'contracts',
    name: 'Contracts Agent',
    department: 'contracts',
    role: 'contracts',
    instructions:
      'Track contract lifecycle: draft review, signature status, renewals, and handoff to finance/CS.',
    tools: ['get_project_details', 'summarize_workspace', 'recommend_next_steps', 'trust_ledger'],
    keywords: ['contract', 'agreement', 'msa', 'nda', 'signature', 'renewal', 'clause'],
    writeAllowed: true,
    priority: 7,
    capabilities: ['contract_lifecycle', 'signature_tracking', 'renewal_watch'],
    supportedModes: HIGH_RISK_MODES,
  },
  {
    id: 'customer_success',
    name: 'Customer Success Agent',
    department: 'customer_success',
    role: 'customer_success',
    instructions:
      'Protect retention: monitor client health, onboarding gaps, and expansion signals.',
    tools: [
      'get_clients',
      'search_clients',
      'get_tickets',
      'get_customer_360',
      'recommend_next_steps',
    ],
    keywords: ['customer success', 'retention', 'churn', 'onboarding', 'expansion', 'cs'],
    priority: 7,
    capabilities: ['retention', 'health_scoring', 'expansion_signals'],
  },
  {
    id: 'support',
    name: 'Customer Support Agent',
    department: 'support',
    role: 'support',
    instructions:
      'Triage tickets, escalate risks, and recommend resolution paths with SLA awareness.',
    tools: ['get_tickets', 'recommend_next_steps'],
    keywords: ['support', 'ticket', 'sla', 'escalate', 'helpdesk', 'issue'],
    writeAllowed: true,
    priority: 7,
    capabilities: ['ticket_triage', 'sla_watch', 'escalation'],
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
    capabilities: ['policy_checks', 'approval_gates', 'audit_readiness'],
    supportedModes: HIGH_RISK_MODES,
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
    capabilities: ['anomaly_detection', 'permission_risk', 'integration_security'],
    supportedModes: HIGH_RISK_MODES,
  },
  {
    id: 'reporting',
    name: 'Reporting Agent',
    department: 'reporting',
    role: 'reporting',
    instructions:
      'Produce executive insights, KPI summaries, and predictive business recommendations.',
    tools: [
      'get_business_snapshot',
      'accounting_snapshot',
      'get_pipeline_summary',
      'get_revenue_summary',
    ],
    keywords: ['report', 'kpi', 'dashboard', 'insight', 'analytics', 'forecast'],
    priority: 6,
    capabilities: ['kpi_summaries', 'executive_insights', 'forecasting'],
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
    capabilities: ['playbook_design', 'workflow_reuse', 'process_improvement'],
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
    capabilities: ['automation_health', 'rule_quality', 'heartbeat'],
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
    capabilities: ['knowledge_graph', 'context_retrieval', 'entity_linking'],
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
    capabilities: ['agent_routing', 'approval_decisions', 'retry_strategy'],
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
    capabilities: ['explainability', 'evidence_trail', 'decision_logging'],
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
    capabilities: [
      'conversation_memory',
      'session_memory',
      'tenant_knowledge',
      'procedural_memory',
      'learning_memory',
    ],
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
    capabilities: ['outcome_scoring', 'reflection', 'self_improvement'],
  },
  {
    id: 'integration',
    name: 'Integration Agent',
    department: 'integration',
    role: 'integration',
    instructions:
      'Watch OAuth health, API connectivity, and integration failures across Alphaclone modules.',
    tools: ['api_health', 'get_automation_health', 'trust_ledger'],
    keywords: ['integration', 'oauth', 'api', 'webhook', 'connector', 'sync'],
    priority: 7,
    capabilities: ['oauth_health', 'api_connectivity', 'webhook_reliability'],
  },
  {
    id: 'notification',
    name: 'Notification Agent',
    department: 'notification',
    role: 'notification',
    instructions:
      'Deliver the right alert to the right person at the right time without notification fatigue.',
    tools: ['recommend_next_steps', 'summarize_workspace'],
    keywords: ['notify', 'alert', 'notification', 'escalate', 'digest'],
    writeAllowed: true,
    priority: 5,
    capabilities: ['user_alerts', 'escalation_routing', 'digest_delivery'],
    supportedModes: WRITE_MODES,
  },
  {
    id: 'monitoring',
    name: 'Monitoring Agent',
    department: 'monitoring',
    role: 'monitoring',
    instructions:
      'Continuously watch unpaid invoices, expiring contracts, overdue leads, failed automations, and system health.',
    tools: [
      'get_automation_health',
      'api_health',
      'get_invoices',
      'get_business_snapshot',
      'recommend_next_steps',
    ],
    keywords: [
      'monitor',
      'watch',
      'threshold',
      'health',
      'alert',
      'failure',
      'expiring',
      'overdue',
    ],
    priority: 8,
    capabilities: [
      'threshold_watch',
      'system_health',
      'goal_wake',
      'continuous_observation',
    ],
  },
];

export const DEPARTMENT_AGENTS: BonnieAgentDefinition[] = RAW_AGENTS.map(enrich);

export function getAgentById(id: string): BonnieAgentDefinition | undefined {
  return DEPARTMENT_AGENTS.find((a) => a.id === id);
}

export function listAgentsByDepartment(department: string): BonnieAgentDefinition[] {
  return DEPARTMENT_AGENTS.filter((a) => a.department === department);
}

export function getAgentRuntimeStatus(agentId: string): {
  id: string;
  name: string;
  capabilities: string[];
  permissions: { writeAllowed: boolean; supportedModes: ExecutionMode[] };
  requiredTools: string[];
  supportedActions: string[];
  confidenceScore: number;
  healthStatus: AgentHealthStatus;
} | null {
  const agent = getAgentById(agentId);
  if (!agent) return null;
  return {
    id: agent.id,
    name: agent.name,
    capabilities: agent.capabilities || [],
    permissions: {
      writeAllowed: agent.writeAllowed === true,
      supportedModes: agent.supportedModes || READ_MODES,
    },
    requiredTools: agent.requiredTools || agent.tools,
    supportedActions: agent.supportedActions || agent.tools,
    confidenceScore: agent.confidencePrior ?? 0.7,
    healthStatus: agent.healthStatus || 'healthy',
  };
}

export function listAgentRuntimeStatuses() {
  return DEPARTMENT_AGENTS.map((a) => getAgentRuntimeStatus(a.id)!);
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

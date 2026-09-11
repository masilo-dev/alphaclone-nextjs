/**
 * Central KPI metric registry for AlphaClone platform dashboards.
 * Single source of truth for labels, semantics, formatting, and drill-down routes.
 */

export type PlatformModuleId =
  | 'home'
  | 'crm'
  | 'leads'
  | 'outreach'
  | 'campaigns'
  | 'email'
  | 'social'
  | 'revenue'
  | 'invoices'
  | 'contracts'
  | 'documents'
  | 'calendar'
  | 'marketing'
  | 'automations'
  | 'agents'
  | 'goals'
  | 'reports'
  | 'projects'
  | 'usage'
  | 'admin';

export type MetricFormat = 'number' | 'currency' | 'percent' | 'duration' | 'text';
export type MetricPolarity = 'higher_is_better' | 'lower_is_better' | 'neutral';

export interface PlatformMetricDefinition {
  id: string;
  module: PlatformModuleId;
  label: string;
  description: string;
  format: MetricFormat;
  polarity: MetricPolarity;
  href?: string;
  /** Primary data source (table, RPC, or API route). */
  dataSource: string;
  permissions?: string[];
  estimated?: boolean;
}

function m(
  def: Omit<PlatformMetricDefinition, 'id'> & { id: string },
): PlatformMetricDefinition {
  return def;
}

export const PLATFORM_METRIC_REGISTRY: Record<string, PlatformMetricDefinition> = {
  // ── Home ──
  'home.total_revenue': m({
    id: 'home.total_revenue',
    module: 'home',
    label: 'Total revenue',
    description: 'Collected and recognized revenue in the selected period.',
    format: 'currency',
    polarity: 'higher_is_better',
    href: '/dashboard/business/billing',
    dataSource: 'get_consolidated_dashboard_stats / business_invoices',
  }),
  'home.new_leads': m({
    id: 'home.new_leads',
    module: 'home',
    label: 'New leads',
    description: 'Leads created in the selected period.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/leads',
    dataSource: 'leads',
  }),
  'home.conversion_rate': m({
    id: 'home.conversion_rate',
    module: 'home',
    label: 'Conversion rate',
    description: 'Share of leads that reached a converted or won status.',
    format: 'percent',
    polarity: 'higher_is_better',
    href: '/dashboard/crm/reports',
    dataSource: 'leads + deals',
  }),
  'home.active_campaigns': m({
    id: 'home.active_campaigns',
    module: 'home',
    label: 'Active campaigns',
    description: 'Campaigns currently sending or scheduled.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/business/campaigns',
    dataSource: 'email_campaigns',
  }),
  'home.outstanding_invoices': m({
    id: 'home.outstanding_invoices',
    module: 'home',
    label: 'Outstanding invoices',
    description: 'Unpaid invoice balance still due from customers.',
    format: 'currency',
    polarity: 'lower_is_better',
    href: '/dashboard/business/billing/manage',
    dataSource: 'business_invoices',
  }),
  'home.upcoming_meetings': m({
    id: 'home.upcoming_meetings',
    module: 'home',
    label: 'Upcoming meetings',
    description: 'Scheduled meetings in the next seven days.',
    format: 'number',
    polarity: 'neutral',
    href: '/dashboard/business/calendar',
    dataSource: 'meetings / calendar_events',
  }),
  'home.tasks_attention': m({
    id: 'home.tasks_attention',
    module: 'home',
    label: 'Tasks requiring attention',
    description: 'Overdue or high-priority tasks not yet completed.',
    format: 'number',
    polarity: 'lower_is_better',
    href: '/dashboard/tasks',
    dataSource: 'tasks',
  }),
  'home.automation_success_rate': m({
    id: 'home.automation_success_rate',
    module: 'home',
    label: 'Automation success rate',
    description: 'Successful automation runs divided by total runs in the period.',
    format: 'percent',
    polarity: 'higher_is_better',
    href: '/dashboard/business/workflows',
    dataSource: 'automation_runs',
    estimated: true,
  }),

  // ── CRM ──
  'crm.total_contacts': m({
    id: 'crm.total_contacts',
    module: 'crm',
    label: 'Total contacts',
    description: 'All contacts in your workspace CRM.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/crm/unified-contacts',
    dataSource: 'contacts',
    permissions: ['crm:read'],
  }),
  'crm.new_contacts': m({
    id: 'crm.new_contacts',
    module: 'crm',
    label: 'New contacts',
    description: 'Contacts added in the selected period.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/crm/unified-contacts',
    dataSource: 'contacts.created_at',
    permissions: ['crm:read'],
  }),
  'crm.qualified_leads': m({
    id: 'crm.qualified_leads',
    module: 'crm',
    label: 'Qualified leads',
    description: 'Leads marked qualified or equivalent in pipeline.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/leads',
    dataSource: 'leads.status',
    permissions: ['crm:read'],
  }),
  'crm.pipeline_value': m({
    id: 'crm.pipeline_value',
    module: 'crm',
    label: 'Pipeline value',
    description: 'Total value of open deals in the pipeline.',
    format: 'currency',
    polarity: 'higher_is_better',
    href: '/dashboard/deals',
    dataSource: 'deals',
    permissions: ['crm:read'],
  }),
  'crm.win_rate': m({
    id: 'crm.win_rate',
    module: 'crm',
    label: 'Win rate',
    description: 'Closed-won deals divided by closed deals in the period.',
    format: 'percent',
    polarity: 'higher_is_better',
    href: '/dashboard/deals',
    dataSource: 'deals.stage',
    permissions: ['crm:read'],
  }),
  'crm.deals_follow_up': m({
    id: 'crm.deals_follow_up',
    module: 'crm',
    label: 'Deals requiring follow-up',
    description: 'Open deals with no activity beyond the follow-up threshold.',
    format: 'number',
    polarity: 'lower_is_better',
    href: '/dashboard/deals',
    dataSource: 'deals + activity_logs',
    permissions: ['crm:read'],
  }),

  // ── Leads ──
  'leads.added': m({
    id: 'leads.added',
    module: 'leads',
    label: 'Leads added',
    description: 'New leads captured in the selected period.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/leads',
    dataSource: 'leads',
  }),
  'leads.qualification_rate': m({
    id: 'leads.qualification_rate',
    module: 'leads',
    label: 'Qualification rate',
    description: 'Qualified leads divided by total leads in the period.',
    format: 'percent',
    polarity: 'higher_is_better',
    href: '/dashboard/leads',
    dataSource: 'leads',
  }),
  'leads.converted': m({
    id: 'leads.converted',
    module: 'leads',
    label: 'Converted leads',
    description: 'Leads converted to customers or deals in the period.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/leads',
    dataSource: 'leads.status',
  }),
  'leads.daily_limit_remaining': m({
    id: 'leads.daily_limit_remaining',
    module: 'leads',
    label: 'Daily lead limit remaining',
    description: 'Remaining lead-finder or import capacity for today.',
    format: 'number',
    polarity: 'neutral',
    href: '/dashboard/leads/campaigns',
    dataSource: 'quota_usage',
  }),

  // ── Outreach & Email ──
  'outreach.messages_sent': m({
    id: 'outreach.messages_sent',
    module: 'outreach',
    label: 'Messages sent',
    description: 'Outbound messages sent in the selected period.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/outreach/inbox',
    dataSource: 'outreach_log / email_logs',
  }),
  'outreach.delivery_rate': m({
    id: 'outreach.delivery_rate',
    module: 'outreach',
    label: 'Delivery rate',
    description: 'Successfully delivered messages divided by attempted sends.',
    format: 'percent',
    polarity: 'higher_is_better',
    href: '/dashboard/outreach/inbox',
    dataSource: 'email_logs',
  }),
  'outreach.reply_rate': m({
    id: 'outreach.reply_rate',
    module: 'outreach',
    label: 'Reply rate',
    description: 'Replies received divided by delivered messages.',
    format: 'percent',
    polarity: 'higher_is_better',
    href: '/dashboard/outreach/inbox',
    dataSource: 'unified_messages',
  }),
  'outreach.failed_messages': m({
    id: 'outreach.failed_messages',
    module: 'outreach',
    label: 'Failed messages',
    description: 'Messages that failed to send or deliver.',
    format: 'number',
    polarity: 'lower_is_better',
    href: '/dashboard/outreach/inbox',
    dataSource: 'email_logs.status',
  }),
  'outreach.unsubscribes': m({
    id: 'outreach.unsubscribes',
    module: 'outreach',
    label: 'Unsubscribes',
    description: 'Contacts who opted out in the selected period.',
    format: 'number',
    polarity: 'lower_is_better',
    href: '/dashboard/marketing/suppressions',
    dataSource: 'email_suppressions',
  }),

  // ── Campaigns ──
  'campaigns.active': m({
    id: 'campaigns.active',
    module: 'campaigns',
    label: 'Active campaigns',
    description: 'Campaigns currently running or scheduled.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/business/campaigns',
    dataSource: 'email_campaigns',
  }),
  'campaigns.recipients': m({
    id: 'campaigns.recipients',
    module: 'campaigns',
    label: 'Total recipients',
    description: 'Unique recipients targeted across active campaigns.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/business/campaigns',
    dataSource: 'email_campaigns',
  }),
  'campaigns.conversion_rate': m({
    id: 'campaigns.conversion_rate',
    module: 'campaigns',
    label: 'Conversion rate',
    description: 'Campaign-attributed conversions divided by recipients.',
    format: 'percent',
    polarity: 'higher_is_better',
    href: '/dashboard/business/campaigns',
    dataSource: 'email_campaigns + leads',
  }),
  'campaigns.failed': m({
    id: 'campaigns.failed',
    module: 'campaigns',
    label: 'Paused or failed campaigns',
    description: 'Campaigns stopped due to errors or manual pause.',
    format: 'number',
    polarity: 'lower_is_better',
    href: '/dashboard/business/campaigns',
    dataSource: 'email_campaigns.status',
  }),

  // ── Social ──
  'social.posts_published': m({
    id: 'social.posts_published',
    module: 'social',
    label: 'Posts published',
    description: 'Social posts successfully published in the period.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/business/social',
    dataSource: 'social_posts',
  }),
  'social.scheduled': m({
    id: 'social.scheduled',
    module: 'social',
    label: 'Scheduled posts',
    description: 'Posts queued for future publication.',
    format: 'number',
    polarity: 'neutral',
    href: '/dashboard/business/social',
    dataSource: 'scheduled_posts',
  }),
  'social.failed_publications': m({
    id: 'social.failed_publications',
    module: 'social',
    label: 'Failed publications',
    description: 'Posts that failed to publish to a connected network.',
    format: 'number',
    polarity: 'lower_is_better',
    href: '/dashboard/business/social',
    dataSource: 'social_posts.status',
  }),
  'social.connected_accounts': m({
    id: 'social.connected_accounts',
    module: 'social',
    label: 'Connected accounts',
    description: 'Active social network connections for this workspace.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/business/social',
    dataSource: 'facebook_integrations + linkedin_integrations',
  }),

  // ── Revenue / Money ──
  'revenue.total': m({
    id: 'revenue.total',
    module: 'revenue',
    label: 'Total revenue',
    description: 'Recognized revenue in the selected period.',
    format: 'currency',
    polarity: 'higher_is_better',
    href: '/dashboard/business/billing',
    dataSource: 'business_invoices + payments',
    permissions: ['billing:read'],
  }),
  'revenue.collected': m({
    id: 'revenue.collected',
    module: 'revenue',
    label: 'Collected payments',
    description: 'Cash collected against invoices in the period.',
    format: 'currency',
    polarity: 'higher_is_better',
    href: '/dashboard/business/billing/manage',
    dataSource: 'invoice_payments',
    permissions: ['billing:read'],
  }),
  'revenue.outstanding': m({
    id: 'revenue.outstanding',
    module: 'revenue',
    label: 'Outstanding balance',
    description: 'Total unpaid invoice balance.',
    format: 'currency',
    polarity: 'lower_is_better',
    href: '/dashboard/business/billing/manage',
    dataSource: 'business_invoices',
    permissions: ['billing:read'],
  }),
  'revenue.overdue': m({
    id: 'revenue.overdue',
    module: 'revenue',
    label: 'Overdue balance',
    description: 'Invoice balance past due date.',
    format: 'currency',
    polarity: 'lower_is_better',
    href: '/dashboard/business/billing/manage',
    dataSource: 'business_invoices.due_date',
    permissions: ['billing:read'],
  }),
  'revenue.net_cash_flow': m({
    id: 'revenue.net_cash_flow',
    module: 'revenue',
    label: 'Net cash flow',
    description: 'Collected revenue minus recorded expenses in the period.',
    format: 'currency',
    polarity: 'higher_is_better',
    href: '/dashboard/business/cash-flow',
    dataSource: 'payments + expenses',
    permissions: ['billing:read'],
  }),

  // ── Invoices ──
  'invoices.total_invoiced': m({
    id: 'invoices.total_invoiced',
    module: 'invoices',
    label: 'Total invoiced',
    description: 'Invoice amounts issued in the period.',
    format: 'currency',
    polarity: 'higher_is_better',
    href: '/dashboard/business/billing/manage',
    dataSource: 'business_invoices',
    permissions: ['billing:read'],
  }),
  'invoices.paid': m({
    id: 'invoices.paid',
    module: 'invoices',
    label: 'Paid invoices',
    description: 'Invoices fully paid in the period.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/business/billing/manage',
    dataSource: 'business_invoices.status',
    permissions: ['billing:read'],
  }),
  'invoices.overdue_count': m({
    id: 'invoices.overdue_count',
    module: 'invoices',
    label: 'Overdue invoices',
    description: 'Invoices past due and not fully paid.',
    format: 'number',
    polarity: 'lower_is_better',
    href: '/dashboard/business/billing/manage',
    dataSource: 'business_invoices',
    permissions: ['billing:read'],
  }),
  'invoices.failed_payments': m({
    id: 'invoices.failed_payments',
    module: 'invoices',
    label: 'Failed payment attempts',
    description: 'Stripe or manual payment attempts that failed.',
    format: 'number',
    polarity: 'lower_is_better',
    href: '/dashboard/business/billing/manage',
    dataSource: 'invoice_payments',
    permissions: ['billing:read'],
  }),

  // ── Contracts ──
  'contracts.awaiting_signature': m({
    id: 'contracts.awaiting_signature',
    module: 'contracts',
    label: 'Awaiting signature',
    description: 'Contracts sent but not yet signed.',
    format: 'number',
    polarity: 'lower_is_better',
    href: '/dashboard/business/documents',
    dataSource: 'contracts.status',
  }),
  'contracts.signed': m({
    id: 'contracts.signed',
    module: 'contracts',
    label: 'Signed',
    description: 'Contracts completed with all required signatures.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/business/documents',
    dataSource: 'contracts.status',
  }),
  'contracts.total_value': m({
    id: 'contracts.total_value',
    module: 'contracts',
    label: 'Total contract value',
    description: 'Aggregate value of active and signed contracts.',
    format: 'currency',
    polarity: 'higher_is_better',
    href: '/dashboard/business/documents',
    dataSource: 'contracts',
  }),

  // ── Projects ──
  'projects.active': m({
    id: 'projects.active',
    module: 'projects',
    label: 'Active projects',
    description: 'Projects currently in progress.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/business/projects',
    dataSource: 'business_projects',
  }),
  'projects.tasks_completed': m({
    id: 'projects.tasks_completed',
    module: 'projects',
    label: 'Tasks completed',
    description: 'Project tasks marked done in the period.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/business/projects',
    dataSource: 'tasks',
  }),
  'projects.blockers': m({
    id: 'projects.blockers',
    module: 'projects',
    label: 'Open blockers',
    description: 'Unresolved project issues blocking delivery.',
    format: 'number',
    polarity: 'lower_is_better',
    href: '/dashboard/business/projects',
    dataSource: 'project_issues',
  }),

  // ── Automations ──
  'automations.active': m({
    id: 'automations.active',
    module: 'automations',
    label: 'Active automations',
    description: 'Workflows and automations currently enabled.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/business/workflows',
    dataSource: 'automation_workflows',
  }),
  'automations.success_rate': m({
    id: 'automations.success_rate',
    module: 'automations',
    label: 'Success rate',
    description: 'Successful automation executions divided by total runs.',
    format: 'percent',
    polarity: 'higher_is_better',
    href: '/dashboard/business/workflows',
    dataSource: 'automation_runs',
    estimated: true,
  }),
  'automations.failed': m({
    id: 'automations.failed',
    module: 'automations',
    label: 'Failed executions',
    description: 'Automation runs that ended in error.',
    format: 'number',
    polarity: 'lower_is_better',
    href: '/dashboard/business/workflows',
    dataSource: 'automation_runs',
  }),

  // ── Agents / Bonnie / MCP ──
  'agents.tasks_completed': m({
    id: 'agents.tasks_completed',
    module: 'agents',
    label: 'Tasks completed',
    description: 'Bonnie agent tasks completed in the period.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/business/bonnie',
    dataSource: 'bonnie_agent_runs',
  }),
  'agents.awaiting_approval': m({
    id: 'agents.awaiting_approval',
    module: 'agents',
    label: 'Awaiting approval',
    description: 'Agent actions pending human approval.',
    format: 'number',
    polarity: 'lower_is_better',
    href: '/dashboard/bonnie/approvals',
    dataSource: 'bonnie_approvals',
  }),
  'agents.tool_success_rate': m({
    id: 'agents.tool_success_rate',
    module: 'agents',
    label: 'Tool success rate',
    description: 'Successful MCP tool executions divided by total tool calls.',
    format: 'percent',
    polarity: 'higher_is_better',
    href: '/dashboard/business/bonnie',
    dataSource: 'mcp_tool_metrics',
  }),

  // ── Usage & Billing ──
  'usage.plan': m({
    id: 'usage.plan',
    module: 'usage',
    label: 'Current plan',
    description: 'Active subscription plan for this workspace.',
    format: 'text',
    polarity: 'neutral',
    href: '/dashboard/business/settings',
    dataSource: 'tenants.subscription_plan',
  }),
  'usage.remaining_capacity': m({
    id: 'usage.remaining_capacity',
    module: 'usage',
    label: 'Remaining daily capacity',
    description: 'Lowest remaining quota across metered action categories today.',
    format: 'number',
    polarity: 'neutral',
    href: '/dashboard/business/settings',
    dataSource: 'quota_usage',
  }),

  // ── Super Admin ──
  'admin.total_users': m({
    id: 'admin.total_users',
    module: 'admin',
    label: 'Total users',
    description: 'Registered user profiles on the platform.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/admin/users',
    dataSource: '/api/admin/dashboard profiles',
  }),
  'admin.active_tenants': m({
    id: 'admin.active_tenants',
    module: 'admin',
    label: 'Active workspaces',
    description: 'Tenants that are not suspended or pending deletion.',
    format: 'number',
    polarity: 'higher_is_better',
    href: '/dashboard/admin/tenants',
    dataSource: '/api/admin/tenants',
  }),
  'admin.platform_revenue': m({
    id: 'admin.platform_revenue',
    module: 'admin',
    label: 'Platform MRR',
    description: 'Estimated monthly recurring revenue across paying tenants.',
    format: 'currency',
    polarity: 'higher_is_better',
    href: '/dashboard/admin/subscriptions',
    dataSource: '/api/admin/tenant-billing-summary',
    estimated: true,
  }),
  'admin.failed_jobs': m({
    id: 'admin.failed_jobs',
    module: 'admin',
    label: 'Failed jobs',
    description: 'Background jobs or cron runs that failed recently.',
    format: 'number',
    polarity: 'lower_is_better',
    href: '/dashboard/admin/operations',
    dataSource: 'error_logs + automation_cron_logs',
  }),
};

export function getMetricDefinition(metricId: string): PlatformMetricDefinition | undefined {
  return PLATFORM_METRIC_REGISTRY[metricId];
}

export function getMetricsForModule(module: PlatformModuleId): PlatformMetricDefinition[] {
  return Object.values(PLATFORM_METRIC_REGISTRY).filter((d) => d.module === module);
}

export function metricPolarityIsBetterHigher(polarity: MetricPolarity): boolean {
  if (polarity === 'lower_is_better') return false;
  if (polarity === 'higher_is_better') return true;
  return true;
}

export function resolveMetricIdByLabel(label: string): string | undefined {
  const normalized = label.toLowerCase().trim();
  for (const def of Object.values(PLATFORM_METRIC_REGISTRY)) {
    if (def.label.toLowerCase() === normalized) return def.id;
  }
  return undefined;
}

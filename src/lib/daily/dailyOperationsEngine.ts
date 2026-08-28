import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export interface DailyOperationsSummary {
  tenantId: string;
  date: string;
  generatedAt: string;

  newBusiness: {
    newLeads: number;
    qualifiedLeads: number;
    newOpportunities: number;
    newClients: number;
  };

  sales: {
    proposalsSent: number;
    proposalsAccepted: number;
    proposalsRejected: number;
    dealsWon: number;
    dealsLost: number;
  };

  clientActivity: {
    clientMessages: number;
    clientMeetings: number;
    decisionsMade: number;
    commitmentsActive: number;
  };

  projects: {
    created: number;
    milestonesCompleted: number;
    atRisk: number;
    blocked: number;
    failed: number;
  };

  communication: {
    emailsReceived: number;
    emailsSent: number;
    responses: number;
    awaitingReply: number;
    noRepliesDetected: number;
    slaRisks: number;
  };

  meetings: {
    completed: number;
    decisions: number;
    actionsGenerated: number;
  };

  documents: {
    proposalsCreated: number;
    contractsSigned: number;
    requiringAttention: number;
  };

  finance: {
    invoicesCreated: number;
    invoicesSent: number;
    paymentsReceived: number;
    overdueInvoices: number;
    failedPayments: number;
    totalInvoicedAmount: number;
    totalReceivedAmount: number;
  };

  marketingAndSocial: {
    campaignsActive: number;
    leadsGenerated: number;
    postsPublished: number;
    failedPosts: number;
  };

  automationAndMcp: {
    totalExecuted: number;
    verified: number;
    retrying: number;
    failed: number;
    pendingApproval: number;
  };

  failures: Array<{
    id: string;
    sourceModule: string;
    title: string;
    description: string;
    actorType: string;
  }>;

  waitingOn: {
    waitingOnTeam: number;
    waitingOnClient: number;
    waitingOnApproval: number;
    waitingOnPayment: number;
  };

  executiveBrief: {
    headline: string;
    todayActionsCount: number;
    businessHighlights: string[];
    deliveryStatus: string;
    communicationStatus: string;
    financeStatus: string;
    systemsStatus: string;
    yourAttentionNeeded: string[];
    currentBottleneck: string;
    recommendedFirstAction: string;
  };
}

/**
 * Constructs a comprehensive daily operations summary and business owner executive briefing.
 */
export async function generateDailyOperationsSummary(
  tenantId: string,
  targetDateStr?: string
): Promise<DailyOperationsSummary> {
  const supabase = createSupabaseAdminClient();
  const dateObj = targetDateStr ? new Date(targetDateStr) : new Date();
  const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0).toISOString();
  const endOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59).toISOString();

  // 1. Fetch Today's Operational Events
  const { data: events } = await supabase
    .from('tenant_operational_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('occurred_at', startOfDay)
    .lte('occurred_at', endOfDay);

  const opEvents = events || [];

  // Helper counting function
  const countModuleActions = (mod: string, actionPattern?: string, status?: string) => {
    return opEvents.filter((e) => {
      if (e.source_module !== mod) return false;
      if (actionPattern && !e.action.toLowerCase().includes(actionPattern.toLowerCase())) return false;
      if (status && e.status !== status) return false;
      return true;
    }).length;
  };

  // 2. Fetch Core Module Metrics
  const [
    { count: newLeadsCount },
    { count: newClientsCount },
    { count: newOppsCount },
    { count: atRiskProjectsCount },
    { count: blockedProjectsCount },
    { count: overdueInvoicesCount },
    { count: breachedSlasCount },
  ] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', startOfDay),
    supabase.from('business_clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', startOfDay),
    supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', startOfDay),
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'at_risk'),
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'blocked'),
    supabase.from('business_invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'overdue'),
    supabase.from('communication_slas').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('sla_breached', true),
  ]);

  // Failures list
  const failures = opEvents
    .filter((e) => e.status === 'FAILED' || e.status === 'BLOCKED')
    .map((e) => ({
      id: e.id,
      sourceModule: e.source_module,
      title: e.title,
      description: e.description || e.action,
      actorType: e.actor_type,
    }));

  const mcpTotal = countModuleActions('MCP');
  const mcpFailed = countModuleActions('MCP', undefined, 'FAILED');
  const mcpVerified = mcpTotal - mcpFailed;

  const proposalsSent = countModuleActions('PROPOSALS', 'sent') + countModuleActions('SALES', 'proposal_sent');
  const proposalsAccepted = countModuleActions('PROPOSALS', 'accepted') + countModuleActions('SALES', 'proposal_accepted');

  const emailsReceived = countModuleActions('EMAIL', 'received');
  const emailsSent = countModuleActions('EMAIL', 'sent');

  const summary: DailyOperationsSummary = {
    tenantId,
    date: startOfDay.slice(0, 10),
    generatedAt: new Date().toISOString(),

    newBusiness: {
      newLeads: newLeadsCount || countModuleActions('LEADS', 'created'),
      qualifiedLeads: countModuleActions('LEADS', 'qualified'),
      newOpportunities: newOppsCount || countModuleActions('SALES', 'opportunity_created'),
      newClients: newClientsCount || countModuleActions('CRM', 'client_created'),
    },

    sales: {
      proposalsSent,
      proposalsAccepted,
      proposalsRejected: countModuleActions('PROPOSALS', 'rejected'),
      dealsWon: countModuleActions('SALES', 'won'),
      dealsLost: countModuleActions('SALES', 'lost'),
    },

    clientActivity: {
      clientMessages: emailsReceived,
      clientMeetings: countModuleActions('MEETINGS', 'completed'),
      decisionsMade: countModuleActions('MEETINGS', 'decision'),
      commitmentsActive: countModuleActions('MEETINGS', 'commitment'),
    },

    projects: {
      created: countModuleActions('PROJECTS', 'created'),
      milestonesCompleted: countModuleActions('PROJECTS', 'milestone'),
      atRisk: atRiskProjectsCount || countModuleActions('PROJECTS', undefined, 'BLOCKED'),
      blocked: blockedProjectsCount || 0,
      failed: countModuleActions('PROJECTS', undefined, 'FAILED'),
    },

    communication: {
      emailsReceived,
      emailsSent,
      responses: countModuleActions('EMAIL', 'responded'),
      awaitingReply: countModuleActions('EMAIL', 'no_reply'),
      noRepliesDetected: countModuleActions('EMAIL', 'NO_REPLY_DETECTED'),
      slaRisks: breachedSlasCount || countModuleActions('EMAIL', 'SLA'),
    },

    meetings: {
      completed: countModuleActions('MEETINGS', 'completed'),
      decisions: countModuleActions('MEETINGS', 'decision'),
      actionsGenerated: countModuleActions('TASKS', 'created_from_meeting'),
    },

    documents: {
      proposalsCreated: countModuleActions('PROPOSALS', 'created'),
      contractsSigned: countModuleActions('CONTRACTS', 'signed'),
      requiringAttention: countModuleActions('DOCUMENTS', 'review'),
    },

    finance: {
      invoicesCreated: countModuleActions('INVOICES', 'created'),
      invoicesSent: countModuleActions('INVOICES', 'sent'),
      paymentsReceived: countModuleActions('PAYMENTS', 'received'),
      overdueInvoices: overdueInvoicesCount || 0,
      failedPayments: countModuleActions('PAYMENTS', undefined, 'FAILED'),
      totalInvoicedAmount: 0,
      totalReceivedAmount: 0,
    },

    marketingAndSocial: {
      campaignsActive: countModuleActions('MARKETING', 'launched'),
      leadsGenerated: countModuleActions('MARKETING', 'lead'),
      postsPublished: countModuleActions('SOCIAL', 'published'),
      failedPosts: countModuleActions('SOCIAL', undefined, 'FAILED'),
    },

    automationAndMcp: {
      totalExecuted: mcpTotal + countModuleActions('AUTOMATION'),
      verified: mcpVerified,
      retrying: countModuleActions('MCP', undefined, 'PARTIAL'),
      failed: mcpFailed,
      pendingApproval: countModuleActions('AUTOMATION', 'approval'),
    },

    failures,

    waitingOn: {
      waitingOnTeam: countModuleActions('TASKS', undefined, 'BLOCKED'),
      waitingOnClient: countModuleActions('EMAIL', 'no_reply'),
      waitingOnApproval: countModuleActions('AUTOMATION', 'approval'),
      waitingOnPayment: overdueInvoicesCount || 0,
    },

    executiveBrief: {
      headline: `${opEvents.length} meaningful business actions executed today.`,
      todayActionsCount: opEvents.length,
      businessHighlights: [
        `${newLeadsCount || 0} new leads acquired`,
        `${newClientsCount || 0} new clients onboarded`,
        `${proposalsSent} proposals sent, ${proposalsAccepted} accepted`,
      ],
      deliveryStatus: atRiskProjectsCount
        ? `${atRiskProjectsCount} projects require risk mitigation`
        : 'All active projects healthy',
      communicationStatus: breachedSlasCount
        ? `${breachedSlasCount} communications breached SLA`
        : 'All communication response SLAs on track',
      financeStatus: overdueInvoicesCount
        ? `${overdueInvoicesCount} invoices overdue follow-up`
        : 'Financial ledger reconciled',
      systemsStatus: `${mcpTotal} MCP / automated executions (${mcpVerified} verified, ${mcpFailed} failures requiring attention)`,
      yourAttentionNeeded: [
        ...(breachedSlasCount ? [`Resolve ${breachedSlasCount} client SLA breaches`] : []),
        ...(overdueInvoicesCount ? [`Follow up on ${overdueInvoicesCount} overdue invoices`] : []),
        ...(mcpFailed ? [`Review ${mcpFailed} failed MCP automated actions`] : []),
      ].slice(0, 3),
      currentBottleneck: atRiskProjectsCount
        ? 'Client approvals/assets delaying active deliverables'
        : 'No critical bottlenecks identified',
      recommendedFirstAction: breachedSlasCount
        ? 'Respond immediately to SLA breached client emails'
        : 'Review top 3 pending proposals for client sign-off',
    },
  };

  return summary;
}

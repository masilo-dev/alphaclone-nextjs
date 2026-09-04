import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export interface OperationsWorkRecord {
  id?: string;
  tenant_id: string;
  work_id: string;
  title: string;
  description?: string;
  objective?: string;
  owner_id?: string;
  owner_name?: string;
  contributors?: string[];
  client_id?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  status: 'REQUESTED' | 'DEFINED' | 'APPROVED' | 'IN_PROGRESS' | 'BLOCKED' | 'REVIEW' | 'VERIFIED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'DEFERRED' | 'KILLED';
  start_date?: string;
  target_date?: string;
  created_by?: string;
  last_activity?: string;
  dependencies?: any[];
  risks?: any[];
  related_project_id?: string;
  related_contact_id?: string;
  related_documents?: any[];
  related_emails?: any[];
  related_meetings?: any[];
  related_invoices?: any[];
  related_decisions?: any[];
  evidence?: any[];
  completion_criteria?: string;
  final_result?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DecisionRecord {
  id?: string;
  tenant_id: string;
  decision_title: string;
  context: string;
  objective: string;
  decision_owner_id?: string;
  decision_owner_name?: string;
  decision_date?: string;
  alternatives_considered?: string[];
  evidence?: string;
  evidence_label: 'MEASURED' | 'ESTIMATED' | 'PREDICTED' | 'UNKNOWN';
  probability_of_success?: number;
  cost_amount?: number;
  opportunity_cost?: string;
  complexity_impact?: string;
  reversibility?: 'reversible' | 'partially_reversible' | 'irreversible';
  risks?: string[];
  expected_result?: string;
  review_date?: string;
  actual_result?: string;
  learning?: string;
  status?: 'proposed' | 'approved' | 'executed' | 'reviewed' | 'rejected';
}

export interface AlamosEvaluation {
  id?: string;
  tenant_id: string;
  decision_id?: string;
  project_id?: string;
  work_record_id?: string;
  title: string;
  alamos_01_outcome_metric: string;
  alamos_02_zero_multiplier: string;
  alamos_03_success_probability: number;
  alamos_04_cost_and_tradeoffs: string;
  alamos_05_potential_failure_modes: string;
  alamos_06_verification_method: string;
  alamos_07_post_evidence_plan: string;
  resulting_action: 'BUILD' | 'FIX' | 'SCALE' | 'KEEP' | 'SIMPLIFY' | 'TEST' | 'DEFER' | 'AUTOMATE' | 'REMOVE' | 'KILL';
  is_mandatory_gate?: boolean;
  gate_approved?: boolean;
  approved_by?: string;
}

export interface FailureRecord {
  id?: string;
  tenant_id: string;
  category: 'automation' | 'api' | 'agent' | 'email' | 'payment' | 'deployment' | 'deliverable' | 'deadline' | 'integration' | 'campaign' | 'other';
  title: string;
  expected_result: string;
  actual_result: string;
  failure_time?: string;
  failure_owner_id?: string;
  failure_owner_name?: string;
  business_impact: string;
  root_cause?: string;
  evidence?: string;
  incorrect_assumptions?: string[];
  recovery_action?: string;
  permanent_corrective_action?: string;
  reusable_learning?: string;
  status?: 'NEW' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED' | 'RECURRING';
}

export interface CommunicationSLA {
  id?: string;
  tenant_id: string;
  source_type: 'email' | 'chat' | 'form' | 'whatsapp' | 'phone' | 'meeting';
  source_id?: string;
  client_id?: string;
  contact_email?: string;
  subject?: string;
  received_at?: string;
  assigned_owner_id?: string;
  response_deadline_at?: string;
  status: 'NEW' | 'ASSIGNED' | 'ACKNOWLEDGED' | 'RESPONDED' | 'WAITING_ON_CLIENT' | 'ESCALATED' | 'CLOSED';
  actual_response_at?: string;
  response_time_minutes?: number;
  sla_breached?: boolean;
}

export interface OperationalBlocker {
  id?: string;
  tenant_id: string;
  work_record_id?: string;
  task_id?: string;
  project_id?: string;
  title: string;
  blocker_cause: string;
  owner_id?: string;
  owner_name?: string;
  required_action: string;
  dependency_id?: string;
  business_impact: string;
  escalation_date?: string;
  status?: 'ACTIVE' | 'RESOLVED' | 'ESCALATED';
}

export class OperationsService {
  /**
   * Executive Today HUD — Aggregates all urgent items requiring immediate owner attention
   */
  static async getTodayHUD(tenantId: string) {
    const admin = createSupabaseAdminClient();
    const nowISO = new Date().toISOString();

    const [
      tasksDue,
      overdueTasks,
      pendingSlas,
      pendingApprovals,
      activeBlockers,
      recentFailures,
      upcomingMeetings,
      overdueInvoices,
    ] = await Promise.all([
      admin.from('tasks').select('*').eq('tenant_id', tenantId).neq('status', 'completed').lte('due_date', nowISO).order('due_date', { ascending: true }),
      admin.from('tasks').select('*').eq('tenant_id', tenantId).neq('status', 'completed').lt('due_date', nowISO),
      admin.from('communication_slas').select('*').eq('tenant_id', tenantId).in('status', ['NEW', 'ASSIGNED', 'ACKNOWLEDGED']).order('response_deadline_at', { ascending: true }),
      admin.from('human_approvals').select('*').eq('tenant_id', tenantId).eq('status', 'pending'),
      admin.from('operational_blockers').select('*').eq('tenant_id', tenantId).eq('status', 'ACTIVE'),
      admin.from('failure_records').select('*').eq('tenant_id', tenantId).in('status', ['NEW', 'INVESTIGATING', 'RECURRING']).order('failure_time', { ascending: false }).limit(5),
      admin.from('meeting_briefs').select('*').eq('tenant_id', tenantId).gte('created_at', nowISO).limit(5),
      admin.from('business_invoices').select('*').eq('tenant_id', tenantId).eq('status', 'overdue'),
    ]);

    const tasksDueCount = (tasksDue.data || []).length;
    const overdueCount = (overdueTasks.data || []).length;
    const slaCount = (pendingSlas.data || []).length;
    const slaApproachingBreach = (pendingSlas.data || []).filter((s: any) => {
      const diffMs = new Date(s.response_deadline_at).getTime() - Date.now();
      return diffMs > 0 && diffMs < 4 * 3600 * 1000; // < 4h
    }).length;
    const approvalCount = (pendingApprovals.data || []).length;
    const blockerCount = (activeBlockers.data || []).length;
    const failureCount = (recentFailures.data || []).length;
    const invoiceOverdueCount = (overdueInvoices.data || []).length;

    return {
      todayStats: {
        tasksDue: tasksDueCount,
        overdueTasks: overdueCount,
        pendingSlas: slaCount,
        slaApproachingBreach,
        pendingApprovals: approvalCount,
        activeBlockers: blockerCount,
        recentFailures: failureCount,
        overdueInvoices: invoiceOverdueCount,
      },
      tasksDueToday: tasksDue.data || [],
      overdueTasks: overdueTasks.data || [],
      slaItems: pendingSlas.data || [],
      approvals: pendingApprovals.data || [],
      blockers: activeBlockers.data || [],
      failures: recentFailures.data || [],
      meetings: upcomingMeetings.data || [],
      overdueInvoices: overdueInvoices.data || [],
    };
  }

  /**
   * Executive Business Health Overview
   */
  static async getBusinessHealth(tenantId: string) {
    const admin = createSupabaseAdminClient();
    const {
      countOpenTasks,
      countActiveProjects,
    } = await import('@/lib/crm/canonicalWorkspaceStats');

    const [
      openTasksCount,
      activeProjectsCount,
      blockedTasksRes,
      decisionsRes,
      slasRes,
      invoicesRes,
      failuresRes,
      blockersRes,
      projectsRes,
    ] = await Promise.all([
      countOpenTasks(admin, tenantId),
      countActiveProjects(admin, tenantId),
      admin.from('tasks').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'blocked'),
      admin.from('decision_records').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'proposed'),
      admin.from('communication_slas').select('*').eq('tenant_id', tenantId),
      admin.from('business_invoices').select('total_amount, status').eq('tenant_id', tenantId),
      admin.from('failure_records').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      admin.from('operational_blockers').select('*').eq('tenant_id', tenantId).eq('status', 'ACTIVE'),
      admin.from('projects').select('id, status, client_sla_status').eq('tenant_id', tenantId),
    ]);

    const projects = projectsRes.data || [];
    const projectsAtRisk = projects.filter((p: { status?: string; client_sla_status?: string }) =>
      p.status === 'at_risk' || p.client_sla_status === 'breached',
    ).length;
    const slas = slasRes.data || [];
    const totalSlas = slas.length;
    const breachedSlas = slas.filter((s: { sla_breached?: boolean; response_deadline_at?: string; status?: string }) =>
      s.sla_breached || (new Date(s.response_deadline_at || 0).getTime() < Date.now() && s.status !== 'CLOSED' && s.status !== 'RESPONDED'),
    ).length;
    const slaCompliancePct = totalSlas > 0 ? Math.round(((totalSlas - breachedSlas) / totalSlas) * 100) : 100;

    const invoices = invoicesRes.data || [];
    const outstandingInvoices = invoices.filter((i: { status?: string }) => i.status === 'sent' || i.status === 'overdue');
    const outstandingRevenue = outstandingInvoices.reduce(
      (acc: number, curr: { total_amount?: number }) => acc + (Number(curr.total_amount) || 0),
      0,
    );

    const blockers = blockersRes.data || [];
    const failuresCount = failuresRes.count || 0;

    let primaryBottleneck = 'None detected';
    if (blockers.length > 3) {
      primaryBottleneck = `${blockers.length} active work blockers slowing project execution`;
    } else if (breachedSlas > 0) {
      primaryBottleneck = `${breachedSlas} client communications breaching 24h response SLA`;
    } else if (outstandingInvoices.length > 5) {
      primaryBottleneck = `${outstandingInvoices.length} outstanding invoices awaiting collection`;
    } else if (failuresCount > 2) {
      primaryBottleneck = `${failuresCount} operational/automation failures logged`;
    }

    return {
      activeProjectsCount,
      projectsAtRiskCount: projectsAtRisk,
      openTasksCount,
      blockedTasksCount: blockedTasksRes.count || 0,
      failedTasksCount: failuresCount,
      pendingDecisionsCount: decisionsRes.count || 0,
      slaCompliancePct,
      outstandingRevenue,
      primaryBottleneck,
      stats_source: 'canonical_workspace_stats',
      recentFailures: [],
      activeBlockers: blockers.slice(0, 5),
    };
  }

  /**
   * Work Records CRUD
   */
  static async getUniversalWorkRecords(tenantId: string, status?: string) {
    const admin = createSupabaseAdminClient();
    let query = admin.from('operations_work_records').select('*').eq('tenant_id', tenantId);
    if (status) query = query.eq('status', status);
    const { data, error } = await query.order('last_activity', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createWorkRecord(payload: OperationsWorkRecord) {
    const admin = createSupabaseAdminClient();
    const workId = payload.work_id || `WR-${Math.floor(100000 + Math.random() * 900000)}`;
    const { data, error } = await admin
      .from('operations_work_records')
      .insert({ ...payload, work_id: workId, last_activity: new Date().toISOString() })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  static async updateWorkRecordStatus(tenantId: string, id: string, status: string, finalResult?: string) {
    const admin = createSupabaseAdminClient();
    const updatePayload: any = {
      status,
      last_activity: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (finalResult) updatePayload.final_result = finalResult;

    const { data, error } = await admin
      .from('operations_work_records')
      .update(updatePayload)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Decision Records & ALAMOS
   */
  static async getDecisionRecords(tenantId: string) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('decision_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('decision_date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createDecisionRecord(payload: DecisionRecord) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('decision_records')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  static async evaluateALAMOS(payload: AlamosEvaluation) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('alamos_evaluations')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  static async getAlamosEvaluations(tenantId: string) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('alamos_evaluations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  /**
   * Failure Records
   */
  static async getFailureRecords(tenantId: string) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('failure_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('failure_time', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createFailureRecord(payload: FailureRecord) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('failure_records')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Communication SLAs (24h standard)
   */
  static async getCommunicationSLAs(tenantId: string) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('communication_slas')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('response_deadline_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async createCommunicationSLA(payload: CommunicationSLA) {
    const admin = createSupabaseAdminClient();
    const deadline = payload.response_deadline_at || new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const { data, error } = await admin
      .from('communication_slas')
      .insert({ ...payload, response_deadline_at: deadline })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  static async updateSLAStatus(tenantId: string, id: string, status: CommunicationSLA['status']) {
    const admin = createSupabaseAdminClient();
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'RESPONDED' || status === 'CLOSED') {
      updateData.actual_response_at = new Date().toISOString();
    }
    const { data, error } = await admin
      .from('communication_slas')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Blockers
   */
  static async getBlockers(tenantId: string) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('operational_blockers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createBlocker(payload: OperationalBlocker) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('operational_blockers')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  static async resolveBlocker(tenantId: string, id: string, resolutionNotes: string) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('operational_blockers')
      .update({
        status: 'RESOLVED',
        resolved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Natural Language "Ask Bonnie" Operational Query Engine
   */
  static async askBonnieOperations(tenantId: string, userQuery: string) {
    const [hud, health, decisions, failures, blockers] = await Promise.all([
      this.getTodayHUD(tenantId),
      this.getBusinessHealth(tenantId),
      this.getDecisionRecords(tenantId),
      this.getFailureRecords(tenantId),
      this.getBlockers(tenantId),
    ]);

    const queryLower = userQuery.toLowerCase();

    if (queryLower.includes('attention') || queryLower.includes('today')) {
      return {
        answer: `Today AlphaClone has ${hud.todayStats.tasksDue} priority tasks due, ${hud.todayStats.overdueTasks} overdue tasks, ${hud.todayStats.pendingSlas} unanswered client messages, ${hud.todayStats.pendingApprovals} decisions awaiting approval, ${hud.todayStats.activeBlockers} active blocked tasks, and ${hud.todayStats.recentFailures} recent failures.`,
        evidenceQuality: 'MEASURED',
        details: hud.todayStats,
        recommendation: hud.todayStats.pendingApprovals > 0 ? 'Review pending approvals first.' : hud.todayStats.pendingSlas > 0 ? 'Respond to client messages approaching 24h SLA.' : 'Focus on tasks due today.',
      };
    }

    if (queryLower.includes('bottleneck') || queryLower.includes('constraint')) {
      return {
        answer: `The highest operational constraint currently identified is: "${health.primaryBottleneck}".`,
        evidenceQuality: 'MEASURED',
        details: { primaryBottleneck: health.primaryBottleneck, blockersCount: health.activeBlockers.length },
        recommendation: 'Resolve active blockers to restore project velocity.',
      };
    }

    if (queryLower.includes('fail') || queryLower.includes('error')) {
      return {
        answer: `There are ${failures.length} recorded operational failures. Key recent issues include: ${failures.slice(0, 3).map((f: any) => f.title).join(', ') || 'None'}.`,
        evidenceQuality: 'MEASURED',
        details: failures.slice(0, 5),
        recommendation: 'Review failure root causes and permanent corrective actions.',
      };
    }

    if (queryLower.includes('decision')) {
      return {
        answer: `There are ${decisions.length} decision records documented. ${decisions.filter((d: any) => d.status === 'proposed').length} are currently awaiting review.`,
        evidenceQuality: 'MEASURED',
        details: decisions.slice(0, 5),
        recommendation: 'Apply the ALAMOS 01-07 decision framework before approving high-impact changes.',
      };
    }

    return {
      answer: `AlphaClone Operations Status: ${health.activeProjectsCount} active projects, ${health.openTasksCount} open tasks (${health.blockedTasksCount} blocked), ${health.slaCompliancePct}% 24h SLA compliance, and $${health.outstandingRevenue.toLocaleString()} in outstanding A/R.`,
      evidenceQuality: 'MEASURED',
      details: health,
      recommendation: 'Check the Operations Command Center for full action items.',
    };
  }
}

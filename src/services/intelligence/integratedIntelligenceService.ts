import type { SupabaseClient } from '@supabase/supabase-js';
import { intelligenceScoringService } from './intelligenceScoringService';

type ModuleName =
  | 'crm'
  | 'invoicingRevenue'
  | 'emailInbox'
  | 'taskManagement'
  | 'socialMedia'
  | 'aiProposals'
  | 'analyticsDashboard'
  | 'teamCollaboration'
  | 'automationWorkflows'
  | 'customerSuccess';

export interface ModuleAssessment {
  module: ModuleName;
  score: number;
  confidence: number;
  probabilityState: Record<string, number>;
  risks: string[];
  recommendations: string[];
  signals: Record<string, number>;
}

export interface IntegratedIntelligenceSnapshot {
  tenantId: string;
  generatedAt: string;
  overallScore: number;
  overallConfidence: number;
  modules: ModuleAssessment[];
  topActions: string[];
  systemicRisks: string[];
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const round2 = (value: number): number => Math.round(value * 100) / 100;

class IntegratedIntelligenceService {
  private isMissingTableError(error: unknown): boolean {
    const code = (error as { code?: string })?.code;
    return code === '42P01' || code === 'PGRST205' || code === '42703';
  }

  private async safeCount(supabase: SupabaseClient, table: string, tenantId: string): Promise<number> {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (error) {
      if (this.isMissingTableError(error)) return 0;
      throw error;
    }
    return count || 0;
  }

  private async safeRows(
    supabase: SupabaseClient,
    table: string,
    columns: string,
    tenantId: string,
    limit = 200
  ): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq('tenant_id', tenantId)
      .limit(limit);

    if (error) {
      if (this.isMissingTableError(error)) return [];
      throw error;
    }
    if (!Array.isArray(data)) return [];
    return data as unknown as Record<string, unknown>[];
  }

  private summarizeTopActions(modules: ModuleAssessment[]): string[] {
    return modules
      .flatMap((moduleAssessment) =>
        moduleAssessment.recommendations.map((recommendation) => ({
          recommendation,
          module: moduleAssessment.module,
          score: moduleAssessment.score
        }))
      )
      .sort((a, b) => a.score - b.score)
      .slice(0, 7)
      .map((entry) => `[${entry.module}] ${entry.recommendation}`);
  }

  private summarizeSystemicRisks(modules: ModuleAssessment[]): string[] {
    return modules
      .flatMap((moduleAssessment) =>
        moduleAssessment.risks.map((risk) => ({
          risk,
          score: moduleAssessment.score
        }))
      )
      .sort((a, b) => a.score - b.score)
      .slice(0, 7)
      .map((entry) => entry.risk);
  }

  private buildProbabilityState(primaryScore: number, confidence: number): Record<string, number> {
    const success = clamp(primaryScore / 100, 0.01, 0.99);
    const delay = clamp((1 - success) * (1 - confidence), 0.01, 0.9);
    const risk = clamp(1 - success - delay, 0.01, 0.9);
    return {
      success: round2(success),
      delay: round2(delay),
      risk: round2(risk)
    };
  }

  private async assessCrm(supabase: SupabaseClient, tenantId: string): Promise<ModuleAssessment> {
    const leads = await this.safeRows(
      supabase,
      'leads',
      'id, email, phone, website, industry, stage, intelligence_score, created_at',
      tenantId,
      400
    );
    const deals = await this.safeRows(
      supabase,
      'deals',
      'id, probability, value, stage, intelligence_score, updated_at',
      tenantId,
      300
    );

    const leadCount = leads.length;
    const dealCount = deals.length;
    const avgLeadScore =
      leadCount > 0
        ? leads.reduce((sum, lead) => sum + Number(lead.intelligence_score || 0), 0) / leadCount
        : 0;
    const avgDealProbability =
      dealCount > 0 ? deals.reduce((sum, deal) => sum + Number(deal.probability || 0), 0) / dealCount : 0;

    const score = round2(clamp(avgLeadScore * 0.45 + avgDealProbability * 0.55, 0, 100));
    const confidence = round2(clamp(0.42 + Math.min(leadCount + dealCount, 180) / 300, 0.3, 0.95));
    const risks: string[] = [];
    const recommendations: string[] = [];

    if (leadCount < 20) risks.push('CRM lead volume is low for stable funnel predictions.');
    if (avgDealProbability < 45) risks.push('Average deal close probability is under target threshold.');
    if (score < 55) recommendations.push('Increase high-intent lead qualification before pipeline expansion.');
    if (avgLeadScore < 55) recommendations.push('Improve lead enrichment and contactability coverage.');
    if (avgDealProbability < 60) recommendations.push('Prioritize decision-maker engagement on active deals.');

    return {
      module: 'crm',
      score,
      confidence,
      probabilityState: this.buildProbabilityState(score, confidence),
      risks,
      recommendations,
      signals: {
        leadCount,
        dealCount,
        avgLeadScore: round2(avgLeadScore),
        avgDealProbability: round2(avgDealProbability)
      }
    };
  }

  private async assessInvoicingRevenue(supabase: SupabaseClient, tenantId: string): Promise<ModuleAssessment> {
    const invoices = await this.safeRows(
      supabase,
      'invoices',
      'id, amount, total_amount, status, due_date, created_at',
      tenantId,
      500
    );
    const businessInvoices = await this.safeRows(
      supabase,
      'business_invoices',
      'id, total, status, due_date, created_at',
      tenantId,
      500
    );

    const normalized = [
      ...invoices.map((row) => ({
        amount: Number(row.total_amount || row.amount || 0),
        status: String(row.status || '').toLowerCase(),
        dueDate: row.due_date ? new Date(String(row.due_date)) : null
      })),
      ...businessInvoices.map((row) => ({
        amount: Number(row.total || 0),
        status: String(row.status || '').toLowerCase(),
        dueDate: row.due_date ? new Date(String(row.due_date)) : null
      }))
    ];

    const now = new Date();
    const paid = normalized.filter((row) => row.status === 'paid');
    const overdue = normalized.filter((row) => row.status !== 'paid' && row.dueDate && row.dueDate < now);
    const totalAmount = normalized.reduce((sum, row) => sum + row.amount, 0);
    const paidAmount = paid.reduce((sum, row) => sum + row.amount, 0);
    const collectionRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

    const score = round2(clamp(collectionRate * 0.8 + (normalized.length > 0 ? 20 : 0) - overdue.length * 1.2, 0, 100));
    const confidence = round2(clamp(0.4 + Math.min(normalized.length, 160) / 320, 0.3, 0.95));
    const risks: string[] = [];
    const recommendations: string[] = [];

    if (overdue.length > 0) risks.push(`Revenue aging risk detected with ${overdue.length} overdue invoices.`);
    if (collectionRate < 70) risks.push('Invoice collection rate is below healthy operating range.');
    if (collectionRate < 85) recommendations.push('Activate staged reminder flows for unpaid invoices.');
    if (overdue.length > 5) recommendations.push('Escalate overdue accounts to structured recovery workflow.');

    return {
      module: 'invoicingRevenue',
      score,
      confidence,
      probabilityState: this.buildProbabilityState(score, confidence),
      risks,
      recommendations,
      signals: {
        invoiceCount: normalized.length,
        paidCount: paid.length,
        overdueCount: overdue.length,
        collectionRate: round2(collectionRate)
      }
    };
  }

  private async assessEmailInbox(supabase: SupabaseClient, tenantId: string): Promise<ModuleAssessment> {
    const campaigns = await this.safeRows(
      supabase,
      'email_campaigns',
      'id, total_sent, total_opened, total_clicked, total_bounced, status, created_at',
      tenantId,
      300
    );
    const sent = campaigns.reduce((sum, row) => sum + Number(row.total_sent || 0), 0);
    const opened = campaigns.reduce((sum, row) => sum + Number(row.total_opened || 0), 0);
    const clicked = campaigns.reduce((sum, row) => sum + Number(row.total_clicked || 0), 0);
    const bounced = campaigns.reduce((sum, row) => sum + Number(row.total_bounced || 0), 0);
    const openRate = sent > 0 ? (opened / sent) * 100 : 0;
    const clickRate = sent > 0 ? (clicked / sent) * 100 : 0;
    const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0;

    const score = round2(clamp(openRate * 0.5 + clickRate * 1.8 + (100 - bounceRate * 2) * 0.25, 0, 100));
    const confidence = round2(clamp(0.38 + Math.min(campaigns.length, 120) / 260, 0.3, 0.95));
    const risks: string[] = [];
    const recommendations: string[] = [];

    if (openRate < 25) risks.push('Email open rate is low and suppresses outbound conversion flow.');
    if (bounceRate > 5) risks.push('Bounce rate exceeds recommended quality threshold.');
    if (openRate < 35) recommendations.push('Re-optimize send-time and subject-line strategy by segment.');
    if (clickRate < 3) recommendations.push('Refine call-to-action clarity and body personalization depth.');

    return {
      module: 'emailInbox',
      score,
      confidence,
      probabilityState: this.buildProbabilityState(score, confidence),
      risks,
      recommendations,
      signals: {
        campaignCount: campaigns.length,
        sent,
        openRate: round2(openRate),
        clickRate: round2(clickRate),
        bounceRate: round2(bounceRate)
      }
    };
  }

  private async assessTaskManagement(supabase: SupabaseClient, tenantId: string): Promise<ModuleAssessment> {
    const tasks = await this.safeRows(supabase, 'tasks', 'id, status, priority, due_date, created_at', tenantId, 600);
    const now = new Date();
    const completed = tasks.filter((row) => String(row.status) === 'completed').length;
    const overdue = tasks.filter((row) => {
      const status = String(row.status || '');
      const due = row.due_date ? new Date(String(row.due_date)) : null;
      return status !== 'completed' && status !== 'cancelled' && due && due < now;
    }).length;
    const active = tasks.filter((row) => {
      const status = String(row.status || '');
      return status === 'todo' || status === 'in_progress' || status === 'review';
    }).length;
    const completionRate = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;

    const score = round2(clamp(completionRate * 0.7 + (100 - overdue * 3) * 0.3, 0, 100));
    const confidence = round2(clamp(0.35 + Math.min(tasks.length, 220) / 420, 0.3, 0.95));
    const risks: string[] = [];
    const recommendations: string[] = [];

    if (overdue > 0) risks.push(`Task backlog has ${overdue} overdue items.`);
    if (completionRate < 45) risks.push('Task completion performance is below execution target.');
    if (overdue > 10) recommendations.push('Apply strict weekly backlog burn-down on overdue tasks.');
    if (completionRate < 60) recommendations.push('Reframe vague tasks into specific outcome-based tasks.');

    return {
      module: 'taskManagement',
      score,
      confidence,
      probabilityState: this.buildProbabilityState(score, confidence),
      risks,
      recommendations,
      signals: {
        totalTasks: tasks.length,
        activeTasks: active,
        overdueTasks: overdue,
        completionRate: round2(completionRate)
      }
    };
  }

  private async assessSocialMedia(supabase: SupabaseClient, tenantId: string): Promise<ModuleAssessment> {
    const posts = await this.safeRows(
      supabase,
      'social_posts',
      'id, status, likes_count, comments_count, shares_count, created_at',
      tenantId,
      500
    );
    const published = posts.filter((row) => String(row.status || '').toLowerCase() === 'published');
    const avgLikes = published.length
      ? published.reduce((sum, row) => sum + Number(row.likes_count || 0), 0) / published.length
      : 0;
    const avgComments = published.length
      ? published.reduce((sum, row) => sum + Number(row.comments_count || 0), 0) / published.length
      : 0;
    const avgShares = published.length
      ? published.reduce((sum, row) => sum + Number(row.shares_count || 0), 0) / published.length
      : 0;

    const engagementScore = clamp(avgLikes * 0.7 + avgComments * 4 + avgShares * 6, 0, 100);
    const score = round2(engagementScore);
    const confidence = round2(clamp(0.32 + Math.min(published.length, 120) / 280, 0.3, 0.95));
    const risks: string[] = [];
    const recommendations: string[] = [];

    if (published.length < 8) risks.push('Social publishing volume is too low for stable reach compounding.');
    if (avgComments < 2) risks.push('Conversation depth is weak; network effect is constrained.');
    if (published.length < 12) recommendations.push('Increase consistent publishing cadence on highest-yield channels.');
    if (avgShares < 1) recommendations.push('Shift toward data-backed insight posts with explicit discussion prompts.');

    return {
      module: 'socialMedia',
      score,
      confidence,
      probabilityState: this.buildProbabilityState(score, confidence),
      risks,
      recommendations,
      signals: {
        totalPosts: posts.length,
        publishedPosts: published.length,
        avgLikes: round2(avgLikes),
        avgComments: round2(avgComments),
        avgShares: round2(avgShares)
      }
    };
  }

  private async assessAiProposals(supabase: SupabaseClient, tenantId: string): Promise<ModuleAssessment> {
    const quotes = await this.safeRows(supabase, 'quotes', 'id, status, created_at, total_amount', tenantId, 300);
    const contracts = await this.safeRows(supabase, 'contracts', 'id, status, created_at', tenantId, 300);

    const quoteSent = quotes.filter((row) => String(row.status || '').toLowerCase().includes('sent')).length;
    const quoteAccepted = quotes.filter((row) => String(row.status || '').toLowerCase().includes('accept')).length;
    const contractSigned = contracts.filter((row) => String(row.status || '').toLowerCase().includes('sign')).length;
    const acceptanceRate = quoteSent > 0 ? (quoteAccepted / quoteSent) * 100 : 0;
    const contractRate = quoteAccepted > 0 ? (contractSigned / quoteAccepted) * 100 : 0;

    const score = round2(clamp(acceptanceRate * 0.65 + contractRate * 0.35, 0, 100));
    const confidence = round2(clamp(0.3 + Math.min(quotes.length + contracts.length, 140) / 300, 0.28, 0.95));
    const risks: string[] = [];
    const recommendations: string[] = [];

    if (quoteSent > 0 && acceptanceRate < 40) risks.push('Proposal acceptance performance is below target.');
    if (quoteAccepted > 0 && contractRate < 60) risks.push('Post-acceptance conversion to signature is slow.');
    if (acceptanceRate < 55) recommendations.push('Increase proposal personalization and risk-first framing depth.');
    if (contractRate < 75) recommendations.push('Tighten negotiation response SLAs and stakeholder alignment sequence.');

    return {
      module: 'aiProposals',
      score,
      confidence,
      probabilityState: this.buildProbabilityState(score, confidence),
      risks,
      recommendations,
      signals: {
        quotes: quotes.length,
        contracts: contracts.length,
        acceptanceRate: round2(acceptanceRate),
        contractRate: round2(contractRate)
      }
    };
  }

  private async assessAnalyticsDashboard(supabase: SupabaseClient, tenantId: string): Promise<ModuleAssessment> {
    const leadsCount = await this.safeCount(supabase, 'leads', tenantId);
    const dealsCount = await this.safeCount(supabase, 'deals', tenantId);
    const tasksCount = await this.safeCount(supabase, 'tasks', tenantId);
    const campaignsCount = await this.safeCount(supabase, 'email_campaigns', tenantId);
    const hasCoverage = [leadsCount, dealsCount, tasksCount, campaignsCount].filter((value) => value > 0).length;

    const score = round2(clamp((hasCoverage / 4) * 100, 0, 100));
    const confidence = round2(clamp(0.35 + hasCoverage * 0.13, 0.3, 0.95));
    const risks: string[] = [];
    const recommendations: string[] = [];

    if (hasCoverage < 4) risks.push('Analytics coverage gaps reduce cross-module decision quality.');
    if (hasCoverage < 3) recommendations.push('Enable complete telemetry coverage across core operational modules.');
    if (hasCoverage >= 3) recommendations.push('Use a unified KPI cadence to align module-level operating decisions.');

    return {
      module: 'analyticsDashboard',
      score,
      confidence,
      probabilityState: this.buildProbabilityState(score, confidence),
      risks,
      recommendations,
      signals: {
        leadsCount,
        dealsCount,
        tasksCount,
        campaignsCount
      }
    };
  }

  private async assessTeamCollaboration(supabase: SupabaseClient, tenantId: string): Promise<ModuleAssessment> {
    const teamMembers = await this.safeCount(supabase, 'tenant_users', tenantId);
    const comments = await this.safeCount(supabase, 'task_comments', tenantId);
    const activities = await this.safeCount(supabase, 'lead_activities', tenantId);

    const interactionIndex = comments + activities;
    const score = round2(clamp(teamMembers > 0 ? Math.min(100, interactionIndex / teamMembers) : 0, 0, 100));
    const confidence = round2(clamp(0.28 + Math.min(interactionIndex, 250) / 400, 0.25, 0.95));
    const risks: string[] = [];
    const recommendations: string[] = [];

    if (teamMembers > 1 && interactionIndex < teamMembers * 3) {
      risks.push('Collaboration signal density is low relative to team size.');
    }
    if (teamMembers > 1 && interactionIndex < teamMembers * 5) {
      recommendations.push('Increase shared activity logging and task-level communication cadence.');
    }
    if (teamMembers <= 1) {
      recommendations.push('Collaboration module is constrained by single-user operation mode.');
    }

    return {
      module: 'teamCollaboration',
      score,
      confidence,
      probabilityState: this.buildProbabilityState(score, confidence),
      risks,
      recommendations,
      signals: {
        teamMembers,
        taskComments: comments,
        leadActivities: activities,
        interactionIndex
      }
    };
  }

  private async assessAutomationWorkflows(supabase: SupabaseClient, tenantId: string): Promise<ModuleAssessment> {
    const workflows = await this.safeRows(supabase, 'workflows', 'id, status, created_at', tenantId, 300);
    const automationRuns = await this.safeRows(
      supabase,
      'autonomous_runner_runs',
      'id, status, created_at',
      tenantId,
      500
    );

    const activeWorkflows = workflows.filter((row) => String(row.status || '').toLowerCase() === 'active').length;
    const successfulRuns = automationRuns.filter((row) => String(row.status || '').toLowerCase() === 'success').length;
    const runSuccessRate = automationRuns.length > 0 ? (successfulRuns / automationRuns.length) * 100 : 0;

    const score = round2(clamp(activeWorkflows * 10 + runSuccessRate * 0.6, 0, 100));
    const confidence = round2(clamp(0.3 + Math.min(workflows.length + automationRuns.length, 240) / 420, 0.25, 0.95));
    const risks: string[] = [];
    const recommendations: string[] = [];

    if (activeWorkflows < 2) risks.push('Automation coverage is low; manual execution load remains high.');
    if (automationRuns.length > 0 && runSuccessRate < 80) {
      risks.push('Automation execution reliability is below target threshold.');
    }
    if (activeWorkflows < 4) recommendations.push('Expand automation on repetitive CRM and follow-up flows.');
    if (runSuccessRate < 90 && automationRuns.length > 0) {
      recommendations.push('Stabilize workflow failure paths with explicit retry and alert policies.');
    }

    return {
      module: 'automationWorkflows',
      score,
      confidence,
      probabilityState: this.buildProbabilityState(score, confidence),
      risks,
      recommendations,
      signals: {
        workflows: workflows.length,
        activeWorkflows,
        automationRuns: automationRuns.length,
        runSuccessRate: round2(runSuccessRate)
      }
    };
  }

  private async assessCustomerSuccess(supabase: SupabaseClient, tenantId: string): Promise<ModuleAssessment> {
    const clients = await this.safeRows(
      supabase,
      'business_clients',
      'id, status, created_at, updated_at, monthly_value',
      tenantId,
      500
    );
    const paidInvoices = await this.safeRows(
      supabase,
      'invoices',
      'id, status, created_at, client_id',
      tenantId,
      1000
    );

    const activeClients = clients.filter((row) => String(row.status || '').toLowerCase() === 'active').length;
    const churnedClients = clients.filter((row) => String(row.status || '').toLowerCase().includes('churn')).length;
    const retentionRate = clients.length > 0 ? ((clients.length - churnedClients) / clients.length) * 100 : 0;
    const payingClients = new Set(
      paidInvoices
        .filter((row) => String(row.status || '').toLowerCase() === 'paid')
        .map((row) => String(row.client_id || ''))
        .filter((value) => value.length > 0)
    ).size;
    const expansionPotential = activeClients > 0 ? (payingClients / activeClients) * 100 : 0;

    const score = round2(clamp(retentionRate * 0.7 + expansionPotential * 0.3, 0, 100));
    const confidence = round2(clamp(0.33 + Math.min(clients.length, 200) / 350, 0.25, 0.95));
    const risks: string[] = [];
    const recommendations: string[] = [];

    if (retentionRate < 85) risks.push('Customer retention is below target resilience band.');
    if (expansionPotential < 55) risks.push('Expansion readiness is under-utilized across active clients.');
    if (retentionRate < 90) recommendations.push('Increase proactive success reviews for at-risk accounts.');
    if (expansionPotential < 70) recommendations.push('Launch structured expansion playbooks by customer maturity tier.');

    return {
      module: 'customerSuccess',
      score,
      confidence,
      probabilityState: this.buildProbabilityState(score, confidence),
      risks,
      recommendations,
      signals: {
        totalClients: clients.length,
        activeClients,
        churnedClients,
        retentionRate: round2(retentionRate),
        expansionPotential: round2(expansionPotential)
      }
    };
  }

  public async generateSnapshot(
    supabase: SupabaseClient,
    tenantId: string,
    options?: { persist?: boolean }
  ): Promise<IntegratedIntelligenceSnapshot> {
    const modules = await Promise.all([
      this.assessCrm(supabase, tenantId),
      this.assessInvoicingRevenue(supabase, tenantId),
      this.assessEmailInbox(supabase, tenantId),
      this.assessTaskManagement(supabase, tenantId),
      this.assessSocialMedia(supabase, tenantId),
      this.assessAiProposals(supabase, tenantId),
      this.assessAnalyticsDashboard(supabase, tenantId),
      this.assessTeamCollaboration(supabase, tenantId),
      this.assessAutomationWorkflows(supabase, tenantId),
      this.assessCustomerSuccess(supabase, tenantId)
    ]);

    const overallScore = round2(modules.reduce((sum, moduleRow) => sum + moduleRow.score, 0) / modules.length);
    const overallConfidence = round2(
      modules.reduce((sum, moduleRow) => sum + moduleRow.confidence, 0) / modules.length
    );

    const snapshot: IntegratedIntelligenceSnapshot = {
      tenantId,
      generatedAt: new Date().toISOString(),
      overallScore,
      overallConfidence,
      modules,
      topActions: this.summarizeTopActions(modules),
      systemicRisks: this.summarizeSystemicRisks(modules)
    };

    if (options?.persist) {
      const crmModule = modules.find((moduleRow) => moduleRow.module === 'crm');
      const crmSeed = intelligenceScoringService.scoreLead({
        industry: 'cross_module',
        email: crmModule && crmModule.score > 50 ? 'known@domain.com' : undefined,
        phone: crmModule && crmModule.score > 40 ? '+10000000000' : undefined,
        touchedPricingPage: crmModule ? crmModule.score > 65 : false,
        openedEmail: crmModule ? crmModule.score > 55 : false,
        silentDays: crmModule && crmModule.score < 45 ? 8 : 2
      });

      await supabase.from('intelligence_snapshots').insert({
        tenant_id: tenantId,
        overall_score: overallScore,
        overall_confidence: overallConfidence,
        module_scores: modules.map((moduleRow) => ({
          module: moduleRow.module,
          score: moduleRow.score,
          confidence: moduleRow.confidence
        })),
        top_actions: snapshot.topActions,
        systemic_risks: snapshot.systemicRisks,
        snapshot_payload: snapshot,
        quantum_state: crmSeed.stateDistribution
      });
    }

    return snapshot;
  }
}

export const integratedIntelligenceService = new IntegratedIntelligenceService();

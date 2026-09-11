import type { SupabaseClient } from '@supabase/supabase-js';

export interface RootCauseSignal {
  category: 'deal_regression' | 'deal_stall' | 'deal_loss' | 'activity_drop' | 'churn_risk' | 'conversion_slowdown';
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact_revenue: number;
  description: string;
  evidence: string[];
  recommended_action: string;
}

export interface RevenueRootCauseReport {
  tenant_id: string;
  generated_at: string;
  period_days: number;
  pipeline_delta: number;
  pipeline_delta_pct: number;
  forecast_delta: number;
  total_impact: number;
  signals: RootCauseSignal[];
  summary: string;
  confidence: number;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

class RevenueRootCauseService {
  /**
   * When pipeline drops or forecast misses, automatically investigate WHY.
   * Correlates across: lost deals, stalled deals, reduced activity, churn signals.
   */
  async analyze(
    supabase: SupabaseClient,
    tenantId: string,
    periodDays: number = 7
  ): Promise<RevenueRootCauseReport> {
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const priorStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const signals: RootCauseSignal[] = [];

    // 1. Detect deals that moved backward (stage regression)
    const regressions = await this.detectDealRegressions(supabase, tenantId, periodStart);
    signals.push(...regressions);

    // 2. Detect stalled deals (no activity in period)
    const stalls = await this.detectStalledDeals(supabase, tenantId, periodDays);
    signals.push(...stalls);

    // 3. Detect recent deal losses
    const losses = await this.detectRecentLosses(supabase, tenantId, periodStart);
    signals.push(...losses);

    // 4. Detect activity volume drops
    const activityDrops = await this.detectActivityDrop(supabase, tenantId, periodStart, priorStart);
    signals.push(...activityDrops);

    // 5. Detect conversion rate slowdowns
    const conversionSlowdowns = await this.detectConversionSlowdown(supabase, tenantId, periodStart, priorStart);
    signals.push(...conversionSlowdowns);

    // Sort by severity and revenue impact
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    signals.sort((a, b) => {
      const sevDiff = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
      if (sevDiff !== 0) return sevDiff;
      return Math.abs(b.impact_revenue) - Math.abs(a.impact_revenue);
    });

    // Calculate totals
    const totalImpact = signals.reduce((sum, s) => sum + s.impact_revenue, 0);
    const pipelineDelta = signals
      .filter(s => ['deal_regression', 'deal_loss', 'deal_stall'].includes(s.category))
      .reduce((sum, s) => sum + s.impact_revenue, 0);

    // Build narrative summary
    const criticalCount = signals.filter(s => s.severity === 'critical').length;
    const highCount = signals.filter(s => s.severity === 'high').length;
    const summary = this.buildNarrativeSummary(signals, totalImpact, periodDays);

    const confidence = round2(Math.min(0.95, 0.5 + signals.length * 0.03));

    return {
      tenant_id: tenantId,
      generated_at: now.toISOString(),
      period_days: periodDays,
      pipeline_delta: round2(pipelineDelta),
      pipeline_delta_pct: 0, // Would need prior period pipeline total
      forecast_delta: round2(totalImpact),
      total_impact: round2(totalImpact),
      signals: signals.slice(0, 15), // Cap at 15 signals
      summary,
      confidence
    };
  }

  private async detectDealRegressions(
    supabase: SupabaseClient,
    tenantId: string,
    since: Date
  ): Promise<RootCauseSignal[]> {
    const signals: RootCauseSignal[] = [];

    const { data: activities } = await supabase
      .from('deal_activities')
      .select('deal_id, activity_type, metadata, created_at')
      .eq('tenant_id', tenantId)
      .eq('activity_type', 'stage_change')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (!Array.isArray(activities)) return signals;

    const stageOrder: Record<string, number> = {
      lead: 1, qualified: 2, proposal: 3, negotiation: 4, closed_won: 5, closed_lost: 0
    };

    for (const act of activities) {
      const meta = act.metadata as Record<string, string> | null;
      if (!meta?.from_stage || !meta?.to_stage) continue;

      const fromRank = stageOrder[meta.from_stage] ?? 0;
      const toRank = stageOrder[meta.to_stage] ?? 0;

      if (toRank < fromRank && meta.to_stage !== 'closed_lost') {
        // Deal moved backward
        const { data: deal } = await supabase
          .from('deals')
          .select('name, value')
          .eq('id', act.deal_id)
          .eq('tenant_id', tenantId)
          .single();

        const dealValue = Number(deal?.value || 0);
        const dealName = String(deal?.name || act.deal_id);

        signals.push({
          category: 'deal_regression',
          severity: dealValue >= 25000 ? 'critical' : dealValue >= 10000 ? 'high' : 'medium',
          impact_revenue: -dealValue * 0.3, // Partial impact for regression
          description: `Deal "${dealName}" regressed from ${meta.from_stage} to ${meta.to_stage}`,
          evidence: [
            `Stage moved backward: ${meta.from_stage} → ${meta.to_stage}`,
            `Deal value: $${dealValue.toLocaleString()}`,
            `Occurred: ${new Date(String(act.created_at)).toLocaleDateString()}`
          ],
          recommended_action: `Schedule a recovery call for "${dealName}" to identify blockers and re-establish momentum.`
        });
      }
    }

    return signals;
  }

  private async detectStalledDeals(
    supabase: SupabaseClient,
    tenantId: string,
    staleDays: number
  ): Promise<RootCauseSignal[]> {
    const signals: RootCauseSignal[] = [];
    const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

    const { data: deals } = await supabase
      .from('deals')
      .select('id, name, value, stage, updated_at')
      .eq('tenant_id', tenantId)
      .not('stage', 'in', '(closed_won,closed_lost)')
      .lt('updated_at', cutoff.toISOString())
      .order('value', { ascending: false })
      .limit(20);

    if (!Array.isArray(deals)) return signals;

    for (const deal of deals) {
      const value = Number(deal.value || 0);
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(String(deal.updated_at)).getTime()) / (1000 * 60 * 60 * 24)
      );

      signals.push({
        category: 'deal_stall',
        severity: value >= 20000 ? 'high' : value >= 5000 ? 'medium' : 'low',
        impact_revenue: -value * 0.15, // Stall reduces expected value
        description: `Deal "${deal.name}" in ${deal.stage} stage has been inactive for ${daysSinceUpdate} days`,
        evidence: [
          `Last activity: ${daysSinceUpdate} days ago`,
          `Current stage: ${deal.stage}`,
          `Pipeline value at risk: $${value.toLocaleString()}`
        ],
        recommended_action: `Run a stall-recovery sequence: direct call to identify decision blockers.`
      });
    }

    return signals;
  }

  private async detectRecentLosses(
    supabase: SupabaseClient,
    tenantId: string,
    since: Date
  ): Promise<RootCauseSignal[]> {
    const signals: RootCauseSignal[] = [];

    const { data: lostDeals } = await supabase
      .from('deals')
      .select('id, name, value, updated_at, loss_reason')
      .eq('tenant_id', tenantId)
      .eq('stage', 'closed_lost')
      .gte('updated_at', since.toISOString())
      .order('value', { ascending: false })
      .limit(10);

    if (!Array.isArray(lostDeals)) return signals;

    for (const deal of lostDeals) {
      const value = Number(deal.value || 0);

      signals.push({
        category: 'deal_loss',
        severity: value >= 25000 ? 'critical' : value >= 10000 ? 'high' : 'medium',
        impact_revenue: -value,
        description: `Deal "${deal.name}" was lost ($${value.toLocaleString()})`,
        evidence: [
          `Loss reason: ${deal.loss_reason || 'Not specified'}`,
          `Lost on: ${new Date(String(deal.updated_at)).toLocaleDateString()}`,
          `Revenue impact: -$${value.toLocaleString()}`
        ],
        recommended_action: `Conduct a loss retrospective and update competitive intelligence.`
      });
    }

    return signals;
  }

  private async detectActivityDrop(
    supabase: SupabaseClient,
    tenantId: string,
    currentStart: Date,
    priorStart: Date
  ): Promise<RootCauseSignal[]> {
    const signals: RootCauseSignal[] = [];

    // Count activities in current period
    const { count: currentCount } = await supabase
      .from('deal_activities')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', currentStart.toISOString());

    // Count activities in prior period
    const { count: priorCount } = await supabase
      .from('deal_activities')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', priorStart.toISOString())
      .lt('created_at', currentStart.toISOString());

    const current = currentCount || 0;
    const prior = priorCount || 0;

    if (prior > 0 && current < prior) {
      const dropPct = round2(((prior - current) / prior) * 100);
      if (dropPct >= 15) {
        signals.push({
          category: 'activity_drop',
          severity: dropPct >= 40 ? 'critical' : dropPct >= 25 ? 'high' : 'medium',
          impact_revenue: 0, // Indirect impact
          description: `Deal activity volume dropped ${dropPct}% compared to prior period`,
          evidence: [
            `Current period: ${current} activities`,
            `Prior period: ${prior} activities`,
            `Drop: -${dropPct}%`
          ],
          recommended_action: `Investigate team bandwidth and ensure pipeline coverage is maintained.`
        });
      }
    }

    return signals;
  }

  private async detectConversionSlowdown(
    supabase: SupabaseClient,
    tenantId: string,
    currentStart: Date,
    priorStart: Date
  ): Promise<RootCauseSignal[]> {
    const signals: RootCauseSignal[] = [];

    // Deals entering negotiation/proposal in current vs prior period
    for (const stage of ['proposal', 'negotiation'] as const) {
      const { count: currentAdvances } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('stage', stage)
        .gte('updated_at', currentStart.toISOString());

      const { count: priorAdvances } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('stage', stage)
        .gte('updated_at', priorStart.toISOString())
        .lt('updated_at', currentStart.toISOString());

      const curr = currentAdvances || 0;
      const prev = priorAdvances || 0;

      if (prev > 2 && curr < prev) {
        const dropPct = round2(((prev - curr) / prev) * 100);
        if (dropPct >= 20) {
          signals.push({
            category: 'conversion_slowdown',
            severity: dropPct >= 50 ? 'high' : 'medium',
            impact_revenue: 0,
            description: `Deals advancing to ${stage} dropped ${dropPct}% vs prior period`,
            evidence: [
              `Current: ${curr} deals reached ${stage}`,
              `Prior: ${prev} deals reached ${stage}`,
              `Conversion velocity is declining`
            ],
            recommended_action: `Review qualification criteria and proposal turnaround times.`
          });
        }
      }
    }

    return signals;
  }

  private buildNarrativeSummary(signals: RootCauseSignal[], totalImpact: number, periodDays: number): string {
    if (signals.length === 0) {
      return `No significant revenue risks detected in the past ${periodDays} days. Pipeline is healthy.`;
    }

    const parts: string[] = [];
    const losses = signals.filter(s => s.category === 'deal_loss');
    const stalls = signals.filter(s => s.category === 'deal_stall');
    const regressions = signals.filter(s => s.category === 'deal_regression');
    const criticals = signals.filter(s => s.severity === 'critical');

    if (criticals.length > 0) {
      parts.push(`⚠️ ${criticals.length} critical revenue risk(s) detected.`);
    }

    if (losses.length > 0) {
      const lossValue = Math.abs(losses.reduce((s, l) => s + l.impact_revenue, 0));
      parts.push(`${losses.length} deal(s) lost totaling $${lossValue.toLocaleString()}.`);
    }

    if (stalls.length > 0) {
      parts.push(`${stalls.length} deal(s) stalled with no recent activity.`);
    }

    if (regressions.length > 0) {
      parts.push(`${regressions.length} deal(s) moved backward in the pipeline.`);
    }

    if (Math.abs(totalImpact) > 0) {
      parts.push(`Total estimated revenue impact: $${Math.abs(totalImpact).toLocaleString()}.`);
    }

    return parts.join(' ');
  }
}

export const revenueRootCauseService = new RevenueRootCauseService();

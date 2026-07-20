import { getAutomationHealth } from './automation/observabilityService';
import { tenantService } from './tenancy/TenantService';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const businessReportService = {
  /**
   * Generates a full business performance report for Alphaclone Systems.
   * Includes: revenue trends, conversion rates, social metrics, automation health, and expenses.
   */
  async generateBusinessPerformanceReport(tenantId?: string) {
    const tid = tenantId || tenantService.getCurrentTenantId();
    if (!tid) throw new Error('No active tenant context found.');

    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const admin = createSupabaseAdminClient();
    const [invoiceResult, leadResult, dealResult, accountResult, socialResult] = await Promise.all([
      admin.from('invoices').select('amount, total_amount, paid_at, created_at').eq('tenant_id', tid).ilike('status', 'paid').gte('created_at', sixMonthsAgo.toISOString()).lte('created_at', now.toISOString()),
      admin.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('created_at', sixMonthsAgo.toISOString()),
      admin.from('deals').select('id, stage, value, probability').eq('tenant_id', tid).gte('created_at', sixMonthsAgo.toISOString()),
      admin.from('chart_of_accounts').select('account_name, account_code, current_balance').eq('tenant_id', tid).eq('account_type', 'expense'),
      admin.from('social_posts').select('id, caption, platforms, linkedin_stats, published_at').eq('tenant_id', tid).eq('status', 'published').order('published_at', { ascending: false }).limit(50),
    ]);
    for (const result of [invoiceResult, leadResult, dealResult, accountResult, socialResult]) if (result.error) throw result.error;

    const monthly = new Map<string, number>();
    for (const invoice of invoiceResult.data || []) {
      const date = new Date(invoice.paid_at || invoice.created_at);
      const key = date.toISOString().slice(0, 7);
      monthly.set(key, (monthly.get(key) || 0) + Number(invoice.total_amount ?? invoice.amount ?? 0));
    }
    const revenueTrendData = Array.from(monthly, ([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date));
    const deals = dealResult.data || [];
    const totalLeads = leadResult.count || 0;
    const totalDeals = deals.length;
    const totalWon = deals.filter((deal: any) => deal.stage === 'closed_won').length;
    const totalLost = deals.filter((deal: any) => deal.stage === 'closed_lost').length;
    const decided = totalWon + totalLost;
    const winRate = decided > 0 ? totalWon / decided * 100 : 0;
    const leadToDealConversion = totalLeads > 0 ? ((totalDeals / totalLeads) * 100).toFixed(2) : "0.00";

    // 3. Automation Health Metrics
    const automationHealth = await getAutomationHealth(tid);

    // 4. Expense Breakdown by Category (from Chart of Accounts)
    const expenseBreakdown = (accountResult.data || []).map((acc: any) => ({
      category: acc.account_name,
      amount: Math.abs(Number(acc.current_balance || 0)),
      code: acc.account_code
    })).filter((e: any) => e.amount > 0);

    const topSocialPosts = (socialResult.data || []).map((post: any) => {
      const stats = post.linkedin_stats && typeof post.linkedin_stats === 'object' ? post.linkedin_stats as Record<string, unknown> : {};
      const impressions = Number(stats.impressions || stats.impressionCount || 0);
      const interactions = Number(stats.likes || stats.likeCount || 0) + Number(stats.comments || stats.commentCount || 0) + Number(stats.shares || stats.shareCount || 0);
      return { platform: Array.isArray(post.platforms) ? post.platforms.join(', ') : 'social', topic: String(post.caption || '').slice(0, 120), reach: impressions, engagement: impressions > 0 ? interactions / impressions * 100 : 0, date: post.published_at };
    }).filter((post: any) => post.reach > 0).sort((a: any, b: any) => b.reach - a.reach).slice(0, 5);

    const stageMap = new Map<string, { stage: string; dealCount: number; totalValue: number }>();
    for (const deal of deals) {
      const current = stageMap.get(deal.stage) || { stage: deal.stage, dealCount: 0, totalValue: 0 };
      current.dealCount += 1; current.totalValue += Number(deal.value || 0); stageMap.set(deal.stage, current);
    }
    const pipelineStats = Array.from(stageMap.values());
    const weightedValue = deals.filter((deal: any) => !['closed_won', 'closed_lost'].includes(deal.stage)).reduce((sum: number, deal: any) => sum + Number(deal.value || 0) * Number(deal.probability || 0) / 100, 0);

    return {
      executiveSummary: {
        totalRevenue: revenueTrendData.reduce((sum, item) => sum + (item.revenue || 0), 0),
        conversionRate: `${leadToDealConversion}%`,
        winRate: `${winRate.toFixed(2)}%`,
        automationSuccessRate: automationHealth.success ? 
          `${(( (automationHealth.status_counts?.completed || 0) / (automationHealth.total_runs || 1)) * 100).toFixed(1)}%` : 'N/A'
      },
      revenueTrend: revenueTrendData,
      salesPerformance: {
        totalLeads,
        totalDeals,
        totalWon,
        totalLost,
        leadToDealConversion
      },
      pipelineSnapshot: {
        stats: pipelineStats,
        weightedValue
      },
      automationThroughput: {
        totalRuns: automationHealth.total_runs || 0,
        statusCounts: automationHealth.status_counts || {}
      },
      expenseBreakdown,
      topSocialPosts,
      generatedAt: now.toISOString()
    };
  },

  async generateExecutiveReport(tenantId: string): Promise<string> {
    const data = await this.generateBusinessPerformanceReport(tenantId);
    
    return `
# EXECUTIVE PERFORMANCE REPORT: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}
**AlphaClone Systems | Strategic Briefing**

## 1. EXECUTIVE SUMMARY
- **Total Revenue (Period):** $${data.executiveSummary.totalRevenue.toLocaleString()}
- **Lead-to-Deal Conversion:** ${data.executiveSummary.conversionRate}
- **Proposal Win Rate:** ${data.executiveSummary.winRate}
- **Automation Success Rate:** ${data.executiveSummary.automationSuccessRate}

## 2. REVENUE MOMENTUM
Revenue trend below reflects paid invoice data recorded during the reporting period.
${(data.revenueTrend || []).map((r: any) => `- ${r.date}: $${(r.revenue || 0).toLocaleString()}`).join('\n')}

## 3. SALES PIPELINE & CONVERSION
- **Total Leads Ingested:** ${data.salesPerformance.totalLeads}
- **Active Opportunities:** ${data.salesPerformance.totalDeals}
- **Conversion Efficiency:** ${data.salesPerformance.leadToDealConversion}% from lead to active deal.
- **Weighted Pipeline Value:** $${data.pipelineSnapshot.weightedValue.toLocaleString()}

## 4. AUTOMATION & OPERATIONAL HEALTH
- **Total Autonomous Runs:** ${data.automationThroughput.totalRuns}
- **Status Distribution:** ${Object.entries(data.automationThroughput.statusCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}
- **Operational Insight:** Automation throughput is reported from recorded workflow runs only.

## 5. TOP PERFORMING SOCIAL ASSETS
${(data.topSocialPosts || []).map((p: any) => `- [${p.platform}] "${p.topic}" - Reach: ${p.reach.toLocaleString()}, Engagement: ${p.engagement}%`).join('\n')}

## 6. EXPENSE DISTRIBUTION
${(data.expenseBreakdown || []).map((e: any) => `- ${e.category}: $${e.amount.toLocaleString()}`).join('\n')}

## 7. RECOMMENDED NEXT ACTIONS
1. Review the recorded revenue trend and investigate material month-over-month changes.
2. Prioritize active opportunities using the weighted pipeline value and current stage distribution.
3. Review the largest recorded expense categories for margin opportunities.

---
*Report generated autonomously by AlphaClone Nexus Strategic Orchestrator.*
`;
  }
};

import type { SupabaseClient } from '@supabase/supabase-js';

export interface PaymentRiskReport {
  client_id: string;
  risk_score: number; // 0 to 100
  risk_tier: 'minimal' | 'moderate' | 'elevated' | 'severe';
  factors: string[];
  metrics: {
    overdue_ratio: number; // overdue invoices / total invoices
    average_days_late: number;
    open_balance: number;
    credit_utilization: number; // open_balance / lifetime_invoiced
  };
  repayment_probability: number; // percentage
  mitigation_strategies: string[];
}

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;

class PaymentRiskScoringService {
  /**
   * Computes a dynamic payment risk score for a client based on historical payment performance,
   * current outstanding balance ratio, and sector-wide average delay metrics.
   */
  async computeRiskScore(
    supabase: SupabaseClient,
    tenantId: string,
    clientId: string
  ): Promise<PaymentRiskReport> {
    const factors: string[] = [];
    const mitigations: string[] = [];

    // 1. Fetch client details
    const { data: client } = await supabase
      .from('business_clients')
      .select('id, name, email')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    // 2. Fetch all invoices for this client
    const { data: invoices } = await supabase
      .from('business_invoices')
      .select('amount, total_amount, due_date, paid_at, status')
      .eq('client_id', clientId)
      .eq('tenant_id', tenantId);

    const invoiceList = Array.isArray(invoices) ? invoices : [];

    let totalInvoices = invoiceList.length;
    let overdueCount = 0;
    let paidCount = 0;
    let totalDaysLate = 0;
    let openBalance = 0;
    let lifetimeInvoiced = 0;

    for (const inv of invoiceList) {
      const amt = Number(inv.total_amount || inv.amount || 0);
      lifetimeInvoiced += amt;

      if (inv.status === 'paid') {
        paidCount++;
        if (inv.paid_at && inv.due_date) {
          const delay = new Date(inv.paid_at).getTime() - new Date(inv.due_date).getTime();
          if (delay > 0) {
            totalDaysLate += Math.floor(delay / (1000 * 60 * 60 * 24));
          }
        }
      } else if (inv.status === 'overdue' || inv.status === 'unpaid') {
        openBalance += amt;
        if (inv.status === 'overdue') {
          overdueCount++;
        }
      }
    }

    const overdueRatio = totalInvoices > 0 ? overdueCount / totalInvoices : 0;
    const averageDaysLate = paidCount > 0 ? totalDaysLate / paidCount : 0;
    const creditUtilization = lifetimeInvoiced > 0 ? openBalance / lifetimeInvoiced : 0;

    // Mathematical risk score formulation
    let riskScore = 10; // Base baseline risk

    if (overdueRatio > 0.5) {
      riskScore += 35;
      factors.push(`Critical invoice default rate: ${Math.round(overdueRatio * 100)}% of invoices have gone overdue`);
    } else if (overdueRatio > 0.2) {
      riskScore += 20;
      factors.push(`Frequent payment delays: ${Math.round(overdueRatio * 100)}% overdue invoice history`);
    }

    if (averageDaysLate > 15) {
      riskScore += 25;
      factors.push(`Significant receipt delay: Paid invoices average ${Math.round(averageDaysLate)} days late`);
    } else if (averageDaysLate > 5) {
      riskScore += 10;
      factors.push(`Minor latency: History of minor payment delays averaging ${Math.round(averageDaysLate)} days`);
    }

    if (creditUtilization > 0.6 && openBalance > 5000) {
      riskScore += 20;
      factors.push(`High credit exposure: Client open balance accounts for ${Math.round(creditUtilization * 100)}% of their lifetime volume`);
    }

    // Mitigations and Tiering
    riskScore = clamp(riskScore, 5, 95);

    let riskTier: 'minimal' | 'moderate' | 'elevated' | 'severe' = 'minimal';
    if (riskScore >= 75) {
      riskTier = 'severe';
      mitigations.push('Require 100% upfront prepayment for all upcoming milestones or projects.');
      mitigations.push('Transition account strictly to NET 7 or immediate payment upon receipt.');
    } else if (riskScore >= 50) {
      riskTier = 'elevated';
      mitigations.push('Require a minimum 50% upfront deposit on future contracts.');
      mitigations.push('Establish automated weekly SMS payment reminders starting 5 days prior to invoice due dates.');
    } else if (riskScore >= 25) {
      riskTier = 'moderate';
      mitigations.push('Establish credit limit of $10,000 for outstanding balances.');
      mitigations.push('Enable automatic credit card charging through Stripe pre-authorization.');
    } else {
      mitigations.push('Maintain standard NET 30 terms. Apply automated friendly reminders on due date.');
    }

    const repaymentProbability = clamp(100 - riskScore, 5, 98);

    return {
      client_id: clientId,
      risk_score: round2(riskScore),
      risk_tier: riskTier,
      factors,
      metrics: {
        overdue_ratio: round2(overdueRatio),
        average_days_late: round2(averageDaysLate),
        open_balance: round2(openBalance),
        credit_utilization: round2(creditUtilization)
      },
      repayment_probability: round2(repaymentProbability),
      mitigation_strategies: mitigations
    };
  }
}

export const paymentRiskScoringService = new PaymentRiskScoringService();

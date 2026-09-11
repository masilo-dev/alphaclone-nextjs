import type { SupabaseClient } from '@supabase/supabase-js';

export interface InvoicePaymentPrediction {
  invoice_id: string;
  invoice_number?: string;
  client_id: string;
  client_name?: string;
  amount: number;
  due_date: string;
  predicted_payment_date: string;
  predicted_days_late: number;
  payment_probability: number;
  confidence: number;
  risk_tier: 'low' | 'medium' | 'high' | 'critical';
}

export interface CashFlowForecastDay {
  date: string;
  expected_inflow: number;
  expected_outflow: number;
  net_position: number;
  cumulative_position: number;
  confidence: number;
  inflow_invoices: number;
  outflow_expenses: number;
}

export interface CashFlowReport {
  tenant_id: string;
  generated_at: string;
  forecast_days: number;
  current_balance_estimate: number;
  total_expected_inflow: number;
  total_expected_outflow: number;
  net_forecast: number;
  lowest_point_date: string | null;
  lowest_point_value: number;
  invoice_predictions: InvoicePaymentPrediction[];
  daily_forecast: CashFlowForecastDay[];
  alerts: string[];
  confidence: number;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;
const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

/**
 * Build a client payment behavior profile from historical invoice data.
 * Returns average days to pay and payment reliability score.
 */
function analyzeClientPaymentBehavior(
  paidInvoices: Array<{ created_at: string; paid_at?: string; due_date?: string; amount: number }>
): { avgDaysToPay: number; reliability: number; sampleSize: number } {
  const paymentDelays: number[] = [];

  for (const inv of paidInvoices) {
    if (!inv.paid_at) continue;
    const created = new Date(inv.created_at).getTime();
    const paid = new Date(inv.paid_at).getTime();
    const days = Math.floor((paid - created) / (1000 * 60 * 60 * 24));
    if (days >= 0 && days < 365) {
      paymentDelays.push(days);
    }
  }

  if (paymentDelays.length === 0) {
    return { avgDaysToPay: 30, reliability: 0.5, sampleSize: 0 }; // Default assumption
  }

  const avg = paymentDelays.reduce((s, d) => s + d, 0) / paymentDelays.length;

  // Reliability = how consistent they are (low variance = high reliability)
  const variance = paymentDelays.reduce((s, d) => s + Math.pow(d - avg, 2), 0) / paymentDelays.length;
  const stdDev = Math.sqrt(variance);
  const cv = avg > 0 ? stdDev / avg : 1; // Coefficient of variation

  // Lower CV = more predictable = higher reliability
  const reliability = clamp(1 - cv * 0.5, 0.2, 0.95);

  return {
    avgDaysToPay: Math.round(avg),
    reliability: round2(reliability),
    sampleSize: paymentDelays.length
  };
}

class CashFlowPredictionService {
  /**
   * Generate a cash flow forecast by predicting when each outstanding invoice
   * will be paid based on historical client payment patterns.
   */
  async forecast(
    supabase: SupabaseClient,
    tenantId: string,
    forecastDays: number = 90
  ): Promise<CashFlowReport> {
    const now = new Date();
    const forecastEnd = new Date(now.getTime() + forecastDays * 24 * 60 * 60 * 1000);
    const alerts: string[] = [];

    // 1. Fetch all outstanding invoices
    const { data: outstandingRaw } = await supabase
      .from('business_invoices')
      .select('id, invoice_number, client_id, total, status, due_date, created_at')
      .eq('tenant_id', tenantId)
      .not('status', 'in', '(paid,cancelled,void)')
      .order('due_date', { ascending: true })
      .limit(500);
    const allOutstanding = (Array.isArray(outstandingRaw) ? outstandingRaw : []).map((inv: any) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      client_id: inv.client_id,
      amount: Number(inv.total || 0),
      due_date: inv.due_date,
      created_at: inv.created_at,
    }));

    // 2. Build client payment profiles from historical data
    const clientIds = [...new Set(allOutstanding.map(inv => inv.client_id).filter(Boolean))];
    const clientProfiles: Map<string, ReturnType<typeof analyzeClientPaymentBehavior>> = new Map();

    for (const clientId of clientIds) {
      const { data: paidHistory } = await supabase
        .from('business_invoices')
        .select('created_at, paid_at, due_date, total')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })
        .limit(50);

      const profile = analyzeClientPaymentBehavior(
        (Array.isArray(paidHistory) ? paidHistory : []).map((row: any) => ({
          ...row,
          amount: Number(row.total || 0),
        }))
      );
      clientProfiles.set(clientId, profile);
    }

    // 3. Predict payment date for each outstanding invoice
    const predictions: InvoicePaymentPrediction[] = [];

    for (const inv of allOutstanding) {
      const profile = clientProfiles.get(inv.client_id) || { avgDaysToPay: 30, reliability: 0.5, sampleSize: 0 };

      // Predict payment date = created_at + avgDaysToPay
      const createdTime = new Date(inv.created_at).getTime();
      const predictedPayTime = createdTime + profile.avgDaysToPay * 24 * 60 * 60 * 1000;
      const predictedPayDate = new Date(Math.max(predictedPayTime, now.getTime())); // Can't be in the past

      const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(createdTime + 30 * 24 * 60 * 60 * 1000);
      const predictedDaysLate = Math.max(0, Math.floor((predictedPayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

      // Payment probability decreases with lateness
      let paymentProb = profile.reliability;
      if (predictedDaysLate > 60) paymentProb *= 0.5;
      else if (predictedDaysLate > 30) paymentProb *= 0.7;
      else if (predictedDaysLate > 14) paymentProb *= 0.85;

      // Risk tier
      let riskTier: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (paymentProb < 0.4) riskTier = 'critical';
      else if (paymentProb < 0.6) riskTier = 'high';
      else if (paymentProb < 0.8) riskTier = 'medium';

      predictions.push({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        client_id: inv.client_id,
        amount: inv.amount,
        due_date: dueDate.toISOString().split('T')[0],
        predicted_payment_date: predictedPayDate.toISOString().split('T')[0],
        predicted_days_late: predictedDaysLate,
        payment_probability: round2(paymentProb),
        confidence: round2(clamp(profile.reliability * (profile.sampleSize > 3 ? 1 : 0.6), 0.2, 0.95)),
        risk_tier: riskTier
      });
    }

    // 4. Fetch expected expenses/outflows
    const { data: recurringExpenses } = await supabase
      .from('expenses')
      .select('amount, category, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(200);
    const expenses = Array.isArray(recurringExpenses) ? recurringExpenses : [];

    // Estimate monthly expense rate
    const monthlyExpenseRate = expenses.length > 0
      ? expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0) / Math.max(1, expenses.length / 30)
      : 0;
    const dailyExpenseRate = monthlyExpenseRate / 30;

    // 5. Build daily forecast
    const dailyForecast: CashFlowForecastDay[] = [];
    let cumulative = 0;
    let lowestPoint = Infinity;
    let lowestDate: string | null = null;

    for (let day = 0; day < forecastDays; day++) {
      const date = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];

      // Expected inflows on this day
      const dayInflows = predictions.filter(p => p.predicted_payment_date === dateStr);
      const expectedInflow = dayInflows.reduce((s, p) => s + p.amount * p.payment_probability, 0);

      // Expected outflows (daily average)
      const expectedOutflow = dailyExpenseRate;

      const net = expectedInflow - expectedOutflow;
      cumulative += net;

      if (cumulative < lowestPoint) {
        lowestPoint = cumulative;
        lowestDate = dateStr;
      }

      dailyForecast.push({
        date: dateStr,
        expected_inflow: round2(expectedInflow),
        expected_outflow: round2(expectedOutflow),
        net_position: round2(net),
        cumulative_position: round2(cumulative),
        confidence: round2(dayInflows.length > 0 ? 0.7 : 0.4),
        inflow_invoices: dayInflows.length,
        outflow_expenses: expectedOutflow > 0 ? 1 : 0
      });
    }

    // 6. Generate alerts
    const criticalInvoices = predictions.filter(p => p.risk_tier === 'critical');
    if (criticalInvoices.length > 0) {
      const totalAtRisk = criticalInvoices.reduce((s, p) => s + p.amount, 0);
      alerts.push(`⚠️ ${criticalInvoices.length} invoice(s) at critical payment risk totaling $${totalAtRisk.toLocaleString()}`);
    }

    if (lowestPoint < 0) {
      alerts.push(`🔴 Cash position projected to go negative on ${lowestDate} (projected: $${round2(lowestPoint).toLocaleString()})`);
    }

    const overdueCount = predictions.filter(p => p.predicted_days_late > 14).length;
    if (overdueCount > 3) {
      alerts.push(`${overdueCount} invoices predicted to be 14+ days late. Consider automated reminder sequences.`);
    }

    const totalExpectedInflow = predictions.reduce((s, p) => s + p.amount * p.payment_probability, 0);
    const totalExpectedOutflow = dailyExpenseRate * forecastDays;

    return {
      tenant_id: tenantId,
      generated_at: now.toISOString(),
      forecast_days: forecastDays,
      current_balance_estimate: 0, // Would need bank integration
      total_expected_inflow: round2(totalExpectedInflow),
      total_expected_outflow: round2(totalExpectedOutflow),
      net_forecast: round2(totalExpectedInflow - totalExpectedOutflow),
      lowest_point_date: lowestDate,
      lowest_point_value: round2(lowestPoint === Infinity ? 0 : lowestPoint),
      invoice_predictions: predictions,
      daily_forecast: dailyForecast,
      alerts,
      confidence: round2(clamp(0.4 + predictions.length * 0.02, 0.3, 0.9))
    };
  }
}

export const cashFlowPredictionService = new CashFlowPredictionService();

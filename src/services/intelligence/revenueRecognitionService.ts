import type { SupabaseClient } from '@supabase/supabase-js';

export interface RevenueSchedule {
  invoice_id: string;
  total_amount: number;
  recognized_revenue: number;
  deferred_revenue: number;
  monthly_schedule: { month: string; amount: number }[];
}

class RevenueRecognitionService {
  /**
   * Generates ASC 606 / IFRS 15 compliant subscription revenue recognition schedules,
   * amortizing annual or quarterly upfront payments across their service delivery periods.
   */
  async buildRecognitionSchedule(
    supabase: SupabaseClient,
    tenantId: string,
    invoiceId: string,
    serviceMonths: number = 12
  ): Promise<RevenueSchedule> {
    const { data: invoice } = await supabase
      .from('business_invoices')
      .select('amount, total_amount, paid_at, created_at')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const total = Number(invoice.total_amount || invoice.amount || 0);
    const startDate = invoice.paid_at ? new Date(invoice.paid_at) : new Date(invoice.created_at);
    
    const monthlyAmount = total / serviceMonths;
    const schedule: { month: string; amount: number }[] = [];

    const now = new Date();
    let recognized = 0;

    for (let i = 0; i < serviceMonths; i++) {
      const scheduleDate = new Date(startDate);
      scheduleDate.setMonth(scheduleDate.getMonth() + i);
      
      const isPast = scheduleDate.getTime() <= now.getTime();
      if (isPast) {
        recognized += monthlyAmount;
      }

      schedule.push({
        month: scheduleDate.toISOString().substring(0, 7), // YYYY-MM format
        amount: Math.round(monthlyAmount * 100) / 100
      });
    }

    return {
      invoice_id: invoiceId,
      total_amount: total,
      recognized_revenue: Math.round(recognized * 100) / 100,
      deferred_revenue: Math.round((total - recognized) * 100) / 100,
      monthly_schedule: schedule
    };
  }
}

export const revenueRecognitionService = new RevenueRecognitionService();

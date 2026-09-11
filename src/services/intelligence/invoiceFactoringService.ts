import type { SupabaseClient } from '@supabase/supabase-js';

export interface FactoringEvaluation {
  invoice_id: string;
  face_value: number;
  advance_rate: number; // percentage (e.g., 0.85)
  discount_fee: number; // fixed fee or percentage
  immediate_cash_yield: number;
  eligibility: 'approved' | 'rejected' | 'manual_review';
  reason: string;
}

class InvoiceFactoringService {
  /**
   * Evaluates outstanding invoices for factoring eligibility, calculating
   * the potential immediate cash yield against associated discount risk fees.
   */
  async evaluateInvoiceForFactoring(
    supabase: SupabaseClient,
    tenantId: string,
    invoiceId: string
  ): Promise<FactoringEvaluation> {
    const { data: invoice } = await supabase
      .from('business_invoices')
      .select('amount, total_amount, due_date, status, client_id')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    if (!invoice || invoice.status === 'paid') {
      return {
        invoice_id: invoiceId,
        face_value: 0,
        advance_rate: 0,
        discount_fee: 0,
        immediate_cash_yield: 0,
        eligibility: 'rejected',
        reason: 'Invoice not found or already paid.'
      };
    }

    const faceValue = Number(invoice.total_amount || invoice.amount || 0);

    // Basic rule: Invoices under $1000 or over 90 days late are rejected
    if (faceValue < 1000) {
      return {
        invoice_id: invoiceId,
        face_value: faceValue,
        advance_rate: 0,
        discount_fee: 0,
        immediate_cash_yield: 0,
        eligibility: 'rejected',
        reason: 'Invoice face value is below the $1,000 factoring threshold.'
      };
    }

    const daysLate = invoice.due_date ? Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;

    if (daysLate > 90) {
      return {
        invoice_id: invoiceId,
        face_value: faceValue,
        advance_rate: 0,
        discount_fee: 0,
        immediate_cash_yield: 0,
        eligibility: 'rejected',
        reason: 'Invoice is over 90 days delinquent, making it ineligible for standard factoring.'
      };
    }

    // Typical factoring terms: 85% advance rate, 3% discount fee
    const advanceRate = 0.85;
    const discountRate = daysLate > 30 ? 0.05 : 0.03; // Higher fee if already late
    
    const discountFee = faceValue * discountRate;
    const immediateCash = faceValue * advanceRate - discountFee;

    return {
      invoice_id: invoiceId,
      face_value: faceValue,
      advance_rate: advanceRate,
      discount_fee: discountFee,
      immediate_cash_yield: immediateCash,
      eligibility: daysLate > 60 ? 'manual_review' : 'approved',
      reason: `Factoring approved at ${(advanceRate * 100)}% advance with a ${(discountRate * 100)}% fee structure.`
    };
  }
}

export const invoiceFactoringService = new InvoiceFactoringService();

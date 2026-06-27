import { businessInvoiceService } from '@/services/businessInvoiceService';

export async function convertQuoteToInvoice(
    quoteId: string,
    tenantId: string,
    options?: { autoSend?: boolean; origin?: string }
): Promise<{ invoiceId: string | null; publicToken: string | null; error: string | null }> {
    return businessInvoiceService.convertQuoteToInvoice(quoteId, tenantId, options);
}

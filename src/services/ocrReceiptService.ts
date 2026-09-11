/**
 * Receipt image parser.
 * Does not invent vendor, amount, or tax. Real OCR is not wired in this client.
 */

export interface ParsedReceipt {
  vendorName: string;
  date: string;
  totalAmount: number;
  category: 'Software & Tools' | 'Office & Supplies' | 'Travel & Transport' | 'Meals & Entertainment' | 'Utilities' | 'General Expense';
  confidenceScore: number;
  rawTextPreview: string;
}

export class ReceiptOcrUnavailableError extends Error {
  constructor() {
    super('Receipt text extraction is not configured. Enter vendor, date, and amount manually.');
    this.name = 'ReceiptOcrUnavailableError';
  }
}

export const ocrReceiptService = {
  async parseReceiptImage(_imageSource: File | string): Promise<ParsedReceipt> {
    throw new ReceiptOcrUnavailableError();
  },
};

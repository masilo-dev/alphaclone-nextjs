/**
 * Invoice Email Templates — body fragments wrapped by buildEmail() at send time.
 */

import { buildEmail } from '@/lib/email/template';

export interface InvoiceEmailData {
    recipientName: string;
    recipientEmail: string;
    tenantId: string;
    invoiceNumber: string;
    amount: number | string;
    currency?: string;
    dueDate?: string;
    actionUrl: string;
    workspaceName: string;
    senderName?: string;
    notes?: string;
    trackingPixelUrl?: string;
}

const INVOICE_BODY_STYLES = `
  .invoice-header { padding: 0 0 24px 0; text-align: center; }
  .invoice-header h1 { margin: 0; color: #0f172a; font-size: 22px; font-weight: bold; }
  .invoice-text { margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.5; }
  .invoice-card { background-color: #f1f5f9; border-radius: 8px; padding: 24px; margin-bottom: 24px; border: 1px solid #e2e8f0; }
  .invoice-row { margin-bottom: 8px; color: #64748b; font-size: 14px; }
  .invoice-val { color: #0f172a; float: right; font-weight: 500; }
  .invoice-amount { font-size: 24px; font-weight: bold; color: #0f172a; text-align: center; margin: 20px 0; }
  .invoice-btn-wrap { text-align: center; padding: 16px 0; }
  .invoice-btn { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
`;

function formatCurrency(amount: number | string, currency: string = 'USD') {
    if (typeof amount === 'string') {
        if (/[^\d.,]/.test(amount)) {
            return amount;
        }
        const parsed = parseFloat(amount.replace(/,/g, ''));
        if (!isNaN(parsed)) {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(parsed);
        }
        return amount;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function formatDate(dateString?: string) {
    if (!dateString) return 'Due on receipt';
    try {
        return new Date(dateString).toLocaleDateString('en-US', { timeZone: 'UTC' });
    } catch {
        return dateString;
    }
}

function wrapInvoiceEmail(subject: string, bodyContent: string, data: InvoiceEmailData): string {
    const bodyHtml = `<style>${INVOICE_BODY_STYLES}</style>${bodyContent}`;
    return buildEmail({
        subject,
        bodyHtml,
        tenantName: data.workspaceName,
        tenantId: data.tenantId,
        recipientEmail: data.recipientEmail,
    });
}

export const invoiceEmailTemplates = {
    invoiceSent(data: InvoiceEmailData): string {
        const pixel = data.trackingPixelUrl
            ? `<img src="${data.trackingPixelUrl}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`
            : '';
        const content = `
        <div class="invoice-header">
          <h1>New Invoice</h1>
        </div>
        <p class="invoice-text">Hi ${data.recipientName},</p>
        <p class="invoice-text">${data.senderName || data.workspaceName} has sent you a new invoice.</p>
        <div class="invoice-amount">${formatCurrency(data.amount, data.currency)}</div>
        <div class="invoice-card">
          <div class="invoice-row">Invoice Number <span class="invoice-val">${data.invoiceNumber}</span></div>
          <div class="invoice-row">Due Date <span class="invoice-val">${formatDate(data.dueDate)}</span></div>
          ${data.notes ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#475569;font-size:14px;font-style:italic;">"${data.notes}"</p></div>` : ''}
        </div>
        <div class="invoice-btn-wrap">
          <a href="${data.actionUrl}" class="invoice-btn">View &amp; Pay Invoice</a>
        </div>
        ${pixel}`;
        return wrapInvoiceEmail(`Invoice ${data.invoiceNumber}`, content, data);
    },

    invoiceOverdue(data: InvoiceEmailData): string {
        const pixel = data.trackingPixelUrl
            ? `<img src="${data.trackingPixelUrl}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`
            : '';
        const content = `
        <div class="invoice-header">
          <h1 style="color:#ef4444;">Invoice Overdue</h1>
        </div>
        <p class="invoice-text">Hi ${data.recipientName},</p>
        <p class="invoice-text">This is a friendly reminder that an invoice from ${data.senderName || data.workspaceName} is now past due.</p>
        <div class="invoice-amount" style="color:#ef4444;">${formatCurrency(data.amount, data.currency)}</div>
        <div class="invoice-card">
          <div class="invoice-row">Invoice Number <span class="invoice-val">${data.invoiceNumber}</span></div>
          <div class="invoice-row">Due Date <span class="invoice-val" style="color:#ef4444;font-weight:bold;">${formatDate(data.dueDate)}</span></div>
        </div>
        <div class="invoice-btn-wrap">
          <a href="${data.actionUrl}" class="invoice-btn">View &amp; Pay Invoice</a>
        </div>
        ${pixel}`;
        return wrapInvoiceEmail(`Overdue: Invoice ${data.invoiceNumber}`, content, data);
    },

    invoiceViewedReminder(data: InvoiceEmailData): string {
        const pixel = data.trackingPixelUrl
            ? `<img src="${data.trackingPixelUrl}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`
            : '';
        const content = `
        <div class="invoice-header">
          <h1 style="color:#4f46e5;">Quick Reminder</h1>
        </div>
        <p class="invoice-text">Hi ${data.recipientName},</p>
        <p class="invoice-text">We noticed you recently viewed invoice ${data.invoiceNumber} from ${data.senderName || data.workspaceName}. We wanted to make it easy for you to complete payment.</p>
        <div class="invoice-amount">${formatCurrency(data.amount, data.currency)}</div>
        <div class="invoice-card">
          <div class="invoice-row">Invoice Number <span class="invoice-val">${data.invoiceNumber}</span></div>
          <div class="invoice-row">Due Date <span class="invoice-val">${formatDate(data.dueDate)}</span></div>
        </div>
        <div class="invoice-btn-wrap"><a href="${data.actionUrl}" class="invoice-btn">Complete Payment</a></div>
        ${pixel}`;
        return wrapInvoiceEmail(`Following Up: Invoice ${data.invoiceNumber}`, content, data);
    },

    invoiceNotOpenedReminder(data: InvoiceEmailData): string {
        const pixel = data.trackingPixelUrl
            ? `<img src="${data.trackingPixelUrl}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`
            : '';
        const content = `
        <div class="invoice-header">
          <h1 style="color:#0369a1;">Following Up on Your Invoice</h1>
        </div>
        <p class="invoice-text">Hi ${data.recipientName},</p>
        <p class="invoice-text">We wanted to make sure you received invoice ${data.invoiceNumber} from ${data.senderName || data.workspaceName}.</p>
        <div class="invoice-amount">${formatCurrency(data.amount, data.currency)}</div>
        <div class="invoice-card">
          <div class="invoice-row">Invoice Number <span class="invoice-val">${data.invoiceNumber}</span></div>
          <div class="invoice-row">Due Date <span class="invoice-val">${formatDate(data.dueDate)}</span></div>
        </div>
        <div class="invoice-btn-wrap"><a href="${data.actionUrl}" class="invoice-btn">View Invoice</a></div>
        ${pixel}`;
        return wrapInvoiceEmail(`Re: Invoice ${data.invoiceNumber}`, content, data);
    },
};

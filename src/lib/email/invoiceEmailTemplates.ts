/**
 * Invoice Email Templates — body fragments wrapped by buildEmail() at send time.
 */

import { buildEmail } from '@/lib/email/template';
import { EMAIL_SYSTEM_FONTS } from '@/lib/email/emailLayout';

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
  .invoice-header { padding: 0 0 20px 0; text-align: center; }
  .invoice-header h1 { margin: 0; color: #0f172a; font-size: 22px; font-weight: bold; }
  .invoice-text { margin: 0 0 16px 0; color: #334155; font-size: 16px; line-height: 1.6; }
  .invoice-card { background-color: #f8fafc; border-radius: 8px; padding: 20px 24px; margin-bottom: 24px; border: 1px solid #e2e8f0; }
  .invoice-row { margin-bottom: 8px; color: #64748b; font-size: 14px; }
  .invoice-val { color: #0f172a; float: right; font-weight: 600; }
  .invoice-amount { font-size: 28px; font-weight: bold; color: #0f172a; text-align: center; margin: 20px 0; }
  .invoice-btn-wrap { text-align: center; padding: 16px 0 8px 0; }
  .invoice-btn { display: inline-block; padding: 14px 28px; background-color: #0284c7; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center; }
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

function renderInvoiceCard(data: InvoiceEmailData, dueDateColor: string = '#0f172a'): string {
    const formattedDue = formatDate(data.dueDate);
    const notesBlock = data.notes
        ? `<div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid #e2e8f0;"><p style="margin: 0; color: #475569; font-size: 14px; font-style: italic; line-height: 1.5; font-family: ${EMAIL_SYSTEM_FONTS};">&ldquo;${data.notes}&rdquo;</p></div>`
        : '';

    return `
    <div class="invoice-card" style="background-color: #f8fafc; border-radius: 8px; padding: 20px 24px; margin: 0 0 24px 0; border: 1px solid #e2e8f0; font-family: ${EMAIL_SYSTEM_FONTS};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="invoice-row" style="padding: 5px 0; color: #64748b; font-size: 14px; line-height: 1.5; font-family: ${EMAIL_SYSTEM_FONTS};">Invoice Number</td>
          <td class="invoice-val" align="right" style="padding: 5px 0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right; line-height: 1.5; font-family: ${EMAIL_SYSTEM_FONTS};">${data.invoiceNumber}</td>
        </tr>
        <tr>
          <td class="invoice-row" style="padding: 5px 0; color: #64748b; font-size: 14px; line-height: 1.5; font-family: ${EMAIL_SYSTEM_FONTS};">Due Date</td>
          <td class="invoice-val" align="right" style="padding: 5px 0; color: ${dueDateColor}; font-size: 14px; font-weight: 600; text-align: right; line-height: 1.5; font-family: ${EMAIL_SYSTEM_FONTS};">${formattedDue}</td>
        </tr>
      </table>
      ${notesBlock}
    </div>`;
}

function renderInvoiceButton(actionUrl: string, label: string, btnColor: string = '#0284c7'): string {
    return `
    <div class="invoice-btn-wrap" style="text-align: center; padding: 16px 0 8px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
        <tr>
          <td align="center" style="border-radius: 6px; background-color: ${btnColor};">
            <a href="${actionUrl}" class="email-btn invoice-btn" style="display: inline-block; padding: 14px 28px; background-color: ${btnColor}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; font-family: ${EMAIL_SYSTEM_FONTS}; text-align: center; -webkit-text-size-adjust: none;">${label}</a>
          </td>
        </tr>
      </table>
    </div>`;
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
        <div class="invoice-header" style="padding: 0 0 16px 0; text-align: center;">
          <h1 style="margin: 0; color: #0f172a; font-family: ${EMAIL_SYSTEM_FONTS}; font-size: 22px; font-weight: 700; line-height: 1.3;">New Invoice</h1>
        </div>
        <p class="invoice-text" style="margin: 0 0 14px 0; color: #334155; font-family: ${EMAIL_SYSTEM_FONTS}; font-size: 16px; line-height: 1.6;">Hi ${data.recipientName},</p>
        <p class="invoice-text" style="margin: 0 0 16px 0; color: #334155; font-family: ${EMAIL_SYSTEM_FONTS}; font-size: 16px; line-height: 1.6;">${data.senderName || data.workspaceName} has sent you a new invoice.</p>
        <div class="invoice-amount" style="font-size: 28px; font-weight: 700; color: #0f172a; text-align: center; margin: 20px 0; font-family: ${EMAIL_SYSTEM_FONTS};">${formatCurrency(data.amount, data.currency)}</div>
        ${renderInvoiceCard(data)}
        ${renderInvoiceButton(data.actionUrl, 'View &amp; Pay Invoice', '#0284c7')}
        ${pixel}`;
        return wrapInvoiceEmail(`Invoice ${data.invoiceNumber}`, content, data);
    },

    invoiceOverdue(data: InvoiceEmailData): string {
        const pixel = data.trackingPixelUrl
            ? `<img src="${data.trackingPixelUrl}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`
            : '';
        const content = `
        <div class="invoice-header" style="padding: 0 0 16px 0; text-align: center;">
          <h1 style="margin: 0; color: #dc2626; font-family: ${EMAIL_SYSTEM_FONTS}; font-size: 22px; font-weight: 700; line-height: 1.3;">Invoice Overdue</h1>
        </div>
        <p class="invoice-text" style="margin: 0 0 14px 0; color: #334155; font-family: ${EMAIL_SYSTEM_FONTS}; font-size: 16px; line-height: 1.6;">Hi ${data.recipientName},</p>
        <p class="invoice-text" style="margin: 0 0 16px 0; color: #334155; font-family: ${EMAIL_SYSTEM_FONTS}; font-size: 16px; line-height: 1.6;">This is a friendly reminder that an invoice from ${data.senderName || data.workspaceName} is now past due.</p>
        <div class="invoice-amount" style="font-size: 28px; font-weight: 700; color: #dc2626; text-align: center; margin: 20px 0; font-family: ${EMAIL_SYSTEM_FONTS};">${formatCurrency(data.amount, data.currency)}</div>
        ${renderInvoiceCard(data, '#dc2626')}
        ${renderInvoiceButton(data.actionUrl, 'View &amp; Pay Invoice', '#dc2626')}
        ${pixel}`;
        return wrapInvoiceEmail(`Overdue: Invoice ${data.invoiceNumber}`, content, data);
    },

    invoiceViewedReminder(data: InvoiceEmailData): string {
        const pixel = data.trackingPixelUrl
            ? `<img src="${data.trackingPixelUrl}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`
            : '';
        const content = `
        <div class="invoice-header" style="padding: 0 0 16px 0; text-align: center;">
          <h1 style="margin: 0; color: #4f46e5; font-family: ${EMAIL_SYSTEM_FONTS}; font-size: 22px; font-weight: 700; line-height: 1.3;">Quick Reminder</h1>
        </div>
        <p class="invoice-text" style="margin: 0 0 14px 0; color: #334155; font-family: ${EMAIL_SYSTEM_FONTS}; font-size: 16px; line-height: 1.6;">Hi ${data.recipientName},</p>
        <p class="invoice-text" style="margin: 0 0 16px 0; color: #334155; font-family: ${EMAIL_SYSTEM_FONTS}; font-size: 16px; line-height: 1.6;">We noticed you recently viewed invoice ${data.invoiceNumber} from ${data.senderName || data.workspaceName}. We wanted to make it easy for you to complete payment.</p>
        <div class="invoice-amount" style="font-size: 28px; font-weight: 700; color: #0f172a; text-align: center; margin: 20px 0; font-family: ${EMAIL_SYSTEM_FONTS};">${formatCurrency(data.amount, data.currency)}</div>
        ${renderInvoiceCard(data)}
        ${renderInvoiceButton(data.actionUrl, 'Complete Payment', '#4f46e5')}
        ${pixel}`;
        return wrapInvoiceEmail(`Following Up: Invoice ${data.invoiceNumber}`, content, data);
    },

    invoiceNotOpenedReminder(data: InvoiceEmailData): string {
        const pixel = data.trackingPixelUrl
            ? `<img src="${data.trackingPixelUrl}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`
            : '';
        const content = `
        <div class="invoice-header" style="padding: 0 0 16px 0; text-align: center;">
          <h1 style="margin: 0; color: #0284c7; font-family: ${EMAIL_SYSTEM_FONTS}; font-size: 22px; font-weight: 700; line-height: 1.3;">Following Up on Your Invoice</h1>
        </div>
        <p class="invoice-text" style="margin: 0 0 14px 0; color: #334155; font-family: ${EMAIL_SYSTEM_FONTS}; font-size: 16px; line-height: 1.6;">Hi ${data.recipientName},</p>
        <p class="invoice-text" style="margin: 0 0 16px 0; color: #334155; font-family: ${EMAIL_SYSTEM_FONTS}; font-size: 16px; line-height: 1.6;">We wanted to make sure you received invoice ${data.invoiceNumber} from ${data.senderName || data.workspaceName}.</p>
        <div class="invoice-amount" style="font-size: 28px; font-weight: 700; color: #0f172a; text-align: center; margin: 20px 0; font-family: ${EMAIL_SYSTEM_FONTS};">${formatCurrency(data.amount, data.currency)}</div>
        ${renderInvoiceCard(data)}
        ${renderInvoiceButton(data.actionUrl, 'View Invoice', '#0284c7')}
        ${pixel}`;
        return wrapInvoiceEmail(`Re: Invoice ${data.invoiceNumber}`, content, data);
    },
};

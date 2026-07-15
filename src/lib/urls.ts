/**
 * AppUrls - Centralized URL builder for AlphaClone
 * Standardizes redirects and links across email templates, dashboards, and services.
 */

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(/^https:\/\/www\./, 'https://');

export const AppUrls = {
  // Public Signing (canonical native contract portal)
  signContract: (token: string) => `${BASE_URL}/contract/${token}`,

  // Public Payment
  payInvoice: (invoiceId: string, publicToken?: string) =>
    publicToken
      ? `${BASE_URL}/invoice/${invoiceId}?token=${encodeURIComponent(publicToken)}`
      : `${BASE_URL}/invoice/${invoiceId}`,

  clientFinancePortal: (token: string) => `${BASE_URL}/portal/${token}`,

  // Public Document View
  viewDocument: (docId: string, type: 'invoice' | 'contract' | 'receipt', token?: string) => {
    if (type === 'contract') return `${BASE_URL}/contract/${docId}`;
    if (type === 'invoice') return AppUrls.payInvoice(docId, token);
    return `${BASE_URL}/public/receipt/${docId}`;
  },
    
  viewReceipt: (docId: string) => `${BASE_URL}/public/receipt/${docId}`,
    
  // Dashboard Routes
  dashboard: () => `${BASE_URL}/dashboard`,
  finance: () => `${BASE_URL}/dashboard?tab=finance`,
  accounting: () => `${BASE_URL}/dashboard?tab=accounting`,
  
  // Auth
  login: () => `${BASE_URL}/auth/login`,
};

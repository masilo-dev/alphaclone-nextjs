/**
 * AppUrls - Centralized URL builder for AlphaClone
 * Standardizes redirects and links across email templates, dashboards, and services.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.alphaclonesystems.com';

export const AppUrls = {
  // Public Signing
  signContract: (token: string) => `${BASE_URL}/sign/${token}`,
  
  // Public Payment
  payInvoice: (invoiceId: string) => `${BASE_URL}/pay/${invoiceId}`,
  
  // Public Document View
  viewDocument: (docId: string, type: 'invoice' | 'contract' | 'receipt') => 
    `${BASE_URL}/view/${type}/${docId}`,
    
  viewReceipt: (docId: string) => `${BASE_URL}/public/receipt/${docId}`,
    
  // Dashboard Routes
  dashboard: () => `${BASE_URL}/dashboard`,
  finance: () => `${BASE_URL}/dashboard?tab=finance`,
  accounting: () => `${BASE_URL}/dashboard?tab=accounting`,
  
  // Auth
  login: () => `${BASE_URL}/sign-in`,
};

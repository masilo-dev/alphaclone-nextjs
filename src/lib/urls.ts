/**
 * AppUrls - Centralized URL builder for AlphaClone
 * Standardizes redirects and links across email templates, dashboards, and services.
 * Customer-facing links always go through publicUrlGuard (zero-localhost).
 */

import { buildValidatedPublicUrl, getProductionBaseUrl, validatePublicUrl } from '@/lib/urls/publicUrlGuard';

export { validatePublicUrl, buildValidatedPublicUrl, getProductionBaseUrl };

export const AppUrls = {
  // Public Signing (canonical native contract portal)
  signContract: (token: string) => buildValidatedPublicUrl(`/contract/${encodeURIComponent(token)}`),

  // Public Payment
  payInvoice: (invoiceId: string, publicToken?: string) =>
    publicToken
      ? buildValidatedPublicUrl(`/invoice/${invoiceId}?token=${encodeURIComponent(publicToken)}`)
      : buildValidatedPublicUrl(`/invoice/${invoiceId}`),

  clientFinancePortal: (token: string) =>
    buildValidatedPublicUrl(`/portal/${encodeURIComponent(token)}`),

  // Public Document View
  viewDocument: (docId: string, type: 'invoice' | 'contract' | 'receipt', token?: string) => {
    if (type === 'contract') return buildValidatedPublicUrl(`/contract/${docId}`);
    if (type === 'invoice') return AppUrls.payInvoice(docId, token);
    return buildValidatedPublicUrl(`/public/receipt/${docId}`);
  },

  viewReceipt: (docId: string) => buildValidatedPublicUrl(`/public/receipt/${docId}`),

  // Dashboard Routes
  dashboard: () => buildValidatedPublicUrl('/dashboard'),
  finance: () => buildValidatedPublicUrl('/dashboard?tab=finance'),
  accounting: () => buildValidatedPublicUrl('/dashboard?tab=accounting'),

  // Auth
  login: () => buildValidatedPublicUrl('/auth/login'),
};

/**
 * Contract Email Templates — body fragments wrapped by buildEmail() at send time.
 */

import { buildEmail } from '@/lib/email/template';

export interface ContractEmailData {
    recipientEmail: string;
    tenantId: string;
    contractTitle: string;
    contractType: string;
    signingUrl: string;
    workspaceName: string;
    customMessage?: string;
}

const CONTRACT_BODY_STYLES = `
  .contract-header { padding: 0 0 24px 0; text-align: center; }
  .contract-header h1 { margin: 0; color: #0f172a; font-size: 22px; font-weight: bold; }
  .contract-text { margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.5; }
  .contract-message { background-color: #f1f5f9; border-left: 4px solid #14b8a6; padding: 16px 20px; font-style: italic; color: #475569; font-size: 15px; line-height: 22px; border-radius: 0 8px 8px 0; margin-bottom: 24px; }
  .contract-card { background-color: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px; border: 1px solid #e2e8f0; }
  .contract-row { margin-bottom: 8px; color: #64748b; font-size: 14px; }
  .contract-val { color: #0f172a; float: right; font-weight: 500; }
  .contract-btn-wrap { text-align: center; padding: 16px 0; }
  .contract-btn { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
`;

export const contractEmailTemplates = {
    signatureRequest(data: ContractEmailData): string {
        const content = `
        <div class="contract-header">
          <h1>Signature Request</h1>
        </div>
        <p class="contract-text">Hello,</p>
        <p class="contract-text">You have been requested by <strong>${data.workspaceName}</strong> to review and sign the contract: <strong>${data.contractTitle}</strong>.</p>
        ${data.customMessage ? `<div class="contract-message">"${data.customMessage}"</div>` : ''}
        <div class="contract-card">
          <div class="contract-row">Document Type <span class="contract-val">${data.contractType}</span></div>
          <div class="contract-row">Link Expiration <span class="contract-val">14 Days (Tied to ${data.recipientEmail})</span></div>
        </div>
        <div class="contract-btn-wrap">
          <a href="${data.signingUrl}" class="contract-btn">Review &amp; Sign Contract</a>
        </div>`;

        const bodyHtml = `<style>${CONTRACT_BODY_STYLES}</style>${content}`;
        return buildEmail({
            subject: `Contract: ${data.contractTitle}`,
            bodyHtml,
            tenantName: data.workspaceName,
            tenantId: data.tenantId,
            recipientEmail: data.recipientEmail,
        });
    },
};

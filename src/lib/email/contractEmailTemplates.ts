/**
 * Contract Email Templates
 */

export interface ContractEmailData {
    recipientEmail: string;
    contractTitle: string;
    contractType: string;
    signingUrl: string;
    workspaceName: string;
    customMessage?: string;
}

const baseHtml = (content: string, workspaceName: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 40px; margin-bottom: 40px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); padding: 32px; text-align: center; }
    .header h1 { margin: 0; color: white; font-size: 24px; font-weight: bold; }
    .content { padding: 32px; }
    .text { margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.5; }
    .custom-message { background-color: #f1f5f9; border-left: 4px solid #14b8a6; padding: 16px 20px; font-style: italic; color: #475569; font-size: 15px; line-height: 22px; border-radius: 0 8px 8px 0; margin-bottom: 24px; }
    .card { background-color: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px; border: 1px solid #e2e8f0; }
    .row { margin-bottom: 8px; color: #64748b; font-size: 14px; }
    .val { color: #0f172a; float: right; font-weight: 500;}
    .btn-container { text-align: center; padding: 16px 0; }
    .btn { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px -1px rgb(20 184 166 / 0.2); }
    .footer { padding: 24px; background-color: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer-text { margin: 0 0 8px 0; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    ${content}
    <div class="footer">
      <p class="footer-text">${workspaceName}</p>
      <p style="margin: 0; color: #94a3b8; font-size: 11px;">This is a secure electronic signature link. Please do not forward this email.</p>
    </div>
  </div>
</body>
</html>
`;

export const contractEmailTemplates = {
    signatureRequest(data: ContractEmailData): string {
        const content = `
        <div class="header">
          <h1>Signature Request</h1>
        </div>
        <div class="content">
          <p class="text">Hello,</p>
          <p class="text">You have been requested by <strong>${data.workspaceName}</strong> to review and sign the contract: <strong>${data.contractTitle}</strong>.</p>
          
          ${data.customMessage ? `<div class="custom-message">"${data.customMessage}"</div>` : ''}

          <div class="card">
            <div class="row">Document Type <span class="val">${data.contractType}</span></div>
            <div class="row">Link Expiration <span class="val">14 Days (Tied to ${data.recipientEmail})</span></div>
          </div>
          
          <div class="btn-container">
            <a href="${data.signingUrl}" class="btn">Review & Sign Contract</a>
          </div>
        </div>
        `;
        return baseHtml(content, data.workspaceName);
    }
};

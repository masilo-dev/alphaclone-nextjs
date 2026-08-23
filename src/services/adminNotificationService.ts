import { sendEmailServer } from '@/lib/server/emailSendingServer';

export interface UserSignupPayload {
  userId: string;
  email: string;
  fullName?: string;
  companyName?: string;
  businessType?: string;
  tenantId?: string;
}

export async function notifyAdminOnUserSignup(payload: UserSignupPayload): Promise<boolean> {
  const adminEmail = 'bonnie@alphaclonesystems.com';
  const html = `
    <div style="font-family: sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc; border-radius: 12px;">
      <h2 style="color: #14b8a6; margin-top: 0;">🚀 New User Signup Alert</h2>
      <p>A new user has registered on AlphaClone Systems.</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; color: #cbd5e1;">
        <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${payload.email}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">User ID:</td><td style="padding: 8px;">${payload.userId}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Full Name:</td><td style="padding: 8px;">${payload.fullName || 'N/A'}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Company:</td><td style="padding: 8px;">${payload.companyName || 'N/A'}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Business Type:</td><td style="padding: 8px;">${payload.businessType || 'N/A'}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Workspace ID:</td><td style="padding: 8px;">${payload.tenantId || 'N/A'}</td></tr>
      </table>
      <p style="margin-top: 24px; font-size: 12px; color: #64748b;">AlphaClone Admin Automation Engine</p>
    </div>
  `;

  try {
    const result = await sendEmailServer({
      tenantId: payload.tenantId || 'system',
      userId: payload.userId,
      to: adminEmail,
      subject: `[AlphaClone Admin] New Signup: ${payload.email}`,
      html,
      text: `New signup: ${payload.email} (${payload.fullName || 'No name'})`,
      fromName: 'AlphaClone Platform System',
    });
    return result.success;
  } catch (err) {
    console.error('[notifyAdminOnUserSignup] Error:', err);
    return false;
  }
}

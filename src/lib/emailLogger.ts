import { createSupabaseAdminClient } from './supabase-admin';

export interface EmailLogData {
  tenantId?: string | null;
  userId?: string | null;
  provider: string;
  toEmail: string;
  subject?: string;
  templateName?: string;
  status: 'sent' | 'failed' | 'skipped';
  error?: string;
  emailId?: string;
  metadata?: Record<string, any>;
}

export async function logEmailSend(data: EmailLogData): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    
    // Ensure text fields don't exceed reasonable limits
    const safeError = data.error ? String(data.error).substring(0, 2000) : null;
    const safeSubject = data.subject ? String(data.subject).substring(0, 500) : null;

    const { error } = await supabase
      .from('email_logs')
      .insert({
        tenant_id: data.tenantId || null,
        user_id: data.userId || null,
        provider: data.provider,
        to_email: data.toEmail,
        subject: safeSubject,
        template_name: data.templateName || null,
        status: data.status,
        error: safeError,
        email_id: data.emailId || null,
        metadata: data.metadata || null
      });

    if (error) {
      console.error('[emailLogger] Failed to insert email log:', error);
    }
  } catch (err) {
    console.error('[emailLogger] Unexpected error logging email:', err);
  }
}

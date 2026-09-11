import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';
import { emitBusinessEvent } from '@/lib/automation/emit-event';

export async function intakeExternalFormSubmission(params: {
  provider: 'typeform' | 'tally';
  tenantSlug: string;
  formSlug: string;
  payload: Record<string, unknown>;
  secretHeader?: string | null;
}) {
  const admin = createAdminSupabaseClientOrThrow();
  const { provider, tenantSlug, formSlug, payload, secretHeader } = params;

  const { data: tenant } = await admin.from('tenants').select('id, name').eq('slug', tenantSlug).maybeSingle();
  if (!tenant) return { ok: false as const, status: 404, error: 'Workspace not found' };

  const { data: form } = await admin
    .from('tenant_forms')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('slug', formSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!form) return { ok: false as const, status: 404, error: 'Form not found' };

  const settings = (form.settings || {}) as Record<string, unknown>;
  const expectedSecret = String(settings.webhookSecret || '').trim();
  if (expectedSecret && secretHeader !== expectedSecret) {
    return { ok: false as const, status: 401, error: 'Invalid webhook secret' };
  }

  const flat: Record<string, string> = {};
  if (provider === 'typeform') {
    const formResponse = payload.form_response as Record<string, unknown> | undefined;
    const answers = formResponse?.answers;
    if (Array.isArray(answers)) {
      for (const ans of answers) {
        const a = ans as Record<string, unknown>;
        const field = a.field as Record<string, unknown> | undefined;
        const choice = a.choice as Record<string, unknown> | undefined;
        const key = String(field?.ref || field?.id || 'answer');
        flat[key] = String(a.text || a.email || a.phone_number || a.number || choice?.label || a.url || '').trim();
      }
    }
  } else {
    const data = payload.data as Record<string, unknown> | undefined;
    const fields = data?.fields;
    if (Array.isArray(fields)) {
      for (const f of fields) {
        const row = f as Record<string, unknown>;
        flat[String(row.label || row.key || 'field')] = String(row.value || '').trim();
      }
    }
  }

  const email = Object.values(flat).find((v) => v.includes('@')) || null;
  const name = flat.name || flat.full_name || flat['Full Name'] || null;

  const { data: submission, error: subError } = await admin
    .from('form_submissions')
    .insert({
      form_id: form.id,
      tenant_id: tenant.id,
      data: flat,
      submitter_name: name,
      submitter_email: email,
      status: 'new',
    })
    .select()
    .single();
  if (subError) throw subError;

  await admin
    .from('tenant_forms')
    .update({
      submission_count: Number(form.submission_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', form.id);

  if (settings.createLead !== false) {
    await admin.from('leads').insert({
      tenant_id: tenant.id,
      name: name || email || `${provider} lead`,
      email,
      source: `${provider}:${form.slug}`,
      status: 'new',
      notes: JSON.stringify(flat),
    });
  }

  try {
    await emitBusinessEvent(tenant.id, 'form_submitted', {
      source: provider,
      formId: form.id,
      submissionId: submission.id,
      email,
      name,
    });
  } catch {
    // optional automation table
  }

  return { ok: true as const, status: 200, submissionId: submission.id };
}

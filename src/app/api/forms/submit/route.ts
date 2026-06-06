import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';
import type { FormField } from '@/types/tenantForms';

export const dynamic = 'force-dynamic';

const submitSchema = z.object({
  tenantSlug: z.string().min(1),
  formSlug: z.string().min(1).optional(),
  data: z.record(z.string(), z.string()),
});

function pickValue(data: Record<string, string>, fields: FormField[], keys: string[]): string | null {
  for (const key of keys) {
    const field = fields.find((f) => f.id === key || f.label.toLowerCase() === key);
    const raw = field ? data[field.id] : data[key];
    const val = String(raw || '').trim();
    if (val) return val;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { tenantSlug, formSlug = 'contact', data: rawData } = parsed.data;
    const data: Record<string, string> = rawData;
    const admin = createAdminSupabaseClientOrThrow();

    const { data: tenant } = await admin.from('tenants').select('id, name').eq('slug', tenantSlug).maybeSingle();
    if (!tenant) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    let formQuery = admin
      .from('tenant_forms')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true);
    formQuery = formSlug === 'contact'
      ? formQuery.or('slug.eq.contact,is_default.eq.true')
      : formQuery.eq('slug', formSlug);

    const { data: form } = await formQuery.order('is_default', { ascending: false }).limit(1).maybeSingle();
    if (!form) {
      return NextResponse.json({ error: 'Form not found or inactive' }, { status: 404 });
    }

    const fields = (form.fields || []) as FormField[];
    for (const field of fields) {
      if (field.required) {
        const val = String(data[field.id] || '').trim();
        if (!val) {
          return NextResponse.json({ error: `${field.label} is required` }, { status: 400 });
        }
      }
    }

    const name = pickValue(data, fields, ['name', 'full_name', 'fullname']);
    const email = pickValue(data, fields, ['email', 'email_address']);
    const phone = pickValue(data, fields, ['phone', 'phone_number', 'mobile']);
    const message = pickValue(data, fields, ['message', 'notes', 'details']) || JSON.stringify(data);

    const { data: submission, error: subError } = await admin
      .from('form_submissions')
      .insert({
        form_id: form.id,
        tenant_id: tenant.id,
        data,
        submitter_name: name,
        submitter_email: email,
        submitter_phone: phone,
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

    const settings = (form.settings || {}) as Record<string, unknown>;
    if (settings.createLead !== false) {
      try {
        await admin.from('leads').insert({
          tenant_id: tenant.id,
          name: name || email || 'Form lead',
          email: email || null,
          phone: phone || null,
          source: `form:${form.slug}`,
          status: 'new',
          notes: message,
        });
      } catch (leadErr) {
        console.warn('[forms/submit] lead insert skipped:', leadErr);
      }
    }

    try {
      const { emitBusinessEvent } = await import('@/lib/automation/emit-event');
      await emitBusinessEvent(tenant.id, 'lead_created', {
        source: 'branded_form',
        formId: form.id,
        submissionId: submission.id,
        email,
        name,
      });
    } catch {
      // automation table may not exist yet
    }

    const thankYou = String(settings.thankYouMessage || 'Thank you! We will be in touch soon.');
    return NextResponse.json({ success: true, thankYouMessage: thankYou, submissionId: submission.id });
  } catch (err: any) {
    console.error('[forms/submit]', err);
    return NextResponse.json({ error: err.message || 'Submission failed' }, { status: 500 });
  }
}

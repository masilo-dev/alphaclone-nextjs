import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// CORS headers to allow embeddable form submissions from external client websites
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const embedLeadSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(80).optional().default(''),
  company: z.string().trim().max(160).optional().default(''),
  message: z.string().trim().max(5000).optional().default(''),
  website: z.string().max(200).optional().default(''),
  form_started_at: z.coerce.number().int().positive().optional(),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const parsed = embedLeadSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'A valid workspace, name, and email are required. Text fields must be within the allowed length.' },
        { status: 400, headers: corsHeaders }
      );
    }
    const { tenant_id, name, email, phone, company, message, website, form_started_at } = parsed.data;
    if (website) {
      return NextResponse.json({ success: true, message: 'Lead submitted successfully' }, { status: 200, headers: corsHeaders });
    }
    if (form_started_at) {
      const elapsed = Date.now() - form_started_at;
      if (elapsed < 1500 || elapsed > 86_400_000) {
        return NextResponse.json({ error: 'Please complete the form normally and try again.' }, { status: 400, headers: corsHeaders });
      }
    }

    const admin = createSupabaseAdminClient();

    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .select('id')
      .eq('id', tenant_id)
      .maybeSingle();
    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'This lead form is not available.' }, { status: 404, headers: corsHeaders });
    }

    // Insert lead into Supabase leads table
    const { data: lead, error } = await admin
      .from('leads')
      .insert({
        tenant_id,
        business_name: company || name,
        email,
        phone: phone || null,
        notes: message || 'Inbound Web Lead Form',
        source: 'embed_form',
        stage: 'lead',
        status: 'new',
      })
      .select()
      .single();

    if (error) {
      console.error('[Embed Lead Route] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json(
      { success: true, lead_id: lead.id, message: 'Lead submitted successfully' },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error('[Embed Lead Route] Exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}

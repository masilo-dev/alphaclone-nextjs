import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// CORS headers to allow embeddable form submissions from external client websites
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, name, email, phone, company, message } = body;

    if (!tenant_id || !name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: tenant_id, name, and email are required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const admin = createSupabaseAdminClient();

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
        stage: 'new',
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

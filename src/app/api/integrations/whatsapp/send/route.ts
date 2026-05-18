import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, phone, message, integrationId } = body;

    if (!tenantId || !phone || !message) {
      return NextResponse.json({ error: 'tenantId, phone, and message are required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    // 1. Fetch Integration
    let query = supabase
      .from('whatsapp_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (integrationId) {
      query = query.eq('id', integrationId);
    }

    const { data: integration, error: intError } = await query.maybeSingle();

    if (intError || !integration) {
      return NextResponse.json({ error: 'No active WhatsApp integration found.' }, { status: 404 });
    }

    const idInstance = integration.waba_id;
    const apiTokenInstance = integration.metadata?.apiTokenInstance;

    if (!idInstance || !apiTokenInstance) {
      return NextResponse.json({ error: 'WhatsApp instance is not fully configured.' }, { status: 400 });
    }

    // 2. Format phone number to clean digit sequence
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // 3. Send message to Green API
    const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
    const greenApiResp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: `${cleanPhone}@c.us`,
        message: message
      })
    });

    if (!greenApiResp.ok) {
      const errText = await greenApiResp.text();
      return NextResponse.json({ error: `Green API Error: ${errText}` }, { status: greenApiResp.status });
    }

    const greenApiData = await greenApiResp.json();

    // 4. Save to Unified Messages
    // Try to find if contact exists in CRM
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`phone.ilike.%${cleanPhone}%,mobile.ilike.%${cleanPhone}%`)
      .maybeSingle();

    const { data: unifiedMsg, error: insertError } = await supabase
      .from('unified_messages')
      .insert({
        tenant_id: tenantId,
        source: 'whatsapp',
        external_id: greenApiData?.idMessage || `wa_out_${Date.now()}`,
        direction: 'outbound',
        channel: 'chat',
        body: message,
        from_address: idInstance,
        to_address: cleanPhone,
        contact_id: contact?.id || null,
        read: true,
        replied: true,
        starred: false,
        archived: false,
        folder: 'sent',
        priority: 'normal',
        needs_response: false,
        sent_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to log message in unified_messages', insertError);
    }

    return NextResponse.json({ success: true, message: unifiedMsg });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to send WhatsApp message', request);
  }
}

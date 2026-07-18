import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const adminRoles = ['owner', 'admin', 'tenant_admin', 'super_admin'];
const schema = z.object({ chatbot_enabled: z.boolean() });

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('whatsapp_chatbot_settings').select('chatbot_enabled').eq('tenant_id', tenantId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ chatbotEnabled: Boolean(data?.chatbot_enabled) });
  } catch (error) {
    return routeErrorResponse(error, 'WhatsApp chatbot settings could not be loaded', req);
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, adminRoles, req);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid chatbot setting' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('whatsapp_chatbot_settings').upsert({ tenant_id: tenantId, chatbot_enabled: parsed.data.chatbot_enabled, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' }).select('chatbot_enabled').single();
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'whatsapp_chatbot_setting_updated', payload: { enabled: data.chatbot_enabled, actorUserId: user.id } });
    return NextResponse.json({ chatbotEnabled: data.chatbot_enabled });
  } catch (error) {
    return routeErrorResponse(error, 'WhatsApp chatbot settings could not be saved', req);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const schema = z.object({ message: z.string().trim().min(1).max(5000) });

export async function POST(req: NextRequest, context: { params: Promise<{ callId: string }> }) {
  try {
    const { callId } = await context.params;
    if (!z.string().uuid().safeParse(callId).success) return NextResponse.json({ error: 'Valid callId required' }, { status: 400 });
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: call, error: callError } = await admin.from('video_calls').select('tenant_id').eq('id', callId).maybeSingle();
    if (callError) throw callError;
    if (!call) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    const { user } = await requireTenantAccess(call.tenant_id, req);
    const { data: profile } = await admin.from('profiles').select('full_name, name').eq('id', user.id).maybeSingle();
    const { data, error } = await admin.from('meeting_chat_messages').insert({ video_call_id: callId, sender_id: user.id, sender_name: profile?.full_name || profile?.name || user.email || 'Workspace member', message: parsed.data.message }).select('*').single();
    if (error) throw error;
    return NextResponse.json({ message: data }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Meeting message could not be sent', req); }
}

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, accepted } = body as { token?: string; accepted?: boolean };
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: proposal, error } = await admin
      .from('proposals')
      .update({
        status: accepted ? 'accepted' : 'rejected',
        accepted_at: accepted ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('public_token', token)
      .select('id, status')
      .maybeSingle();

    if (error || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, proposal });
  } catch {
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 });
  }
}

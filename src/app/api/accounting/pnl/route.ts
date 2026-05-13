
import { NextRequest, NextResponse } from 'next/server';
import { generatePnLStatement } from '@/lib/accounting/pnl';
import { auth } from '@clerk/nextjs/server'; // Assuming Clerk is used for auth based on .env
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') || 'monthly') as 'monthly' | 'quarterly' | 'yearly';
    const fromDate = searchParams.get('from_date') || undefined;
    const toDate = searchParams.get('to_date') || undefined;
    
    // Auth check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    
    // Get tenant_id for the user
    // In this app, it seems profiles table links user to tenant
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.tenant_id) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const statement = await generatePnLStatement(
      profile.tenant_id,
      period,
      fromDate,
      toDate
    );

    return NextResponse.json(statement);
  } catch (err: any) {
    console.error('[PnL API] Error:', err);
    return NextResponse.json({ 
      error: 'Failed to generate P&L statement',
      message: err.message 
    }, { status: 500 });
  }
}

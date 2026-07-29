
import { NextRequest, NextResponse } from 'next/server';
import { generatePnLStatement } from '@/lib/accounting/pnl';
<<<<<<< HEAD
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { z } from 'zod';
=======
import { requireAuthenticatedUser } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
>>>>>>> origin/main

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') || 'monthly') as 'monthly' | 'quarterly' | 'yearly';
    const fromDate = searchParams.get('from_date') || undefined;
    const toDate = searchParams.get('to_date') || undefined;
<<<<<<< HEAD
    const tenantId = z.string().uuid().parse(searchParams.get('tenantId'));
    await requireTenantAccess(tenantId);

    const statement = await generatePnLStatement(
      tenantId,
=======
    
    // Auth check
    const { user } = await requireAuthenticatedUser();
    const userId = user.id;

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
>>>>>>> origin/main
      period,
      fromDate,
      toDate
    );

    return NextResponse.json(statement);
<<<<<<< HEAD
  } catch (err: unknown) {
    console.error('[PnL API] Error:', err);
    return routeErrorResponse(err, 'Failed to generate P&L statement', req);
=======
  } catch (err: any) {
    console.error('[PnL API] Error:', err);
    return NextResponse.json({ 
      error: 'Failed to generate P&L statement',
      message: err.message 
    }, { status: 500 });
>>>>>>> origin/main
  }
}

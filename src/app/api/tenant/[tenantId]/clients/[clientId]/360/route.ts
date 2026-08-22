import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { customer360Service } from '@/services/intelligence/customer360Service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; clientId: string }> }
) {
  try {
    const { tenantId, clientId } = await params;
    const admin = createSupabaseAdminClient();

    // Fetch client email or record
    const { data: client } = await admin
      .from('business_clients')
      .select('email, name, company')
      .eq('tenant_id', tenantId)
      .eq('id', clientId)
      .maybeSingle();

    const targetEmail = client?.email || clientId;

    const profile = await customer360Service.buildProfile(admin, tenantId, targetEmail);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch Client 360 profile' }, { status: 500 });
  }
}

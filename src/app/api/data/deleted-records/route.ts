import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  restoreContactById,
  restoreClientById,
  purgeContactById,
} from '@/lib/crm/softDeleteContact';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({
  tenantId: z.string().uuid(),
  action: z.enum(['restore', 'purge']),
  type: z.enum(['contact', 'client']),
  id: z.string().uuid(),
});

type DeletedContactRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  deleted_at: string | null;
};

type DeletedClientRow = {
  id: string;
  name: string | null;
  email: string | null;
  updated_at: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();

    const [{ data: contacts }, { data: clients }] = await Promise.all([
      admin
        .from('contacts')
        .select('id, full_name, email, deleted_at, status')
        .eq('tenant_id', tenantId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(100),
      admin
        .from('business_clients')
        .select('id, name, email, is_active, updated_at')
        .eq('tenant_id', tenantId)
        .eq('is_active', false)
        .order('updated_at', { ascending: false })
        .limit(100),
    ]);

    return NextResponse.json({
      contacts: ((contacts || []) as DeletedContactRow[]).map((c) => ({
        id: c.id,
        name: c.full_name,
        email: c.email,
        deletedAt: c.deleted_at,
        type: 'contact' as const,
      })),
      clients: ((clients || []) as DeletedClientRow[]).map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        deletedAt: c.updated_at,
        type: 'client' as const,
      })),
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load deleted records');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = actionSchema.parse(await request.json());
    await requireTenantAccess(body.tenantId);
    const admin = createSupabaseAdminClient();

    if (body.action === 'restore') {
      const result =
        body.type === 'contact'
          ? await restoreContactById(admin, body.tenantId, body.id)
          : await restoreClientById(admin, body.tenantId, body.id);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, action: 'restored' });
    }

    if (body.type === 'client') {
      return NextResponse.json(
        { error: 'Permanent purge is only supported for contacts' },
        { status: 400 }
      );
    }

    const result = await purgeContactById(admin, body.tenantId, body.id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, action: 'purged' });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to update deleted record');
  }
}

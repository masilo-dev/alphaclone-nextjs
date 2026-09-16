import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import 'server-only';

import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireClientPortalAccessDoubleGuarded } from '@/lib/auth/clientPortalAuth';
import { resolveClientByPortalToken } from '@/services/finance/clientFinancePortalService';
import { getClientScopedActivity } from '@/services/finance/workspaceActivityService';

const schema = z.object({
  token: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

function mapAuthError(code: string): { status: number; message: string } {
  switch (code) {
    case 'NO_SESSION':
    case 'BAD_TOKEN':
    case 'SALT_ROTATED':
    case 'SESSION_REVOKED':
      return { status: 401, message: 'Session expired or invalid. Please log in again.' };
    case 'CLIENT_INACTIVE':
      return { status: 403, message: 'This portal account is not active.' };
    case 'TOKEN_MISMATCH':
      return { status: 403, message: 'Session does not match this portal.' };
    case 'BAD_PORTAL_TOKEN':
      return { status: 404, message: 'Portal not found.' };
    case 'INTERNAL_ERROR':
      return { status: 500, message: 'Server error.' };
    default:
      return { status: 403, message: 'Access denied.' };
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = schema.safeParse({
      token: searchParams.get('token'),
      limit: searchParams.get('limit'),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Valid portal token is required.' },
        { status: 400 }
      );
    }
    const { token, limit } = parsed.data;
    const admin = await resolveSupabaseAdminClient();
    const guarded = await requireClientPortalAccessDoubleGuarded(
      admin,
      token,
      resolveClientByPortalToken
    );
    if (!guarded.ok) {
      const { status, message } = mapAuthError(guarded.error.code);
      return NextResponse.json(
        { error: message, code: guarded.error.code },
        { status }
      );
    }
    const client = guarded.resolvedClient;
    const { activity } = await getClientScopedActivity(
      admin,
      client.tenant_id,
      client.id,
      { limit: limit ?? 10 }
    );
    return NextResponse.json({ activity });
  } catch (error) {
    console.error('[client-finance/activity]', error);
    return NextResponse.json(
      { error: 'Activity could not be loaded' },
      { status: 500 }
    );
  }
}

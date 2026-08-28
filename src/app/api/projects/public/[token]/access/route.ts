import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  loadPublicPortalContext,
  loadPublicPortalPayload,
  readPortalPassword,
} from '@/lib/projects/portalPublicHandlers';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token?.trim()) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const password = readPortalPassword(req);
    const access = await loadPublicPortalContext(admin, token.trim(), password);

    if (!access.ok) {
      return NextResponse.json(access.body, { status: access.status });
    }

    const payload = await loadPublicPortalPayload(admin, access.project);
    return NextResponse.json({ success: true, ...payload });
  } catch (error) {
    console.error('[projects/public/access]', error);
    return NextResponse.json({ error: 'Failed to load project portal' }, { status: 500 });
  }
}

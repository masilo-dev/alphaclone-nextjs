import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  loadPublicPortalContext,
  loadPublicPortalPayload,
  readPortalPassword,
} from '@/lib/projects/portalPublicHandlers';

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const password = readPortalPassword(req);
  const ctx = await loadPublicPortalContext(admin, token.trim(), password);

  if (!ctx.ok) {
    return NextResponse.json(ctx.body, { status: ctx.status });
  }

  const payload = await loadPublicPortalPayload(admin, ctx.project);
  return NextResponse.json({ success: true, ...payload });
}

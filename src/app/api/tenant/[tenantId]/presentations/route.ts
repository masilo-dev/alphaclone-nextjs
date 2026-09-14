import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { generateBrandedPresentation } from '@/lib/presentations/generateBrandedPresentation';

const schema = z.object({ title: z.string().trim().min(1).max(160), subtitle: z.string().trim().max(300).optional(), slides: z.array(z.object({ title: z.string().trim().min(1).max(160), body: z.string().trim().max(6000).optional(), bullets: z.array(z.string().trim().min(1).max(500)).max(12).optional() })).min(1).max(30) });
export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try { const { tenantId } = await context.params; const { admin } = await requireTenantAccess(tenantId, req); const parsed = schema.safeParse(await req.json().catch(() => ({}))); if (!parsed.success) return NextResponse.json({ error: 'A title and at least one slide are required' }, { status: 400 }); const { data: tenant } = await admin.from('tenants').select('name').eq('id', tenantId).single(); const buffer = await generateBrandedPresentation({ ...parsed.data, tenantName: tenant?.name || 'AlphaClone' }); return new NextResponse(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'Content-Disposition': `attachment; filename="${parsed.data.title.replace(/[^a-z0-9]+/gi, '_').slice(0, 80)}.pptx"` } }); } catch (error) { return routeErrorResponse(error, 'Presentation could not be generated', req); }
}

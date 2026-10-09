import { NextRequest, NextResponse } from 'next/server';
import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireClientPortalAccessDoubleGuarded } from '@/lib/auth/clientPortalAuth';
import { resolveClientByPortalToken } from '@/services/finance/clientFinancePortalService';
import { loadClientProjects, loadClientProjectDetails } from '@/lib/clientPortal/projects';
import { isUuid } from '@/lib/tenant/platformTenant';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const id = req.nextUrl.searchParams.get('projectId') || '';
  if (!isUuid(token) || !isUuid(id)) return NextResponse.json({error:'Valid portal and project are required'},{status:400});
  try {
    const admin = await resolveSupabaseAdminClient();
    const access = await requireClientPortalAccessDoubleGuarded(admin,token,resolveClientByPortalToken);
    if (!access.ok) return NextResponse.json({error:'Portal access denied',code:access.error.code},{status:access.error.http});
    const client = access.resolvedClient;
    const projects = await loadClientProjects(admin,client.tenant_id,client.id);
    if (!projects.some(project=>project.id===id)) return NextResponse.json({error:'Project not found'},{status:404});
    const details = await loadClientProjectDetails(admin,client.tenant_id,id);
    return NextResponse.json(details,{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) { console.error('[client-finance/project]',error); return NextResponse.json({error:'Project details could not be loaded. Please retry.'},{status:500}); }
}

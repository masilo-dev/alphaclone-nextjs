import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === '42P01' || code === 'PGRST205';
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    const facebookPromise = supabase
      .from('facebook_integrations')
      .select('id, page_id, is_active, page_access_token, metadata, updated_at')
      .eq('tenant_id', tenantId);

    const mcpKeysPromise = supabase
      .from('mcp_api_keys')
      .select('id, is_active, created_at')
      .eq('tenant_id', tenantId);

    const [facebookResult, mcpKeysResult] = await Promise.all([
      facebookPromise,
      mcpKeysPromise
    ]);

    const facebookRows = facebookResult.error
      ? isMissingTableError(facebookResult.error)
        ? []
        : (() => {
            throw facebookResult.error;
          })()
      : facebookResult.data || [];

    const mcpKeyRows = mcpKeysResult.error
      ? isMissingTableError(mcpKeysResult.error)
        ? []
        : (() => {
            throw mcpKeysResult.error;
          })()
      : mcpKeysResult.data || [];

    const activeFacebook = facebookRows.filter(
      (row: any) => row.is_active && row.page_access_token && !row.metadata?.no_pages
    );
    const activeMcpKeys = mcpKeyRows.filter((row: any) => row.is_active);

    const readinessScore = [
      activeFacebook.length > 0 ? 50 : 0,
      activeMcpKeys.length > 0 ? 50 : 0
    ].reduce((sum, value) => sum + value, 0);

    return NextResponse.json({
      success: true,
      data: {
        tenantId,
        readinessScore,
        facebook: {
          total: facebookRows.length,
          active: activeFacebook.length,
          status: activeFacebook.length > 0 ? 'ready' : 'attention_required'
        },
        mcp: {
          apiKeys: activeMcpKeys.length,
          status: activeMcpKeys.length > 0 ? 'ready' : 'attention_required'
        }
      }
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to fetch integration readiness');
  }
}

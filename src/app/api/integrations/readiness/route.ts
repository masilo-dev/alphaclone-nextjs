import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getFacebookTokens } from '@/services/facebook/facebookIntegrationService';

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

    const { admin: supabase } = await requireTenantAccess(tenantId);

    const facebookPromise = supabase
      .from('facebook_integrations')
      .select('id, page_id, is_active, metadata, updated_at, expires_at')
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

    const activeFacebook: typeof facebookRows = [];
    for (const row of facebookRows) {
      if (!row.is_active || row.metadata?.no_pages) continue;
      const tokens = await getFacebookTokens(supabase, row);
      if (tokens.pageAccessToken) activeFacebook.push(row);
    }
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

import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

function appUrl(req: NextRequest): string {
  return (ENV.NEXT_PUBLIC_APP_URL || req.nextUrl.origin || 'https://alphaclonesystems.com').replace(/\/$/, '');
}

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  try {
    const { admin } = await requireTenantAccess(tenantId, req);
    const { data: integration, error } = await admin
      .from('linkedin_integrations')
      .select('id, tenant_id, user_id, is_active, scopes, token_expires_at, updated_at, linkedin_member_id, linkedin_person_urn, metadata')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const { data: lastWebhook } = await admin
      .from('webhook_events')
      .select('id, tenant_id, status, event_type, external_id, error_message, processed_at, created_at')
      .eq('provider', 'linkedin')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const scopes = Array.isArray(integration?.scopes) ? integration.scopes.map(String) : [];
    const requiredScopes = ['w_member_social', 'w_organization_social'];
    const leadScopes = ['r_ads_leadgen_automation', 'r_marketing_leadgen_automation'];
    const missingRequiredScopes = requiredScopes.filter((scope) => !scopes.includes(scope));
    const missingLeadScopes = leadScopes.filter((scope) => !scopes.includes(scope));

    return NextResponse.json({
      success: true,
      webhookUrl: `${appUrl(req)}/api/linkedin/webhook?tenantId=${encodeURIComponent(tenantId)}`,
      legacyLeadWebhookUrl: `${appUrl(req)}/api/webhooks/linkedin/leads?tenantId=${tenantId}`,
      configured: {
        clientId: Boolean(ENV.LINKEDIN_CLIENT_ID),
        clientSecret: Boolean(ENV.LINKEDIN_CLIENT_SECRET),
        redirectUri: Boolean(ENV.LINKEDIN_REDIRECT_URI),
      },
      integration: integration
        ? {
            id: integration.id,
            active: Boolean(integration.is_active),
            tokenExpiresAt: integration.token_expires_at,
            updatedAt: integration.updated_at,
            memberId: integration.linkedin_member_id,
            personUrn: integration.linkedin_person_urn,
            scopes,
            missingRequiredScopes,
            missingLeadScopes,
            companyPagesCount: Array.isArray(integration.metadata?.company_pages)
              ? integration.metadata.company_pages.length
              : 0,
          }
        : null,
      lastWebhook: lastWebhook || null,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load LinkedIn diagnostics', req);
  }
}

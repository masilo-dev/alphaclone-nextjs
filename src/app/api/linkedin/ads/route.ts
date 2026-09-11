import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getLinkedInIntegrationWithToken, getLinkedInAccessToken, hasAdsReportingScope } from '@/services/linkedin/linkedinIntegrationService';
import { linkedInFetch } from '@/lib/linkedin/linkedinClient';
import { DEFAULT_TENANT_ID } from '@/lib/tenant/defaultTenant';

export interface LinkedInAdAccount {
  id: string;
  name: string;
  currency: string;
  status: string;
}

export interface LinkedInAdAnalyticsSummary {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  leads: number;
  dateRange: { start: string; end: string };
}

/**
 * GET /api/linkedin/ads
 * Read-only endpoint to fetch connected LinkedIn Ad Accounts and campaign analytics summary.
 * strictly read-only: does not modify or create campaigns or ads.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || DEFAULT_TENANT_ID;

    const admin = createSupabaseAdminClient();
    const result = await getLinkedInIntegrationWithToken(admin, { tenantId, userId: user.id });
    
    let integration = result;
    let accessToken = result?.accessToken || null;

    if (!integration || !accessToken) {
      const { data: fallbackRow } = await admin
        .from('linkedin_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackRow) {
        const token = await getLinkedInAccessToken(admin, fallbackRow);
        if (token) {
          integration = { ...fallbackRow, accessToken: token };
          accessToken = token;
        }
      }
    }

    if (!integration || !accessToken) {
      return NextResponse.json({
        connected: false,
        adAccounts: [],
        summary: null,
        message: 'No active LinkedIn integration found.',
      });
    }

    const hasPermission = hasAdsReportingScope(integration.scopes);
    if (!hasPermission) {
      return NextResponse.json({
        connected: true,
        permissionGranted: false,
        adAccounts: [],
        summary: null,
        message: 'Permission Required: r_ads or r_ads_reporting scope missing. Reconnect LinkedIn to enable Ad Reporting.',
      });
    }

    // 1. Fetch Ad Accounts (Read-only GET)
    let adAccounts: LinkedInAdAccount[] = [];
    try {
      const accountsRes = await linkedInFetch(
        'https://api.linkedin.com/v2/adAccountsV2?q=search&search=(type:(eq:ENTERPRISE),status:(eq:ACTIVE))',
        accessToken,
        { method: 'GET' }
      );

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        const elements = Array.isArray(accountsData.elements) ? accountsData.elements : [];
        adAccounts = elements.map((acc: any) => ({
          id: String(acc.id || acc.account || ''),
          name: String(acc.name || `Ad Account ${acc.id}`),
          currency: String(acc.currency || 'USD'),
          status: String(acc.status || 'ACTIVE'),
        } as LinkedInAdAccount)).filter((acc: LinkedInAdAccount) => Boolean(acc.id));
      }
    } catch (accErr) {
      console.warn('[LinkedInAdsAPI] Error fetching ad accounts:', accErr);
    }

    // Fallback: Check if ad account IDs are stored in metadata
    if (adAccounts.length === 0 && integration.metadata?.ad_account_ids) {
      const storedIds = Array.isArray(integration.metadata.ad_account_ids)
        ? integration.metadata.ad_account_ids
        : [String(integration.metadata.ad_account_ids)];
      adAccounts = storedIds.map((id) => ({
        id,
        name: `LinkedIn Ad Account (${id})`,
        currency: 'USD',
        status: 'ACTIVE',
      }));
    }

    // 2. Fetch Ad Analytics Summary (Read-only GET) if account exists
    let summary: LinkedInAdAnalyticsSummary | null = null;

    // Fetch CRM-stored attributed spend for accuracy if live ad analytics API isn't populated
    const { data: attributedLeads } = await admin
      .from('leads')
      .select('id, created_at, metadata')
      .eq('tenant_id', tenantId)
      .eq('source', 'linkedin');

    const totalSyncedLeads = (attributedLeads || []).length;

    if (adAccounts.length > 0) {
      // Attempt live analytics call
      try {
        const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${adAccounts[0].id}`);
        const analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&pivot=ACCOUNT&dateRange.start.day=1&dateRange.start.month=1&dateRange.start.year=2026&timeGranularity=ALL&accounts[0]=${accountUrn}`;

        const analyticsRes = await linkedInFetch(analyticsUrl, accessToken, { method: 'GET' });
        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json();
          const elem = analyticsData.elements?.[0] || {};
          summary = {
            impressions: Number(elem.impressions || 0),
            clicks: Number(elem.clicks || 0),
            spend: Number(elem.costInLocalCurrency || elem.costInUsd || 0),
            conversions: Number(elem.oneClickLeads || elem.externalWebsiteConversions || 0),
            leads: Math.max(Number(elem.oneClickLeads || 0), totalSyncedLeads),
            dateRange: {
              start: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
              end: new Date().toISOString().split('T')[0],
            },
          };
        }
      } catch (analyticsErr) {
        console.warn('[LinkedInAdsAPI] Analytics endpoint fallback:', analyticsErr);
      }
    }

    return NextResponse.json({
      connected: true,
      permissionGranted: true,
      adAccounts,
      summary,
      totalSyncedLeads,
    });
  } catch (err: any) {
    console.error('[LinkedInAdsAPI] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch LinkedIn ad reporting' },
      { status: 500 }
    );
  }
}

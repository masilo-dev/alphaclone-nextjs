import { NextRequest, NextResponse } from 'next/server';
import { ZohoCampaignsService } from '@/services/zoho/ZohoCampaignsService';
import { ZohoAuthExpiredError, ZohoAPIError } from '@/services/zoho/ZohoService';
import { createSupabaseServerClient } from '@/lib/supabase-server';

async function getUserId(req: NextRequest): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;
  } catch { /* fall through */ }

  const userIdFromQuery = req.nextUrl.searchParams.get('userId');
  if (userIdFromQuery) return userIdFromQuery;
  return req.headers.get('x-user-id');
}

function handleZohoError(err: unknown): NextResponse {
  const isMissingConfig =
    err instanceof Error &&
    (err.message.includes('Campaigns is not configured') ||
      err.message.includes('not configured'));

  if (err instanceof ZohoAuthExpiredError || isMissingConfig) {
    return NextResponse.json(
      { error: 'Zoho session expired or Campaigns access is missing. Reconnect in Settings.', code: 'ZOHO_RECONNECT', reconnect: true },
      { status: 401 }
    );
  }

  if (err instanceof ZohoAPIError) {
    if (err.status === 401 || err.status === 403) {
      return NextResponse.json(
        { error: 'Zoho rejected this request. Reconnect with Campaigns scopes.', code: 'ZOHO_FORBIDDEN', reconnect: true },
        { status: 401 }
      );
    }
    if (err.status === 429) {
      return NextResponse.json({ error: 'Rate limit reached. Wait a minute and retry.', code: 'ZOHO_RATE_LIMIT' }, { status: 429 });
    }
    return NextResponse.json(
      { error: err.message || 'Campaign request failed.', code: 'ZOHO_API_ERROR' },
      { status: err.status >= 400 && err.status < 500 ? err.status : 502 }
    );
  }

  const message = err instanceof Error ? err.message : 'Campaign request failed';
  return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required', code: 'NO_SESSION' }, { status: 401 });
  }

  try {
    const service = new ZohoCampaignsService(userId);

    switch (action) {
      case 'status': {
        const ready = await service.checkCampaignsReady();
        return NextResponse.json({ success: true, campaignsReady: ready });
      }
      case 'lists': {
        const fromIndex = Number(req.nextUrl.searchParams.get('fromIndex') || 1);
        const range = Number(req.nextUrl.searchParams.get('range') || 50);
        const result = await service.getMailingLists({ fromIndex, range });
        return NextResponse.json({ success: true, lists: result.lists });
      }
      case 'campaigns': {
        const status = req.nextUrl.searchParams.get('status') || 'all';
        const fromIndex = Number(req.nextUrl.searchParams.get('fromIndex') || 1);
        const range = Number(req.nextUrl.searchParams.get('range') || 25);
        const result = await service.getRecentCampaigns({ status, fromIndex, range });
        return NextResponse.json({ success: true, campaigns: result.campaigns });
      }
      case 'sent': {
        const limit = Number(req.nextUrl.searchParams.get('limit') || 10);
        const result = await service.getRecentSentCampaigns(limit);
        return NextResponse.json({ success: true, campaigns: result.campaigns });
      }
      case 'report': {
        const campaignKey = req.nextUrl.searchParams.get('campaignKey');
        if (!campaignKey) {
          return NextResponse.json({ error: 'campaignKey is required' }, { status: 400 });
        }
        const report = await service.getCampaignReport(campaignKey);
        return NextResponse.json({ success: true, report });
      }
      default:
        return NextResponse.json({ error: 'Unknown action. Use status|lists|campaigns|sent|report' }, { status: 400 });
    }
  } catch (err) {
    return handleZohoError(err);
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required', code: 'NO_SESSION' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = String(body.action || '');
    const service = new ZohoCampaignsService(userId);

    switch (action) {
      case 'create': {
        const result = await service.createCampaign({
          campaignName: body.campaignName,
          fromEmail: body.fromEmail,
          fromName: body.fromName,
          subject: body.subject,
          contentUrl: body.contentUrl,
          listKeys: body.listKeys || [],
          topicId: body.topicId,
        });
        return NextResponse.json({ success: true, ...result });
      }
      case 'send': {
        if (!body.campaignKey) {
          return NextResponse.json({ error: 'campaignKey is required' }, { status: 400 });
        }
        const result = await service.sendCampaign(body.campaignKey);
        return NextResponse.json({ success: true, ...result });
      }
      case 'subscribe': {
        if (!body.listKey || !body.email) {
          return NextResponse.json({ error: 'listKey and email are required' }, { status: 400 });
        }
        const result = await service.subscribeContact(body.listKey, body.email, body.firstName, body.lastName);
        return NextResponse.json(result);
      }
      case 'unsubscribe': {
        if (!body.listKey || !body.email) {
          return NextResponse.json({ error: 'listKey and email are required' }, { status: 400 });
        }
        const result = await service.unsubscribeContact(body.listKey, body.email);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: 'Unknown action. Use create|send|subscribe|unsubscribe' }, { status: 400 });
    }
  } catch (err) {
    return handleZohoError(err);
  }
}

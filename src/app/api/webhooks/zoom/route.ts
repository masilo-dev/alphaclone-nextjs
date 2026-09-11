import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

function timingSafeEqualHex(a: string, b: string): boolean {
  const na = a.replace(/^v0=/i, '').toLowerCase();
  const nb = b.replace(/^v0=/i, '').toLowerCase();
  try {
    const ba = Buffer.from(na.length % 2 === 0 ? na : `0${na}`, 'hex');
    const bb = Buffer.from(nb.length % 2 === 0 ? nb : `0${nb}`, 'hex');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function verifyZoomWebhookHeaders(
  rawBody: string,
  secret: string,
  signatureHeader: string | null,
  timestampHeader: string | null
): boolean {
  if (!signatureHeader || !timestampHeader) return false;
  const hash = signatureHeader.startsWith('v0=') ? signatureHeader.slice(3) : signatureHeader;
  const message = `v0:${timestampHeader}:${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return timingSafeEqualHex(expected, hash);
}

function verifyDeauthPayloadSignature(
  clientId: string,
  userId: string,
  deauthorizationTime: string,
  receivedSignature: string,
  secret: string
): boolean {
  const message = `${clientId}${userId}${deauthorizationTime}`;
  const expected = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return timingSafeEqualHex(expected, receivedSignature);
}

type ZoomWebhookBody = {
  event?: string;
  payload?: {
    plainToken?: string;
    client_id?: string;
    user_id?: string;
    account_id?: string;
    deauthorization_time?: string;
    signature?: string;
  };
};

export async function POST(req: Request) {
  const rawBody = await req.text();
  const webhookSecret = ENV.ZOOM_WEBHOOK_SECRET_TOKEN;
  const clientSecret = ENV.ZOOM_CLIENT_SECRET;
  const ourClientId = ENV.ZOOM_CLIENT_ID;

  let body: ZoomWebhookBody;
  try {
    body = JSON.parse(rawBody) as ZoomWebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const zmSig = req.headers.get('x-zm-signature');
  const zmTs = req.headers.get('x-zm-request-timestamp');

  const verifyHeaders = (): boolean => {
    if (!webhookSecret) return false;
    return verifyZoomWebhookHeaders(rawBody, webhookSecret, zmSig, zmTs);
  };

  const verifyDeauth = (p: NonNullable<ZoomWebhookBody['payload']>): boolean => {
    if (!p.client_id || !p.user_id || !p.deauthorization_time || !p.signature) return false;
    if (ourClientId && p.client_id !== ourClientId) return false;

    if (verifyHeaders()) return true;

    if (webhookSecret) {
      if (verifyDeauthPayloadSignature(p.client_id, p.user_id, p.deauthorization_time, p.signature, webhookSecret)) {
        return true;
      }
    }
    if (clientSecret) {
      if (verifyDeauthPayloadSignature(p.client_id, p.user_id, p.deauthorization_time, p.signature, clientSecret)) {
        return true;
      }
    }
    return false;
  };

  if (body.event === 'endpoint.url_validation' && body.payload?.plainToken) {
    if (!webhookSecret) {
      console.warn('[Zoom webhook] ZOOM_WEBHOOK_SECRET_TOKEN not set');
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }
    if (zmSig && zmTs && !verifyZoomWebhookHeaders(rawBody, webhookSecret, zmSig, zmTs)) {
      console.warn('[Zoom webhook] url_validation rejected: invalid signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const plainToken = body.payload.plainToken;
    const encryptedToken = crypto.createHmac('sha256', webhookSecret).update(plainToken).digest('hex');
    return NextResponse.json({ plainToken, encryptedToken });
  }

  if (body.event === 'app_deauthorized' && body.payload) {
    if (!webhookSecret && !clientSecret) {
      console.warn('[Zoom webhook] app_deauthorized: no ZOOM_WEBHOOK_SECRET_TOKEN or ZOOM_CLIENT_SECRET');
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }
    if (!verifyDeauth(body.payload)) {
      console.warn('[Zoom webhook] app_deauthorized rejected: verification failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = body.payload.user_id;
    if (!userId) {
      return NextResponse.json({ error: 'Bad payload' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: rows, error: selErr } = await admin
      .from('tenant_integrations')
      .select('tenant_id, metadata')
      .eq('integration_id', 'zoom')
      .eq('status', 'connected');

    if (selErr) {
      console.error('[Zoom webhook] tenant_integrations select:', selErr);
      return NextResponse.json({ ok: true, processed: 0 });
    }

    const revokedAt = body.payload.deauthorization_time || new Date().toISOString();
    let processed = 0;

    for (const row of rows || []) {
      const meta = (row.metadata || {}) as Record<string, unknown>;
      const storedId = meta.zoom_account_id != null ? String(meta.zoom_account_id) : '';
      if (!storedId || storedId !== userId) continue;

      const { error: upErr } = await admin
        .from('tenant_integrations')
        .update({
          status: 'disconnected',
          metadata: {
            zoom_account_id: userId,
            zoom_revoked_at: revokedAt,
          },
        })
        .eq('tenant_id', row.tenant_id)
        .eq('integration_id', 'zoom');

      if (upErr) {
        console.error('[Zoom webhook] tenant_integrations update:', upErr);
        continue;
      }
      processed += 1;

      try {
        await admin
          .from('zoom_integration_secrets')
          .delete()
          .eq('tenant_id', row.tenant_id);
        await admin
          .from('tenant_zoom_settings')
          .update({
            integration_mode: 'none',
            zoom_account_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', row.tenant_id);
      } catch {
        /* table may be missing */
      }
    }

    return NextResponse.json({ ok: true, processed });
  }

  return NextResponse.json({ ok: true, ignored: body.event ?? 'unknown' });
}

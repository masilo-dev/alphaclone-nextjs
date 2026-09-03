import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { withCronJob } from '@/lib/cron/withCronJob';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { assertSafeExternalHttpUrl } from '@/lib/security/externalUrl';
import { decryptIntegrationToken, encryptIntegrationToken, isEncryptedToken } from '@/lib/integration/integrationTokenCrypto';

export const dynamic = 'force-dynamic';

async function runWebhookDeliveries() {
  const admin = createSupabaseAdminClient();
  const { data: deliveries, error } = await admin.rpc('claim_webhook_deliveries', { p_limit: 50 });
  if (error) throw error;
  let delivered = 0;
  let failed = 0;
  for (const delivery of deliveries || []) {
    const { data: webhook } = await admin.from('webhooks').select('url, secret, is_active').eq('id', delivery.webhook_id).maybeSingle();
    if (!webhook?.is_active) {
      await admin.from('webhook_deliveries').update({ status: 'failed', error_message: 'Webhook is disabled', attempts: Number(delivery.attempts || 0) + 1, next_retry_at: null }).eq('id', delivery.id);
      failed += 1;
      continue;
    }
    const attempts = Number(delivery.attempts || 0) + 1;
    try {
      await assertSafeExternalHttpUrl(webhook.url);
      const body = JSON.stringify({ event: delivery.event, data: delivery.payload, timestamp: new Date().toISOString(), delivery_id: delivery.id });
      const secret = isEncryptedToken(String(webhook.secret || '')) ? await decryptIntegrationToken(String(webhook.secret)) : String(webhook.secret || '');
      if (!secret) throw new Error('Webhook signing secret is unavailable');
      if (!isEncryptedToken(String(webhook.secret || ''))) await admin.from('webhooks').update({ secret: await encryptIntegrationToken(secret) }).eq('id', delivery.webhook_id);
      const signature = createHmac('sha256', secret).update(body).digest('hex');
      const response = await fetch(webhook.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AlphaClone-Delivery': delivery.id, 'X-AlphaClone-Event': delivery.event, 'X-AlphaClone-Signature': signature }, body, signal: AbortSignal.timeout(30_000), redirect: 'error' });
      const responseBody = (await response.text()).slice(0, 10_000);
      if (!response.ok) throw Object.assign(new Error(`Endpoint returned HTTP ${response.status}`), { responseStatus: response.status, responseBody });
      await admin.from('webhook_deliveries').update({ status: 'delivered', attempts, response_status: response.status, response_body: responseBody, error_message: null, delivered_at: new Date().toISOString(), next_retry_at: null }).eq('id', delivery.id);
      delivered += 1;
    } catch (sendError) {
      const finalFailure = attempts >= 5;
      const delayMinutes = [1, 5, 15, 60, 360][Math.min(attempts - 1, 4)];
      const nextRetry = new Date(Date.now() + delayMinutes * 60_000).toISOString();
      const detail = sendError as Error & { responseStatus?: number; responseBody?: string };
      await admin.from('webhook_deliveries').update({ status: finalFailure ? 'failed' : 'retrying', attempts, response_status: detail.responseStatus || null, response_body: detail.responseBody || null, error_message: detail.message.slice(0, 2000), next_retry_at: finalFailure ? null : nextRetry }).eq('id', delivery.id);
      failed += 1;
    }
  }
  return NextResponse.json({ success: true, processed: deliveries?.length || 0, delivered, failed });
}

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  return withCronJob('webhook-deliveries', async () => {
    try {
      return await runWebhookDeliveries();
    } catch (error) {
      console.error('[webhook-deliveries]', error);
      return NextResponse.json({ success: false, error: 'Webhook delivery processing failed' }, { status: 500 });
    }
  });
}

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
<<<<<<< HEAD
import { isProduction } from '@/lib/security/productionGuard';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';
import { normalizePhoneNumber } from '@/services/engine/CommunicationEngine';
=======
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';
>>>>>>> origin/main

export const dynamic = 'force-dynamic';

function getRawUrl(req: NextRequest) {
  const url = new URL(req.url);
  url.searchParams.sort();
  return url.toString();
}

function validateTwilioSignature(params: Record<string, string>, url: string, signatureHeader: string, authToken: string) {
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map((k) => k + params[k]).join('');
  const digest = crypto.createHmac('sha1', authToken).update(data).digest('base64');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/x-www-form-urlencoded') && !contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Unsupported content-type' }, { status: 400 });
    }

    const formData = await req.formData();
    const payload: Record<string, string> = {};
    formData.forEach((v, k) => {
      payload[k] = typeof v === 'string' ? v : '';
    });

    const signature = req.headers.get('x-twilio-signature');
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
<<<<<<< HEAD
    if (isProduction() && (!signature || !authToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
=======
>>>>>>> origin/main
    if (signature && authToken) {
      const ok = validateTwilioSignature(payload, getRawUrl(req), signature, authToken);
      if (!ok) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

<<<<<<< HEAD
    const fromRaw = String(payload.From || '').trim();
    const toRaw = String(payload.To || '').trim();
    const body = String(payload.Body || '').trim();
    const sid = String(payload.MessageSid || payload.SmsMessageSid || '').trim();
    if (!fromRaw || !toRaw) return NextResponse.json({ error: 'Missing From/To' }, { status: 400 });

    const from = normalizePhoneNumber(fromRaw);
    const to = normalizePhoneNumber(toRaw);
=======
    const from = String(payload.From || '').trim();
    const to = String(payload.To || '').trim();
    const body = String(payload.Body || '').trim();
    const sid = String(payload.MessageSid || payload.SmsMessageSid || '').trim();
    if (!from || !to) return NextResponse.json({ error: 'Missing From/To' }, { status: 400 });
>>>>>>> origin/main

    const admin = createSupabaseAdminClient();
    const { data: integration } = await admin
      .from('twilio_integrations')
      .select('tenant_id, is_active')
      .eq('phone_number', to)
      .eq('is_active', true)
      .maybeSingle();

    if (!integration?.tenant_id) {
      return NextResponse.json({ success: true, ignored: true });
    }

<<<<<<< HEAD
    const keyword = body.trim().toUpperCase();
    const isStopKeyword = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(keyword);
    if (isStopKeyword) {
      await admin.from('sms_opt_outs').upsert({
        tenant_id: integration.tenant_id,
        phone_number: from,
        keyword,
        source: 'twilio',
      });
    }

=======
>>>>>>> origin/main
    await admin.from('sms_messages').insert({
      tenant_id: integration.tenant_id,
      from_number: from,
      to_number: to,
      body,
      status: 'received',
      twilio_sid: sid || null,
      received_at: new Date().toISOString(),
    });

    await captureUnifiedMessageFromWebhook({
      supabase: admin as any,
      tenantId: integration.tenant_id,
      source: 'sms',
      channel: 'sms',
      direction: 'inbound',
      externalId: sid || null,
      threadId: from,
      from,
      to,
      subject: null,
      text: body,
      html: null,
      receivedAt: new Date().toISOString(),
      metadata: { twilio: true },
    });

<<<<<<< HEAD
    return NextResponse.json({ success: true, optOut: isStopKeyword });
=======
    return NextResponse.json({ success: true });
>>>>>>> origin/main
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
<<<<<<< HEAD
=======

>>>>>>> origin/main

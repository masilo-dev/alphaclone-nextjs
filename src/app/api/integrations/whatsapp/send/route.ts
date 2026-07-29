import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
<<<<<<< HEAD
import { sendWhatsAppMessage, type SendWhatsAppErrorCode } from '@/lib/whatsapp/sendWhatsApp';

function statusForWhatsAppError(code?: SendWhatsAppErrorCode): number {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'NOT_CONFIGURED':
      return 503;
    case 'META_API_ERROR':
    case 'NETWORK_ERROR':
      return 502;
    default:
      return 502;
  }
}
=======
import { sendWhatsAppMessage } from '@/lib/whatsapp/sendWhatsApp';
>>>>>>> origin/main

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, phone, message, integrationId } = body;

    if (!tenantId || !phone || !message) {
      return NextResponse.json({ error: 'tenantId, phone, and message are required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const result = await sendWhatsAppMessage({ tenantId, phone, message, integrationId });
<<<<<<< HEAD
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, code: result.code },
        { status: statusForWhatsAppError(result.code) },
      );
    }
=======
    if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
>>>>>>> origin/main
    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, 'Failed to send WhatsApp message', request);
  }
}

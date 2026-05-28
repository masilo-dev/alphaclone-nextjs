import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { sendWhatsAppMessage } from '@/lib/whatsapp/sendWhatsApp';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, phone, message, integrationId } = body;

    if (!tenantId || !phone || !message) {
      return NextResponse.json({ error: 'tenantId, phone, and message are required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const result = await sendWhatsAppMessage({ tenantId, phone, message, integrationId });
    if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, 'Failed to send WhatsApp message', request);
  }
}

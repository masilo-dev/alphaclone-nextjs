import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  businessAdapterService,
  type AnalyzeDocumentInput,
  type BookMeetingInput,
  type CreateSubscriptionCheckoutInput,
  type PortalEventInput,
} from '@/services/adapters/businessAdapters';

type AdapterMode =
  | 'book_calendar_meeting'
  | 'create_subscription_checkout'
  | 'create_client_portal_event'
  | 'analyze_document';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mode = String(body.mode || '').trim() as AdapterMode;
    const tenantId = String(body.tenantId || '').trim();
    if (!tenantId || !mode) {
      return NextResponse.json({ error: 'tenantId and mode are required' }, { status: 400 });
    }

    const auth = await requireTenantAccess(tenantId);
    const actorUserId = auth.user.id;

    if (mode === 'book_calendar_meeting') {
      const input: BookMeetingInput = {
        tenantId,
        bookingTypeId: String(body.bookingTypeId || '').trim(),
        startTime: String(body.startTime || '').trim(),
        endTime: String(body.endTime || '').trim(),
        clientName: String(body.clientName || '').trim(),
        clientEmail: String(body.clientEmail || '').trim(),
        clientPhone: body.clientPhone ? String(body.clientPhone).trim() : undefined,
        clientNotes: body.clientNotes ? String(body.clientNotes).trim() : undefined,
        timeZone: body.timeZone ? String(body.timeZone).trim() : undefined,
      };
      if (!input.bookingTypeId || !input.startTime || !input.endTime || !input.clientName || !input.clientEmail) {
        return NextResponse.json(
          { error: 'bookingTypeId, startTime, endTime, clientName and clientEmail are required' },
          { status: 400 }
        );
      }
      const result = await businessAdapterService.bookCalendarMeeting(input);
      return NextResponse.json(result, { status: result.status === 'failed' ? 400 : 200 });
    }

    if (mode === 'create_subscription_checkout') {
      const input: CreateSubscriptionCheckoutInput = {
        tenantId,
        planId: String(body.planId || '').trim() as 'starter' | 'pro' | 'enterprise',
        priceId: String(body.priceId || '').trim(),
        adminEmail: String(body.adminEmail || auth.user.email || '').trim(),
        successUrl: body.successUrl ? String(body.successUrl).trim() : undefined,
        cancelUrl: body.cancelUrl ? String(body.cancelUrl).trim() : undefined,
      };
      if (!input.planId || !input.priceId || !input.adminEmail) {
        return NextResponse.json({ error: 'planId, priceId and adminEmail are required' }, { status: 400 });
      }
      const result = await businessAdapterService.createPaymentSubscriptionCheckout(input);
      return NextResponse.json(result, { status: result.status === 'failed' ? 400 : 200 });
    }

    if (mode === 'create_client_portal_event') {
      const input: PortalEventInput = {
        tenantId,
        actorUserId,
        eventType: String(body.eventType || '').trim() as PortalEventInput['eventType'],
        projectId: body.projectId ? String(body.projectId).trim() : undefined,
        clientId: body.clientId ? String(body.clientId).trim() : undefined,
        deliverableId: body.deliverableId ? String(body.deliverableId).trim() : undefined,
        feedbackRating: body.feedbackRating ? Number(body.feedbackRating) : undefined,
        feedbackComment: body.feedbackComment ? String(body.feedbackComment).trim() : undefined,
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
      };
      if (!input.eventType) {
        return NextResponse.json({ error: 'eventType is required' }, { status: 400 });
      }
      const result = await businessAdapterService.createClientPortalEvent(input);
      return NextResponse.json(result, { status: result.status === 'failed' ? 400 : 200 });
    }

    if (mode === 'analyze_document') {
      const input: AnalyzeDocumentInput = {
        tenantId,
        actorUserId,
        documentUrl: body.documentUrl ? String(body.documentUrl).trim() : undefined,
        documentText: body.documentText ? String(body.documentText) : undefined,
        documentType: body.documentType ? String(body.documentType).trim() as AnalyzeDocumentInput['documentType'] : undefined,
      };
      if (!input.documentUrl && !input.documentText) {
        return NextResponse.json({ error: 'documentUrl or documentText is required' }, { status: 400 });
      }
      const result = await businessAdapterService.analyzeDocument(input);
      return NextResponse.json(result, { status: result.status === 'failed' ? 400 : 200 });
    }

    return NextResponse.json({ error: 'Unsupported mode' }, { status: 400 });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to execute adapter operation');
  }
}

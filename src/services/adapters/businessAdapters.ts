import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';

type AdapterName =
  | 'calendar_booking'
  | 'payment_subscription'
  | 'client_portal_event'
  | 'document_intelligence';

type AdapterStatus = 'success' | 'failed' | 'partial_success';

export type AdapterResult<T = Record<string, unknown>> = {
  status: AdapterStatus;
  adapter: AdapterName;
  message: string;
  data?: T;
  error?: string;
};

export type BookMeetingInput = {
  tenantId: string;
  bookingTypeId: string;
  startTime: string;
  endTime: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientNotes?: string;
  timeZone?: string;
};

export type CreateSubscriptionCheckoutInput = {
  tenantId: string;
  planId: 'starter' | 'pro' | 'enterprise';
  priceId: string;
  adminEmail: string;
  successUrl?: string;
  cancelUrl?: string;
};

export type PortalEventInput = {
  tenantId: string;
  actorUserId: string;
  eventType:
    | 'project_viewed'
    | 'deliverable_downloaded'
    | 'feedback_submitted'
    | 'milestone_acknowledged'
    | 'portal_message_sent'
    | 'custom';
  projectId?: string;
  clientId?: string;
  deliverableId?: string;
  feedbackRating?: number;
  feedbackComment?: string;
  metadata?: Record<string, unknown>;
};

export type AnalyzeDocumentInput = {
  tenantId: string;
  actorUserId: string;
  documentUrl?: string;
  documentText?: string;
  documentType?: 'contract' | 'proposal' | 'invoice' | 'nda' | 'other';
};

type LogPayload = {
  tenantId: string;
  actorUserId?: string;
  adapter: AdapterName;
  action: string;
  status: AdapterStatus;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  error?: string;
};

class BusinessAdapterService {
  private getInternalApiBaseUrl(): string {
    const baseUrl =
      ENV.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
    return String(baseUrl || '').replace(/\/+$/, '');
  }

  private async logAdapterRun(payload: LogPayload): Promise<void> {
    const supabaseAdmin = createSupabaseAdminClient();
    await supabaseAdmin.from('adapter_event_logs').insert({
      tenant_id: payload.tenantId,
      actor_user_id: payload.actorUserId || null,
      adapter_name: payload.adapter,
      action: payload.action,
      status: payload.status,
      request_payload: payload.requestPayload || {},
      response_payload: payload.responsePayload || {},
      error_message: payload.error || null,
    });
  }

  async bookCalendarMeeting(input: BookMeetingInput): Promise<AdapterResult<{ bookingId?: string }>> {
    try {
      const baseUrl = this.getInternalApiBaseUrl();
      if (!baseUrl) {
        throw new Error('NEXT_PUBLIC_APP_URL is not configured for calendar adapter requests');
      }
      const response = await fetch(`${baseUrl}/api/booking/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: input.tenantId,
          booking_type_id: input.bookingTypeId,
          start_time: input.startTime,
          end_time: input.endTime,
          client_name: input.clientName,
          client_email: input.clientEmail,
          client_phone: input.clientPhone || null,
          client_notes: input.clientNotes || null,
          time_zone: input.timeZone || 'UTC',
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMessage = String(payload?.error || 'Failed to create booking');
        await this.logAdapterRun({
          tenantId: input.tenantId,
          adapter: 'calendar_booking',
          action: 'book_meeting',
          status: 'failed',
          requestPayload: input as unknown as Record<string, unknown>,
          responsePayload: payload,
          error: errorMessage,
        });
        return {
          status: 'failed',
          adapter: 'calendar_booking',
          message: 'Calendar booking failed',
          error: errorMessage,
        };
      }

      await this.logAdapterRun({
        tenantId: input.tenantId,
        adapter: 'calendar_booking',
        action: 'book_meeting',
        status: 'success',
        requestPayload: input as unknown as Record<string, unknown>,
        responsePayload: payload,
      });

      return {
        status: 'success',
        adapter: 'calendar_booking',
        message: 'Meeting booked successfully',
        data: { bookingId: payload?.booking?.id },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown booking adapter error';
      await this.logAdapterRun({
        tenantId: input.tenantId,
        adapter: 'calendar_booking',
        action: 'book_meeting',
        status: 'failed',
        requestPayload: input as unknown as Record<string, unknown>,
        error: errorMessage,
      });
      return {
        status: 'failed',
        adapter: 'calendar_booking',
        message: 'Calendar booking failed',
        error: errorMessage,
      };
    }
  }

  async createPaymentSubscriptionCheckout(
    input: CreateSubscriptionCheckoutInput
  ): Promise<AdapterResult<{ checkoutUrl?: string }>> {
    try {
      const baseUrl = this.getInternalApiBaseUrl();
      if (!baseUrl) {
        throw new Error('NEXT_PUBLIC_APP_URL is not configured for payment adapter requests');
      }
      const response = await fetch(`${baseUrl}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: input.tenantId,
          planId: input.planId,
          priceId: input.priceId,
          adminEmail: input.adminEmail,
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMessage = String(payload?.error || 'Failed to create checkout session');
        await this.logAdapterRun({
          tenantId: input.tenantId,
          adapter: 'payment_subscription',
          action: 'create_checkout_session',
          status: 'failed',
          requestPayload: input as unknown as Record<string, unknown>,
          responsePayload: payload,
          error: errorMessage,
        });
        return {
          status: 'failed',
          adapter: 'payment_subscription',
          message: 'Payment checkout session failed',
          error: errorMessage,
        };
      }

      await this.logAdapterRun({
        tenantId: input.tenantId,
        adapter: 'payment_subscription',
        action: 'create_checkout_session',
        status: 'success',
        requestPayload: input as unknown as Record<string, unknown>,
        responsePayload: payload,
      });

      return {
        status: 'success',
        adapter: 'payment_subscription',
        message: 'Subscription checkout session created',
        data: { checkoutUrl: payload?.url },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown payment adapter error';
      await this.logAdapterRun({
        tenantId: input.tenantId,
        adapter: 'payment_subscription',
        action: 'create_checkout_session',
        status: 'failed',
        requestPayload: input as unknown as Record<string, unknown>,
        error: errorMessage,
      });
      return {
        status: 'failed',
        adapter: 'payment_subscription',
        message: 'Payment checkout session failed',
        error: errorMessage,
      };
    }
  }

  async createClientPortalEvent(input: PortalEventInput): Promise<AdapterResult<{ eventId?: string }>> {
    const supabaseAdmin = createSupabaseAdminClient();
    try {
      const { data, error } = await supabaseAdmin
        .from('client_portal_events')
        .insert({
          tenant_id: input.tenantId,
          actor_user_id: input.actorUserId,
          project_id: input.projectId || null,
          client_id: input.clientId || null,
          deliverable_id: input.deliverableId || null,
          event_type: input.eventType,
          feedback_rating: input.feedbackRating || null,
          feedback_comment: input.feedbackComment || null,
          metadata: input.metadata || {},
        })
        .select('id')
        .single();

      if (error) {
        await this.logAdapterRun({
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          adapter: 'client_portal_event',
          action: 'create_event',
          status: 'failed',
          requestPayload: input as unknown as Record<string, unknown>,
          error: error.message,
        });
        return {
          status: 'failed',
          adapter: 'client_portal_event',
          message: 'Client portal event creation failed',
          error: error.message,
        };
      }

      await this.logAdapterRun({
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        adapter: 'client_portal_event',
        action: 'create_event',
        status: 'success',
        requestPayload: input as unknown as Record<string, unknown>,
        responsePayload: { id: data.id },
      });

      return {
        status: 'success',
        adapter: 'client_portal_event',
        message: 'Client portal event created',
        data: { eventId: data.id },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown client portal adapter error';
      await this.logAdapterRun({
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        adapter: 'client_portal_event',
        action: 'create_event',
        status: 'failed',
        requestPayload: input as unknown as Record<string, unknown>,
        error: errorMessage,
      });
      return {
        status: 'failed',
        adapter: 'client_portal_event',
        message: 'Client portal event creation failed',
        error: errorMessage,
      };
    }
  }

  async analyzeDocument(input: AnalyzeDocumentInput): Promise<AdapterResult<Record<string, unknown>>> {
    const supabaseAdmin = createSupabaseAdminClient();
    const sourceText = String(input.documentText || '').trim();
    const normalized = sourceText.toLowerCase();

    const extracted = {
      hasNdaLanguage: normalized.includes('non-disclosure') || normalized.includes('confidential'),
      hasPaymentTerms: normalized.includes('payment') || normalized.includes('net 30') || normalized.includes('invoice'),
      hasTerminationClause: normalized.includes('termination'),
      hasSignatureBlock: normalized.includes('signature') || normalized.includes('signed'),
      estimatedWordCount: sourceText ? sourceText.split(/\s+/).filter(Boolean).length : 0,
      riskFlags: [] as string[],
    };

    if (!extracted.hasPaymentTerms && input.documentType !== 'nda') {
      extracted.riskFlags.push('Missing explicit payment terms');
    }
    if (!extracted.hasTerminationClause) {
      extracted.riskFlags.push('Missing termination clause');
    }
    if (!extracted.hasSignatureBlock) {
      extracted.riskFlags.push('No signature section detected');
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('document_intelligence_runs')
        .insert({
          tenant_id: input.tenantId,
          actor_user_id: input.actorUserId,
          document_url: input.documentUrl || null,
          document_type: input.documentType || 'other',
          extracted_entities: extracted,
          summary: `Document scan completed with ${extracted.riskFlags.length} risk flag(s).`,
          status: 'completed',
        })
        .select('id')
        .single();

      if (error) {
        await this.logAdapterRun({
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          adapter: 'document_intelligence',
          action: 'analyze_document',
          status: 'failed',
          requestPayload: {
            documentUrl: input.documentUrl || null,
            documentType: input.documentType || 'other',
          },
          error: error.message,
        });
        return {
          status: 'failed',
          adapter: 'document_intelligence',
          message: 'Document intelligence analysis failed',
          error: error.message,
        };
      }

      await this.logAdapterRun({
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        adapter: 'document_intelligence',
        action: 'analyze_document',
        status: 'success',
        requestPayload: {
          documentUrl: input.documentUrl || null,
          documentType: input.documentType || 'other',
        },
        responsePayload: { runId: data.id, extracted },
      });

      return {
        status: 'success',
        adapter: 'document_intelligence',
        message: 'Document intelligence analysis completed',
        data: { runId: data.id, ...extracted },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown document intelligence adapter error';
      await this.logAdapterRun({
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        adapter: 'document_intelligence',
        action: 'analyze_document',
        status: 'failed',
        requestPayload: {
          documentUrl: input.documentUrl || null,
          documentType: input.documentType || 'other',
        },
        error: errorMessage,
      });
      return {
        status: 'failed',
        adapter: 'document_intelligence',
        message: 'Document intelligence analysis failed',
        error: errorMessage,
      };
    }
  }
}

export const businessAdapterService = new BusinessAdapterService();

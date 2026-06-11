import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

/**
 * POST /api/integrations/whatsapp/send-document
 *
 * Send a quote, invoice, or any document to a WhatsApp contact directly from
 * the Alphaclone platform. Supports sending:
 *  - A plain text message (type: 'text')
 *  - A PDF/document via public URL (type: 'document')
 *  - An image via public URL (type: 'image')
 *
 * Each tenant uses their OWN credentials — fully multi-tenant isolated.
 * No cross-tenant data exposure.
 */

const META_GRAPH_VERSION = 'v18.0';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      phone,           // recipient phone number (digits only, e.g. "27821234567")
      messageType,     // 'text' | 'document' | 'image'
      message,         // body text or caption
      documentUrl,     // public URL to PDF/document file (for type: 'document' | 'image')
      documentName,    // filename shown in WhatsApp (e.g. "Invoice_001.pdf")
      referenceType,   // 'quote' | 'invoice' | 'custom' (for logging)
      referenceId,     // ID of the quote/invoice record
    } = body;

    if (!tenantId || !phone || !message) {
      return NextResponse.json(
        { error: 'tenantId, phone, and message are required' },
        { status: 400 }
      );
    }

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    // 1. Resolve tenant's WhatsApp integration credentials
    const { data: integration, error: intErr } = await supabase
      .from('whatsapp_integrations')
      .select('id, phone_number_id, access_token')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .not('phone_number_id', 'is', null)
      .not('access_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (intErr || !integration) {
      return NextResponse.json(
        {
          error: 'No active WhatsApp integration found. Please connect your Meta WhatsApp Business number in Integration Settings.',
        },
        { status: 404 }
      );
    }

    const { phone_number_id, access_token } = integration;
    const cleanPhone = String(phone).replace(/[^0-9]/g, '');

    // 2. Build Meta Graph API payload based on message type
    let metaPayload: Record<string, any>;
    const basePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
    };

    const type = messageType || 'text';

    if (type === 'document' && documentUrl) {
      metaPayload = {
        ...basePayload,
        type: 'document',
        document: {
          link: documentUrl,
          caption: message,
          filename: documentName || 'Document.pdf',
        },
      };
    } else if (type === 'image' && documentUrl) {
      metaPayload = {
        ...basePayload,
        type: 'image',
        image: {
          link: documentUrl,
          caption: message,
        },
      };
    } else {
      // Default: text message
      metaPayload = {
        ...basePayload,
        type: 'text',
        text: {
          preview_url: !!documentUrl,
          body: documentUrl ? `${message}\n\n${documentUrl}` : message,
        },
      };
    }

    // 3. Send via Meta Cloud API
    const metaRes = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metaPayload),
      }
    );

    const metaData = await metaRes.json();
    if (!metaRes.ok) {
      console.error('[WhatsApp send-document] Meta error:', metaData);
      return NextResponse.json(
        { error: metaData?.error?.message || 'Failed to send WhatsApp message' },
        { status: 502 }
      );
    }

    const metaMessageId = metaData.messages?.[0]?.id;

    // 4. Log sent message in whatsapp_messages table
    await supabase.from('whatsapp_messages').insert({
      tenant_id: tenantId,
      integration_id: integration.id,
      provider: 'meta-whatsapp',
      provider_message_id: metaMessageId || `wa_doc_${Date.now()}`,
      chat_id: cleanPhone,
      phone_number: cleanPhone,
      direction: 'outbound',
      message_type: type,
      body: message,
      status: 'sent',
      sent_by: 'human',
      needs_response: false,
      sent_at: new Date().toISOString(),
      metadata: {
        provider: 'meta-whatsapp',
        reference_type: referenceType || 'custom',
        reference_id: referenceId || null,
        document_url: documentUrl || null,
        document_name: documentName || null,
      },
    });

    return NextResponse.json({
      success: true,
      messageId: metaMessageId,
      to: cleanPhone,
      type,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to send WhatsApp document', request);
  }
}

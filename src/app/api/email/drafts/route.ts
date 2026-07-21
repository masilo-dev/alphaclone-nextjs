import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { microsoftGraphService } from '@/services/microsoftGraphService';
import { ZohoMailService } from '@/services/zoho/ZohoMailService';
import { normalizeDeliveryProvider } from '@/lib/email/emailProviderOptions';

const saveSchema = z.object({
  tenantId: z.string().uuid(),
  to: z.string().optional(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().min(1),
  deliveryProvider: z.string().optional(),
  inReplyToMessageId: z.string().optional(),
});

function parseRecipients(value?: string): string[] {
  return String(value || '')
    .split(/[,\n;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const body = saveSchema.parse(await req.json());
    const { user } = await requireTenantAccess(body.tenantId, req);
    const provider = normalizeDeliveryProvider(body.deliveryProvider || 'auto');
    const toList = parseRecipients(body.to);
    const ccList = parseRecipients(body.cc);
    const subject = String(body.subject || '').trim() || '(Draft)';
    const content = String(body.body || '').trim();

    if (!content) {
      return NextResponse.json({ error: 'Draft body is required' }, { status: 400 });
    }

    let providerDraftId: string | null = null;
    let savedTo: string | null = null;

    if (provider === 'microsoft') {
      const result = await microsoftGraphService.createDraft({
        to: toList,
        cc: ccList,
        subject,
        body: content,
      });
      providerDraftId = result.id;
      savedTo = 'microsoft';
    } else if (provider === 'zoho') {
      const zoho = new ZohoMailService(user.id, body.tenantId);
      const result = await zoho.saveDraft({
        toAddress: toList[0],
        ccAddress: ccList.join(','),
        subject,
        content,
        inReplyTo: body.inReplyToMessageId,
      });
      providerDraftId = String(result?.data?.messageId || result?.messageId || '');
      savedTo = 'zoho';
    }

    return NextResponse.json({
      success: true,
      savedTo,
      providerDraftId,
      note:
        savedTo === null
          ? 'Draft saved locally. Connect Microsoft or Zoho to sync drafts to your mailbox.'
          : `Draft saved to ${savedTo} drafts folder.`,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to save email draft', req);
  }
}

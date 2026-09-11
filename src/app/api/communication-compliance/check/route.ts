import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  COMMUNICATION_CLASSIFICATIONS,
  resolveCommunicationCompliance,
} from '@/lib/compliance/communicationCompliance';

const schema = z.object({
  tenantId: z.string().uuid(),
  senderIdentityId: z.string().min(1),
  senderEmail: z.string().email(),
  recipientEmail: z.string().email(),
  classification: z.enum(COMMUNICATION_CLASSIFICATIONS),
  purpose: z.object({
    category: z.string().min(1),
    reasonText: z.string().min(1),
    relatedRecordType: z.string().optional(),
    relatedRecordId: z.string().uuid().optional(),
    requestedByRecipient: z.boolean().optional(),
    campaignId: z.string().uuid().optional(),
    contractId: z.string().uuid().optional(),
    ticketId: z.string().uuid().optional(),
    invoiceId: z.string().uuid().optional(),
  }),
  brand: z.object({
    id: z.string().uuid().optional(),
    legalCompanyName: z.string().min(1),
    tradingName: z.string().optional(),
    logoUrl: z.string().url().optional(),
    logoAlt: z.string().optional(),
    primaryColor: z.string().optional(),
    postalAddress: z.string().optional(),
    website: z.string().url().optional(),
    supportEmail: z.string().email().optional(),
    privacyContact: z.string().email().optional(),
  }),
  locale: z.string().min(2),
  localeSource: z.string().min(1),
  recipientCountry: z.string().optional(),
  jurisdictionSource: z.string().optional(),
  jurisdictionConfidence: z.enum(['verified', 'declared', 'inferred', 'unknown']).optional(),
  consentStatus: z.enum(['pending','granted','denied','withdrawn','expired','not_required','legitimate_interest_review_required','suppressed','unknown']),
  consentRecordId: z.string().uuid().optional(),
  legalBasis: z.enum(['consent','contract','legal_obligation','vital_interests','public_task','legitimate_interests','not_required']).optional(),
  suppressed: z.boolean().optional(),
  policies: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(['privacy','terms','cookies','email','security','subprocessors','legal_notice']),
    version: z.string(),
    language: z.string(),
    publicUrl: z.string().url(),
    status: z.literal('published'),
  })),
  requestedTracking: z.object({
    delivery: z.boolean().optional(),
    bounce: z.boolean().optional(),
    opens: z.boolean().optional(),
    links: z.boolean().optional(),
    documentDownloads: z.boolean().optional(),
  }).optional(),
  regionalOpenTrackingAllowed: z.boolean().optional(),
  unsubscribeUrl: z.string().url().optional(),
  preferencesUrl: z.string().url().optional(),
  dataRequestUrl: z.string().url().optional(),
  links: z.array(z.string()).optional(),
  approvalCompleted: z.boolean().optional(),
  approvalRequired: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }
    await requireTenantAccess(parsed.data.tenantId);
    const result = resolveCommunicationCompliance(parsed.data);
    return NextResponse.json(result, { status: result.ready ? 200 : 422 });
  } catch (error) {
    return routeErrorResponse(error, 'Unable to resolve communication compliance', request);
  }
}

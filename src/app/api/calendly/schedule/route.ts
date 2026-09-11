import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { calendlyService } from '@/services/calendlyService';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const input = z.object({
      tenantId: z.string().uuid(),
      eventTypeUri: z.string().url().refine(value => {
        try { return new URL(value).origin === 'https://api.calendly.com'; } catch { return false; }
      }, 'Invalid Calendly event type URI'),
      inviteeDetails: z.object({
        name: z.string().trim().min(1).max(160), email: z.string().email().max(320),
        start_time: z.string().datetime(), timezone: z.string().trim().min(1).max(80).optional(),
        questions_and_answers: z.array(z.object({ question: z.string().max(500), answer: z.string().max(2000) })).max(20).optional(),
      }),
    }).parse(await req.json());
    const { user } = await requireTenantAccess(input.tenantId);
    const booking = await calendlyService.scheduleMeeting(input.eventTypeUri, input.inviteeDetails, input.tenantId);
    const admin = createSupabaseAdminClient();
    await admin.from('business_automation_events').insert({
      tenant_id: input.tenantId, event_type: 'calendly_meeting_scheduled',
      payload: { actorUserId: user.id, inviteeEmail: input.inviteeDetails.email, bookingUri: booking?.uri || null },
    });
    return NextResponse.json({ success: true, booking });
  } catch (error) {
    return routeErrorResponse(error, 'Calendly meeting could not be scheduled', req);
  }
}

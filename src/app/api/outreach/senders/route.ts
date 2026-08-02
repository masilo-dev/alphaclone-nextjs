import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, routeErrorResponse } from "@/lib/apiAuth";

const updateSchema = z.object({
  tenantId: z.uuid(),
  senderId: z.uuid(),
  warmupStatus: z.enum([
    "not_started",
    "warming",
    "ready",
    "paused",
    "blocked",
  ]),
  dailySendLimit: z.number().int().min(1).max(10000),
});

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(request.nextUrl.searchParams.get("tenantId") || "");
    const { admin } = await requireTenantAccess(tenantId, request);
    const { data: senders, error } = await admin
      .from("email_sender_addresses")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("is_default", { ascending: false })
      .order("email_address");
    if (error) throw error;
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data: events, error: eventError } = await admin
      .from("outreach_events")
      .select("event_type, metadata")
      .eq("tenant_id", tenantId)
      .gte("occurred_at", since)
      .in("event_type", ["sent", "delivered", "bounced", "complained"]);
    if (eventError) throw eventError;
    type SenderRow = Record<string, any>;
    type EventRow = { event_type: string; metadata?: Record<string, unknown> | null };
    const enriched = ((senders || []) as SenderRow[]).map((sender) => {
      const senderEvents = ((events || []) as EventRow[]).filter(
        (event: EventRow) =>
          String(event.metadata?.sender_email || "").toLowerCase() ===
          String(sender.email_address).toLowerCase(),
      );
      const sent = senderEvents.filter(
        (event: EventRow) =>
          event.event_type === "sent" || event.event_type === "delivered",
      ).length;
      const bounced = senderEvents.filter(
        (event: EventRow) => event.event_type === "bounced",
      ).length;
      const complained = senderEvents.filter(
        (event: EventRow) => event.event_type === "complained",
      ).length;
      const bounceRate = sent
        ? bounced / sent
        : Number(sender.bounce_rate || 0);
      const complaintRate = sent
        ? complained / sent
        : Number(sender.complaint_rate || 0);
      const reputationScore = Math.max(
        0,
        Math.round((100 - bounceRate * 500 - complaintRate * 5000) * 100) / 100,
      );
      return {
        ...sender,
        live_health: {
          sent,
          bounced,
          complained,
          bounceRate,
          complaintRate,
          reputationScore,
          unsafe: bounceRate >= 0.05 || complaintRate >= 0.001,
        },
      };
    });
    return NextResponse.json({ success: true, senders: enriched });
  } catch (error) {
    return routeErrorResponse(
      error,
      "Sender deliverability could not be loaded",
      request,
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const parsed = updateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "Invalid sender warm-up settings",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    const input = parsed.data;
    const { admin } = await requireTenantAccess(input.tenantId, request);
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("email_sender_addresses")
      .update({
        warmup_status: input.warmupStatus,
        daily_send_limit: input.dailySendLimit,
        warmup_started_at: input.warmupStatus === "warming" ? now : undefined,
        updated_at: now,
      })
      .eq("tenant_id", input.tenantId)
      .eq("id", input.senderId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    return NextResponse.json({ success: true, sender: data });
  } catch (error) {
    return routeErrorResponse(
      error,
      "Sender warm-up settings could not be saved",
      request,
    );
  }
}

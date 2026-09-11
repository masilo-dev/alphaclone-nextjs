import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, routeErrorResponse } from "@/lib/apiAuth";

const createSchema = z.object({
  tenantId: z.uuid(),
  sequenceId: z.uuid(),
  name: z.string().trim().min(2).max(160),
  hypothesis: z.string().trim().max(1000).optional(),
  metric: z.enum([
    "open_rate",
    "click_rate",
    "reply_rate",
    "meeting_rate",
    "revenue",
  ]),
  variants: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(40),
        label: z.string().trim().min(1).max(120),
        weight: z.number().positive(),
        subject: z.string().max(500).optional(),
        body: z.string().max(200_000).optional(),
        offer: z.string().max(5000).optional(),
      }),
    )
    .min(2)
    .max(8),
});
const updateSchema = z.object({
  tenantId: z.uuid(),
  experimentId: z.uuid(),
  status: z.enum(["draft", "running", "completed", "stopped"]),
  winnerVariant: z.string().trim().max(40).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(request.nextUrl.searchParams.get("tenantId") || "");
    const { admin } = await requireTenantAccess(tenantId, request);
    const [experimentResult, eventResult] = await Promise.all([
      admin
        .from("outreach_experiments")
        .select("*, sequence:outreach_sequences(id,name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      admin
        .from("outreach_events")
        .select("event_type, variant, metadata")
        .eq("tenant_id", tenantId)
        .not("variant", "is", null)
        .order("occurred_at", { ascending: false })
        .limit(20_000),
    ]);
    if (experimentResult.error) throw experimentResult.error;
    if (eventResult.error) throw eventResult.error;
    const experiments = (experimentResult.data || []).map((experiment: any) => {
      const events = (eventResult.data || []).filter(
        (event: any) => event.metadata?.experiment_id === experiment.id,
      );
      const results: Record<string, Record<string, number>> = {};
      for (const variant of Array.isArray(experiment.variants)
        ? experiment.variants
        : []) {
        const rows = events.filter(
          (event: any) => event.variant === variant.key,
        );
        const count = (type: string) =>
          rows.filter((event: any) => event.event_type === type).length;
        const sent = count("sent");
        results[variant.key] = {
          sent,
          opened: count("opened"),
          clicked: count("clicked"),
          replied: count("replied") + count("reply"),
          meetings: count("meeting_booked"),
          revenue: rows.reduce(
            (sum: number, event: any) =>
              sum + Number(event.metadata?.revenue || 0),
            0,
          ),
        };
      }
      return { ...experiment, live_results: results };
    });
    return NextResponse.json({ success: true, experiments });
  } catch (error) {
    return routeErrorResponse(
      error,
      "Experiments could not be loaded",
      request,
    );
  }
}
export async function POST(request: NextRequest) {
  try {
    const parsed = createSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid experiment", details: parsed.error.flatten() },
        { status: 400 },
      );
    const input = parsed.data;
    const { admin } = await requireTenantAccess(input.tenantId, request);
    const total = input.variants.reduce((sum, item) => sum + item.weight, 0);
    const variants = input.variants.map((item) => ({
      ...item,
      allocation: item.weight / total,
    }));
    const { data, error } = await admin
      .from("outreach_experiments")
      .insert({
        tenant_id: input.tenantId,
        sequence_id: input.sequenceId,
        name: input.name,
        hypothesis: input.hypothesis || null,
        metric: input.metric,
        variants,
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(
      { success: true, experiment: data },
      { status: 201 },
    );
  } catch (error) {
    return routeErrorResponse(
      error,
      "Experiment could not be created",
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
        { error: "Invalid experiment update" },
        { status: 400 },
      );
    const input = parsed.data;
    const { admin } = await requireTenantAccess(input.tenantId, request);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: input.status };
    if (input.status === "running") patch.started_at = now;
    if (input.status === "completed") {
      patch.completed_at = now;
      patch.winner_variant = input.winnerVariant || null;
    }
    const { data, error } = await admin
      .from("outreach_experiments")
      .update(patch)
      .eq("tenant_id", input.tenantId)
      .eq("id", input.experimentId)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, experiment: data });
  } catch (error) {
    return routeErrorResponse(
      error,
      "Experiment could not be updated",
      request,
    );
  }
}

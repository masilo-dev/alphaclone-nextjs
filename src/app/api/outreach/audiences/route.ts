import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, routeErrorResponse } from "@/lib/apiAuth";

const ruleSchema = z.object({
  source: z.enum(["leads", "contacts", "clients"]).default("leads"),
  status: z.string().trim().max(80).optional(),
  industry: z.string().trim().max(160).optional(),
  country: z.string().trim().max(120).optional(),
  search: z.string().trim().max(160).optional(),
});
const createSchema = z.object({
  tenantId: z.uuid(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  rules: ruleSchema,
});

async function estimateAudience(
  admin: any,
  tenantId: string,
  rules: z.infer<typeof ruleSchema>,
) {
  const table =
    rules.source === "contacts"
      ? "contacts"
      : rules.source === "clients"
        ? "business_clients"
        : "leads";
  let query = admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (table === "contacts") query = query.is("deleted_at", null);
  if (table === "business_clients") query = query.eq("is_active", true);
  if (rules.status && table !== "business_clients")
    query = query.eq("status", rules.status);
  if (rules.industry && table !== "contacts")
    query = query.ilike("industry", `%${rules.industry}%`);
  if (rules.country && table === "leads")
    query = query.ilike("location", `%${rules.country}%`);
  if (rules.search) {
    const term = rules.search.replace(/[,%()]/g, " ").trim();
    const columns =
      table === "contacts"
        ? "full_name,email"
        : table === "business_clients"
          ? "name,email"
          : "business_name,email";
    query = query.or(
      columns
        .split(",")
        .map((column) => `${column}.ilike.%${term}%`)
        .join(","),
    );
  }
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(request.nextUrl.searchParams.get("tenantId") || "");
    const preview = request.nextUrl.searchParams.get("preview") === "true";
    const { admin } = await requireTenantAccess(tenantId, request);
    if (preview) {
      const parsed = ruleSchema.safeParse({
        source: request.nextUrl.searchParams.get("source") || "leads",
        status: request.nextUrl.searchParams.get("status") || undefined,
        industry: request.nextUrl.searchParams.get("industry") || undefined,
        country: request.nextUrl.searchParams.get("country") || undefined,
        search: request.nextUrl.searchParams.get("search") || undefined,
      });
      if (!parsed.success)
        return NextResponse.json(
          { error: "Invalid audience rules" },
          { status: 400 },
        );
      return NextResponse.json({
        success: true,
        estimatedSize: await estimateAudience(admin, tenantId, parsed.data),
      });
    }
    const { data, error } = await admin
      .from("marketing_segments")
      .select("*")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, audiences: data || [] });
  } catch (error) {
    return routeErrorResponse(error, "Audiences could not be loaded", request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid audience", details: parsed.error.flatten() },
        { status: 400 },
      );
    const { tenantId, name, description, rules } = parsed.data;
    const { user, admin } = await requireTenantAccess(tenantId, request);
    const estimatedSize = await estimateAudience(admin, tenantId, rules);
    const { data, error } = await admin
      .from("marketing_segments")
      .insert({
        tenant_id: tenantId,
        name,
        description: description || null,
        segment_type: "dynamic",
        rules: { operator: "and", source: rules.source, rules },
        estimated_size: estimatedSize,
        last_calculated_at: new Date().toISOString(),
        status: "active",
        created_by: user.id,
        updated_by: user.id,
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(
      { success: true, audience: data },
      { status: 201 },
    );
  } catch (error) {
    return routeErrorResponse(error, "Audience could not be created", request);
  }
}

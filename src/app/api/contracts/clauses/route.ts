import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, routeErrorResponse } from "@/lib/apiAuth";
import { ensureApprovedContractClauseDefaults } from "@/lib/contracts/approvedClauseDefaults";

const clauseSchema = z.object({
  tenantId: z.uuid(),
  title: z.string().trim().min(2).max(200),
  category: z.string().trim().min(2).max(100),
  body: z.string().min(1).max(200_000),
  fallbackBody: z.string().max(200_000).optional(),
  jurisdiction: z.string().trim().max(120).optional(),
  languageCode: z.string().trim().min(2).max(12).default("en"),
  riskLevel: z.enum(["low", "moderate", "high", "critical"]).default("low"),
  variables: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
});

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(
      request.nextUrl.searchParams.get("tenantId") || "",
    ).trim();
    if (!tenantId)
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 },
      );
    const { admin } = await requireTenantAccess(tenantId, request);
    await ensureApprovedContractClauseDefaults(admin, tenantId);
    const { data, error } = await admin
      .from("contract_clauses")
      .select("*")
      .eq("tenant_id", tenantId)
      .neq("approval_status", "retired")
      .order("category")
      .order("title");
    if (error) throw error;
    return NextResponse.json({ success: true, clauses: data || [] });
  } catch (error) {
    return routeErrorResponse(
      error,
      "Clause library could not be loaded",
      request,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = clauseSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid clause", details: parsed.error.flatten() },
        { status: 400 },
      );
    const input = parsed.data;
    const { user, admin } = await requireTenantAccess(input.tenantId, request);
    const { data: latest, error: latestError } = await admin
      .from("contract_clauses")
      .select("version_number")
      .eq("tenant_id", input.tenantId)
      .eq("title", input.title)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;
    const { data, error } = await admin
      .from("contract_clauses")
      .insert({
        tenant_id: input.tenantId,
        title: input.title,
        category: input.category,
        body: input.body,
        fallback_body: input.fallbackBody || null,
        jurisdiction: input.jurisdiction || null,
        language_code: input.languageCode,
        version_number: Number(latest?.version_number || 0) + 1,
        approval_status: "draft",
        risk_level: input.riskLevel,
        variables: input.variables,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, clause: data }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, "Clause could not be created", request);
  }
}

const reviewSchema = z.object({
  tenantId: z.uuid(),
  clauseId: z.uuid(),
  approvalStatus: z.enum(["pending", "approved", "rejected", "retired"]),
});

export async function PATCH(request: NextRequest) {
  try {
    const parsed = reviewSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid clause review", details: parsed.error.flatten() },
        { status: 400 },
      );
    const { tenantId, clauseId, approvalStatus } = parsed.data;
    const { user, admin } = await requireTenantAccess(tenantId, request);
    const approved = approvalStatus === "approved";
    const { data, error } = await admin
      .from("contract_clauses")
      .update({
        approval_status: approvalStatus,
        approved_by: approved ? user.id : null,
        approved_at: approved ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", clauseId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return NextResponse.json({ error: "Clause not found" }, { status: 404 });
    return NextResponse.json({ success: true, clause: data });
  } catch (error) {
    return routeErrorResponse(
      error,
      "Clause review could not be saved",
      request,
    );
  }
}

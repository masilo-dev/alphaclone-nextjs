import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, routeErrorResponse } from "@/lib/apiAuth";
import { ensureApprovedContractClauseDefaults } from "@/lib/contracts/approvedClauseDefaults";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    tenantId: z.uuid(),
    action: z.literal("send_signature_reminders"),
  }),
  z.object({
    tenantId: z.uuid(),
    action: z.literal("create_version"),
    content: z.string().min(1).max(1_000_000),
    changeSummary: z.string().trim().max(4000).optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    tenantId: z.uuid(),
    action: z.literal("add_clause"),
    clauseId: z.uuid(),
    contractVersionId: z.uuid().optional(),
    position: z.number().int().nonnegative().optional(),
    renderedBody: z.string().min(1).max(200_000),
    modifiedFromApproved: z.boolean().default(false),
    modificationReason: z.string().trim().max(2000).optional(),
  }),
  z.object({
    tenantId: z.uuid(),
    action: z.literal("add_signer"),
    contactId: z.uuid().optional(),
    companyId: z.uuid().optional(),
    name: z.string().trim().min(1).max(160),
    email: z.email(),
    role: z.string().trim().min(1).max(80),
    signingOrder: z.number().int().positive().optional(),
    signatureRequired: z.boolean().default(true),
  }),
  z.object({
    tenantId: z.uuid(),
    action: z.literal("open_negotiation"),
    title: z.string().trim().min(2).max(240),
    contractVersionId: z.uuid().optional(),
    clauseId: z.uuid().optional(),
    body: z.string().trim().min(1).max(50_000),
    proposedText: z.string().max(200_000).optional(),
  }),
  z.object({
    tenantId: z.uuid(),
    action: z.literal("comment"),
    threadId: z.uuid(),
    body: z.string().trim().min(1).max(50_000),
    proposedText: z.string().max(200_000).optional(),
  }),
  z.object({
    tenantId: z.uuid(),
    action: z.literal("add_obligation"),
    title: z.string().trim().min(2).max(240),
    description: z.string().max(10_000).optional(),
    obligationType: z.string().trim().max(80).optional(),
    dueDate: z.iso.datetime({ offset: true }).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    ownerUserId: z.uuid().optional(),
    recurrence: z.record(z.string(), z.unknown()).optional(),
  }),
]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
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
    const { data: contract, error: contractError } = await admin
      .from("contracts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (contractError) throw contractError;
    if (!contract)
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );

    const [
      versions,
      clauses,
      clauseLibrary,
      parties,
      negotiations,
      obligations,
      milestones,
      signatures,
      events,
    ] = await Promise.all([
      admin
        .from("contract_versions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("contract_id", id)
        .order("version_number", { ascending: false }),
      admin
        .from("contract_clause_usages")
        .select("*, clause:contract_clauses(*)")
        .eq("tenant_id", tenantId)
        .eq("contract_id", id)
        .order("position"),
      admin
        .from("contract_clauses")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("approval_status", "approved")
        .order("category")
        .order("title"),
      admin
        .from("contract_parties")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("contract_id", id)
        .order("signing_order"),
      admin
        .from("contract_negotiation_threads")
        .select("*, messages:contract_negotiation_messages(*)")
        .eq("tenant_id", tenantId)
        .eq("contract_id", id)
        .order("updated_at", { ascending: false }),
      admin
        .from("contract_obligations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("contract_id", id)
        .order("due_date"),
      admin
        .from("contract_milestones")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("contract_id", id)
        .order("due_at"),
      admin
        .from("contract_signature_events")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("contract_id", id)
        .order("occurred_at", { ascending: false }),
      admin
        .from("contract_lifecycle_events")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("contract_id", id)
        .order("created_at", { ascending: false }),
    ]);
    const firstError = [
      versions,
      clauses,
      clauseLibrary,
      parties,
      negotiations,
      obligations,
      milestones,
      signatures,
      events,
    ].find((result) => result.error)?.error;
    if (firstError) throw firstError;
    const latestVersions = (versions.data || []).slice(0, 2);
    const auditMetadata = (contract.metadata || {}) as Record<string, unknown>;
    const auditPath = typeof auditMetadata.audit_trail_pdf === "string" ? auditMetadata.audit_trail_pdf : "";
    const auditSignedUrl = auditPath
      ? (await admin.storage.from("private").createSignedUrl(auditPath, 3600)).data?.signedUrl || null
      : null;
    const redline =
      latestVersions.length === 2
        ? (() => {
            const [right, left] = latestVersions;
            const leftLines = String(left.content || "")
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
            const rightLines = String(right.content || "")
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
            const leftSet = new Set(leftLines);
            const rightSet = new Set(rightLines);
            return {
              leftVersion: left.version_number,
              rightVersion: right.version_number,
              leftContent: left.content,
              rightContent: right.content,
              additions: rightLines.filter((line) => !leftSet.has(line)),
              removals: leftLines.filter((line) => !rightSet.has(line)),
            };
          })()
        : null;
    return NextResponse.json({
      success: true,
      contract,
      versions: versions.data || [],
      clauses: clauses.data || [],
      clauseLibrary: clauseLibrary.data || [],
      parties: parties.data || [],
      negotiations: negotiations.data || [],
      obligations: obligations.data || [],
      milestones: milestones.data || [],
      signatures: signatures.data || [],
      events: events.data || [],
      redline,
      auditCertificate: auditPath
        ? {
            url: auditSignedUrl,
            hash: auditMetadata.audit_trail_pdf_hash || null,
            generatedAt: auditMetadata.audit_trail_pdf_at || null,
            expiresInSeconds: 3600,
          }
        : null,
    });
  } catch (error) {
    return routeErrorResponse(
      error,
      "Contract workspace could not be loaded",
      request,
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const parsed = actionSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "Invalid contract workspace action",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    const input = parsed.data;
    const { user, admin } = await requireTenantAccess(input.tenantId, request);
    const { data: contract } = await admin
      .from("contracts")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("id", id)
      .maybeSingle();
    if (!contract)
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );

    if (input.action === "send_signature_reminders") {
      const { sendOrderedContractSignatureReminders } =
        await import("@/services/contractSignatureReminderService");
      const result = await sendOrderedContractSignatureReminders({
        tenantId: input.tenantId,
        contractId: id,
        actorUserId: user.id,
        force: true,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (input.action === "create_version") {
      const { data: latest, error: latestError } = await admin
        .from("contract_versions")
        .select("version_number")
        .eq("tenant_id", input.tenantId)
        .eq("contract_id", id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw latestError;
      const versionNumber = Number(latest?.version_number || 0) + 1;
      const { data, error } = await admin
        .from("contract_versions")
        .insert({
          tenant_id: input.tenantId,
          contract_id: id,
          version_number: versionNumber,
          content: input.content,
          content_hash: createHash("sha256")
            .update(input.content)
            .digest("hex"),
          status: "draft",
          change_summary: input.changeSummary || null,
          created_by: user.id,
          metadata: input.metadata,
        })
        .select("*")
        .single();
      if (error) throw error;
      await admin
        .from("contracts")
        .update({
          current_version_id: data.id,
          content: input.content,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", input.tenantId)
        .eq("id", id);
      return NextResponse.json(
        { success: true, version: data },
        { status: 201 },
      );
    }

    if (input.action === "add_clause") {
      const { data, error } = await admin
        .from("contract_clause_usages")
        .insert({
          tenant_id: input.tenantId,
          contract_id: id,
          contract_version_id: input.contractVersionId || null,
          clause_id: input.clauseId,
          position: input.position ?? null,
          rendered_body: input.renderedBody,
          modified_from_approved: input.modifiedFromApproved,
          modification_reason: input.modificationReason || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, usage: data }, { status: 201 });
    }

    if (input.action === "add_signer") {
      const { data, error } = await admin
        .from("contract_parties")
        .insert({
          tenant_id: input.tenantId,
          contract_id: id,
          contact_id: input.contactId || null,
          company_id: input.companyId || null,
          party_snapshot: { name: input.name, email: input.email },
          role: input.role,
          signing_order: input.signingOrder || null,
          signature_required: input.signatureRequired,
          signature_status: "not_requested",
        })
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json(
        { success: true, signer: data },
        { status: 201 },
      );
    }

    if (input.action === "open_negotiation") {
      const { data: thread, error: threadError } = await admin
        .from("contract_negotiation_threads")
        .insert({
          tenant_id: input.tenantId,
          contract_id: id,
          contract_version_id: input.contractVersionId || null,
          clause_id: input.clauseId || null,
          title: input.title,
          status: "open",
          created_by: user.id,
        })
        .select("*")
        .single();
      if (threadError) throw threadError;
      const { error: messageError } = await admin
        .from("contract_negotiation_messages")
        .insert({
          tenant_id: input.tenantId,
          thread_id: thread.id,
          author_user_id: user.id,
          author_role: "internal",
          body: input.body,
          proposed_text: input.proposedText || null,
        });
      if (messageError) throw messageError;
      return NextResponse.json({ success: true, thread }, { status: 201 });
    }

    if (input.action === "comment") {
      const { data: thread } = await admin
        .from("contract_negotiation_threads")
        .select("id")
        .eq("tenant_id", input.tenantId)
        .eq("contract_id", id)
        .eq("id", input.threadId)
        .maybeSingle();
      if (!thread)
        return NextResponse.json(
          { error: "Negotiation thread not found" },
          { status: 404 },
        );
      const { data, error } = await admin
        .from("contract_negotiation_messages")
        .insert({
          tenant_id: input.tenantId,
          thread_id: input.threadId,
          author_user_id: user.id,
          author_role: "internal",
          body: input.body,
          proposed_text: input.proposedText || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      await admin
        .from("contract_negotiation_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", input.threadId);
      return NextResponse.json(
        { success: true, message: data },
        { status: 201 },
      );
    }

    const { data, error } = await admin
      .from("contract_obligations")
      .insert({
        tenant_id: input.tenantId,
        contract_id: id,
        title: input.title,
        description: input.description || null,
        obligation_type: input.obligationType || null,
        due_date: input.dueDate || null,
        priority: input.priority,
        owner_user_id: input.ownerUserId || user.id,
        recurrence: input.recurrence || null,
        status: "planned",
        idempotency_key: `manual:${id}:${crypto.randomUUID()}`,
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(
      { success: true, obligation: data },
      { status: 201 },
    );
  } catch (error) {
    return routeErrorResponse(
      error,
      "Contract workspace action failed",
      request,
    );
  }
}

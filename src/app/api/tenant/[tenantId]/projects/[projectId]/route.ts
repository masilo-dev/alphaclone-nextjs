import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireTenantAccess, routeErrorResponse } from "@/lib/apiAuth";
import {
  computeProjectProgressPercent,
  finishedProjectWriteFields,
  isFinishedProject,
  isFinishedProjectStage,
  isFinishedProjectStatus,
  normalizeProjectStage,
  normalizeProjectStatus,
} from "@/lib/projects/projectEnums";
import {
  notifyProjectClientProgressUpdate,
  notifyProjectClientStageUpdate,
} from "@/lib/projects/projectClientNotification";
import { sendEmailServer } from "@/lib/email/sendEmailServer";
import { buildCanonicalProjectPortalUrl } from "@/lib/projects/portalLinks";

const fields = z
  .object({
    name: z.string().trim().min(1).max(200),
    category: z.string().max(120),
    status: z.string().max(80),
    currentStage: z.string().max(120),
    progress: z.number().min(0).max(100),
    dueDate: z.union([
      z.string().date(),
      z.string().datetime(),
      z.literal(""),
      z.null(),
    ]),
    startDate: z.union([
      z.string().date(),
      z.string().datetime(),
      z.literal(""),
      z.null(),
    ]),
    team: z.array(z.string().uuid()).max(100),
    image: z.string().url().max(2000).nullable(),
    description: z.string().max(10_000).nullable(),
    contractStatus: z.string().max(80),
    contractText: z.string().max(100_000).nullable(),
    externalUrl: z.string().url().max(2000).nullable(),
    isPublic: z.boolean(),
    showInPortfolio: z.boolean(),
    budget: z.number().min(0).max(1_000_000_000).nullable(),
    risk: z.string().max(40).nullable(),
    health: z.string().max(40).nullable(),
    resources: z.array(z.string().max(300)).max(200),
    budgetTotal: z.number().min(0).max(1_000_000_000).nullable(),
    budgetUsed: z.number().min(0).max(1_000_000_000),
    velocityScore: z.number().min(0).max(100).nullable(),
    healthScore: z.number().min(0).max(100).nullable(),
    portalEnabled: z.boolean(),
    estimatedCompletionDate: z.union([
      z.string().date(),
      z.string().datetime(),
      z.literal(""),
      z.null(),
    ]),
    autoInvoiceEnabled: z.boolean(),
  })
  .partial();
const actionSchema = z.object({
  action: z.enum(["ensure_portal_token", "recalculate_progress"]),
});
const columnMap: Record<string, string> = {
  currentStage: "current_stage",
  dueDate: "due_date",
  startDate: "start_date",
  contractStatus: "contract_status",
  contractText: "contract_text",
  externalUrl: "external_url",
  isPublic: "is_public",
  showInPortfolio: "show_in_portfolio",
  budgetTotal: "budget_total",
  budgetUsed: "budget_used",
  velocityScore: "velocity_score",
  healthScore: "health_score",
  portalEnabled: "portal_enabled",
  estimatedCompletionDate: "estimated_completion_date",
  autoInvoiceEnabled: "auto_invoice_enabled",
};

async function access(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string; projectId: string }> },
) {
  const { tenantId, projectId } = await context.params;
  const auth = await requireTenantAccess(tenantId, req);
  return { tenantId, projectId, auth };
}

const validProjectId = (projectId: string) =>
  z.string().uuid().safeParse(projectId).success;

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string; projectId: string }> },
) {
  try {
    const { tenantId, projectId, auth } = await access(req, context);
    if (!validProjectId(projectId))
      return NextResponse.json(
        { error: "Valid project ID is required" },
        { status: 400 },
      );
    const parsed = fields.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success || !Object.keys(parsed.data).length)
      return NextResponse.json(
        {
          error: "Invalid project update",
          fields: parsed.success
            ? undefined
            : parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    const admin = createSupabaseAdminClient();
    if (parsed.data.team?.length) {
      const { count, error } = await admin
        .from("tenant_users")
        .select("user_id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("user_id", [...new Set(parsed.data.team)]);
      if (error) throw error;
      if ((count || 0) !== new Set(parsed.data.team).size)
        return NextResponse.json(
          { error: "Every project team member must belong to this workspace" },
          { status: 400 },
        );
    }
    const { data: before, error: beforeError } = await admin
      .from("projects")
      .select("id, name, current_stage, status, progress, portal_expires_at, owner_id")
      .eq("id", projectId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (beforeError) throw beforeError;
    if (!before)
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const [key, value] of Object.entries(parsed.data)) {
      if (key === "status" && typeof value === "string") {
        const status = normalizeProjectStatus(value);
        if (!status)
          return NextResponse.json(
            { error: `Invalid project status: ${value}` },
            { status: 400 },
          );
        patch.status = status;
        continue;
      }
      if (key === "currentStage" && typeof value === "string") {
        const currentStage = normalizeProjectStage(value);
        if (!currentStage)
          return NextResponse.json(
            { error: `Invalid project stage: ${value}` },
            { status: 400 },
          );
        patch.current_stage = currentStage;
        continue;
      }
      patch[columnMap[key] || key] = [
        "dueDate",
        "startDate",
        "estimatedCompletionDate",
      ].includes(key)
        ? typeof value === "string" && value
          ? value.slice(0, 10)
          : null
        : value;
    }
    if (parsed.data.portalEnabled === false) patch.portal_token = null;
    const nextStatus = typeof patch.status === "string" ? patch.status : before.status;
    const nextStage =
      typeof patch.current_stage === "string" ? patch.current_stage : before.current_stage;
    const wasComplete = isFinishedProject({
      status: before.status,
      current_stage: before.current_stage,
    });
    const willBeComplete = isFinishedProject({
      status: nextStatus,
      current_stage: nextStage,
    });
    if (willBeComplete) {
      const finished = finishedProjectWriteFields();
      if (!isFinishedProjectStatus(typeof patch.status === "string" ? String(patch.status) : before.status)) {
        patch.status = finished.status;
      }
      if (isFinishedProjectStage(String(nextStage))) {
        patch.current_stage = finished.current_stage;
      }
      if (typeof patch.progress !== "number") patch.progress = finished.progress;
      if (!patch.estimated_completion_date) {
        patch.estimated_completion_date = finished.estimated_completion_date;
      }
    }
    if (willBeComplete && !wasComplete && !before.portal_expires_at) {
      const expires = new Date();
      expires.setDate(expires.getDate() + 14);
      patch.portal_expires_at = expires.toISOString();
    }
    const { data: project, error } = await admin
      .from("projects")
      .update(patch)
      .eq("id", projectId)
      .eq("tenant_id", tenantId)
      .select("*")
      .single();
    if (error) throw error;
    const { error: eventError } = await admin
      .from("business_automation_events")
      .insert({
        tenant_id: tenantId,
        event_type: "project_updated",
        payload: {
          projectId,
          actorUserId: auth.user.id,
          changedFields: Object.keys(parsed.data),
          previousStage: before.current_stage,
          currentStage: project.current_stage,
        },
      });
    if (eventError)
      console.error(
        "[projects] project_updated event could not be recorded",
        eventError,
      );
    const origin = req.nextUrl.origin;
    const notificationResults: Record<string, unknown> = {};
    if (typeof project.current_stage === "string" && before.current_stage !== project.current_stage) {
      notificationResults.stage = await notifyProjectClientStageUpdate({
        admin,
        projectId,
        tenantId,
        previousStage: before.current_stage || "In Progress",
        newStage: project.current_stage,
        origin,
      });
    }
    if (typeof project.progress === "number" && before.progress !== project.progress) {
      notificationResults.progress = await notifyProjectClientProgressUpdate({
        admin,
        projectId,
        tenantId,
        previousProgress: before.progress ?? null,
        newProgress: project.progress,
        origin,
        trigger: "progress_change",
      });
    }
    const changedForOwner = [
      before.current_stage !== project.current_stage ? `Stage: ${before.current_stage || "In Progress"} -> ${project.current_stage || "In Progress"}` : "",
      before.status !== project.status ? `Status: ${before.status || "Active"} -> ${project.status || "Active"}` : "",
      before.progress !== project.progress ? `Progress: ${before.progress ?? 0}% -> ${project.progress ?? 0}%` : "",
    ].filter(Boolean);
    if (changedForOwner.length && before.owner_id) {
      const { data: ownerProfile } = await admin
        .from("profiles")
        .select("email, name")
        .eq("id", before.owner_id)
        .maybeSingle();
      if (ownerProfile?.email) {
        const projectPortalUrl = project.portal_token ? buildCanonicalProjectPortalUrl(project.portal_token) : "";
        const ownerEmail = await sendEmailServer({
          tenantId,
          to: ownerProfile.email,
          subject: `Project updated: ${project.name || before.name}`,
          fromName: "AlphaClone Project Updates",
          isPlatformNotification: true,
          templateName: "projectOwnerUpdate",
          html: `
            <p>Hi ${ownerProfile.name || "there"},</p>
            <p><strong>${project.name || before.name}</strong> was updated.</p>
            <ul>${changedForOwner.map((line) => `<li>${line}</li>`).join("")}</ul>
            ${projectPortalUrl ? `<p><a href="${projectPortalUrl}">Open client portal</a></p>` : ""}
            <p style="color:#64748b;font-size:12px;">Automated notification from AlphaClone Systems.</p>
          `,
        });
        notificationResults.owner = { sent: ownerEmail.success, skipped: ownerEmail.error };
      }
    }
    return NextResponse.json({ project, previousStage: before.current_stage, notifications: notificationResults });
  } catch (error) {
    return routeErrorResponse(error, "Project could not be updated", req);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string; projectId: string }> },
) {
  try {
    const { tenantId, projectId } = await access(req, context);
    if (!validProjectId(projectId))
      return NextResponse.json(
        { error: "Valid project ID is required" },
        { status: 400 },
      );
    const parsed = actionSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid project action" },
        { status: 400 },
      );
    const admin = createSupabaseAdminClient();
    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, portal_token, status, current_stage")
      .eq("id", projectId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project)
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (parsed.data.action === "ensure_portal_token") {
      if (project.portal_token)
        return NextResponse.json({ token: project.portal_token });
      const token = crypto.randomUUID().replace(/-/g, "");
      const { error } = await admin
        .from("projects")
        .update({ portal_token: token, portal_enabled: true })
        .eq("id", projectId)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return NextResponse.json({ token });
    }
    const [
      { data: milestones, error: milestoneError },
      { data: tasks, error: taskError },
    ] = await Promise.all([
      admin
        .from("project_milestones")
        .select("status")
        .eq("project_id", projectId),
      admin
        .from("tasks")
        .select("status")
        .eq("tenant_id", tenantId)
        .or(`related_to_project.eq.${projectId},project_id.eq.${projectId}`),
    ]);
    if (milestoneError) throw milestoneError;
    if (taskError) throw taskError;
    const progress = computeProjectProgressPercent({
      status: project.status,
      current_stage: project.current_stage,
      milestones,
      tasks,
    });
    const finishedPatch = isFinishedProject({
      status: project.status,
      current_stage: project.current_stage,
    })
      ? finishedProjectWriteFields()
      : null;
    const { error } = await admin
      .from("projects")
      .update({
        progress,
        updated_at: new Date().toISOString(),
        ...(finishedPatch
          ? { status: finishedPatch.status, current_stage: finishedPatch.current_stage }
          : {}),
      })
      .eq("id", projectId)
      .eq("tenant_id", tenantId);
    if (error) throw error;
    return NextResponse.json({ progress });
  } catch (error) {
    return routeErrorResponse(
      error,
      "Project action could not be completed",
      req,
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string; projectId: string }> },
) {
  try {
    const { tenantId, projectId, auth } = await access(req, context);
    if (!validProjectId(projectId))
      return NextResponse.json(
        { error: "Valid project ID is required" },
        { status: 400 },
      );
    const admin = createSupabaseAdminClient();
    const { error: fileError } = await admin
      .from("file_uploads")
      .update({ deleted_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("entity_type", "project")
      .eq("entity_id", projectId);
    if (fileError) throw fileError;
    const { data, error } = await admin
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("tenant_id", tenantId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const { error: eventError } = await admin
      .from("business_automation_events")
      .insert({
        tenant_id: tenantId,
        event_type: "project_deleted",
        payload: { projectId, actorUserId: auth.user.id },
      });
    if (eventError)
      console.error(
        "[projects] project_deleted event could not be recorded",
        eventError,
      );
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, "Project could not be deleted", req);
  }
}

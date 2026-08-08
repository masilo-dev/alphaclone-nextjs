import { NextRequest, NextResponse } from "next/server";
import { requireTenantAccess, routeErrorResponse } from "@/lib/apiAuth";
import {
  assertContractTransition,
  assertInvoiceTransition,
  connectedLifecycleActionSchema,
  normalizeOutreachRecipient,
} from "@/lib/revenue/connectedLifecycle";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(
      request.nextUrl.searchParams.get("tenantId") || "",
    ).trim();
    const entityType = String(
      request.nextUrl.searchParams.get("entityType") || "",
    ).trim();
    const entityId = String(
      request.nextUrl.searchParams.get("entityId") || "",
    ).trim();
    if (!tenantId || !entityType || !entityId) {
      return NextResponse.json(
        { error: "tenantId, entityType, and entityId are required" },
        { status: 400 },
      );
    }
    const { admin } = await requireTenantAccess(tenantId, request);
    const [
      { data: outgoing, error: outgoingError },
      { data: incoming, error: incomingError },
    ] = await Promise.all([
      admin
        .from("revenue_lifecycle_links")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("source_type", entityType)
        .eq("source_id", entityId),
      admin
        .from("revenue_lifecycle_links")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("target_type", entityType)
        .eq("target_id", entityId),
    ]);
    if (outgoingError) throw outgoingError;
    if (incomingError) throw incomingError;
    return NextResponse.json({
      success: true,
      links: [...(outgoing || []), ...(incoming || [])],
    });
  } catch (error) {
    return routeErrorResponse(
      error,
      "Revenue lifecycle could not be loaded",
      request,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = connectedLifecycleActionSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid lifecycle action", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const input = parsed.data;
    const { user, admin } = await requireTenantAccess(input.tenantId, request);

    if (input.action === "link") {
      const { data, error } = await admin
        .from("revenue_lifecycle_links")
        .upsert(
          {
            tenant_id: input.tenantId,
            source_type: input.sourceType,
            source_id: input.sourceId,
            target_type: input.targetType,
            target_id: input.targetId,
            relationship: input.relationship,
            metadata: input.metadata,
            created_by: user.id,
          },
          {
            onConflict:
              "tenant_id,source_type,source_id,target_type,target_id,relationship",
          },
        )
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, link: data }, { status: 201 });
    }

    if (input.action === "transition_contract") {
      const { data: contract, error: readError } = await admin
        .from("contracts")
        .select("id, lifecycle_status, status")
        .eq("tenant_id", input.tenantId)
        .eq("id", input.contractId)
        .maybeSingle();
      if (readError) throw readError;
      if (!contract)
        return NextResponse.json(
          { error: "Contract not found" },
          { status: 404 },
        );
      const from = String(
        contract.lifecycle_status || contract.status || "draft",
      );
      assertContractTransition(from, input.status);
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = {
        lifecycle_status: input.status,
        status: input.status,
        updated_at: now,
      };
      if (input.status === "viewed") patch.viewed_at = now;
      if (input.status === "active") patch.activated_at = now;
      if (input.status === "terminated") {
        patch.terminated_at = now;
        patch.termination_reason = input.reason || null;
      }
      const { error: updateError } = await admin
        .from("contracts")
        .update(patch)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.contractId);
      if (updateError) throw updateError;
      const { error: eventError } = await admin
        .from("contract_lifecycle_events")
        .insert({
          tenant_id: input.tenantId,
          contract_id: input.contractId,
          from_status: from,
          to_status: input.status,
          reason: input.reason || null,
          actor_user_id: user.id,
          source: "api",
          evidence: input.evidence,
        });
      if (eventError) throw eventError;
      return NextResponse.json({ success: true, from, to: input.status });
    }

    if (input.action === "transition_invoice") {
      const { data: invoice, error: readError } = await admin
        .from("business_invoices")
        .select(
          "id, lifecycle_status, status, total, total_amount, balance_due",
        )
        .eq("tenant_id", input.tenantId)
        .eq("id", input.invoiceId)
        .maybeSingle();
      if (readError) throw readError;
      if (!invoice)
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 },
        );
      const from = String(
        invoice.lifecycle_status || invoice.status || "draft",
      );
      assertInvoiceTransition(from, input.status);
      if (input.status === "sent") {
        const { count, error: evidenceError } = await admin
          .from("invoice_delivery_log")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", input.tenantId)
          .eq("invoice_id", input.invoiceId);
        if (evidenceError) throw evidenceError;
        if (!count)
          return NextResponse.json(
            {
              error:
                "Invoice cannot be marked sent without delivery-attempt evidence. Use the Send invoice action.",
            },
            { status: 409 },
          );
      }
      if (input.status === "viewed") {
        const { count, error: evidenceError } = await admin
          .from("invoice_views")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", input.tenantId)
          .eq("invoice_id", input.invoiceId);
        if (evidenceError) throw evidenceError;
        if (!count)
          return NextResponse.json(
            {
              error:
                "Invoice cannot be marked viewed without a verified view event.",
            },
            { status: 409 },
          );
      }
      if (["partially_paid", "paid"].includes(input.status)) {
        const { data: payments, error: evidenceError } = await admin
          .from("business_invoice_payments")
          .select("amount")
          .eq("tenant_id", input.tenantId)
          .eq("invoice_id", input.invoiceId);
        if (evidenceError) throw evidenceError;
        const paidAmount = (payments || []).reduce(
          (sum: number, payment: { amount: number | string }) =>
            sum + Number(payment.amount || 0),
          0,
        );
        if (paidAmount <= 0)
          return NextResponse.json(
            {
              error:
                "Invoice cannot be marked paid without reconciled payment evidence.",
            },
            { status: 409 },
          );
        const invoiceTotal = Number(invoice.total ?? invoice.total_amount ?? 0);
        if (
          input.status === "paid" &&
          invoiceTotal > 0 &&
          paidAmount + 0.005 < invoiceTotal
        )
          return NextResponse.json(
            {
              error:
                "Invoice still has an unpaid balance and cannot be marked fully paid.",
            },
            { status: 409 },
          );
        if (
          input.status === "partially_paid" &&
          invoiceTotal > 0 &&
          paidAmount + 0.005 >= invoiceTotal
        )
          return NextResponse.json(
            {
              error:
                "Payment evidence covers the full invoice; mark it paid instead.",
            },
            { status: 409 },
          );
      }
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = {
        lifecycle_status: input.status,
        status: input.status,
        updated_at: now,
      };
      if (input.status === "approved") patch.approved_at = now;
      if (input.status === "viewed") patch.viewed_at = now;
      if (input.status === "disputed") {
        patch.disputed_at = now;
        patch.dispute_reason = input.reason || null;
      }
      const { error: updateError } = await admin
        .from("business_invoices")
        .update(patch)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.invoiceId);
      if (updateError) throw updateError;
      const { error: eventError } = await admin
        .from("invoice_lifecycle_events")
        .insert({
          tenant_id: input.tenantId,
          invoice_id: input.invoiceId,
          event_type: `status_${input.status}`,
          from_status: from,
          to_status: input.status,
          actor_user_id: user.id,
          source: "api",
          evidence: { reason: input.reason || null, ...input.evidence },
        });
      if (eventError) throw eventError;
      return NextResponse.json({ success: true, from, to: input.status });
    }

    if (input.action === "schedule_contract_milestones") {
      const [
        { data: milestones, error: milestoneError },
        { data: invoice, error: invoiceError },
      ] = await Promise.all([
        admin
          .from("contract_milestones")
          .select("id, title, due_at, milestone_type")
          .eq("tenant_id", input.tenantId)
          .eq("contract_id", input.contractId)
          .order("due_at"),
        admin
          .from("business_invoices")
          .select("id, total_amount, amount, total")
          .eq("tenant_id", input.tenantId)
          .eq("id", input.invoiceId)
          .maybeSingle(),
      ]);
      if (milestoneError) throw milestoneError;
      if (invoiceError) throw invoiceError;
      if (!invoice)
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 },
        );
      if (!milestones?.length)
        return NextResponse.json(
          { error: "Contract has no milestones" },
          { status: 409 },
        );
      const total = Number(
        invoice.total_amount || invoice.amount || invoice.total || 0,
      );
      const amount = Math.round((total / milestones.length) * 100) / 100;
      const rows = milestones.map(
        (
          milestone: {
            id: string;
            title: string;
            due_at: string;
            milestone_type?: string;
          },
          index: number,
        ) => ({
          tenant_id: input.tenantId,
          invoice_id: input.invoiceId,
          contract_id: input.contractId,
          contract_milestone_id: milestone.id,
          sequence_number: index + 1,
          label: milestone.title,
          amount:
            index === milestones.length - 1
              ? Math.round((total - amount * index) * 100) / 100
              : amount,
          currency_code: input.currencyCode,
          due_date: String(milestone.due_at).slice(0, 10),
          status: "scheduled",
        }),
      );
      const { data, error } = await admin
        .from("invoice_payment_schedules")
        .upsert(rows, {
          onConflict: "tenant_id,invoice_id,sequence_number",
        })
        .select("*");
      if (error) throw error;
      return NextResponse.json(
        { success: true, schedules: data },
        { status: 201 },
      );
    }

    if (input.action === "provision_signed_contract") {
      const { data: contract, error: contractError } = await admin
        .from("contracts")
        .select("*")
        .eq("tenant_id", input.tenantId)
        .eq("id", input.contractId)
        .maybeSingle();
      if (contractError) throw contractError;
      if (!contract)
        return NextResponse.json(
          { error: "Contract not found" },
          { status: 404 },
        );
      const status = String(
        contract.lifecycle_status || contract.status || "draft",
      );
      if (
        !["signed", "active", "expiring", "renewed", "fully_signed"].includes(
          status,
        )
      )
        return NextResponse.json(
          {
            error:
              "Only signed or active contracts can provision billing and delivery",
          },
          { status: 409 },
        );
      const existingLinks = await admin
        .from("revenue_lifecycle_links")
        .select("target_type, target_id")
        .eq("tenant_id", input.tenantId)
        .eq("source_type", "contract")
        .eq("source_id", input.contractId)
        .in("target_type", ["project", "invoice"]);
      let projectId =
        existingLinks.data?.find(
          (link: { target_type: string; target_id: string }) =>
            link.target_type === "project",
        )?.target_id ||
        contract.project_id ||
        null;
      let invoiceId =
        existingLinks.data?.find(
          (link: { target_type: string; target_id: string }) =>
            link.target_type === "invoice",
        )?.target_id || null;
      const total = Number(
        contract.value ?? contract.total_amount ?? contract.payment_amount ?? 0,
      );
      if (input.createProject && !projectId) {
        const { data: project, error } = await admin
          .from("projects")
          .insert({
            tenant_id: input.tenantId,
            owner_id: user.id,
            owner_name: user.email || "Workspace member",
            name: contract.title,
            category: contract.type || "Contract delivery",
            status: "Pending",
            current_stage: "Initiation",
            progress: 0,
            description: `Delivery project provisioned from signed contract ${contract.title}`,
            contract_id: contract.id,
            contract_status: status,
            contract_text: contract.content || null,
            client_id: contract.client_id || null,
            budget: total || null,
            budget_total: total || null,
            budget_used: 0,
            team: [],
            resources: [],
            is_public: false,
            show_in_portfolio: false,
            portal_enabled: false,
            auto_invoice_enabled: true,
          })
          .select("id")
          .single();
        if (error) throw error;
        projectId = project.id;
        await admin
          .from("revenue_lifecycle_links")
          .upsert(
            {
              tenant_id: input.tenantId,
              source_type: "contract",
              source_id: contract.id,
              target_type: "project",
              target_id: projectId,
              relationship: "provisions",
              created_by: user.id,
            },
            {
              onConflict:
                "tenant_id,source_type,source_id,target_type,target_id,relationship",
            },
          );
      }
      if (input.createInvoice && !invoiceId) {
        const issue = new Date();
        const due = new Date(
          issue.getTime() + input.invoiceDueDays * 86400_000,
        );
        const { data: invoice, error } = await admin
          .from("business_invoices")
          .insert({
            tenant_id: input.tenantId,
            client_id: contract.client_id || null,
            project_id: projectId,
            contract_id: contract.id,
            invoice_number: `INV-${issue.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            issue_date: issue.toISOString().slice(0, 10),
            due_date: due.toISOString().slice(0, 10),
            status: "draft",
            lifecycle_status: "draft",
            subtotal: total,
            tax_rate: 0,
            tax: 0,
            discount_amount: 0,
            total,
            amount_paid: 0,
            balance_due: total,
            line_items: [
              {
                description: contract.title,
                quantity: 1,
                rate: total,
                amount: total,
              },
            ],
            notes: `Generated from signed contract ${contract.id}`,
            is_public: false,
          })
          .select("id")
          .single();
        if (error) throw error;
        invoiceId = invoice.id;
        await admin
          .from("invoice_line_items")
          .insert({
            tenant_id: input.tenantId,
            invoice_id: invoiceId,
            description: contract.title,
            quantity: 1,
            unit_price: total,
          });
        await admin
          .from("revenue_lifecycle_links")
          .upsert(
            {
              tenant_id: input.tenantId,
              source_type: "contract",
              source_id: contract.id,
              target_type: "invoice",
              target_id: invoiceId,
              relationship: "billed_by",
              created_by: user.id,
            },
            {
              onConflict:
                "tenant_id,source_type,source_id,target_type,target_id,relationship",
            },
          );
        if (projectId)
          await admin
            .from("revenue_lifecycle_links")
            .upsert(
              {
                tenant_id: input.tenantId,
                source_type: "invoice",
                source_id: invoiceId,
                target_type: "project",
                target_id: projectId,
                relationship: "funds",
                created_by: user.id,
              },
              {
                onConflict:
                  "tenant_id,source_type,source_id,target_type,target_id,relationship",
              },
            );
      }
      if (invoiceId) {
        const { data: milestones } = await admin
          .from("contract_milestones")
          .select("id, title, due_at")
          .eq("tenant_id", input.tenantId)
          .eq("contract_id", contract.id)
          .order("due_at");
        if (milestones?.length) {
          const amount = Math.round((total / milestones.length) * 100) / 100;
          await admin.from("invoice_payment_schedules").upsert(
            milestones.map(
              (
                milestone: { id: string; title: string; due_at: string },
                index: number,
              ) => ({
                tenant_id: input.tenantId,
                invoice_id: invoiceId,
                contract_id: contract.id,
                contract_milestone_id: milestone.id,
                sequence_number: index + 1,
                label: milestone.title,
                amount:
                  index === milestones.length - 1
                    ? Math.round((total - amount * index) * 100) / 100
                    : amount,
                currency_code: contract.currency || "USD",
                due_date: String(milestone.due_at).slice(0, 10),
                status: "scheduled",
              }),
            ),
            { onConflict: "tenant_id,invoice_id,sequence_number" },
          );
        }
      }
      return NextResponse.json(
        {
          success: true,
          contractId: contract.id,
          projectId,
          invoiceId,
          verified: {
            projectLinked: !input.createProject || Boolean(projectId),
            invoiceLinked: !input.createInvoice || Boolean(invoiceId),
          },
        },
        { status: 201 },
      );
    }

    if (input.action === "queue_document_intelligence") {
      const { data: document, error: documentError } = await admin
        .from("documents")
        .select("id")
        .eq("tenant_id", input.tenantId)
        .eq("id", input.documentId)
        .maybeSingle();
      if (documentError) throw documentError;
      if (!document)
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 },
        );
      const rows = input.jobs.map((job) => ({
        tenant_id: input.tenantId,
        document_id: input.documentId,
        job_type: job,
        status: "queued",
        input: { requested_by: user.id },
      }));
      const { data, error } = await admin
        .from("document_intelligence_jobs")
        .insert(rows)
        .select("*");
      if (error) throw error;
      await admin
        .from("documents")
        .update({
          intelligence_status: "queued",
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", input.tenantId)
        .eq("id", input.documentId);
      return NextResponse.json({ success: true, jobs: data }, { status: 202 });
    }

    const normalized = normalizeOutreachRecipient(
      input.channel,
      input.recipient,
    );
    const { data, error } = await admin
      .from("outreach_suppressions")
      .upsert(
        {
          tenant_id: input.tenantId,
          channel: input.channel,
          normalized_recipient: normalized,
          reason: input.reason,
          source: "user",
          expires_at: input.expiresAt || null,
        },
        { onConflict: "tenant_id,channel,normalized_recipient" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(
      { success: true, suppression: data },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/cannot move/i.test(message))
      return NextResponse.json({ error: message }, { status: 409 });
    return routeErrorResponse(
      error,
      "Revenue lifecycle action failed",
      request,
    );
  }
}

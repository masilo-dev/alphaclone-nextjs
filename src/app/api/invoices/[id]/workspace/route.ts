import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, routeErrorResponse } from "@/lib/apiAuth";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    tenantId: z.uuid(),
    action: z.literal("open_dispute"),
    reason: z.string().trim().min(2).max(5000),
    disputedAmount: z.number().nonnegative().optional(),
    ownerUserId: z.uuid().optional(),
  }),
  z.object({
    tenantId: z.uuid(),
    action: z.literal("add_adjustment"),
    adjustmentType: z.enum([
      "credit_note",
      "discount",
      "write_off",
      "refund",
      "fee",
    ]),
    amount: z.number().finite(),
    currencyCode: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("USD"),
    reason: z.string().trim().min(2).max(2000),
  }),
  z.object({
    tenantId: z.uuid(),
    action: z.literal("add_installment"),
    sequenceNumber: z.number().int().positive(),
    label: z.string().trim().min(1).max(160),
    amount: z.number().nonnegative(),
    currencyCode: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("USD"),
    dueDate: z.string().date(),
    contractId: z.uuid().optional(),
    contractMilestoneId: z.uuid().optional(),
  }),
  z.object({ tenantId: z.uuid(), action: z.literal("verify_payment_link") }),
]);

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const value = address.toLowerCase();
  return (
    value === "::1" ||
    value === "::" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    /^fe[89ab]/.test(value)
  );
}

async function assertPublicPaymentUrl(url: URL) {
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Payment link must be a public HTTPS URL");
  const addresses = await lookup(url.hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => isPrivateAddress(address))
  )
    throw new Error("Payment link resolves to a private or unsafe address");
}

async function verifyPaymentUrl(rawUrl: string) {
  let current = new URL(rawUrl);
  for (let redirect = 0; redirect <= 4; redirect += 1) {
    await assertPublicPaymentUrl(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      let response = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "Bonnie-Payment-Link-Verifier/1.0" },
      });
      if (response.status === 405 || response.status === 501)
        response = await fetch(current, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            Range: "bytes=0-1024",
            "User-Agent": "Bonnie-Payment-Link-Verifier/1.0",
          },
        });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location)
          throw new Error("Payment link returned an invalid redirect");
        current = new URL(location, current);
        continue;
      }
      if (!response.ok)
        throw new Error(`Payment provider returned HTTP ${response.status}`);
      return { status: response.status, finalUrl: current.toString() };
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("Payment link has too many redirects");
}

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
    const { data: invoice, error: invoiceError } = await admin
      .from("business_invoices")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (invoiceError) throw invoiceError;
    if (!invoice)
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    const [schedules, adjustments, disputes, events, links] = await Promise.all(
      [
        admin
          .from("invoice_payment_schedules")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("invoice_id", id)
          .order("sequence_number"),
        admin
          .from("invoice_adjustments")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("invoice_id", id)
          .order("created_at", { ascending: false }),
        admin
          .from("invoice_disputes")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("invoice_id", id)
          .order("opened_at", { ascending: false }),
        admin
          .from("invoice_lifecycle_events")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("invoice_id", id)
          .order("created_at", { ascending: false }),
        admin
          .from("revenue_lifecycle_links")
          .select("*")
          .eq("tenant_id", tenantId)
          .or(`source_id.eq.${id},target_id.eq.${id}`),
      ],
    );
    const failure = [schedules, adjustments, disputes, events, links].find(
      (result) => result.error,
    )?.error;
    if (failure) throw failure;
    const now = new Date();
    const [
      historyResult,
      outstandingResult,
      signedContractsResult,
      billedContractsResult,
    ] = await Promise.all([
      invoice.client_id
        ? admin
            .from("business_invoices")
            .select("created_at, paid_at, due_date")
            .eq("tenant_id", tenantId)
            .eq("client_id", invoice.client_id)
            .eq("status", "paid")
            .not("paid_at", "is", null)
            .order("paid_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
      admin
        .from("business_invoices")
        .select("id, due_date, balance_due, total, status")
        .eq("tenant_id", tenantId)
        .not("status", "in", "(paid,void,cancelled)")
        .limit(1000),
      admin
        .from("contracts")
        .select(
          "id, title, total_value, payment_amount, currency, status, lifecycle_status",
        )
        .eq("tenant_id", tenantId)
        .or(
          "status.in.(client_signed,fully_signed),lifecycle_status.in.(signed,active,expiring)",
        )
        .limit(1000),
      admin
        .from("business_invoices")
        .select("contract_id")
        .eq("tenant_id", tenantId)
        .not("contract_id", "is", null)
        .limit(2000),
    ]);
    const extraFailure = [
      historyResult,
      outstandingResult,
      signedContractsResult,
      billedContractsResult,
    ].find((result) => result.error)?.error;
    if (extraFailure) throw extraFailure;
    const paymentDays = (historyResult.data || [])
      .map((row: any) =>
        Math.max(
          0,
          Math.round(
            (new Date(row.paid_at).getTime() -
              new Date(row.created_at).getTime()) /
              86400_000,
          ),
        ),
      )
      .filter((days: number) => days < 730);
    const avgDaysToPay = paymentDays.length
      ? paymentDays.reduce((sum: number, days: number) => sum + days, 0) /
        paymentDays.length
      : 30;
    const createdAt = new Date(invoice.created_at || invoice.issue_date || now);
    const predictedDate = new Date(
      Math.max(now.getTime(), createdAt.getTime() + avgDaysToPay * 86400_000),
    );
    const dueDate = invoice.due_date
      ? new Date(invoice.due_date)
      : new Date(createdAt.getTime() + 30 * 86400_000);
    const predictedDaysLate = Math.max(
      0,
      Math.round((predictedDate.getTime() - dueDate.getTime()) / 86400_000),
    );
    const sampleConfidence = Math.min(0.95, 0.35 + paymentDays.length * 0.1);
    const paymentProbability = Math.max(
      0.15,
      Math.min(
        0.98,
        sampleConfidence - Math.max(0, predictedDaysLate - 7) * 0.006,
      ),
    );
    const outstanding = outstandingResult.data || [];
    const forecastBuckets = [30, 60, 90].map((days) => ({
      days,
      expected: outstanding
        .filter(
          (row: any) =>
            !row.due_date ||
            new Date(row.due_date).getTime() <=
              now.getTime() + days * 86400_000,
        )
        .reduce(
          (sum: number, row: any) =>
            sum +
            Number(row.balance_due ?? row.total ?? 0) *
              (new Date(row.due_date || now).getTime() < now.getTime()
                ? 0.65
                : 0.85),
          0,
        ),
    }));
    const billedContractIds = new Set(
      (billedContractsResult.data || []).map((row: any) => row.contract_id),
    );
    const unbilledContracts = (signedContractsResult.data || []).filter(
      (contract: any) => !billedContractIds.has(contract.id),
    );
    return NextResponse.json({
      success: true,
      invoice,
      schedules: schedules.data || [],
      adjustments: adjustments.data || [],
      disputes: disputes.data || [],
      events: events.data || [],
      links: links.data || [],
      intelligence: {
        paymentPrediction: {
          predictedPaymentDate: predictedDate.toISOString().slice(0, 10),
          predictedDaysLate,
          paymentProbability,
          confidence: sampleConfidence,
          historySamples: paymentDays.length,
          riskTier:
            paymentProbability < 0.4
              ? "critical"
              : paymentProbability < 0.6
                ? "high"
                : paymentProbability < 0.8
                  ? "medium"
                  : "low",
        },
        cashFlowForecast: forecastBuckets,
        unbilledSignedContracts: unbilledContracts,
      },
    });
  } catch (error) {
    return routeErrorResponse(
      error,
      "Invoice workspace could not be loaded",
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
          error: "Invalid invoice workspace action",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    const input = parsed.data;
    const { user, admin } = await requireTenantAccess(input.tenantId, request);
    const { data: invoice } = await admin
      .from("business_invoices")
      .select("id, payment_link")
      .eq("tenant_id", input.tenantId)
      .eq("id", id)
      .maybeSingle();
    if (!invoice)
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    if (input.action === "verify_payment_link") {
      if (!invoice.payment_link)
        return NextResponse.json(
          { error: "Invoice has no payment link" },
          { status: 409 },
        );
      const verification = await verifyPaymentUrl(invoice.payment_link);
      const now = new Date().toISOString();
      const { error: updateError } = await admin
        .from("business_invoices")
        .update({ payment_link_verified_at: now, updated_at: now })
        .eq("tenant_id", input.tenantId)
        .eq("id", id);
      if (updateError) throw updateError;
      await admin
        .from("invoice_lifecycle_events")
        .insert({
          tenant_id: input.tenantId,
          invoice_id: id,
          event_type: "payment_link_verified",
          actor_user_id: user.id,
          source: "workspace",
          evidence: verification,
        });
      return NextResponse.json({
        success: true,
        verifiedAt: now,
        verification,
      });
    }

    if (input.action === "open_dispute") {
      const now = new Date().toISOString();
      const { data, error } = await admin
        .from("invoice_disputes")
        .insert({
          tenant_id: input.tenantId,
          invoice_id: id,
          reason: input.reason,
          disputed_amount: input.disputedAmount ?? null,
          owner_user_id: input.ownerUserId || user.id,
        })
        .select("*")
        .single();
      if (error) throw error;
      await admin
        .from("business_invoices")
        .update({
          lifecycle_status: "disputed",
          status: "disputed",
          disputed_at: now,
          dispute_reason: input.reason,
          updated_at: now,
        })
        .eq("tenant_id", input.tenantId)
        .eq("id", id);
      await admin
        .from("invoice_lifecycle_events")
        .insert({
          tenant_id: input.tenantId,
          invoice_id: id,
          event_type: "dispute_opened",
          to_status: "disputed",
          actor_user_id: user.id,
          source: "workspace",
          evidence: { dispute_id: data.id },
        });
      return NextResponse.json(
        { success: true, dispute: data },
        { status: 201 },
      );
    }

    if (input.action === "add_adjustment") {
      const { data, error } = await admin
        .from("invoice_adjustments")
        .insert({
          tenant_id: input.tenantId,
          invoice_id: id,
          adjustment_type: input.adjustmentType,
          amount: input.amount,
          currency_code: input.currencyCode,
          reason: input.reason,
          created_by: user.id,
        })
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json(
        { success: true, adjustment: data },
        { status: 201 },
      );
    }

    const { data, error } = await admin
      .from("invoice_payment_schedules")
      .upsert(
        {
          tenant_id: input.tenantId,
          invoice_id: id,
          contract_id: input.contractId || null,
          contract_milestone_id: input.contractMilestoneId || null,
          sequence_number: input.sequenceNumber,
          label: input.label,
          amount: input.amount,
          currency_code: input.currencyCode,
          due_date: input.dueDate,
          status: "scheduled",
        },
        { onConflict: "tenant_id,invoice_id,sequence_number" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(
      { success: true, installment: data },
      { status: 201 },
    );
  } catch (error) {
    return routeErrorResponse(
      error,
      "Invoice workspace action failed",
      request,
    );
  }
}

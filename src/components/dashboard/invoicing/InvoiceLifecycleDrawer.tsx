"use client";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  Loader2,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { DetailDrawer } from "@/components/ui/DetailDrawer";
import { AskBonnieButton } from "@/components/ui/os/AskBonnieButton";
import { BusinessContextPanel } from "@/components/dashboard/crm/BusinessContextPanel";

type Workspace = {
  invoice: Record<string, any>;
  schedules: Array<Record<string, any>>;
  adjustments: Array<Record<string, any>>;
  disputes: Array<Record<string, any>>;
  events: Array<Record<string, any>>;
  links: Array<Record<string, any>>;
  intelligence: {
    paymentPrediction: {
      predictedPaymentDate: string;
      predictedDaysLate: number;
      paymentProbability: number;
      confidence: number;
      historySamples: number;
      riskTier: string;
    };
    cashFlowForecast: Array<{ days: number; expected: number }>;
    unbilledSignedContracts: Array<Record<string, any>>;
  };
};

export function InvoiceLifecycleDrawer({
  invoiceId,
  tenantId,
  open,
  onOpenChange,
}: {
  invoiceId: string | null;
  tenantId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<
    "installment" | "adjustment" | "dispute" | null
  >(null);
  const [form, setForm] = useState({
    label: "",
    amount: "",
    dueDate: "",
    reason: "",
    adjustmentType: "credit_note",
  });
  const load = useCallback(async () => {
    if (!invoiceId || !tenantId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/invoices/${encodeURIComponent(invoiceId)}/workspace?tenantId=${encodeURIComponent(tenantId)}`,
        { credentials: "include" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          payload.error || "Invoice workspace could not be loaded",
        );
      setData(payload);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Invoice workspace could not be loaded",
      );
    } finally {
      setLoading(false);
    }
  }, [invoiceId, tenantId]);
  useEffect(() => {
    if (open) void load();
  }, [open, load]);
  const submit = async () => {
    if (!invoiceId || !tenantId || !mode) return;
    const amount = Number(form.amount);
    const body =
      mode === "installment"
        ? {
            action: "add_installment",
            tenantId,
            sequenceNumber: (data?.schedules.length || 0) + 1,
            label: form.label,
            amount,
            currencyCode: data?.invoice.currency || "USD",
            dueDate: form.dueDate,
          }
        : mode === "adjustment"
          ? {
              action: "add_adjustment",
              tenantId,
              adjustmentType: form.adjustmentType,
              amount,
              currencyCode: data?.invoice.currency || "USD",
              reason: form.reason,
            }
          : {
              action: "open_dispute",
              tenantId,
              reason: form.reason,
              disputedAmount: amount || undefined,
            };
    try {
      const response = await fetch(
        `/api/invoices/${encodeURIComponent(invoiceId)}/workspace`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "Invoice action failed");
      toast.success(
        mode === "installment"
          ? "Installment saved"
          : mode === "adjustment"
            ? "Adjustment created"
            : "Dispute opened",
      );
      setMode(null);
      setForm({
        label: "",
        amount: "",
        dueDate: "",
        reason: "",
        adjustmentType: "credit_note",
      });
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Invoice action failed",
      );
    }
  };
  const transition = async (status: string) => {
    if (!invoiceId || !tenantId) return;
    try {
      const response = await fetch("/api/revenue-lifecycle", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transition_invoice",
          tenantId,
          invoiceId,
          status,
          reason: "Updated from invoice workspace",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "Invoice transition failed");
      toast.success(`Invoice moved to ${status.replaceAll("_", " ")}`);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Invoice transition failed",
      );
    }
  };
  const verifyPaymentLink = async () => {
    if (!invoiceId || !tenantId) return;
    try {
      const response = await fetch(
        `/api/invoices/${encodeURIComponent(invoiceId)}/workspace`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify_payment_link", tenantId }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "Payment link verification failed");
      toast.success("Payment link is reachable and verified");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Payment link verification failed",
      );
    }
  };
  const card = "rounded-xl border border-white/10 bg-white/[0.025] p-3";
  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={
        data?.invoice?.invoice_number ||
        data?.invoice?.invoiceNumber ||
        "Invoice lifecycle"
      }
      size="wide"
    >
      {loading && !data ? (
        <div className="flex min-h-60 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
        </div>
      ) : data ? (
        <div className="flex flex-col xl:flex-row gap-4 pt-2">
          <div className="flex-1 min-w-0 space-y-4">
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-white">Lifecycle</p>
              {invoiceId && tenantId ? (
                <AskBonnieButton
                  compact
                  mode="summarise"
                  contexts={[
                    { type: 'Invoice', id: invoiceId, label: String(data.invoice.invoice_number || 'Invoice') },
                  ]}
                />
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                "draft",
                "pending_approval",
                "approved",
                "sent",
                "viewed",
                "partially_paid",
                "paid",
                "overdue",
                "disputed",
                "void",
              ].map((status) => (
                <button
                  key={status}
                  onClick={() => void transition(status)}
                  className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${data.invoice.lifecycle_status === status ? "border-teal-400 bg-teal-500/15 text-teal-200" : "border-white/10 text-slate-400"}`}
                >
                  {status.replaceAll("_", " ")}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3">
              <a
                href={`/api/invoices/${encodeURIComponent(String(data.invoice.id))}/statement?tenantId=${encodeURIComponent(String(tenantId))}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-300"
              >
                <Download className="h-3 w-3" /> Statement
              </a>
              <a
                href={`/api/invoices/${encodeURIComponent(String(data.invoice.id))}/receipt?tenantId=${encodeURIComponent(String(tenantId))}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-300"
              >
                <Download className="h-3 w-3" /> Receipt
              </a>
            </div>
            {data.invoice.payment_link ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                <a
                  href={data.invoice.payment_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold text-sky-300"
                >
                  <ExternalLink className="h-3 w-3" /> Open payment link
                </a>
                <button
                  onClick={() => void verifyPaymentLink()}
                  className="rounded-lg border border-teal-500/25 bg-teal-500/10 px-2 py-1 text-[10px] font-bold text-teal-200"
                >
                  Verify link
                </button>
                {data.invoice.payment_link_verified_at ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" /> Verified{" "}
                    {new Date(
                      data.invoice.payment_link_verified_at,
                    ).toLocaleString()}
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-300">
                    Not verified
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-3 border-t border-white/5 pt-3 text-[10px] text-slate-500">
                No payment link configured.
              </p>
            )}
          </section>
          <div className="grid gap-3 sm:grid-cols-2">
            <section className={card}>
              <div className="flex justify-between">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-sky-300" />
                  <p className="text-xs font-bold text-white">
                    Payment schedule
                  </p>
                </div>
                <button
                  onClick={() => setMode("installment")}
                  className="text-[10px] font-bold text-teal-300"
                >
                  Add
                </button>
              </div>
              {data.schedules.length ? (
                data.schedules.map((row) => (
                  <div
                    key={row.id}
                    className="mt-2 flex justify-between text-[11px]"
                  >
                    <span className="text-slate-300">
                      {row.sequence_number}. {row.label}
                    </span>
                    <span className="text-slate-500">
                      {row.currency_code} {Number(row.amount).toLocaleString()}{" "}
                      · {row.due_date}
                    </span>
                  </div>
                ))
              ) : (
                <p className="mt-3 text-[11px] text-slate-500">
                  No installments configured.
                </p>
              )}
            </section>
            <section className={card}>
              <div className="flex justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-violet-300" />
                  <p className="text-xs font-bold text-white">
                    Credits & adjustments
                  </p>
                </div>
                <button
                  onClick={() => setMode("adjustment")}
                  className="text-[10px] font-bold text-teal-300"
                >
                  Add
                </button>
              </div>
              {data.adjustments.length ? (
                data.adjustments.map((row) => (
                  <div
                    key={row.id}
                    className="mt-2 flex justify-between text-[11px]"
                  >
                    <span className="text-slate-300">
                      {String(row.adjustment_type).replaceAll("_", " ")}
                    </span>
                    <span className="text-slate-500">
                      {row.currency_code} {Number(row.amount).toLocaleString()}{" "}
                      · {row.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="mt-3 text-[11px] text-slate-500">
                  No adjustments.
                </p>
              )}
            </section>
          </div>
          <section className={card}>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-300" />
              <p className="text-xs font-bold text-white">
                Revenue forecast & billing gaps
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[9px] font-black uppercase text-slate-500">
                  Predicted payment
                </p>
                <p className="mt-1 text-xs font-bold text-white">
                  {data.intelligence.paymentPrediction.predictedPaymentDate}
                </p>
                <p
                  className={`text-[10px] ${data.intelligence.paymentPrediction.riskTier === "high" || data.intelligence.paymentPrediction.riskTier === "critical" ? "text-rose-300" : "text-slate-500"}`}
                >
                  {Math.round(
                    data.intelligence.paymentPrediction.paymentProbability *
                      100,
                  )}
                  % probability · {data.intelligence.paymentPrediction.riskTier}{" "}
                  risk
                </p>
              </div>
              {data.intelligence.cashFlowForecast.map((bucket) => (
                <div key={bucket.days}>
                  <p className="text-[9px] font-black uppercase text-slate-500">
                    Expected {bucket.days}d inflow
                  </p>
                  <p className="mt-1 text-xs font-bold text-emerald-300">
                    {data.invoice.currency || "USD"}{" "}
                    {Math.round(bucket.expected).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            {data.intelligence.unbilledSignedContracts.length ? (
              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                <p className="text-[10px] font-bold text-amber-200">
                  {data.intelligence.unbilledSignedContracts.length} signed
                  contract(s) have no invoice
                </p>
                <p className="mt-1 text-[9px] text-slate-400">
                  {data.intelligence.unbilledSignedContracts
                    .slice(0, 4)
                    .map((contract) => contract.title)
                    .join(" · ")}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[10px] text-emerald-300">
                No signed-contract billing gaps detected.
              </p>
            )}
          </section>
          <section className={card}>
            <div className="flex justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                <p className="text-xs font-bold text-white">
                  Disputes & collection notes
                </p>
              </div>
              <button
                onClick={() => setMode("dispute")}
                className="text-[10px] font-bold text-teal-300"
              >
                Open dispute
              </button>
            </div>
            {data.disputes.length ? (
              data.disputes.map((row) => (
                <div key={row.id} className="mt-2">
                  <p className="text-[11px] font-semibold text-slate-300">
                    {row.reason}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {row.status}
                    {row.disputed_amount
                      ? ` · ${Number(row.disputed_amount).toLocaleString()}`
                      : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="mt-3 text-[11px] text-slate-500">No disputes.</p>
            )}
          </section>
          {mode ? (
            <section className={`${card} border-teal-500/25`}>
              <p className="text-xs font-bold text-white">
                {mode === "installment"
                  ? "New installment"
                  : mode === "adjustment"
                    ? "New adjustment"
                    : "Open dispute"}
              </p>
              <div className="mt-3 grid gap-2">
                {mode === "installment" ? (
                  <>
                    <input
                      value={form.label}
                      onChange={(e) =>
                        setForm({ ...form, label: e.target.value })
                      }
                      placeholder="Milestone or installment"
                      className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                    />
                    <input
                      value={form.dueDate}
                      onChange={(e) =>
                        setForm({ ...form, dueDate: e.target.value })
                      }
                      type="date"
                      className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                    />
                  </>
                ) : mode === "adjustment" ? (
                  <select
                    value={form.adjustmentType}
                    onChange={(e) =>
                      setForm({ ...form, adjustmentType: e.target.value })
                    }
                    className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                  >
                    <option value="credit_note">Credit note</option>
                    <option value="discount">Discount</option>
                    <option value="write_off">Write-off</option>
                    <option value="refund">Refund</option>
                    <option value="fee">Fee</option>
                  </select>
                ) : null}
                <input
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                />
                {mode !== "installment" ? (
                  <textarea
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                    placeholder="Reason or collection notes"
                    className="min-h-20 rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                  />
                ) : null}
                <div className="flex gap-2">
                  <button
                    onClick={() => void submit()}
                    className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setMode(null)}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </section>
          ) : null}
          </div>
          {invoiceId && tenantId ? (
            <BusinessContextPanel
              tenantId={tenantId}
              entityType="invoice"
              entityId={invoiceId}
              className="hidden xl:block w-72 shrink-0 sticky top-0 self-start"
            />
          ) : null}
        </div>
      ) : (
        <p className="p-8 text-center text-sm text-slate-500">
          Invoice workspace unavailable.
        </p>
      )}
    </DetailDrawer>
  );
}

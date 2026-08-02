"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  Download,
  FileDiff,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Signature,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { DetailDrawer } from "@/components/ui/DetailDrawer";

type Workspace = {
  contract: Record<string, any>;
  versions: Array<Record<string, any>>;
  clauses: Array<Record<string, any>>;
  clauseLibrary: Array<Record<string, any>>;
  parties: Array<Record<string, any>>;
  negotiations: Array<Record<string, any>>;
  obligations: Array<Record<string, any>>;
  milestones: Array<Record<string, any>>;
  signatures: Array<Record<string, any>>;
  events: Array<Record<string, any>>;
  auditCertificate?: {
    url: string | null;
    hash: string | null;
    generatedAt: string | null;
    expiresInSeconds: number;
  } | null;
  redline: {
    leftVersion: number;
    rightVersion: number;
    leftContent: string;
    rightContent: string;
    additions: string[];
    removals: string[];
  } | null;
};

export function ContractLifecycleDrawer({
  contractId,
  tenantId,
  open,
  onOpenChange,
}: {
  contractId: string | null;
  tenantId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<
    "signer" | "obligation" | "negotiation" | "version" | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "client",
    title: "",
    body: "",
    dueDate: "",
    changeSummary: "",
  });

  const load = useCallback(async () => {
    if (!contractId || !tenantId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/contracts/${encodeURIComponent(contractId)}/workspace?tenantId=${encodeURIComponent(tenantId)}`,
        { credentials: "include" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          payload.error || "Contract workspace could not be loaded",
        );
      setWorkspace(payload);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Contract workspace could not be loaded",
      );
    } finally {
      setLoading(false);
    }
  }, [contractId, tenantId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const submit = async () => {
    if (!contractId || !tenantId || !action) return;
    setSaving(true);
    try {
      const body =
        action === "version"
          ? {
              action: "create_version",
              tenantId,
              content: form.body,
              changeSummary: form.changeSummary || undefined,
            }
          : action === "signer"
            ? {
                action: "add_signer",
                tenantId,
                name: form.name,
                email: form.email,
                role: form.role,
                signatureRequired: true,
                signingOrder: (workspace?.parties.length || 0) + 1,
              }
            : action === "obligation"
              ? {
                  action: "add_obligation",
                  tenantId,
                  title: form.title,
                  description: form.body || undefined,
                  dueDate: form.dueDate
                    ? new Date(form.dueDate).toISOString()
                    : undefined,
                  priority: "medium",
                }
              : {
                  action: "open_negotiation",
                  tenantId,
                  title: form.title,
                  body: form.body,
                };
      const response = await fetch(
        `/api/contracts/${encodeURIComponent(contractId)}/workspace`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "Contract action failed");
      toast.success(
        action === "version"
          ? "New contract version saved"
          : action === "signer"
            ? "Signer added"
            : action === "obligation"
              ? "Obligation added"
              : "Negotiation opened",
      );
      setAction(null);
      setForm({
        name: "",
        email: "",
        role: "client",
        title: "",
        body: "",
        dueDate: "",
        changeSummary: "",
      });
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Contract action failed",
      );
    } finally {
      setSaving(false);
    }
  };

  const transition = async (status: string) => {
    if (!contractId || !tenantId) return;
    try {
      const response = await fetch("/api/revenue-lifecycle", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transition_contract",
          tenantId,
          contractId,
          status,
          reason: "Updated from contract lifecycle workspace",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "Lifecycle transition failed");
      toast.success(`Contract moved to ${status.replaceAll("_", " ")}`);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Lifecycle transition failed",
      );
    }
  };

  const addApprovedClause = async (clause: Record<string, any>) => {
    if (!contractId || !tenantId) return;
    try {
      const response = await fetch(
        `/api/contracts/${encodeURIComponent(contractId)}/workspace`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add_clause",
            tenantId,
            clauseId: clause.id,
            contractVersionId: workspace?.versions[0]?.id || undefined,
            position: workspace?.clauses.length || 0,
            renderedBody: clause.body,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "Clause could not be added");
      toast.success(`${clause.title} added to contract`);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Clause could not be added",
      );
    }
  };

  const provision = async () => {
    if (!contractId || !tenantId) return;
    try {
      const response = await fetch("/api/revenue-lifecycle", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "provision_signed_contract",
          tenantId,
          contractId,
          createInvoice: true,
          createProject: true,
          invoiceDueDays: 14,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          payload.error || "Billing and delivery could not be provisioned",
        );
      toast.success(
        `Project and invoice ready${payload.invoiceId ? ` · invoice ${String(payload.invoiceId).slice(0, 8)}` : ""}`,
      );
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Billing and delivery could not be provisioned",
      );
    }
  };
  const remindSigners = async () => {
    if (
      !contractId ||
      !tenantId ||
      !window.confirm(
        "Send a secure signature reminder to the next signer(s) in order?",
      )
    )
      return;
    try {
      const response = await fetch(
        `/api/contracts/${encodeURIComponent(contractId)}/workspace`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send_signature_reminders",
            tenantId,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          payload.error || "Signature reminders could not be sent",
        );
      toast.success(`${payload.sent || 0} signature reminder(s) delivered`);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Signature reminders could not be sent",
      );
    }
  };

  const card = "rounded-xl border border-white/10 bg-white/[0.025] p-3";
  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={workspace?.contract?.title || "Contract lifecycle"}
      size="wide"
    >
      {loading && !workspace ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
        </div>
      ) : workspace ? (
        <div className="space-y-4 pt-2">
          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-white">Lifecycle</p>
                <p className="text-xs text-slate-400">
                  Every transition is recorded in the audit history.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {[
                  "signed",
                  "active",
                  "expiring",
                  "renewed",
                  "fully_signed",
                ].includes(
                  String(
                    workspace.contract.lifecycle_status ||
                      workspace.contract.status,
                  ),
                ) ? (
                  <button
                    onClick={() => void provision()}
                    className="rounded-lg border border-teal-500/25 bg-teal-500/10 px-2.5 py-1.5 text-[10px] font-bold text-teal-300"
                  >
                    Create project + invoice
                  </button>
                ) : null}
                <button
                  onClick={() => void load()}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                "draft",
                "internal_review",
                "sent",
                "viewed",
                "negotiating",
                "signed",
                "active",
                "expiring",
                "renewed",
                "terminated",
              ].map((status) => (
                <button
                  key={status}
                  onClick={() => void transition(status)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${workspace.contract.lifecycle_status === status ? "border-teal-400 bg-teal-500/15 text-teal-200" : "border-white/10 text-slate-400 hover:border-teal-500/30"}`}
                >
                  {status.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <section className={card}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileDiff className="h-4 w-4 text-sky-300" />
                  <p className="text-xs font-bold text-white">
                    Versions & clauses
                  </p>
                </div>
                <button
                  onClick={() => {
                    setForm({
                      ...form,
                      body: String(workspace.contract.content || ""),
                      changeSummary: "",
                    });
                    setAction("version");
                  }}
                  className="text-[10px] font-bold text-sky-300"
                >
                  Save version
                </button>
              </div>
              <p className="mt-2 text-2xl font-black text-white">
                {workspace.versions.length}
              </p>
              <p className="text-[11px] text-slate-500">
                {workspace.clauses.length} approved clause usages
              </p>
              {workspace.versions.slice(0, 3).map((version) => (
                <p key={version.id} className="mt-2 text-[11px] text-slate-300">
                  v{version.version_number} ·{" "}
                  {version.change_summary || "Saved version"}
                </p>
              ))}
              <div className="mt-3 border-t border-white/5 pt-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                  Approved library
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {workspace.clauseLibrary.map((clause) => {
                    const used = workspace.clauses.some(
                      (usage) => usage.clause_id === clause.id,
                    );
                    return (
                      <button
                        key={clause.id}
                        disabled={used}
                        onClick={() => void addApprovedClause(clause)}
                        title={clause.body}
                        className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-2 py-1 text-[9px] font-bold text-sky-200 disabled:border-white/5 disabled:text-slate-600"
                      >
                        {used ? "✓ " : "+ "}
                        {clause.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
            <section className={card}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-300" />
                  <p className="text-xs font-bold text-white">Signing order</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void remindSigners()}
                    className="text-[10px] font-bold text-amber-300"
                  >
                    Remind next
                  </button>
                  <button
                    onClick={() => setAction("signer")}
                    className="text-[10px] font-bold text-teal-300"
                  >
                    Add signer
                  </button>
                </div>
              </div>
              {workspace.parties.length ? (
                workspace.parties.map((party) => (
                  <div
                    key={party.id}
                    className="mt-2 flex items-center justify-between text-[11px]"
                  >
                    <span className="text-slate-300">
                      {party.signing_order || "—"}.{" "}
                      {party.party_snapshot?.name ||
                        party.party_snapshot?.email ||
                        party.role}
                    </span>
                    <span className="text-slate-500">
                      {party.signature_status || "not requested"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="mt-3 text-[11px] text-slate-500">
                  No signers configured.
                </p>
              )}
            </section>
            <section className={card}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-amber-300" />
                  <p className="text-xs font-bold text-white">Negotiations</p>
                </div>
                <button
                  onClick={() => setAction("negotiation")}
                  className="text-[10px] font-bold text-teal-300"
                >
                  Open thread
                </button>
              </div>
              {workspace.negotiations.length ? (
                workspace.negotiations.map((thread) => (
                  <div key={thread.id} className="mt-2">
                    <p className="text-[11px] font-semibold text-slate-300">
                      {thread.title}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {thread.status} · {thread.messages?.length || 0} comments
                    </p>
                  </div>
                ))
              ) : (
                <p className="mt-3 text-[11px] text-slate-500">
                  No negotiation threads.
                </p>
              )}
            </section>
            <section className={card}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-rose-300" />
                  <p className="text-xs font-bold text-white">
                    Obligations & milestones
                  </p>
                </div>
                <button
                  onClick={() => setAction("obligation")}
                  className="text-[10px] font-bold text-teal-300"
                >
                  Add obligation
                </button>
              </div>
              {workspace.obligations.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="mt-2 flex justify-between gap-2 text-[11px]"
                >
                  <span className="text-slate-300">{item.title}</span>
                  <span className="text-slate-500">
                    {item.due_date
                      ? new Date(item.due_date).toLocaleDateString()
                      : item.status}
                  </span>
                </div>
              ))}
              <p className="mt-2 text-[10px] text-slate-500">
                {workspace.milestones.length} billing milestones
              </p>
            </section>
          </div>
          {workspace.redline ? (
            <section className={card}>
              <div className="flex items-center gap-2">
                <FileDiff className="h-4 w-4 text-sky-300" />
                <p className="text-xs font-bold text-white">
                  Side-by-side redline · v{workspace.redline.leftVersion} → v
                  {workspace.redline.rightVersion}
                </p>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="max-h-64 overflow-auto rounded-lg border border-rose-500/15 bg-rose-500/5 p-3">
                  <p className="text-[9px] font-black uppercase text-rose-300">
                    Removed
                  </p>
                  {workspace.redline.removals.length ? (
                    workspace.redline.removals.map((line, index) => (
                      <p
                        key={`remove-${index}`}
                        className="mt-1 text-[10px] leading-4 text-rose-200 line-through"
                      >
                        {line}
                      </p>
                    ))
                  ) : (
                    <p className="mt-2 text-[10px] text-slate-500">
                      No removed lines.
                    </p>
                  )}
                </div>
                <div className="max-h-64 overflow-auto rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3">
                  <p className="text-[9px] font-black uppercase text-emerald-300">
                    Added
                  </p>
                  {workspace.redline.additions.length ? (
                    workspace.redline.additions.map((line, index) => (
                      <p
                        key={`add-${index}`}
                        className="mt-1 text-[10px] leading-4 text-emerald-200"
                      >
                        + {line}
                      </p>
                    ))
                  ) : (
                    <p className="mt-2 text-[10px] text-slate-500">
                      No added lines.
                    </p>
                  )}
                </div>
              </div>
            </section>
          ) : null}
          <section className={card}>
            <div className="flex items-center gap-2">
              <Signature className="h-4 w-4 text-emerald-300" />
              <p className="text-xs font-bold text-white">Signature evidence</p>
            </div>
            {workspace.signatures.length ? (
              workspace.signatures.slice(0, 8).map((event) => (
                <div
                  key={event.id}
                  className="mt-2 flex items-center justify-between text-[11px]"
                >
                  <span className="text-slate-300">
                    {event.event_type} · {event.signer_email || "signer"}
                  </span>
                  <span className="text-slate-500">
                    {new Date(event.occurred_at).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="mt-3 text-[11px] text-slate-500">
                No signature evidence recorded yet.
              </p>
            )}
            {workspace.auditCertificate ? (
              <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-emerald-200">Signature audit certificate</p>
                    <p className="mt-1 max-w-[24rem] truncate font-mono text-[9px] text-slate-500" title={workspace.auditCertificate.hash || undefined}>
                      SHA-256 {workspace.auditCertificate.hash || "Recorded"}
                    </p>
                  </div>
                  {workspace.auditCertificate.url ? (
                    <a
                      href={workspace.auditCertificate.url}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 px-2 py-1 text-[10px] font-bold text-emerald-200"
                    >
                      <Download className="h-3 w-3" /> Download certificate
                    </a>
                  ) : (
                    <span className="text-[9px] text-amber-300">Certificate link unavailable</span>
                  )}
                </div>
              </div>
            ) : null}
          </section>
          {action ? (
            <section className={`${card} border-teal-500/25`}>
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-teal-300" />
                <p className="text-xs font-bold text-white">
                  {action === "signer"
                    ? "Add signer"
                    : action === "obligation"
                      ? "Add obligation"
                      : action === "version"
                        ? "Save new version"
                        : "Open negotiation"}
                </p>
              </div>
              <div className="mt-3 grid gap-2">
                {action === "signer" ? (
                  <>
                    <input
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="Signer name"
                      className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                    />
                    <input
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      placeholder="Signer email"
                      type="email"
                      className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                    />
                  </>
                ) : action === "version" ? (
                  <>
                    <input
                      value={form.changeSummary}
                      onChange={(e) =>
                        setForm({ ...form, changeSummary: e.target.value })
                      }
                      placeholder="What changed?"
                      className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                    />
                    <textarea
                      value={form.body}
                      onChange={(e) =>
                        setForm({ ...form, body: e.target.value })
                      }
                      placeholder="Contract content"
                      className="min-h-72 rounded-lg border border-white/10 bg-slate-950 p-3 font-mono text-xs text-white"
                    />
                  </>
                ) : (
                  <>
                    <input
                      value={form.title}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                      placeholder={
                        action === "obligation"
                          ? "Obligation title"
                          : "Thread title"
                      }
                      className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                    />
                    <textarea
                      value={form.body}
                      onChange={(e) =>
                        setForm({ ...form, body: e.target.value })
                      }
                      placeholder="Details"
                      className="min-h-20 rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                    />
                    {action === "obligation" ? (
                      <input
                        value={form.dueDate}
                        onChange={(e) =>
                          setForm({ ...form, dueDate: e.target.value })
                        }
                        type="datetime-local"
                        className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                      />
                    ) : null}
                  </>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => void submit()}
                    disabled={saving}
                    className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setAction(null)}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <p className="p-8 text-center text-sm text-slate-500">
          Contract workspace unavailable.
        </p>
      )}
    </DetailDrawer>
  );
}

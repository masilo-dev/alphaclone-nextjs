"use client";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  GitBranch,
  Loader2,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTenant } from "@/contexts/TenantContext";

type Step = {
  channel: "email" | "linkedin" | "sms" | "whatsapp" | "call" | "task";
  delayMinutes: number;
  subject: string;
  body: string;
  condition: string;
  variantGroup: string;
};
type Sequence = {
  id: string;
  name: string;
  status: string;
  timezone: string;
  stop_on_reply: boolean;
  requires_approval: boolean;
  approved_at?: string | null;
  segment_id?: string | null;
  audience?: { id: string; name: string; estimated_size?: number } | null;
  frequency_cap?: { max_per_7_days?: number };
  steps: Array<Record<string, any>>;
};
type Health = {
  campaignId: string;
  sent: number;
  replies: number;
  meetings: number;
  deals: number;
  shouldPause: boolean;
  reasons: string[];
  bounceRate: number;
  complaintRate: number;
  unsubscribeRate: number;
};
type Audience = {
  id: string;
  name: string;
  estimated_size?: number;
  rules?: { source?: string; rules?: Record<string, string> };
};
type Experiment = {
  id: string;
  name: string;
  metric: string;
  status: string;
  variants: Array<{ key: string; label: string; allocation?: number }>;
  winner_variant?: string | null;
  sequence?: { name?: string } | null;
  live_results?: Record<
    string,
    {
      sent: number;
      opened: number;
      clicked: number;
      replied: number;
      meetings: number;
      revenue: number;
    }
  >;
};
type Sender = {
  id: string;
  email_address: string;
  provider: string;
  warmup_status: string;
  daily_send_limit: number;
  live_health?: {
    reputationScore: number;
    bounceRate: number;
    complaintRate: number;
    unsafe: boolean;
  };
};
const blankStep = (): Step => ({
  channel: "email",
  delayMinutes: 0,
  subject: "",
  body: "",
  condition: "always",
  variantGroup: "",
});

export function OutreachLifecyclePanel() {
  const { currentTenant } = useTenant();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [health, setHealth] = useState<Health[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [audienceForm, setAudienceForm] = useState({
    name: "",
    source: "leads",
    status: "",
    industry: "",
    search: "",
  });
  const [experimentForm, setExperimentForm] = useState({
    name: "",
    sequenceId: "",
    hypothesis: "",
    metric: "reply_rate",
    subjectA: "",
    subjectB: "",
    bodyA: "",
    bodyB: "",
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    audienceId: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    maxPerWeek: 3,
    quietStart: "20:00",
    quietEnd: "08:00",
    stopOnReply: true,
    requiresApproval: true,
  });
  const [steps, setSteps] = useState<Step[]>([blankStep()]);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const [
        sequencesResponse,
        healthResponse,
        audiencesResponse,
        experimentsResponse,
        sendersResponse,
      ] = await Promise.all([
        fetch(
          `/api/outreach/sequences?tenantId=${encodeURIComponent(currentTenant.id)}`,
          { credentials: "include" },
        ),
        fetch(
          `/api/outreach/events?tenantId=${encodeURIComponent(currentTenant.id)}`,
          { credentials: "include" },
        ),
        fetch(
          `/api/outreach/audiences?tenantId=${encodeURIComponent(currentTenant.id)}`,
          { credentials: "include" },
        ),
        fetch(
          `/api/outreach/experiments?tenantId=${encodeURIComponent(currentTenant.id)}`,
          { credentials: "include" },
        ),
        fetch(
          `/api/outreach/senders?tenantId=${encodeURIComponent(currentTenant.id)}`,
          { credentials: "include" },
        ),
      ]);
      const sequencePayload = await sequencesResponse.json().catch(() => ({}));
      const healthPayload = await healthResponse.json().catch(() => ({}));
      const audiencePayload = await audiencesResponse.json().catch(() => ({}));
      const experimentPayload = await experimentsResponse
        .json()
        .catch(() => ({}));
      const senderPayload = await sendersResponse.json().catch(() => ({}));
      if (!sequencesResponse.ok)
        throw new Error(
          sequencePayload.error || "Sequences could not be loaded",
        );
      if (!healthResponse.ok)
        throw new Error(
          healthPayload.error || "Campaign health could not be loaded",
        );
      if (!audiencesResponse.ok)
        throw new Error(
          audiencePayload.error || "Audiences could not be loaded",
        );
      if (!experimentsResponse.ok)
        throw new Error(
          experimentPayload.error || "Experiments could not be loaded",
        );
      if (!sendersResponse.ok)
        throw new Error(
          senderPayload.error || "Sender health could not be loaded",
        );
      setSequences(sequencePayload.sequences || []);
      setHealth(healthPayload.campaigns || []);
      setAudiences(audiencePayload.audiences || []);
      setExperiments(experimentPayload.experiments || []);
      setSenders(senderPayload.senders || []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Outreach workspace could not be loaded",
      );
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!currentTenant?.id) return;
    setSaving(true);
    try {
      const response = await fetch("/api/outreach/sequences", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          name: form.name,
          audienceId: form.audienceId || undefined,
          timezone: form.timezone,
          stopOnReply: form.stopOnReply,
          requiresApproval: form.requiresApproval,
          frequencyCap: { max_per_7_days: form.maxPerWeek },
          quietHours: { start: form.quietStart, end: form.quietEnd },
          steps: steps.map((step) => ({
            channel: step.channel,
            delayMinutes: step.delayMinutes,
            condition:
              step.condition === "always" ? {} : { event: step.condition },
            template: { subject: step.subject, body: step.body },
            variantGroup: step.variantGroup || undefined,
          })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "Sequence could not be created");
      toast.success("Multi-channel sequence created");
      setCreating(false);
      setForm({
        name: "",
        audienceId: "",
        timezone: form.timezone,
        maxPerWeek: 3,
        quietStart: "20:00",
        quietEnd: "08:00",
        stopOnReply: true,
        requiresApproval: true,
      });
      setSteps([blankStep()]);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Sequence could not be created",
      );
    } finally {
      setSaving(false);
    }
  };
  const changeStatus = async (
    sequence: Sequence,
    status: string,
    approve = false,
  ) => {
    if (!currentTenant?.id) return;
    try {
      const response = await fetch("/api/outreach/sequences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          sequenceId: sequence.id,
          status,
          approve,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "Sequence could not be updated");
      toast.success(
        status === "active"
          ? "Sequence approved and activated"
          : `Sequence ${status}`,
      );
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Sequence could not be updated",
      );
    }
  };
  const saveAudience = async () => {
    if (!currentTenant?.id) return;
    try {
      const response = await fetch("/api/outreach/audiences", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          name: audienceForm.name,
          rules: {
            source: audienceForm.source,
            status: audienceForm.status || undefined,
            industry: audienceForm.industry || undefined,
            search: audienceForm.search || undefined,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "Audience could not be saved");
      toast.success(
        `Audience saved with ${payload.audience?.estimated_size || 0} eligible recipients`,
      );
      setAudienceForm({
        name: "",
        source: "leads",
        status: "",
        industry: "",
        search: "",
      });
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Audience could not be saved",
      );
    }
  };
  const saveExperiment = async () => {
    if (!currentTenant?.id) return;
    try {
      const response = await fetch("/api/outreach/experiments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          sequenceId: experimentForm.sequenceId,
          name: experimentForm.name,
          hypothesis: experimentForm.hypothesis || undefined,
          metric: experimentForm.metric,
          variants: [
            {
              key: "A",
              label: "Control",
              weight: 50,
              subject: experimentForm.subjectA || undefined,
              body: experimentForm.bodyA || undefined,
            },
            {
              key: "B",
              label: "Variant",
              weight: 50,
              subject: experimentForm.subjectB || undefined,
              body: experimentForm.bodyB || undefined,
            },
          ],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "Experiment could not be saved");
      toast.success("A/B experiment created");
      setExperimentForm({
        name: "",
        sequenceId: "",
        hypothesis: "",
        metric: "reply_rate",
        subjectA: "",
        subjectB: "",
        bodyA: "",
        bodyB: "",
      });
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Experiment could not be saved",
      );
    }
  };
  const updateExperiment = async (
    experimentId: string,
    status: string,
    winnerVariant?: string,
  ) => {
    if (!currentTenant?.id) return;
    try {
      const response = await fetch("/api/outreach/experiments", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          experimentId,
          status,
          winnerVariant,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "Experiment could not be updated");
      toast.success(`Experiment ${status}`);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Experiment could not be updated",
      );
    }
  };
  const updateSender = async (
    sender: Sender,
    warmupStatus: string,
    dailySendLimit = sender.daily_send_limit,
  ) => {
    if (!currentTenant?.id) return;
    try {
      const response = await fetch("/api/outreach/senders", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          senderId: sender.id,
          warmupStatus,
          dailySendLimit,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          payload.error || "Sender settings could not be updated",
        );
      toast.success(`Sender ${warmupStatus.replaceAll("_", " ")}`);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Sender settings could not be updated",
      );
    }
  };
  const panel = "ac-workspace-panel rounded-xl p-4";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Sequences & campaign safety
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Conditional multi-channel outreach with approvals, frequency caps
            and automatic safety pauses.
          </p>
        </div>
        <button
          onClick={() => setCreating((value) => !value)}
          className="ac-workspace-action-btn ac-workspace-action-btn--primary text-[11px] min-h-8 px-3"
        >
          <Plus className="h-3.5 w-3.5" /> New sequence
        </button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={panel}>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-300" />
            <p className="text-xs font-bold text-white">CRM audiences</p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              value={audienceForm.name}
              onChange={(e) =>
                setAudienceForm({ ...audienceForm, name: e.target.value })
              }
              placeholder="Audience name"
              className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
            />
            <select
              value={audienceForm.source}
              onChange={(e) =>
                setAudienceForm({
                  ...audienceForm,
                  source: e.target.value,
                  status: "",
                  industry: "",
                })
              }
              className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
            >
              <option value="leads">Leads</option>
              <option value="contacts">Contacts</option>
              <option value="clients">Clients</option>
            </select>
            <input
              value={audienceForm.status}
              onChange={(e) =>
                setAudienceForm({ ...audienceForm, status: e.target.value })
              }
              placeholder="Status (optional)"
              className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
            />
            <input
              value={audienceForm.industry}
              onChange={(e) =>
                setAudienceForm({ ...audienceForm, industry: e.target.value })
              }
              placeholder="Industry (optional)"
              disabled={audienceForm.source === "contacts"}
              className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white disabled:opacity-40"
            />
            <input
              value={audienceForm.search}
              onChange={(e) =>
                setAudienceForm({ ...audienceForm, search: e.target.value })
              }
              placeholder="Name or email contains"
              className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white sm:col-span-2"
            />
          </div>
          <button
            onClick={() => void saveAudience()}
            disabled={!audienceForm.name.trim()}
            className="mt-2 rounded-lg bg-sky-500/15 px-3 py-2 text-[10px] font-bold text-sky-200 disabled:opacity-40"
          >
            Calculate & save audience
          </button>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {audiences.map((audience) => (
              <span
                key={audience.id}
                className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-300"
              >
                {audience.name} · {audience.estimated_size || 0}
              </span>
            ))}
          </div>
        </section>
        <section className={panel}>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-violet-300" />
            <p className="text-xs font-bold text-white">A/B experiments</p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              value={experimentForm.name}
              onChange={(e) =>
                setExperimentForm({ ...experimentForm, name: e.target.value })
              }
              placeholder="Experiment name"
              className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
            />
            <select
              value={experimentForm.sequenceId}
              onChange={(e) =>
                setExperimentForm({
                  ...experimentForm,
                  sequenceId: e.target.value,
                })
              }
              className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
            >
              <option value="">Select sequence</option>
              {sequences.map((sequence) => (
                <option key={sequence.id} value={sequence.id}>
                  {sequence.name}
                </option>
              ))}
            </select>
            <input
              value={experimentForm.hypothesis}
              onChange={(e) =>
                setExperimentForm({
                  ...experimentForm,
                  hypothesis: e.target.value,
                })
              }
              placeholder="Hypothesis"
              className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
            />
            <select
              value={experimentForm.metric}
              onChange={(e) =>
                setExperimentForm({ ...experimentForm, metric: e.target.value })
              }
              className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
            >
              <option value="open_rate">Open rate</option>
              <option value="click_rate">Click rate</option>
              <option value="reply_rate">Reply rate</option>
              <option value="meeting_rate">Meeting rate</option>
              <option value="revenue">Revenue</option>
            </select>
            <input
              value={experimentForm.subjectA}
              onChange={(e) =>
                setExperimentForm({
                  ...experimentForm,
                  subjectA: e.target.value,
                })
              }
              placeholder="A subject (blank = campaign subject)"
              className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
            />
            <input
              value={experimentForm.subjectB}
              onChange={(e) =>
                setExperimentForm({
                  ...experimentForm,
                  subjectB: e.target.value,
                })
              }
              placeholder="B subject"
              className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
            />
            <textarea
              value={experimentForm.bodyA}
              onChange={(e) =>
                setExperimentForm({ ...experimentForm, bodyA: e.target.value })
              }
              placeholder="A message (blank = campaign message)"
              className="min-h-16 rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
            />
            <textarea
              value={experimentForm.bodyB}
              onChange={(e) =>
                setExperimentForm({ ...experimentForm, bodyB: e.target.value })
              }
              placeholder="B message / offer"
              className="min-h-16 rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
            />
          </div>
          <button
            onClick={() => void saveExperiment()}
            disabled={!experimentForm.name.trim() || !experimentForm.sequenceId}
            className="mt-2 rounded-lg bg-violet-500/15 px-3 py-2 text-[10px] font-bold text-violet-200 disabled:opacity-40"
          >
            Create 50/50 test
          </button>
          <div className="mt-3 space-y-2">
            {experiments.map((experiment) => (
              <div
                key={experiment.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-2"
              >
                <span className="text-[10px] text-slate-300">
                  {experiment.name} · {experiment.metric.replaceAll("_", " ")} ·{" "}
                  {experiment.status}
                  {experiment.live_results
                    ? ` · A ${experiment.live_results.A?.sent || 0} / B ${experiment.live_results.B?.sent || 0} sent`
                    : ""}
                </span>
                <div className="flex gap-1">
                  {experiment.status === "draft" ? (
                    <button
                      onClick={() =>
                        void updateExperiment(experiment.id, "running")
                      }
                      className="text-[9px] font-bold text-teal-300"
                    >
                      Start
                    </button>
                  ) : null}
                  {experiment.status === "running" ? (
                    <>
                      <button
                        onClick={() =>
                          void updateExperiment(experiment.id, "completed", "A")
                        }
                        className="text-[9px] font-bold text-sky-300"
                      >
                        A wins
                      </button>
                      <button
                        onClick={() =>
                          void updateExperiment(experiment.id, "completed", "B")
                        }
                        className="text-[9px] font-bold text-violet-300"
                      >
                        B wins
                      </button>
                      <button
                        onClick={() =>
                          void updateExperiment(experiment.id, "stopped")
                        }
                        className="text-[9px] font-bold text-amber-300"
                      >
                        Stop
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      {creating ? (
        <section className={panel}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2 text-xs normal-case text-white"
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Saved audience
              <select
                value={form.audienceId}
                onChange={(e) => setForm({ ...form, audienceId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2 text-xs normal-case text-white"
              >
                <option value="">Select audience</option>
                {audiences.map((audience) => (
                  <option key={audience.id} value={audience.id}>
                    {audience.name} ({audience.estimated_size || 0})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Timezone
              <input
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2 text-xs normal-case text-white"
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Max / 7 days
              <input
                type="number"
                min="1"
                max="30"
                value={form.maxPerWeek}
                onChange={(e) =>
                  setForm({ ...form, maxPerWeek: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2 text-xs normal-case text-white"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] font-bold uppercase text-slate-500">
                Quiet from
                <input
                  type="time"
                  value={form.quietStart}
                  onChange={(e) =>
                    setForm({ ...form, quietStart: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                />
              </label>
              <label className="text-[10px] font-bold uppercase text-slate-500">
                Until
                <input
                  type="time"
                  value={form.quietEnd}
                  onChange={(e) =>
                    setForm({ ...form, quietEnd: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                />
              </label>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-xl border border-white/10 bg-slate-950/50 p-3 lg:grid-cols-[7rem_7rem_10rem_1fr_1fr_auto]"
              >
                <select
                  value={step.channel}
                  onChange={(e) =>
                    setSteps(
                      steps.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              channel: e.target.value as Step["channel"],
                            }
                          : row,
                      ),
                    )
                  }
                  className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                >
                  <option value="email">Email</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="call">Call task</option>
                  <option value="task">Task</option>
                </select>
                <input
                  type="number"
                  min="0"
                  value={step.delayMinutes}
                  onChange={(e) =>
                    setSteps(
                      steps.map((row, i) =>
                        i === index
                          ? { ...row, delayMinutes: Number(e.target.value) }
                          : row,
                      ),
                    )
                  }
                  placeholder="Delay min"
                  className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                />
                <select
                  value={step.condition}
                  onChange={(e) =>
                    setSteps(
                      steps.map((row, i) =>
                        i === index
                          ? { ...row, condition: e.target.value }
                          : row,
                      ),
                    )
                  }
                  className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                >
                  <option value="always">Always</option>
                  <option value="not_opened">Not opened</option>
                  <option value="opened">Opened</option>
                  <option value="clicked">Clicked</option>
                  <option value="no_reply">No reply</option>
                  <option value="positive_reply">Positive reply</option>
                </select>
                <input
                  value={step.subject}
                  onChange={(e) =>
                    setSteps(
                      steps.map((row, i) =>
                        i === index ? { ...row, subject: e.target.value } : row,
                      ),
                    )
                  }
                  placeholder="Subject / task title"
                  className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                />
                <input
                  value={step.body}
                  onChange={(e) =>
                    setSteps(
                      steps.map((row, i) =>
                        i === index ? { ...row, body: e.target.value } : row,
                      ),
                    )
                  }
                  placeholder="Message / instructions"
                  className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white"
                />
                <button
                  onClick={() =>
                    steps.length > 1 &&
                    setSteps(steps.filter((_, i) => i !== index))
                  }
                  className="p-2 text-slate-500 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={form.stopOnReply}
                  onChange={(e) =>
                    setForm({ ...form, stopOnReply: e.target.checked })
                  }
                />{" "}
                Stop on reply
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={form.requiresApproval}
                  onChange={(e) =>
                    setForm({ ...form, requiresApproval: e.target.checked })
                  }
                />{" "}
                Require approval
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSteps([...steps, blankStep()])}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300"
              >
                Add step
              </button>
              <button
                onClick={() => void save()}
                disabled={saving}
                className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save sequence"}
              </button>
            </div>
          </div>
        </section>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {loading ? (
          <div
            className={`${panel} flex min-h-32 items-center justify-center lg:col-span-2`}
          >
            <Loader2 className="h-5 w-5 animate-spin text-teal-400" />
          </div>
        ) : sequences.length ? (
          sequences.map((sequence) => (
            <section key={sequence.id} className={panel}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-teal-400" />
                    <p className="text-sm font-semibold text-white">
                      {sequence.name}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {sequence.steps?.length || 0} steps · {sequence.timezone} ·
                    max {sequence.frequency_cap?.max_per_7_days || 3}/week
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Audience: {sequence.audience?.name || "Not selected"}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-black uppercase text-slate-300">
                  {sequence.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {sequence.steps
                  ?.sort((a, b) => a.step_order - b.step_order)
                  .map((step) => (
                    <span
                      key={step.id}
                      className="rounded-lg border border-white/10 bg-slate-950/50 px-2 py-1 text-[10px] text-slate-400"
                    >
                      {step.step_order}. {step.channel} · {step.delay_minutes}m
                    </span>
                  ))}
              </div>
              <div className="mt-3 flex gap-2">
                {sequence.status !== "active" ? (
                  <button
                    onClick={() =>
                      void changeStatus(
                        sequence,
                        "active",
                        sequence.requires_approval && !sequence.approved_at,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500/10 px-2.5 py-1.5 text-[10px] font-bold text-teal-300"
                  >
                    <Play className="h-3 w-3" />
                    {sequence.requires_approval && !sequence.approved_at
                      ? "Approve & activate"
                      : "Activate"}
                  </button>
                ) : (
                  <button
                    onClick={() => void changeStatus(sequence, "paused")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-300"
                  >
                    <Pause className="h-3 w-3" />
                    Pause
                  </button>
                )}
              </div>
            </section>
          ))
        ) : (
          <div
            className={`${panel} lg:col-span-2 text-center text-xs text-slate-500`}
          >
            No multi-channel sequences yet.
          </div>
        )}
      </div>
      <section className={panel}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-sky-300" />
          <p className="text-xs font-bold text-white">
            Sender warm-up & reputation
          </p>
        </div>
        {senders.length ? (
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {senders.map((sender) => (
              <article
                key={sender.id}
                className={`rounded-xl border p-3 ${sender.live_health?.unsafe ? "border-rose-500/25 bg-rose-500/5" : "border-white/10 bg-slate-950/40"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-white">
                      {sender.email_address}
                    </p>
                    <p className="text-[9px] uppercase text-slate-500">
                      {sender.provider} ·{" "}
                      {sender.warmup_status.replaceAll("_", " ")}
                    </p>
                  </div>
                  <span
                    className={`text-lg font-black ${sender.live_health?.unsafe ? "text-rose-300" : "text-emerald-300"}`}
                  >
                    {sender.live_health?.reputationScore ?? 100}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="text-[9px] uppercase text-slate-500">
                    Daily limit{" "}
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      defaultValue={sender.daily_send_limit}
                      onBlur={(event) =>
                        void updateSender(
                          sender,
                          sender.warmup_status,
                          Number(event.target.value),
                        )
                      }
                      className="ml-1 w-20 rounded border border-white/10 bg-slate-950 p-1 text-xs text-white"
                    />
                  </label>
                  {sender.warmup_status !== "warming" ? (
                    <button
                      onClick={() => void updateSender(sender, "warming")}
                      className="text-[9px] font-bold text-sky-300"
                    >
                      Start warm-up
                    </button>
                  ) : (
                    <button
                      onClick={() => void updateSender(sender, "paused")}
                      className="text-[9px] font-bold text-amber-300"
                    >
                      Pause
                    </button>
                  )}
                  {sender.warmup_status === "warming" &&
                  !sender.live_health?.unsafe ? (
                    <button
                      onClick={() => void updateSender(sender, "ready")}
                      className="text-[9px] font-bold text-emerald-300"
                    >
                      Mark ready
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-[9px] text-slate-500">
                  Bounce{" "}
                  {((sender.live_health?.bounceRate || 0) * 100).toFixed(1)}% ·
                  complaints{" "}
                  {((sender.live_health?.complaintRate || 0) * 100).toFixed(2)}%
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-slate-500">
            Connect and verify an email sender to manage warm-up and reputation.
          </p>
        )}
      </section>
      <section className={panel}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <p className="text-xs font-bold text-white">
            Campaign safety & revenue outcomes
          </p>
        </div>
        {health.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="text-slate-500">
                <tr>
                  <th className="pb-2">Campaign</th>
                  <th>Sent</th>
                  <th>Replies</th>
                  <th>Meetings</th>
                  <th>Deals</th>
                  <th>Bounce</th>
                  <th>Complaints</th>
                  <th>Safety</th>
                </tr>
              </thead>
              <tbody>
                {health.map((row) => (
                  <tr key={row.campaignId} className="border-t border-white/5">
                    <td className="py-2 text-slate-300">
                      {row.campaignId === "unassigned"
                        ? "Unassigned activity"
                        : row.campaignId.slice(0, 8)}
                    </td>
                    <td>{row.sent}</td>
                    <td>{row.replies}</td>
                    <td>{row.meetings}</td>
                    <td>{row.deals}</td>
                    <td>{(row.bounceRate * 100).toFixed(1)}%</td>
                    <td>{(row.complaintRate * 100).toFixed(2)}%</td>
                    <td>
                      {row.shouldPause ? (
                        <span
                          title={row.reasons.join(", ")}
                          className="inline-flex items-center gap-1 text-amber-300"
                        >
                          <AlertTriangle className="h-3 w-3" /> Pause
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> Safe
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-slate-500">
            Delivery and revenue health will appear after campaign events
            arrive.
          </p>
        )}
      </section>
    </div>
  );
}

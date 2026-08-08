"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  MessageSquare,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
  Send,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Archive,
  Loader2,
  ArrowRight,
  CornerUpLeft,
  ShieldAlert,
  Inbox,
  Brain,
  RefreshCw,
  Check,
  Star,
  CheckSquare,
  Search,
} from "lucide-react";
import { ModuleStatCards, type ModuleStat } from "../common/ModuleStatCards";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/contexts/TenantContext";
import { extractEmailAddress } from "@/lib/email/composeNavigation";
import toast from "react-hot-toast";
import EmailLeadInsightPanel from "../inbox/EmailLeadInsightPanel";
import EmailProviderSelector from "@/components/shared/EmailProviderSelector";
import {
  normalizeDeliveryProvider,
  resolveAutoProvider,
  type DeliveryEmailProvider,
} from "@/lib/email/emailProviderOptions";

function resolveOutreachProvider(source?: string | null): string | undefined {
  const normalized = String(source || "").toLowerCase();
  if (normalized === "zoho") return "zoho";
  if (normalized === "microsoft" || normalized === "outlook")
    return "microsoft";
  return undefined;
}

interface UnifiedMessage {
  id: string;
  tenant_id: string;
  source: string;
  channel: string;
  direction: string;
  external_id: string | null;
  thread_id: string | null;
  subject: string | null;
  body: string | null;
  html_body: string | null;
  from_address: string | null;
  from_name: string | null;
  to_address: string | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  priority: "low" | "normal" | "high" | "urgent" | null;
  category: string | null;
  intent: string | null;
  needs_response: boolean;
  auto_replied: boolean;
  received_at: string | null;
  sent_at: string | null;
  read: boolean;
  archived: boolean;
  metadata: Record<string, any> | null;
}

export default function UnifiedInboxTab({
  needsReplyOnly = false,
}: {
  needsReplyOnly?: boolean;
}) {
  const { currentTenant: tenant } = useTenant();
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<UnifiedMessage | null>(
    null,
  );
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [draftingReply, setDraftingReply] = useState(false);
  const [draftReplyText, setDraftReplyText] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [processingIntelligence, setProcessingIntelligence] = useState(false);
  const [customReplyPrompt, setCustomReplyPrompt] = useState("");
  const [deliveryProvider, setDeliveryProvider] =
    useState<DeliveryEmailProvider>("auto");
  const [workspaceDefault, setWorkspaceDefault] =
    useState<DeliveryEmailProvider>("auto");
  const [providerOptions, setProviderOptions] = useState<
    Array<{
      id: DeliveryEmailProvider;
      label: string;
      connected: boolean;
      native?: boolean;
      campaigns?: boolean;
    }>
  >([]);
  const [savingDraft, setSavingDraft] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [starredIds, setStarredIds] = useState<Set<string>>(() => {
    try {
      const saved =
        typeof window !== "undefined"
          ? localStorage.getItem("inbox_starred")
          : null;
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterStarredOnly, setFilterStarredOnly] = useState(false);
  const [filterNeedsReply, setFilterNeedsReply] = useState(false);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("unified_messages")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("archived", false)
        .order("received_at", { ascending: false });

      if (error) throw error;
      setMessages(data || []);

      // Select the first message by default if none is selected
      if (data && data.length > 0 && !selectedMessage) {
        setSelectedMessage(data[0]);
      }
    } catch (err: any) {
      toast.error("Failed to load messages: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, selectedMessage]);

  const toggleStar = (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
        toast.success("Removed star");
      } else {
        next.add(msgId);
        toast.success("Message starred");
      }
      try {
        localStorage.setItem("inbox_starred", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const toggleSelect = (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const handleBulkArchive = async () => {
    if (selectedIds.size === 0) return;
    const idsToArchive = Array.from(selectedIds);
    try {
      await Promise.all(
        idsToArchive.map((id) =>
          fetch(
            `/api/tenant/${encodeURIComponent(tenant?.id || "")}/inbox/messages`,
            {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "archive", messageId: id }),
            },
          ),
        ),
      );
      setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
      if (selectedMessage && selectedIds.has(selectedMessage.id)) {
        setSelectedMessage(null);
      }
      setSelectedIds(new Set());
      toast.success(`Archived ${idsToArchive.length} message(s)`);
    } catch (err: any) {
      toast.error("Failed to bulk archive: " + err.message);
    }
  };

  const handleBulkMarkRead = async () => {
    if (selectedIds.size === 0) return;
    const idsToRead = Array.from(selectedIds);
    try {
      setMessages((prev) =>
        prev.map((m) => (selectedIds.has(m.id) ? { ...m, read: true } : m)),
      );
      await Promise.all(
        idsToRead.map((id) =>
          fetch(
            `/api/tenant/${encodeURIComponent(tenant?.id || "")}/inbox/messages`,
            {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "read", messageId: id }),
            },
          ),
        ),
      );
      setSelectedIds(new Set());
      toast.success(`Marked ${idsToRead.length} message(s) as read`);
    } catch (err: any) {
      toast.error("Failed to update messages: " + err.message);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!tenant?.id) return;
    fetch(
      `/api/settings/email-provider?tenantId=${encodeURIComponent(tenant.id)}`,
      {
        credentials: "include",
      },
    )
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        const connected = (data.connectedProviders ||
          []) as typeof providerOptions;
        setProviderOptions(connected);
        const tenantDefault = normalizeDeliveryProvider(data.defaultProvider);
        setWorkspaceDefault(tenantDefault);
        setDeliveryProvider(tenantDefault);
      })
      .catch(() => {});
  }, [tenant?.id]);

  const resolveSendProvider = () => {
    const connectedIds = providerOptions
      .filter((p) => p.connected)
      .map((p) => p.id);
    const fromPicker =
      deliveryProvider === "auto"
        ? resolveAutoProvider(connectedIds, workspaceDefault)
        : deliveryProvider;
    if (fromPicker !== "auto") return fromPicker;
    return resolveOutreachProvider(selectedMessage?.source);
  };

  const handleSaveDraftToMailbox = async () => {
    if (!tenant?.id || !draftReplyText.trim()) return;
    setSavingDraft(true);
    try {
      const recipient = selectedMessage
        ? extractEmailAddress(selectedMessage.from_address)
        : "";
      const provider = resolveSendProvider();
      const res = await fetch("/api/email/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          to: recipient,
          subject: replySubject,
          body: draftReplyText,
          deliveryProvider: provider === "auto" ? "zoho" : provider,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save draft");
      toast.success(data.note || "AI draft saved to drafts");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSelectMessage = async (msg: UnifiedMessage) => {
    setSelectedMessage(msg);
    setDraftReplyText("");
    setCustomReplyPrompt("");
    setReplySubject(
      msg.subject
        ? `Re: ${msg.subject.replace(/^Re:\s*/i, "")}`
        : "Re: Your message",
    );

    if (!msg.read) {
      // Mark as read in local state first
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, read: true } : m)),
      );
      // Save to database
      void fetch(
        `/api/tenant/${encodeURIComponent(tenant?.id || "")}/inbox/messages`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "read", messageId: msg.id }),
        },
      ).then(async (response) => {
        if (!response.ok) {
          await loadMessages();
          toast.error("Message read state could not be saved");
        }
      });
    }
  };

  const handleArchiveMessage = async (msgId: string) => {
    try {
      const response = await fetch(
        `/api/tenant/${encodeURIComponent(tenant?.id || "")}/inbox/messages`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive", messageId: msgId }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "Message could not be archived");

      toast.success("Conversation archived");
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(null);
      }
    } catch (err: any) {
      toast.error("Failed to archive: " + err.message);
    }
  };

  const handleMarkNeedsResponse = async (msgId: string, val: boolean) => {
    try {
      const response = await fetch(
        `/api/tenant/${encodeURIComponent(tenant?.id || "")}/inbox/messages`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "needs_response",
            messageId: msgId,
            value: val,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || "Message could not be updated");

      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, needs_response: val } : m)),
      );
      if (selectedMessage?.id === msgId) {
        setSelectedMessage((prev) =>
          prev ? { ...prev, needs_response: val } : null,
        );
      }
      toast.success(val ? "Marked as needs response" : "Marked as resolved");
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
  };

  const handleGenerateAIDraft = async () => {
    if (!selectedMessage) return;
    setDraftingReply(true);
    try {
      const res = await fetch("/api/inbox/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: selectedMessage.id,
          context: customReplyPrompt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Draft generation failed");
      setDraftReplyText(data.draft);
      toast.success("AI draft generated — review before sending");

      if (tenant?.id && selectedMessage?.channel === "email") {
        const provider = resolveSendProvider();
        void fetch("/api/email/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId: tenant.id,
            to: extractEmailAddress(selectedMessage.from_address),
            subject: replySubject,
            body: data.draft,
            deliveryProvider: provider === "auto" ? "zoho" : provider,
          }),
        }).then(async (draftRes) => {
          if (draftRes.ok)
            toast.success("Saved to your drafts folder for review");
        });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDraftingReply(false);
    }
  };

  const handleProcessIntelligence = async () => {
    if (!selectedMessage) return;
    setProcessingIntelligence(true);
    try {
      const res = await fetch("/api/inbox/process-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: selectedMessage.id }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Intelligence processing failed");

      toast.success("AI Intelligence updated!");
      // Update selected message and messages list
      setSelectedMessage(data.message);
      setMessages((prev) =>
        prev.map((m) => (m.id === selectedMessage.id ? data.message : m)),
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessingIntelligence(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !draftReplyText.trim() || !tenant?.id) return;

    if (selectedMessage.channel !== "email") {
      toast.error(
        "Direct send is available for email messages. Chat and SMS channels need their native reply flow.",
      );
      return;
    }

    const recipient = extractEmailAddress(selectedMessage.from_address);
    if (!recipient.includes("@")) {
      toast.error("No valid recipient email on this message.");
      return;
    }

    setSendingReply(true);
    const sendToast = toast.loading("Sending email...");
    try {
      const subject =
        replySubject.trim() ||
        `Re: ${selectedMessage.subject || "Your message"}`;
      const provider = resolveSendProvider();

      const response = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          leadEmail: recipient,
          leadName: selectedMessage.from_name || undefined,
          subject,
          body: draftReplyText,
          pitchAngle: "inbox_reply",
          autoSend: true,
          consentGranted: true,
          confidenceScore: 100,
          ...(provider
            ? { preferredProvider: provider, deliveryProviders: [provider] }
            : {}),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to send email");
      }

      const stateResponse = await fetch(
        `/api/tenant/${encodeURIComponent(tenant?.id || "")}/inbox/messages`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "replied",
            messageId: selectedMessage.id,
          }),
        },
      );
      const statePayload = await stateResponse.json().catch(() => ({}));
      if (!stateResponse.ok)
        throw new Error(statePayload.error || "Reply state could not be saved");

      const sentVia = String(
        result.provider || provider || "platform",
      ).toUpperCase();
      toast.success(`Email sent via ${sentVia}`, { id: sendToast });
      setDraftReplyText("");
      setCustomReplyPrompt("");
      loadMessages();
    } catch (err: any) {
      toast.error("Failed to send reply: " + err.message, { id: sendToast });
    } finally {
      setSendingReply(false);
    }
  };

  const handleQuickEmailAction = async () => {
    if (!selectedMessage) return;
    if (selectedMessage.channel !== "email") {
      toast.error("Quick send is available for email messages only.");
      return;
    }
    if (!draftReplyText.trim()) {
      await handleGenerateAIDraft();
    }
    document
      .getElementById("inbox-reply-compose")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const getSourceIcon = (source: string) => {
    switch (source?.toLowerCase()) {
      case "zoho":
        return <Mail className="w-4 h-4 text-emerald-400" />;
      case "whatsapp":
        return <MessageCircle className="w-4 h-4 text-green-400" />;
      case "facebook":
        return <MessageSquare className="w-4 h-4 text-blue-400" />;
      case "instagram":
        return <MessageCircle className="w-4 h-4 text-pink-400" />;
      default:
        return <MessageSquare className="w-4 h-4 text-slate-400" />;
    }
  };

  const getPriorityStyle = (priority: string | null) => {
    switch (priority?.toLowerCase()) {
      case "urgent":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "high":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "normal":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  const getSentimentEmoji = (sentiment: string | null) => {
    switch (sentiment?.toLowerCase()) {
      case "positive":
        return "😊";
      case "negative":
        return "😡";
      default:
        return "😐";
    }
  };

  const filteredMessages = messages.filter((m) => {
    if (needsReplyOnly && !m.needs_response) return false;
    if (filterNeedsReply && !m.needs_response) return false;
    if (filterUnreadOnly && m.read) return false;
    if (filterSource !== "all" && m.source !== filterSource) return false;
    if (filterPriority !== "all" && m.priority !== filterPriority) return false;
    if (filterStarredOnly && !starredIds.has(m.id)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (m.from_name || "").toLowerCase().includes(q);
      const matchEmail = (m.from_address || "").toLowerCase().includes(q);
      const matchSubject = (m.subject || "").toLowerCase().includes(q);
      const matchBody = (m.body || "").toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchSubject && !matchBody)
        return false;
    }
    return true;
  });

  const selectedThreadMessages = useMemo(() => {
    if (!selectedMessage) return [];
    const threadKey = selectedMessage.thread_id || selectedMessage.from_address;
    if (!threadKey) return [selectedMessage];
    return messages
      .filter(
        (m) =>
          (m.thread_id && m.thread_id === selectedMessage.thread_id) ||
          (m.from_address && m.from_address === selectedMessage.from_address),
      )
      .sort(
        (a, b) =>
          new Date(a.received_at || a.sent_at || 0).getTime() -
          new Date(b.received_at || b.sent_at || 0).getTime(),
      );
  }, [selectedMessage, messages]);

  const inboxStats = useMemo<ModuleStat[]>(() => {
    const pending = messages.filter((m) => m.needs_response).length;
    const unread = messages.filter((m) => !m.read).length;
    const urgent = messages.filter(
      (m) => m.priority === "urgent" || m.priority === "high",
    ).length;
    const channels = new Set(messages.map((m) => m.source)).size;
    return [
      {
        label: "Total Messages",
        value: messages.length,
        sub: "Across all channels",
        Icon: Inbox,
        accent: "teal",
      },
      {
        label: "Needs Reply",
        value: pending,
        sub: "Awaiting response",
        Icon: CornerUpLeft,
        accent: pending > 0 ? "amber" : "emerald",
      },
      {
        label: "Unread",
        value: unread,
        sub: "Not yet opened",
        Icon: Mail,
        accent: "blue",
      },
      {
        label: "High Priority",
        value: urgent,
        sub: `${channels} channel${channels !== 1 ? "s" : ""} active`,
        Icon: AlertCircle,
        accent: urgent > 0 ? "rose" : "purple",
      },
    ];
  }, [messages]);

  if (loading && messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        <p className="text-slate-400 text-sm">
          Aggregating solopreneur conversation feeds...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {messages.length > 0 && (
        <div className="flex-shrink-0">
          <ModuleStatCards stats={inboxStats} />
        </div>
      )}
      <div
        className="flex flex-1 min-h-0 border border-slate-800 rounded-lg overflow-hidden bg-slate-950"
        role="region"
        aria-label="All channels inbox"
      >
        {/* 1. Channel & Folder Navigation Sidebar */}
        <div className="hidden xl:flex w-48 border-r border-slate-800 flex-col bg-slate-900/40 p-3 shrink-0 select-none overflow-y-auto">
          <div className="flex items-center justify-between mb-3 px-2 pt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Inboxes
            </span>
            <span className="text-[10px] bg-teal-500/15 text-teal-400 px-2 py-0.5 rounded-full font-semibold">
              {messages.filter((m) => m.needs_response).length} Pending
            </span>
          </div>

          <nav className="space-y-1 text-xs">
            <button
              onClick={() => {
                setFilterSource("all");
                setFilterPriority("all");
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                filterSource === "all" && filterPriority === "all"
                  ? "bg-teal-500/15 text-teal-300 font-semibold border border-teal-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <span className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-teal-400" />
                All Inboxes
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {messages.length}
              </span>
            </button>

            <div className="pt-3 pb-1 px-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
              Channels
            </div>

            {[
              {
                id: "zoho",
                name: "Zoho Mail",
                Icon: Mail,
                color: "text-emerald-400",
              },
              {
                id: "whatsapp",
                name: "WhatsApp",
                Icon: MessageCircle,
                color: "text-green-400",
              },
              {
                id: "facebook",
                name: "Facebook",
                Icon: MessageSquare,
                color: "text-blue-400",
              },
              {
                id: "instagram",
                name: "Instagram",
                Icon: MessageCircle,
                color: "text-pink-400",
              },
            ].map((ch) => {
              const count = messages.filter((m) => m.source === ch.id).length;
              const Icon = ch.Icon;
              return (
                <button
                  key={ch.id}
                  onClick={() => setFilterSource(ch.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                    filterSource === ch.id
                      ? "bg-teal-500/15 text-teal-300 font-semibold border border-teal-500/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${ch.color}`} />
                    {ch.name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {count}
                  </span>
                </button>
              );
            })}

            <div className="pt-3 pb-1 px-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
              Smart Folders
            </div>

            <button
              onClick={() => {
                setFilterNeedsReply((prev) => !prev);
                setFilterStarredOnly(false);
                setFilterUnreadOnly(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                filterNeedsReply
                  ? "bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <span className="flex items-center gap-2">
                <CornerUpLeft className="w-3.5 h-3.5 text-amber-400" />
                Needs Reply
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {messages.filter((m) => m.needs_response).length}
              </span>
            </button>

            <button
              onClick={() => {
                setFilterUnreadOnly((prev) => !prev);
                setFilterStarredOnly(false);
                setFilterNeedsReply(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                filterUnreadOnly
                  ? "bg-blue-500/15 text-blue-300 font-semibold border border-blue-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <span className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                Unread
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {messages.filter((m) => !m.read).length}
              </span>
            </button>

            <button
              onClick={() => {
                setFilterPriority(
                  filterPriority === "urgent" ? "all" : "urgent",
                );
                setFilterStarredOnly(false);
                setFilterNeedsReply(false);
                setFilterUnreadOnly(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                filterPriority === "urgent"
                  ? "bg-rose-500/15 text-rose-300 font-semibold border border-rose-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <span className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                High Priority
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {
                  messages.filter(
                    (m) => m.priority === "urgent" || m.priority === "high",
                  ).length
                }
              </span>
            </button>

            <button
              onClick={() => {
                setFilterStarredOnly((prev) => !prev);
                setFilterNeedsReply(false);
                setFilterUnreadOnly(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                filterStarredOnly
                  ? "bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <span className="flex items-center gap-2">
                <Star
                  className={`w-3.5 h-3.5 ${filterStarredOnly ? "text-amber-400 fill-amber-400" : "text-amber-400"}`}
                />
                Starred
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {starredIds.size}
              </span>
            </button>
          </nav>
        </div>

        {/* 2. Middle Message List Section */}
        <div
          className={`${selectedMessage ? "hidden md:flex" : "flex"} w-full md:w-80 xl:w-[22rem] border-r border-slate-800 flex-col bg-slate-900/20 shrink-0 min-h-0`}
        >
          {/* Header & Filter Controls & Search */}
          <div className="p-3 border-b border-slate-800 space-y-2 bg-slate-900/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 capitalize">
                {filterStarredOnly
                  ? "⭐ Starred"
                  : filterNeedsReply
                    ? "↩ Needs Reply"
                    : filterUnreadOnly
                      ? "● Unread"
                      : filterPriority === "urgent"
                        ? "🔴 High Priority"
                        : filterSource === "all"
                          ? "All Conversations"
                          : `${filterSource.charAt(0).toUpperCase() + filterSource.slice(1)} Messages`}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {filteredMessages.length} items
              </span>
            </div>

            {/* Instant Search Bar */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by sender, subject, text..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between pt-1 text-xs bg-teal-500/10 border border-teal-500/20 p-1.5 rounded-lg">
                <span className="text-[11px] font-semibold text-teal-300">
                  {selectedIds.size} selected
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleBulkMarkRead}
                    className="px-2 py-0.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 text-[10px] font-bold rounded"
                  >
                    Mark Read
                  </button>
                  <button
                    onClick={handleBulkArchive}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded flex items-center gap-1"
                  >
                    <Archive className="w-3 h-3" />
                    Archive
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable Message List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-900">
            {filteredMessages.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-3">
                <Inbox className="w-10 h-10 mx-auto opacity-30 text-slate-400" />
                {messages.length === 0 ? (
                  <>
                    <p className="text-sm font-semibold text-white">
                      No messages yet
                    </p>
                    <p className="text-xs opacity-60 max-w-[180px] mx-auto">
                      Connect Zoho, WhatsApp or Facebook to start seeing
                      conversations here.
                    </p>
                    <div className="pt-2">
                      <span className="inline-flex items-center gap-1 text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-3 py-1.5 rounded-full font-semibold">
                        Go to Integrations to connect
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">No matches</p>
                    <p className="text-xs opacity-60">
                      Try a different filter or clear your search.
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setFilterSource("all");
                        setFilterPriority("all");
                        setFilterStarredOnly(false);
                        setFilterNeedsReply(false);
                        setFilterUnreadOnly(false);
                      }}
                      className="mt-1 text-xs text-teal-400 hover:text-teal-300 underline"
                    >
                      Clear all filters
                    </button>
                  </>
                )}
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => handleSelectMessage(msg)}
                  className={`p-3.5 cursor-pointer transition-all flex flex-col gap-2 relative ${
                    selectedMessage?.id === msg.id
                      ? "bg-slate-800/40 border-l-4 border-teal-500"
                      : "hover:bg-slate-900/30"
                  } ${!msg.read ? "bg-slate-900/10" : ""}`}
                >
                  {/* Meta details */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(msg.id)}
                        onChange={() => toggleSelect(msg.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <button
                        onClick={(e) => toggleStar(msg.id, e)}
                        className="text-slate-600 hover:text-amber-400 transition-colors"
                        title={
                          starredIds.has(msg.id) ? "Unstar" : "Star message"
                        }
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${starredIds.has(msg.id) ? "text-amber-400 fill-amber-400" : ""}`}
                        />
                      </button>
                      {getSourceIcon(msg.source)}
                      <span
                        className={`font-semibold text-xs truncate max-w-[120px] ${!msg.read ? "text-white font-bold" : "text-slate-300"}`}
                      >
                        {msg.from_name || msg.from_address || "Unknown"}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {msg.received_at
                        ? new Date(msg.received_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>

                  {/* Subject & snippet */}
                  <div className="space-y-1">
                    {msg.subject && (
                      <h4
                        className={`text-xs truncate ${!msg.read ? "text-white font-bold" : "text-slate-400"}`}
                      >
                        {msg.subject}
                      </h4>
                    )}
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {msg.body}
                    </p>
                  </div>

                  {/* Sentiment & Priority Tags */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-1.5 items-center">
                      {msg.priority && (
                        <span
                          className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded border ${getPriorityStyle(msg.priority)}`}
                        >
                          {msg.priority}
                        </span>
                      )}
                      {msg.sentiment && (
                        <span
                          className="text-xs"
                          title={`Sentiment: ${msg.sentiment}`}
                        >
                          {getSentimentEmoji(msg.sentiment)}
                        </span>
                      )}
                      {msg.category && (
                        <span className="text-[10px] text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded capitalize">
                          {msg.category}
                        </span>
                      )}
                    </div>
                    {msg.needs_response && (
                      <span
                        className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"
                        title="Needs Response"
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Right Detail & Intelligence Panel */}
        <div
          className={`${selectedMessage ? "flex" : "hidden md:flex"} flex-1 flex-col bg-slate-900/10 min-w-0 min-h-0 overflow-hidden`}
        >
          {selectedMessage ? (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Thread Header */}
              <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-900/20 shrink-0">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedMessage(null)}
                    className="md:hidden mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    <CornerUpLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                  <h3 className="text-sm font-bold text-white">
                    {selectedMessage.subject ||
                      `Conversation with ${selectedMessage.from_name || "Client"}`}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                    From:{" "}
                    {selectedMessage.from_address ? (
                      <button
                        type="button"
                        onClick={handleQuickEmailAction}
                        className="font-mono text-teal-400 hover:text-teal-300 underline-offset-2 hover:underline"
                        title="Prepare reply and send in platform"
                      >
                        {selectedMessage.from_address}
                      </button>
                    ) : (
                      <span className="font-mono text-slate-300">Unknown</span>
                    )}
                    <span>
                      | Channel:{" "}
                      <span className="capitalize">
                        {selectedMessage.source} ({selectedMessage.channel})
                      </span>
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {selectedMessage.channel === "email" &&
                    selectedMessage.from_address && (
                      <button
                        type="button"
                        onClick={handleQuickEmailAction}
                        className="px-3 py-2 rounded-xl border border-teal-500/20 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Send email
                      </button>
                    )}
                  <button
                    onClick={() =>
                      handleMarkNeedsResponse(
                        selectedMessage.id,
                        !selectedMessage.needs_response,
                      )
                    }
                    className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      selectedMessage.needs_response
                        ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700"
                    }`}
                    title={
                      selectedMessage.needs_response
                        ? "Mark as Resolved"
                        : "Mark as Pending Response"
                    }
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    {selectedMessage.needs_response
                      ? "Pending Action"
                      : "Resolved"}
                  </button>

                  <button
                    onClick={() => handleArchiveMessage(selectedMessage.id)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition-all"
                    title="Archive conversation"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {selectedMessage.channel === "email" &&
                selectedMessage.from_address && (
                  <div className="px-4 pt-3">
                    <EmailLeadInsightPanel
                      from={selectedMessage.from_address}
                      subject={selectedMessage.subject}
                      compact
                    />
                  </div>
                )}

              {/* Main Area: Message Display & AI Panel */}
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Message Thread Scroll Area */}
                <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6 min-w-0 custom-scrollbar">
                  {selectedThreadMessages.map((threadMsg, idx) => (
                    <div key={threadMsg.id || idx} className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-teal-400 font-bold text-sm shrink-0 border border-slate-700">
                        {threadMsg.from_name?.[0] ||
                          threadMsg.from_address?.[0] ||
                          "C"}
                      </div>
                      <div className="flex-1 min-w-0 bg-slate-900/40 border border-slate-800 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">
                              {threadMsg.from_name || threadMsg.from_address}
                            </span>
                            {threadMsg.direction === "outbound" && (
                              <span className="text-[10px] bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded font-mono uppercase">
                                Sent
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 font-mono">
                            {threadMsg.received_at || threadMsg.sent_at
                              ? new Date(
                                  threadMsg.received_at || threadMsg.sent_at!,
                                ).toLocaleString()
                              : ""}
                          </span>
                        </div>
                        <div className="text-sm text-slate-200 leading-7 whitespace-pre-wrap break-words">
                          {threadMsg.body}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Reply drafting interface */}
                  <div
                    id="inbox-reply-compose"
                    className="mt-8 pt-6 border-t border-slate-800 space-y-4 scroll-mt-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CornerUpLeft className="w-3.5 h-3.5" />
                        Compose Response
                      </span>
                      <button
                        onClick={handleGenerateAIDraft}
                        disabled={draftingReply}
                        className="px-3 py-1.5 bg-teal-500/15 hover:bg-teal-500/25 disabled:opacity-50 text-teal-400 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-teal-500/20 transition-all"
                      >
                        {draftingReply ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        Generate AI Draft
                      </button>
                    </div>

                    {selectedMessage.channel === "email" &&
                      providerOptions.some((p) => p.connected) && (
                        <EmailProviderSelector
                          value={deliveryProvider}
                          onChange={setDeliveryProvider}
                          providers={providerOptions}
                          compact
                        />
                      )}

                    {selectedMessage.channel === "email" && (
                      <input
                        type="text"
                        value={replySubject}
                        onChange={(e) => setReplySubject(e.target.value)}
                        placeholder="Email subject"
                        className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-teal-500"
                      />
                    )}

                    {/* Optional instruction input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add instructions for draft (e.g. 'say yes, book for Friday at 3pm')"
                        value={customReplyPrompt}
                        onChange={(e) => setCustomReplyPrompt(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <textarea
                      rows={8}
                      value={draftReplyText}
                      onChange={(e) => setDraftReplyText(e.target.value)}
                      placeholder="AI draft or manual message response..."
                      className="w-full min-h-48 px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-sm leading-6 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 resize-y"
                    />

                    <div className="flex justify-end gap-2">
                      {draftReplyText && (
                        <button
                          onClick={() => setDraftReplyText("")}
                          className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-400 rounded-xl text-xs font-semibold"
                        >
                          Clear Draft
                        </button>
                      )}
                      {selectedMessage.channel === "email" &&
                        draftReplyText && (
                          <button
                            onClick={handleSaveDraftToMailbox}
                            disabled={savingDraft}
                            className="px-4 py-2 border border-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-semibold disabled:opacity-40"
                          >
                            {savingDraft ? "Saving…" : "Save to Drafts"}
                          </button>
                        )}
                      <button
                        onClick={handleSendReply}
                        disabled={!draftReplyText.trim() || sendingReply}
                        className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-teal-500/10"
                      >
                        {sendingReply ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        {sendingReply ? "Sending..." : "Send Response"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sidebar AI Intelligence Panel */}
                <div className="hidden 2xl:block w-80 border-l border-slate-800 bg-slate-900/30 p-4 space-y-6 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Brain className="w-4 h-4 text-violet-400 animate-pulse" />
                      AI Copilot Intelligence
                    </h4>
                    <button
                      onClick={handleProcessIntelligence}
                      disabled={processingIntelligence}
                      className="p-1 hover:bg-slate-850 rounded text-slate-500 hover:text-white transition-colors"
                      title="Run AI Triage analysis"
                    >
                      {processingIntelligence ? (
                        <Loader2 className="w-3 h-3 animate-spin text-teal-400" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  {/* Intent Summary */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-500">
                      Extracted Intent
                    </span>
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 text-xs text-slate-300 leading-relaxed font-semibold">
                      {selectedMessage.intent ||
                        "Classification pending. Click refresh above to analyze."}
                    </div>
                  </div>

                  {/* AI Sentiment Analysis */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-500">
                      Sentiment Rating
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {getSentimentEmoji(selectedMessage.sentiment)}
                      </span>
                      <span className="text-xs font-bold text-slate-300 capitalize">
                        {selectedMessage.sentiment || "neutral"}
                      </span>
                    </div>
                  </div>

                  {/* Priority / Response urgencies */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-500">
                      Priority Tier
                    </span>
                    <div>
                      <span
                        className={`inline-block text-[10px] font-black uppercase tracking-widest border px-3 py-1 rounded-full ${getPriorityStyle(selectedMessage.priority)}`}
                      >
                        {selectedMessage.priority || "normal"}
                      </span>
                    </div>
                  </div>

                  {/* Recommended Next Action */}
                  {selectedMessage.metadata?.suggested_action && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase text-slate-500">
                        AI Suggested Next Action
                      </span>
                      <div className="p-3 bg-teal-500/5 text-teal-300 rounded-xl border border-teal-500/10 text-xs leading-relaxed flex gap-2">
                        <ArrowRight className="w-4 h-4 flex-shrink-0 text-teal-400 mt-0.5" />
                        <p>{selectedMessage.metadata.suggested_action}</p>
                      </div>
                    </div>
                  )}

                  {/* Summary block */}
                  {selectedMessage.metadata?.summary && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase text-slate-500">
                        Executive Summary
                      </span>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {selectedMessage.metadata.summary}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <Inbox className="w-12 h-12 mb-4 text-slate-700 animate-pulse" />
              <p className="font-semibold text-lg text-white mb-1">
                Select a message
              </p>
              <p className="text-sm max-w-sm">
                Pick any conversation from the list to respond or view smart
                intelligence triage.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { SiOpenai, SiAnthropic } from "react-icons/si";
import { 
  MessageSquareText, 
  Database, 
  Send, 
  Calendar, 
  FolderKanban, 
  FileText, 
  ReceiptText, 
  WalletCards, 
  ArrowRight, 
  Braces,
  CheckCircle2
} from "lucide-react";

interface AiClient {
  id: string;
  name: string;
  badge: string;
  icon: React.ElementType;
  iconColor: string;
  prompt: string;
  targetModules: string[];
}

interface ExecutionModule {
  id: string;
  name: string;
  detail: string;
  icon: React.ElementType;
  color: string;
  liveStatus: string;
}

const AI_CLIENTS: AiClient[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    badge: "OpenAI Interface",
    icon: SiOpenai,
    iconColor: "var(--logo-openai)",
    prompt: "Show me the customers that need follow-up today.",
    targetModules: ["crm", "outreach", "calendar"],
  },
  {
    id: "claude",
    name: "Claude",
    badge: "Anthropic Interface",
    icon: SiAnthropic,
    iconColor: "var(--warning-600)",
    prompt: "Review these opportunities and tell me which need attention.",
    targetModules: ["projects", "documents", "crm"],
  },
  {
    id: "manus",
    name: "Manus",
    badge: "Autonomous Agent",
    icon: MessageSquareText,
    iconColor: "var(--info-500)",
    prompt: "Find 20 leads, create CRM records and prepare outreach.",
    targetModules: ["crm", "outreach", "invoices", "money"],
  },
];

const MODULES: ExecutionModule[] = [
  { id: "crm", name: "CRM & Leads", detail: "Customer history & context", icon: Database, color: "var(--warning-500)", liveStatus: "Connected" },
  { id: "outreach", name: "Email Outreach", detail: "Outlook 365 & Gmail sync", icon: Send, color: "var(--logo-microsoft)", liveStatus: "Auto Draft" },
  { id: "calendar", name: "Calendar", detail: "Cal.com scheduling", icon: Calendar, color: "var(--ws-panel)", liveStatus: "Live Sync" },
  { id: "projects", name: "Projects & Tasks", detail: "Milestones & client delivery", icon: FolderKanban, color: "var(--brand-violet-400)", liveStatus: "In Progress" },
  { id: "documents", name: "Documents", detail: "Proposals & contracts", icon: FileText, color: "var(--logo-google-green)", liveStatus: "Attached" },
  { id: "invoices", name: "Invoices", detail: "Automated billing", icon: ReceiptText, color: "var(--warning-500)", liveStatus: "Auto Generated" },
  { id: "money", name: "Payments", detail: "Stripe & revenue sync", icon: WalletCards, color: "var(--logo-stripe)", liveStatus: "Settled" },
];

export default function AiInterfaceShowcase() {
  const [activeClient, setActiveClient] = useState<string>("chatgpt");
  const currentClient = AI_CLIENTS.find((c) => c.id === activeClient) || AI_CLIENTS[0];

  return (
    <div className="mx-auto max-w-6xl px-2 sm:px-4">
      {/* Header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-1 type-caption font-bold text-cyan-300 shadow-sm backdrop-blur-md">
          <Braces className="h-3.5 w-3.5 text-cyan-600" aria-hidden="true" />
          <span>Universal AI Interface Layer</span>
        </div>
        <h2 className="mt-3 font-marketing-heading text-2xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
          Work from the <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">AI interface</span> you already prefer.
        </h2>
        <p className="mt-3 type-card-description leading-6 text-[var(--ws-text-secondary)] sm:text-base">
          ChatGPT, Claude, and Manus act as natural conversational interfaces into AlphaClone — while AlphaClone supplies the underlying business context, tools, permissions, and execution layer underneath.
        </p>
      </div>

      {/* Main Orchestration Grid */}
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_auto_1.2fr_auto_1.3fr] lg:items-center">
        {/* Column 1: AI Interfaces */}
        <div className="space-y-3">
          <p className="type-caption font-black uppercase tracking-caps text-[var(--ws-text-muted)] px-1">
            01. Choose AI Interface
          </p>
          {AI_CLIENTS.map((client) => {
            const Icon = client.icon;
            const isSelected = client.id === activeClient;
            return (
              <button
                key={client.id}
                type="button"
                onClick={() => setActiveClient(client.id)}
                className={`group relative flex w-full flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-300 ${
                  isSelected
                    ? "border-emerald-400/50 bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-[var(--brand-violet-950)] shadow-xl shadow-emerald-950/40 scale-[1.02]"
                    : "border-white/10 bg-[var(--brand-violet-950)]/80 hover:border-white/20 hover:bg-[var(--ws-panel)]/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-[var(--ws-canvas)] shadow-md">
                      <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" style={{ color: client.iconColor }} />
                    </div>
                    <div>
                      <h4 className="type-ui font-extrabold text-white group-hover:text-cyan-200">{client.name}</h4>
                      <p className="type-caption font-medium text-[var(--ws-text-muted)]">{client.badge}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-[var(--success-500)]/20 px-2 py-0.5 type-ui font-extrabold text-[var(--success-text,var(--success-500))]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--success-500)] animate-pulse" />
                      Active Prompt
                    </span>
                  )}
                </div>

                <div className="mt-3 rounded-xl border border-white/[.07] bg-[var(--ws-canvas)]/80 p-2.5">
                  <p className="type-card-description italic text-[var(--ws-text-secondary)]">“{client.prompt}”</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Dynamic Connector Arrow 1 */}
        <div className="hidden lg:flex flex-col items-center justify-center">
          <div className="h-12 w-0.5 bg-gradient-to-b from-transparent via-cyan-400 to-transparent animate-pulse" />
          <ArrowRight className="h-6 w-6 text-cyan-400 animate-bounce" />
          <div className="h-12 w-0.5 bg-gradient-to-b from-transparent via-cyan-400 to-transparent animate-pulse" />
        </div>

        {/* Column 2: Central AlphaClone Core Engine */}
        <div className="relative group">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-500/30 via-teal-500/30 to-cyan-500/30 blur-xl opacity-80 group-hover:opacity-100 transition duration-500 pointer-events-none" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-2xl border border-cyan-400/40 bg-gradient-to-b from-[var(--brand-violet-950)] via-[var(--brand-violet-950)] to-[var(--brand-violet-950)] p-6 text-center shadow-2xl shadow-cyan-950/50 backdrop-blur-xl">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-cyan-400/40 bg-cyan-400/10 text-cyan-300 shadow-lg shadow-cyan-400/20">
              <Database className="h-7 w-7 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12" />
            </div>

            <h3 className="mt-4 text-xl font-black text-white">AlphaClone OS</h3>
            <p className="mt-1 type-card-description font-bold text-cyan-200">Context + Permission + Execution</p>

            <div className="mt-5 space-y-2 border-t border-cyan-400/20 pt-4 text-left">
              {[
                ["Single Source of Truth", "All customer records unified"],
                ["Granular Guardrails", "Human approval required for high risk"],
                ["Full Audit Trail", "Every API call logged & verified"],
              ].map(([t, d]) => (
                <div key={t} className="flex items-center gap-2 rounded-lg border border-white/[.06] bg-[var(--ws-panel)]/60 p-2 type-caption">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <div>
                    <p className="font-bold text-white type-card-description">{t}</p>
                    <p className="type-card-description text-[var(--ws-text-muted)]">{d}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-emerald-400/30 bg-[var(--success-500)]/10 p-2 text-center type-ui font-extrabold text-[var(--success-text,var(--success-500))]">
              Live sync with {currentClient.name}
            </div>
          </div>
        </div>

        {/* Dynamic Connector Arrow 2 */}
        <div className="hidden lg:flex flex-col items-center justify-center">
          <div className="h-12 w-0.5 bg-gradient-to-b from-transparent via-emerald-400 to-transparent animate-pulse" />
          <ArrowRight className="h-6 w-6 text-emerald-400 animate-bounce" />
          <div className="h-12 w-0.5 bg-gradient-to-b from-transparent via-emerald-400 to-transparent animate-pulse" />
        </div>

        {/* Column 3: Connected Business Execution Modules */}
        <div className="space-y-2">
          <p className="type-caption font-black uppercase tracking-caps text-[var(--ws-text-muted)] px-1">
            03. Executed Systems & Tools
          </p>
          <div className="grid grid-cols-1 gap-2">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              const isTargeted = currentClient.targetModules.includes(mod.id);
              return (
                <div
                  key={mod.id}
                  className={`group flex items-center justify-between rounded-xl border p-2.5 transition-all duration-300 ${
                    isTargeted
                      ? "border-emerald-400/50 bg-[var(--ws-panel)]/90 shadow-md shadow-emerald-950/30 translate-x-1"
                      : "border-white/10 bg-[var(--brand-violet-950)]/70 opacity-70 hover:opacity-100 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-[var(--ws-canvas)]">
                      <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-125" style={{ color: mod.color }} />
                    </div>
                    <div>
                      <p className={`type-card-description font-extrabold ${isTargeted ? "text-white" : "text-[var(--ws-text-secondary)]"}`}>{mod.name}</p>
                      <p className="type-card-description text-[var(--ws-text-muted)]">{mod.detail}</p>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 type-ui font-extrabold ${
                      isTargeted
                        ? "border border-emerald-400/40 bg-[var(--success-500)]/20 text-[var(--success-text,var(--success-500))] animate-pulse"
                        : "border border-[var(--ws-border)] bg-[var(--ws-panel)] text-[var(--ws-text-muted)]"
                    }`}
                  >
                    {mod.liveStatus}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

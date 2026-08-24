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
  CheckCircle2,
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
    iconColor: "#10a37f",
    prompt: "Show me the customers that need follow-up today.",
    targetModules: ["crm", "outreach", "calendar"],
  },
  {
    id: "claude",
    name: "Claude",
    badge: "Anthropic Interface",
    icon: SiAnthropic,
    iconColor: "#d97706",
    prompt: "Review these opportunities and tell me which need attention.",
    targetModules: ["projects", "documents", "crm"],
  },
  {
    id: "manus",
    name: "Manus",
    badge: "Autonomous Agent",
    icon: MessageSquareText,
    iconColor: "#06b6d4",
    prompt: "Find 20 leads, create CRM records and prepare outreach.",
    targetModules: ["crm", "outreach", "invoices", "money"],
  },
];

const MODULES: ExecutionModule[] = [
  { id: "crm", name: "CRM & Leads", detail: "Customer history & context", icon: Database, color: "#f6c344", liveStatus: "Connected" },
  { id: "outreach", name: "Email Outreach", detail: "Outlook 365 & Gmail sync", icon: Send, color: "#0078d4", liveStatus: "Auto Draft" },
  { id: "calendar", name: "Calendar", detail: "Calendly meeting bookings", icon: Calendar, color: "#006bfc", liveStatus: "Live Sync" },
  { id: "projects", name: "Projects & Tasks", detail: "Milestones & client delivery", icon: FolderKanban, color: "#a855f7", liveStatus: "In Progress" },
  { id: "documents", name: "Documents", detail: "Proposals & contracts", icon: FileText, color: "#34a853", liveStatus: "Attached" },
  { id: "invoices", name: "Invoices", detail: "Automated billing", icon: ReceiptText, color: "#f59e0b", liveStatus: "Auto Generated" },
  { id: "money", name: "Payments", detail: "Stripe & revenue sync", icon: WalletCards, color: "#635bff", liveStatus: "Settled" },
];

export default function AiInterfaceShowcase() {
  const [activeClient, setActiveClient] = useState<string>("chatgpt");
  const currentClient = AI_CLIENTS.find((c) => c.id === activeClient) || AI_CLIENTS[0];

  return (
    <div className="mx-auto max-w-6xl px-2 sm:px-4">
      {/* Header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 px-3.5 py-1 text-xs font-semibold text-slate-300">
          <span>Universal AI Interface Layer</span>
        </div>
        <h2 className="mt-3 font-marketing-heading text-2xl font-extrabold leading-tight text-white sm:text-4xl lg:text-[42px]">
          Work from the AI interface you already prefer.
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
          ChatGPT, Claude, and Manus act as natural conversational interfaces into AlphaClone — while AlphaClone supplies the underlying business context, tools, permissions, and execution layer underneath.
        </p>
      </div>

      {/* Main Orchestration Grid */}
      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.1fr_1fr] lg:items-start">
        {/* Column 1: AI Interfaces */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-slate-400 px-1">
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
                className={`group relative flex w-full flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 ${
                  isSelected
                    ? "border-slate-700 bg-slate-900/70 scale-[1.01]"
                    : "border-slate-800 bg-[#030a17]/80 hover:border-slate-700 hover:bg-slate-900/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg border border-slate-800 bg-slate-950">
                      <Icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" style={{ color: client.iconColor }} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{client.name}</h4>
                      <p className="text-[10px] font-medium text-slate-400">{client.badge}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[9px] font-semibold text-slate-200">
                      Active Prompt
                    </span>
                  )}
                </div>

                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/80 p-2.5">
                  <p className="text-xs italic text-slate-300">“{client.prompt}”</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Column 2: Central AlphaClone Core Engine */}
        <div className="relative group order-first lg:order-none">
          <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-[#020815] p-6 text-center shadow-2xl shadow-slate-950/40">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300">
              <Database className="h-7 w-7" />
            </div>

            <h3 className="mt-4 text-xl font-bold text-white">AlphaClone OS</h3>
            <p className="mt-1 text-xs font-semibold text-slate-300">Context + Permission + Execution</p>

            <div className="mt-5 space-y-2 border-t border-slate-800 pt-4 text-left">
              {[
                ["Single Source of Truth", "All customer records unified"],
                ["Granular Guardrails", "Human approval required for high risk"],
                ["Full Audit Trail", "Every API call logged & verified"],
              ].map(([t, d]) => (
                <div key={t} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <div>
                    <p className="font-bold text-white text-[11px]">{t}</p>
                    <p className="text-[10px] text-slate-400">{d}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-center text-[10px] font-semibold text-slate-300">
              Interfacing with {currentClient.name}
            </div>
          </div>
        </div>

        {/* Column 3: Connected Business Execution Modules */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-slate-400 px-1">
            03. Executed Systems & Tools
          </p>
          <div className="grid grid-cols-1 gap-2">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              const isTargeted = currentClient.targetModules.includes(mod.id);
              return (
                <div
                  key={mod.id}
                  className={`group flex items-center justify-between rounded-lg border p-2.5 transition-all duration-200 ${
                    isTargeted
                      ? "border-slate-700 bg-slate-900/80"
                      : "border-slate-800 bg-[#020815]/70 opacity-70 hover:opacity-100 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-md border border-slate-800 bg-slate-950">
                      <Icon className="h-4 w-4 transition-transform duration-200" style={{ color: mod.color }} />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${isTargeted ? "text-white" : "text-slate-300"}`}>{mod.name}</p>
                      <p className="text-[10px] text-slate-400">{mod.detail}</p>
                    </div>
                  </div>

                  <span
                    className={`rounded-md px-2 py-0.5 text-[9px] font-semibold ${
                      isTargeted
                        ? "border border-slate-700 bg-slate-800 text-slate-200"
                        : "border border-slate-800 bg-slate-900 text-slate-500"
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

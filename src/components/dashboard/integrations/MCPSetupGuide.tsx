'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, Copy, ChevronRight, Download, Monitor,
  FileText, Zap, ArrowRight, Sparkles, Lock, Shield,
  MessageSquare, Users, TrendingUp, ClipboardList, Bot,
  ExternalLink, Info, DollarSign, Briefcase, Star, Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';
import { MCPAuthService } from '@/services/mcp/MCPAuthService';
import { supabase } from '@/lib/supabase';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import EnterpriseDPA from './EnterpriseDPA';

// ── What Claude / Manus can do when connected ─────────────────────────────────
const CLAUDE_CAPABILITIES = [
  { icon: Users, title: 'Add & Qualify Leads', desc: '"Add Sarah from TechCorp as a lead and mark her as qualified" — it\'s in CRM instantly.' },
  { icon: Search, title: 'Search Your CRM', desc: '"Show me all new leads from this week" or "Which leads are still uncontacted?" — instant answers.' },
  { icon: Briefcase, title: 'Manage Deals', desc: '"Create a deal for £5,000 with Acme Ltd at the proposal stage" — pipeline updated.' },
  { icon: ClipboardList, title: 'Schedule Tasks', desc: '"Create a follow-up call with John for Friday at 2pm, high priority" — it appears immediately.' },
  { icon: TrendingUp, title: 'Revenue & Invoices', desc: '"How much is outstanding this month?" or "What\'s my total paid revenue?" — real-time data.' },
  { icon: MessageSquare, title: 'Read Messages', desc: '"What are my latest client messages?" — Claude reads and summarises them for you.' },
  { icon: FileText, title: 'Draft Contracts', desc: '"Draft an NDA for client Acme Ltd, 12-month term, mutual confidentiality" — saved to Contracts.' },
  { icon: DollarSign, title: 'Log Expenses', desc: '"Log a $49 expense for Notion subscription under Software" — saved to Accounting.' },
  { icon: Star, title: 'View Quotes & Projects', desc: '"Which quotes are waiting for a response?" or "Update the XYZ project to complete".' },
];

// ── Setup steps (plain English) ────────────────────────────────────────────────
const SETUP_STEPS = [
  {
    number: 1,
    emoji: '💻',
    title: 'Download Claude on your computer',
    body: 'Claude is a smart AI assistant made by a company called Anthropic. You need to download the Claude app to your Mac or Windows PC — it\'s free. Think of it like downloading WhatsApp, but for your desktop.',
    action: {
      label: 'Download Claude Desktop (Free)',
      url: 'https://claude.ai/download',
    },
  },
  {
    number: 2,
    emoji: '🔑',
    title: 'Copy your personal connection key below',
    body: 'Every user gets a unique connection key. This is like a secret password that tells Claude "this is MY AlphaClone account." Copy it — you\'ll need it in the next step.',
    isCopyStep: true,
  },
  {
    number: 3,
    emoji: '📄',
    title: 'Open a special settings file on your computer',
    body: 'Claude has a hidden settings file on your computer. You need to open it and paste your key in. Don\'t worry — we\'ll give you the exact text to copy. You don\'t need to understand it.',
    subSteps: [
      { platform: 'Mac', path: '~/Library/Application Support/Claude/claude_desktop_config.json' },
      { platform: 'Windows', path: '%APPDATA%\\Claude\\claude_desktop_config.json' },
    ],
  },
  {
    number: 4,
    emoji: '📋',
    title: 'Paste this text into that file',
    body: 'Open the file, delete everything in it, and paste the text below. Then save the file.',
    isConfigStep: true,
  },
  {
    number: 5,
    emoji: '🔄',
    title: 'Restart Claude',
    body: 'Close the Claude app completely and open it again. This makes Claude load your new settings. It\'s like turning your phone off and on again.',
  },
  {
    number: 6,
    emoji: '🎉',
    title: 'You\'re done! Try talking to Claude',
    body: 'Open Claude and type: "Show me my latest leads." Claude will connect to your AlphaClone account and show you the answer. No more switching between apps!',
    testPrompts: [
      '"Add a new lead called Jane Smith from Acme Ltd"',
      '"What tasks do I have to do today?"',
      '"How much revenue is outstanding this month?"',
      '"Show me my latest projects"',
    ],
  },
];

type McpSetupType = 'claude' | 'manus' | 'grok' | 'chatgpt';

/** Platform OAuth client IDs — same for all AlphaClone users; copy into connector settings. */
const MCP_OAUTH_PLATFORM_CONFIG: Record<
  McpSetupType,
  { title: string; clientId: string; scopes: string; hint: string }
> = {
  claude: {
    title: 'Claude OAuth Credentials',
    clientId: '1778309945386-41bab8272f61',
    scopes: 'read write mcp:tools mcp:resources openid profile',
    hint: 'In Claude.ai → Settings → Connectors → MCP, paste Client ID when the connector asks for OAuth credentials.',
  },
  grok: {
    title: 'Grok OAuth Credentials',
    clientId: 'grok-connector',
    scopes: 'read write mcp:tools mcp:resources',
    hint: 'In Grok → Settings → MCP / Connectors, paste Client ID when OAuth is requested.',
  },
  chatgpt: {
    title: 'ChatGPT OAuth Credentials',
    clientId: 'chatgpt-connector',
    scopes: 'read write mcp:tools mcp:resources',
    hint: 'In ChatGPT → Settings → Connectors → MCP, paste Client ID if the form asks for one (OAuth sign-in is usually automatic).',
  },
  manus: {
    title: 'Manus OAuth Credentials',
    clientId: 'manus-ai',
    scopes: 'read write mcp:tools mcp:resources',
    hint: 'In Manus → MCP / Tools settings, paste Client ID when connecting via OAuth.',
  },
};

function CopyableCredentialRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase font-bold mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[11px] text-teal-300 bg-black/30 p-1.5 rounded break-all border border-slate-700/50">
          {value}
        </code>
        <button
          type="button"
          onClick={() => onCopy(value, label)}
          className="p-1.5 hover:text-teal-400 transition-colors shrink-0"
          aria-label={`Copy ${label}`}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function McpOAuthCredentialsPanel({
  setupType,
  mcpOrigin,
  onCopy,
}: {
  setupType: McpSetupType;
  mcpOrigin: string;
  onCopy: (text: string, label: string) => void;
}) {
  const config = MCP_OAUTH_PLATFORM_CONFIG[setupType];
  const serverUrl = `${mcpOrigin}/api/mcp`;
  const authUrl = `${mcpOrigin}/api/mcp/authorize`;
  const tokenUrl = `${mcpOrigin}/api/mcp/token`;

  return (
    <div className="mb-6 p-5 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-4">
      <div>
        <p className="text-sm font-bold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-teal-400" />
          {config.title}
        </p>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{config.hint}</p>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          <span className="text-slate-400 font-medium">Note:</span> Client ID identifies the AI app to AlphaClone — it is not your personal API key. Your personal connection key is shown in Step 2 below.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CopyableCredentialRow label="Client ID" value={config.clientId} onCopy={onCopy} />
        <CopyableCredentialRow label="Scopes" value={config.scopes} onCopy={onCopy} />
        <div className="md:col-span-2">
          <CopyableCredentialRow label="MCP Server URL" value={serverUrl} onCopy={onCopy} />
        </div>
        <div className="md:col-span-2">
          <CopyableCredentialRow label="Authorization Endpoint" value={authUrl} onCopy={onCopy} />
        </div>
        <div className="md:col-span-2">
          <CopyableCredentialRow label="Token Endpoint" value={tokenUrl} onCopy={onCopy} />
        </div>
      </div>
    </div>
  );
}

/** Paste at the start of a session so the AI uses AlphaClone MCP correctly. */
const MCP_MASTER_INSTRUCTION = `You are connected to my AlphaClone business workspace via MCP. Use AlphaClone tools for CRM, leads, deals, tasks, invoices, contracts, and messages — do not guess or make up data.

Rules:
1. Before creating records, search for duplicates (same email, company, or name).
2. Confirm destructive actions (delete, close deal, mark paid) before executing.
3. Summarize what you changed after each action (what was created/updated and IDs if returned).
4. If a tool fails, tell me the error and suggest one fix — do not retry blindly.
5. Keep responses concise: bullet lists for data, short paragraphs for recommendations.

When I ask about "my business", pull live data from AlphaClone first, then answer.`;

const MCP_BUSINESS_PROMPT_GROUPS: {
  title: string;
  description: string;
  prompts: string[];
}[] = [
  {
    title: 'Verify connection',
    description: 'Run these first to confirm MCP is working.',
    prompts: [
      'Using AlphaClone, give me a quick snapshot of my workspace: open leads count, active deals, tasks due today, and outstanding invoice total.',
      'List my 5 most recent leads and tell me which ones have no follow-up task scheduled.',
    ],
  },
  {
    title: 'Daily check-in',
    description: 'Morning routine — copy one prompt each day.',
    prompts: [
      'Good morning. Review my AlphaClone workspace and give me today\'s priorities: overdue tasks, stale leads (no contact in 7+ days), deals stuck in the same stage, and unpaid invoices.',
      'What happened in my CRM since yesterday? Summarize new leads, deal stage changes, and messages I should reply to.',
    ],
  },
  {
    title: 'Leads & CRM',
    description: 'Add, search, and qualify prospects.',
    prompts: [
      'Search AlphaClone for leads matching "Acme". If none exist, create a lead: Jane Smith, jane@acme.com, Acme Ltd, source: referral, notes: met at conference.',
      'Show all new uncontacted leads. For each one, suggest a short outreach message I can send today.',
      'Find leads with no activity in the last 14 days and create a high-priority follow-up task for each (due tomorrow).',
    ],
  },
  {
    title: 'Deals & pipeline',
    description: 'Move opportunities through your pipeline.',
    prompts: [
      'List my open deals by stage with total value per stage. Flag any deal over 30 days in the same stage.',
      'Create a deal for Acme Ltd: £5,000, stage proposal, linked to the Acme lead if it exists. Add a task to send the proposal by Friday.',
      'Which deals are most likely to close this month based on stage and last activity? Recommend next actions for the top 3.',
    ],
  },
  {
    title: 'Tasks & follow-ups',
    description: 'Stay on top of work without switching apps.',
    prompts: [
      'Show my open tasks sorted by due date. Group by overdue, today, and this week.',
      'Create a task: "Call John re: proposal" — high priority, due tomorrow, linked to the Acme deal if it exists.',
      'After every sales call I describe, create the follow-up task and log a brief activity note in AlphaClone.',
    ],
  },
  {
    title: 'Revenue & invoices',
    description: 'Cash flow and billing questions.',
    prompts: [
      'What is my total outstanding invoice amount and which clients owe the most?',
      'List invoices overdue by more than 14 days. Draft a polite payment reminder I can send for each.',
      'Summarize paid vs unpaid revenue this month from AlphaClone.',
    ],
  },
  {
    title: 'Contracts & documents',
    description: 'Draft and track agreements.',
    prompts: [
      'Draft a mutual NDA for Acme Ltd: 12-month term, standard confidentiality clauses. Save it to my AlphaClone contracts.',
      'List contracts waiting for signature or review and what I need to do next on each.',
    ],
  },
  {
    title: 'Support & operations',
    description: 'Tickets and team coordination.',
    prompts: [
      'Show open support tickets by priority. Summarize the oldest unresolved ones.',
      'Create a support ticket: "Billing question — invoice #12345" — category billing, priority medium.',
    ],
  },
];

function McpBusinessPromptPlaybook({
  agentLabel,
  onCopy,
}: {
  agentLabel: string;
  onCopy: (text: string, label: string) => void;
}) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>('Verify connection');

  return (
    <div className="mb-8 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/5 to-slate-900/40 overflow-hidden">
      <div className="p-5 border-b border-amber-500/15">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-bold text-white">Business prompt playbook</h2>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed">
          Copy these prompts into {agentLabel} after MCP is connected. Edit names, amounts, and dates for your business — the structure helps {agentLabel} use AlphaClone tools correctly.
        </p>
      </div>

      <div className="p-5 space-y-4 border-b border-slate-800/60">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-400/90 mb-1">
            Master instruction (paste once per session)
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Send this first so {agentLabel} knows how to work with your AlphaClone data.
          </p>
          <div className="relative">
            <pre className="p-4 pr-12 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
              {MCP_MASTER_INSTRUCTION}
            </pre>
            <button
              type="button"
              onClick={() => onCopy(MCP_MASTER_INSTRUCTION, 'Master instruction')}
              className="absolute top-3 right-3 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              aria-label="Copy master instruction"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-800/60">
        {MCP_BUSINESS_PROMPT_GROUPS.map((group) => {
          const isOpen = expandedGroup === group.title;
          return (
            <div key={group.title}>
              <button
                type="button"
                onClick={() => setExpandedGroup(isOpen ? null : group.title)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-800/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{group.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{group.description}</p>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 space-y-2">
                  {group.prompts.map((prompt) => (
                    <div
                      key={prompt}
                      className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800"
                    >
                      <MessageSquare className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                      <p className="flex-1 text-sm text-slate-300 leading-relaxed">{prompt}</p>
                      <button
                        type="button"
                        onClick={() => onCopy(prompt, group.title)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-teal-400 transition-colors shrink-0"
                        aria-label="Copy prompt"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
interface MCPSetupGuideProps {
  initialType?: 'claude' | 'manus' | 'grok' | 'chatgpt';
}

const MCPSetupGuide: React.FC<MCPSetupGuideProps> = ({ initialType }) => {
  const currentTenant = useCurrentTenantSafe();
  const [setupType, setSetupType] = useState<'claude' | 'manus' | 'grok' | 'chatgpt'>(initialType ?? 'claude');
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [expandedStep, setExpandedStep] = useState<number>(1);
  const [connectionToken, setConnectionToken] = useState<string | null>(null);
  const [isDpaAccepted, setIsDpaAccepted] = useState<boolean>(true); // Default to true for non-enterprise
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Initialize setup type from prop, then URL param as fallback
  React.useEffect(() => {
    if (initialType) {
      setSetupType(initialType);
      return;
    }
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mcpParam = params.get('mcp');
      if (mcpParam === 'manus') {
        setSetupType('manus');
      } else if (mcpParam === 'claude') {
        setSetupType('claude');
      } else if (mcpParam === 'grok') {
        setSetupType('grok');
      } else if (mcpParam === 'chatgpt') {
        setSetupType('chatgpt');
      }
    }
  }, [initialType]);


  const isEnterprise = currentTenant?.subscription_plan === 'enterprise';
  const tenantId = currentTenant?.id ?? 'your-workspace-id';

  const mcpOrigin = (typeof window !== 'undefined' ? window.location.origin : 'https://alphaclonesystems.com')
    .replace('//www.', '//');

  const agentLabel =
    setupType === 'claude' ? 'Claude'
    : setupType === 'manus' ? 'Manus'
    : setupType === 'chatgpt' ? 'ChatGPT'
    : 'Grok';

  /** Single-query URL: tenant and user are resolved from the key server-side. */
  const buildConnectionUrl = (token: string | null) => {
    const path = (setupType === 'claude' || setupType === 'grok' || setupType === 'chatgpt') ? '/api/mcp' : '/api/mcp/sse';
    if (setupType === 'chatgpt') {
      return `${mcpOrigin}${path}`;
    }
    const params = new URLSearchParams({
      api_key: token || 'YOUR_KEY_HERE',
    });
    return `${mcpOrigin}${path}?${params.toString()}`;
  };

  // Auth + per-user MCP token (reloads when session or workspace changes)
  React.useEffect(() => {
    let cancelled = false;

    async function loadForUser(user: User | null) {
      setCurrentUser(user);

      if (tenantId === 'your-workspace-id' || !user?.id) {
        if (!cancelled) {
          setConnectionToken(null);
          setIsLoading(false);
        }
        return;
      }

      if (!cancelled) setIsLoading(true);
      try {
        const { token, error: tokenErr } = await MCPAuthService.getOrCreateToken(tenantId, user.id);
        if (tokenErr) console.error('MCP token:', tokenErr);
        if (!cancelled) setConnectionToken(token);

        if (isEnterprise) {
          const accepted = await MCPAuthService.isDPAAccepted(tenantId);
          if (!cancelled) setIsDpaAccepted(accepted);
        }
      } catch (err) {
        console.error('Failed to initialize MCP guide:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void supabase.auth
      .getUser()
      .then(({ data }: { data: { user: User | null } }) => loadForUser(data.user));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        void loadForUser(session?.user ?? null);
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [tenantId, isEnterprise]);

  const handleRotateToken = async () => {
    if (!currentUser?.id) {
      toast.error('You must be signed in to regenerate your connection key.');
      return;
    }
    if (!window.confirm('Are you sure? Your old connection key will stop working immediately.')) return;

    const { token, error } = await MCPAuthService.rotateToken(tenantId, currentUser.id);
    if (token) {
      setConnectionToken(token);
      toast.success('Connection key regenerated!');
    } else {
      toast.error(error || 'Failed to regenerate key');
    }
  };

  const connectionUrl = buildConnectionUrl(connectionToken);

  const configJson = `{
  "mcpServers": {
    "alphaclone": {
      "url": "${connectionUrl}"
    }
  }
}`;

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const markDone = (stepNum: number) => {
    setCompletedSteps(prev => new Set([...prev, stepNum]));
    setExpandedStep(stepNum + 1);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm animate-pulse">Preparing your secure connection keys...</p>
      </div>
    );
  }

  // Enforce DPA Gate for Enterprise
  if (isEnterprise && !isDpaAccepted && currentUser) {
    return (
      <div className="p-6">
        <EnterpriseDPA 
          tenantId={tenantId} 
          userId={currentUser.id} 
          onAccepted={() => setIsDpaAccepted(true)} 
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Hero Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-teal-500 flex items-center justify-center shadow-lg shadow-indigo-900/30">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Connect {setupType === 'claude' ? 'Claude' : setupType === 'manus' ? 'Manus' : setupType === 'chatgpt' ? 'ChatGPT' : 'Grok'} AI to Your Account</h1>
            <p className="text-slate-400 text-sm mt-0.5">Takes about 2 minutes. No tech skills needed.</p>
          </div>
        </div>

        {/* Setup Type Selector */}
        <div className="flex gap-2 mb-8 bg-slate-900/50 p-1 rounded-xl w-fit border border-slate-800">
          <button
            onClick={() => setSetupType('claude')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${setupType === 'claude' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Claude Desktop
          </button>
          <button
            onClick={() => setSetupType('manus')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${setupType === 'manus' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Manus AI
          </button>
          <button
            onClick={() => setSetupType('grok')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${setupType === 'grok' ? 'bg-fuchsia-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Grok AI
          </button>
          <button
            onClick={() => setSetupType('chatgpt')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${setupType === 'chatgpt' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            ChatGPT
          </button>
        </div>

        <McpOAuthCredentialsPanel setupType={setupType} mcpOrigin={mcpOrigin} onCopy={copyText} />

        {setupType === 'chatgpt' && (
          <div className="mb-6 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-slate-200 text-sm">
              In ChatGPT, go to <strong>Settings → Connectors → MCP</strong> and add the <strong>MCP Server URL</strong> from the OAuth credentials box above.
              When ChatGPT asks you to sign in, approve access on AlphaClone — your workspace is attached automatically.
            </p>
          </div>
        )}

        {setupType === 'claude' && (
          <div className="mb-6 p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
            <p className="text-slate-200 text-sm">
              <strong>Claude.ai web connector:</strong> use the OAuth credentials above (Client ID + MCP Server URL).
              <strong className="block mt-2">Claude Desktop:</strong> use your personal Connection URL in Step 2 (includes your API key).
            </p>
          </div>
        )}

        {/* What this does */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-teal-500/10 border border-indigo-500/20 mb-6">
          <p className="text-slate-200 text-sm leading-relaxed">
            <span className="text-white font-semibold">What does this do?</span> When you connect {agentLabel} to your AlphaClone account, you can just <span className="text-teal-400 font-medium">talk to your AI Agent</span> and it will update your CRM for you. No clicking through menus. No typing in forms. Just have a normal conversation, and your business data gets updated automatically.
          </p>
        </div>

        {/* Capabilities grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {CLAUDE_CAPABILITIES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-teal-400" />
                <span className="text-white text-sm font-semibold">{title}</span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Security note */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/20 mb-8">
          <Shield className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-green-300 text-sm font-semibold mb-1">Your data is safe</p>
            <p className="text-slate-400 text-xs leading-relaxed">{agentLabel} can only see YOUR business data. It cannot delete anything. It cannot access your passwords or payment details. It can only read and add things inside your AlphaClone workspace. Workspace and user IDs are injected automatically — you never pass tenant_id or user_id manually.</p>
          </div>
        </div>
      </div>

      <McpBusinessPromptPlaybook agentLabel={agentLabel} onCopy={copyText} />

      {/* Step-by-step guide */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-white mb-5">Step-by-step setup guide</h2>
        <div className="space-y-4">
          {SETUP_STEPS.filter(s => setupType === 'claude' || [1, 2, 3, 6].includes(s.number)).map((step, idx) => {
            const isWebAgent = setupType === 'manus' || setupType === 'grok' || setupType === 'chatgpt';
            const displayNum = idx + 1;
            const isDone = completedSteps.has(step.number);
            const isOpen = expandedStep === step.number;

            // Adjust title/body/action for Manus
            const stepTitle = isWebAgent
              ? step.number === 1 ? `Open ${agentLabel}`
              : step.number === 2 ? (setupType === 'chatgpt' ? 'Copy your MCP Server URL' : 'Copy your Connection URL')
              : step.number === 3 ? (setupType === 'chatgpt' ? 'Add AlphaClone connector in ChatGPT' : `Add AlphaClone to ${agentLabel} MCP Settings`)
              : 'Test your connection'
              : step.title;

            const stepBody = isWebAgent
              ? step.number === 1 ? `Open ${agentLabel} and sign in to your account.`
              : step.number === 2 ? (setupType === 'chatgpt'
                ? 'Copy your MCP Server URL below (no API key in the URL — ChatGPT uses OAuth). When you approve access, your workspace and user are attached automatically.'
                : `Copy your unique Connection URL below. This is what tells ${agentLabel} which AlphaClone account to connect to. Keep it private.`)
              : step.number === 3 ? (setupType === 'chatgpt'
                ? 'In ChatGPT: Settings → Connectors → MCP → Add connector. Paste the MCP Server URL from Step 2. Choose OAuth when prompted, then sign in on the AlphaClone consent page with your connection key.'
                : `In your ${agentLabel} dashboard, go to Settings → MCP Servers (or Tools) → Add New Server. Set the name to "AlphaClone" and paste your Connection URL from Step 2. Save and confirm.`)
              : `In ${agentLabel}, start a new conversation and try one of these prompts to verify everything is connected:`
              : step.body;

            const actionLabel = isWebAgent && step.number === 1 ? `Open ${agentLabel}` : step.action?.label;
            const actionUrl = setupType === 'manus' && step.number === 1 ? 'https://manus.im'
              : setupType === 'grok' && step.number === 1 ? 'https://grok.com'
              : setupType === 'chatgpt' && step.number === 1 ? 'https://chatgpt.com'
              : step.action?.url;

            // For Manus: don't show the Claude config JSON or Mac/Windows file paths
            const showSubSteps = setupType === 'claude' && step.subSteps;
            const showConfigStep = setupType === 'claude' && step.isConfigStep;

            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border transition-all ${
                  isDone
                    ? 'border-teal-500/30 bg-teal-500/5'
                    : isOpen
                    ? 'border-indigo-500/40 bg-slate-900/80'
                    : 'border-slate-800 bg-slate-900/40'
                }`}
              >
                {/* Step header */}
                <button
                  onClick={() => setExpandedStep(isOpen ? 0 : step.number)}
                  className="w-full flex items-center gap-4 p-5 text-left"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                    isDone ? 'bg-teal-500/20' : isOpen ? (setupType === 'claude' ? 'bg-indigo-500/20' : 'bg-teal-500/20') : 'bg-slate-800'
                  }`}>
                    {isDone ? <CheckCircle className="w-5 h-5 text-teal-400" /> : step.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">STEP {displayNum}</span>
                      {isDone && <span className="text-xs text-teal-400 font-semibold">✓ Done</span>}
                    </div>
                    <p className={`font-semibold text-sm mt-0.5 ${isDone ? 'text-teal-300' : 'text-white'}`}>{stepTitle}</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </button>

                {/* Step body */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 border-t border-slate-800/60">
                        <p className="text-slate-300 text-sm leading-relaxed mt-4 mb-4">{stepBody}</p>

                        {/* Download action */}
                        {step.action && (
                          <a
                            href={actionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all mb-4 ${setupType === 'claude' ? 'bg-indigo-600 hover:bg-indigo-500' : setupType === 'manus' ? 'bg-teal-600 hover:bg-teal-500' : 'bg-fuchsia-600 hover:bg-fuchsia-500'}`}
                          >
                            <Download className="w-4 h-4" />
                            {actionLabel}
                            <ExternalLink className="w-3 h-3 opacity-70" />
                          </a>
                        )}

                        {/* Copy key step */}
                        {step.isCopyStep && (
                          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 mb-4">
                            <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wider">Your Connection URL</p>
                            <div className="flex items-center gap-3">
                              <code className="flex-1 text-teal-400 text-xs font-mono break-all bg-black/40 p-2 rounded border border-slate-700">
                                {connectionToken ? connectionUrl : 'Loading your key...'}
                              </code>
                              <button
                                onClick={() => copyText(connectionToken ? connectionUrl : '', 'Connection URL')}
                                disabled={!connectionToken}
                                className="flex-shrink-0 p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all disabled:opacity-50"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-700/50">
                              <p className="text-xs text-slate-400 mb-2">
                                Need OAuth Client ID for a web connector? Copy from the <strong className="text-slate-300">OAuth credentials</strong> section at the top of this page.
                              </p>
                            </div>

                            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between pt-4 border-t border-slate-700/50">
                              <p className="text-xs text-slate-500 leading-relaxed">
                                <span className="text-amber-400 font-medium">Security warning:</span> This key grants AI agents read/write access to your CRM. Never share it publicly.
                              </p>
                              <button
                                onClick={handleRotateToken}
                                className="text-xs uppercase font-bold tracking-widest text-slate-500 hover:text-amber-400 transition-colors flex items-center gap-1.5"
                              >
                                <Lock className="w-3 h-3" />
                                Regenerate Key
                              </button>
                            </div>
                          </div>
                        )}

                        {/* File paths */}
                        {showSubSteps && (
                          <div className="space-y-2 mb-4">
                            <p className="text-slate-400 text-xs font-medium mb-2">Where to find the file on your computer:</p>
                            {step.subSteps.map(sub => (
                              <div key={sub.platform} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
                                <Monitor className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-slate-300 text-xs font-semibold">{sub.platform}: </span>
                                  <code className="text-teal-400 text-xs font-mono">{sub.path}</code>
                                </div>
                                <button
                                  onClick={() => copyText(sub.path, `${sub.platform} path`)}
                                  className="flex-shrink-0 p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-all"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                              💡 <span className="text-slate-400">Tip:</span> If you can't find the file, choose File Explorer (Windows) or Finder (Mac), press the keyboard shortcut to go to a folder, and paste the path above.
                            </p>
                          </div>
                        )}

                        {/* Config JSON copy */}
                        {showConfigStep && (
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Text to paste into the file:</p>
                              <button
                                onClick={() => copyText(configJson, 'Config text')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-all"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                Copy all
                              </button>
                            </div>
                            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-700 text-teal-400 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap">
                              {configJson}
                            </pre>
                            <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                              📝 <span className="text-slate-400">What to do:</span> Open the file, select all the text inside (Ctrl+A or Cmd+A), delete it, then paste this text. Save the file (Ctrl+S or Cmd+S).
                            </p>
                          </div>
                        )}

                        {/* Test prompts */}
                        {(step.testPrompts || ((setupType === 'manus' || setupType === 'grok' || setupType === 'chatgpt') && step.number === 6)) && (
                          <div className="mb-4">
                            <p className="text-slate-400 text-xs font-medium mb-3">
                              Quick test — try saying these to {agentLabel}:
                            </p>
                            <div className="space-y-2">
                              {(setupType === 'manus' || setupType === 'grok' || setupType === 'chatgpt' ? [
                                'Using AlphaClone, give me a quick snapshot: open leads, active deals, tasks due today, outstanding invoices.',
                                'Show me all my leads and flag any with no follow-up in the last 7 days.',
                                'Add a new lead: Jane Smith, jane@acme.com, Acme Ltd, source: website.',
                                'What is my total outstanding invoice amount?',
                                'Create a high-priority task: follow up with Acme Ltd — due tomorrow.',
                              ] : step.testPrompts ?? []).map((prompt: string) => (
                                <div key={prompt} className={`flex items-start gap-3 p-3 rounded-lg border ${setupType === 'manus' ? 'bg-teal-500/10 border-teal-500/20' : setupType === 'grok' ? 'bg-fuchsia-500/10 border-fuchsia-500/20' : setupType === 'chatgpt' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-indigo-500/10 border-indigo-500/20'}`}>
                                  <MessageSquare className={`w-4 h-4 flex-shrink-0 mt-0.5 ${setupType === 'manus' ? 'text-teal-400' : setupType === 'grok' ? 'text-fuchsia-400' : setupType === 'chatgpt' ? 'text-emerald-400' : 'text-indigo-400'}`} />
                                  <span className={`flex-1 text-sm font-medium leading-relaxed ${setupType === 'manus' ? 'text-teal-300' : setupType === 'grok' ? 'text-fuchsia-300' : setupType === 'chatgpt' ? 'text-emerald-300' : 'text-indigo-300'}`}>{prompt}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyText(prompt, 'Test prompt')}
                                    className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0"
                                    aria-label="Copy test prompt"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-3">
                              More prompts for daily workflows are in the <strong className="text-slate-400">Business prompt playbook</strong> section above.
                            </p>
                          </div>
                        )}

                        {/* Done button */}
                        {!isDone && (
                          <button
                            onClick={() => markDone(step.number)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all mt-2 ${setupType === 'claude' ? 'bg-indigo-600 hover:bg-indigo-500' : setupType === 'manus' ? 'bg-teal-600 hover:bg-teal-500' : 'bg-fuchsia-600 hover:bg-fuchsia-500'}`}
                          >
                            <CheckCircle className="w-4 h-4" />
                            {step.number === SETUP_STEPS.length ? 'I\'m done!' : 'Done — next step'}
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Success banner */}
      {completedSteps.size === SETUP_STEPS.length && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 rounded-2xl bg-gradient-to-br from-teal-500/20 to-indigo-500/20 border border-teal-500/30 text-center"
        >
          <div className="text-4xl mb-3">🎉</div>
          <h3 className="text-xl font-bold text-white mb-2">You're connected!</h3>
          <p className="text-slate-300 text-sm leading-relaxed max-w-md mx-auto">
            {agentLabel} can now see and update your AlphaClone account. Just open the app and start talking. No more clicking through menus — just describe what you want!
          </p>
        </motion.div>
      )}

      {/* Help section */}
      <div className="mt-8 p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-slate-400" />
          <span className="text-white text-sm font-semibold">Need help?</span>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed">
          If something isn't working, just email us at{' '}
          <a href="mailto:support@alphaclonesystems.com" className="text-teal-400 hover:underline">support@alphaclonesystems.com</a>{' '}
          and tell us which step you're stuck on. We'll sort it out for you — usually within a few hours.
        </p>
      </div>
    </div>
  );
};

export default MCPSetupGuide;


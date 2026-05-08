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

// ── Main Component ─────────────────────────────────────────────────────────────
interface MCPSetupGuideProps {
  initialType?: 'claude' | 'manus' | 'grok';
}

const MCPSetupGuide: React.FC<MCPSetupGuideProps> = ({ initialType }) => {
  const currentTenant = useCurrentTenantSafe();
  const [setupType, setSetupType] = useState<'claude' | 'manus' | 'grok'>(initialType ?? 'claude');
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
      }
    }
  }, [initialType]);


  const isEnterprise = currentTenant?.subscription_plan === 'enterprise';
  const tenantId = currentTenant?.id ?? 'your-workspace-id';

  const mcpOrigin = (typeof window !== 'undefined' ? window.location.origin : 'https://alphaclonesystems.com')
    .replace('//www.', '//');

  /** Single-query URL: tenant and user are resolved from the key server-side (see /api/mcp/sse). */
  const buildConnectionUrl = (token: string | null) => {
    const params = new URLSearchParams({
      api_key: token || 'YOUR_KEY_HERE',
    });
    return `${mcpOrigin}/api/mcp/sse?${params.toString()}`;
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
            <h1 className="text-2xl font-bold text-white">Connect {setupType === 'claude' ? 'Claude' : setupType === 'manus' ? 'Manus' : 'Grok'} AI to Your Account</h1>
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
        </div>

        {/* What this does */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-teal-500/10 border border-indigo-500/20 mb-6">
          <p className="text-slate-200 text-sm leading-relaxed">
            <span className="text-white font-semibold">What does this do?</span> When you connect {setupType === 'claude' ? 'Claude' : setupType === 'manus' ? 'Manus' : 'Grok'} to your AlphaClone account, you can just <span className="text-teal-400 font-medium">talk to your AI Agent</span> and it will update your CRM for you. No clicking through menus. No typing in forms. Just have a normal conversation, and your business data gets updated automatically.
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
            <p className="text-slate-400 text-xs leading-relaxed">{setupType === 'claude' ? 'Claude' : setupType === 'manus' ? 'Manus' : 'Grok'} can only see YOUR business data. It cannot delete anything. It cannot access your passwords or payment details. It can only read and add things inside your AlphaClone workspace.</p>
          </div>
        </div>
      </div>

      {/* Step-by-step guide */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-white mb-5">Step-by-step setup guide</h2>
        <div className="space-y-4">
          {SETUP_STEPS.filter(s => setupType === 'claude' || [1, 2, 3, 6].includes(s.number)).map((step, idx) => {
            const displayNum = idx + 1;
            const isDone = completedSteps.has(step.number);
            const isOpen = expandedStep === step.number;

            // Adjust title/body/action for Manus
            const stepTitle = setupType === 'manus' || setupType === 'grok'
              ? step.number === 1 ? `Open ${setupType === 'manus' ? 'Manus' : 'Grok'} AI`
              : step.number === 2 ? 'Copy your Connection URL'
              : step.number === 3 ? `Add AlphaClone to ${setupType === 'manus' ? 'Manus' : 'Grok'} MCP Settings`
              : 'Test your connection'
              : step.title;

            const stepBody = setupType === 'manus' || setupType === 'grok'
              ? step.number === 1 ? `${setupType === 'manus' ? 'Manus' : 'Grok'} AI is a powerful autonomous agent. Open the ${setupType === 'manus' ? 'Manus' : 'Grok'} dashboard to get started — you'll need to be logged in.`
              : step.number === 2 ? `Copy your unique Connection URL below. This is what tells ${setupType === 'manus' ? 'Manus' : 'Grok'} which AlphaClone account to connect to. Keep it private.`
              : step.number === 3 ? `In your ${setupType === 'manus' ? 'Manus' : 'Grok'} dashboard, go to Settings → MCP Servers (or Tools) → Add New Server. Set the name to "AlphaClone" and paste your Connection URL from Step 2. Save and confirm.`
              : `In ${setupType === 'manus' ? 'Manus' : 'Grok'}, start a new conversation and try one of these prompts to verify everything is connected:`
              : step.body;

            const actionLabel = (setupType === 'manus' || setupType === 'grok') && step.number === 1 ? `Open ${setupType === 'manus' ? 'Manus' : 'Grok'} AI` : step.action?.label;
            const actionUrl = setupType === 'manus' && step.number === 1 ? 'https://manus.im' : setupType === 'grok' && step.number === 1 ? 'https://grok.com' : step.action?.url;

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

                            {setupType === 'grok' && (
                              <div className="mt-6 space-y-4 pt-6 border-t border-slate-700/50">
                                <p className="text-sm font-bold text-white flex items-center gap-2">
                                  <Shield className="w-4 h-4 text-teal-400" />
                                  Grok OAuth Credentials
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Client ID</p>
                                    <div className="flex items-center gap-2">
                                      <code className="flex-1 text-[11px] text-teal-300 bg-black/30 p-1.5 rounded truncate border border-slate-700/50">grok-connector</code>
                                      <button onClick={() => copyText('grok-connector', 'Client ID')} className="p-1.5 hover:text-teal-400 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Scopes</p>
                                    <div className="flex items-center gap-2">
                                      <code className="flex-1 text-[11px] text-teal-300 bg-black/30 p-1.5 rounded truncate border border-slate-700/50">read write mcp:tools</code>
                                      <button onClick={() => copyText('read write mcp:tools', 'Scopes')} className="p-1.5 hover:text-teal-400 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                                    </div>
                                  </div>
                                  <div className="md:col-span-2">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Authorization Endpoint</p>
                                    <div className="flex items-center gap-2">
                                      <code className="flex-1 text-[11px] text-teal-300 bg-black/30 p-1.5 rounded truncate border border-slate-700/50">{`${mcpOrigin}/authorize`}</code>
                                      <button onClick={() => copyText(`${mcpOrigin}/authorize`, 'Auth Endpoint')} className="p-1.5 hover:text-teal-400 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                                    </div>
                                  </div>
                                  <div className="md:col-span-2">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Token Endpoint</p>
                                    <div className="flex items-center gap-2">
                                      <code className="flex-1 text-[11px] text-teal-300 bg-black/30 p-1.5 rounded truncate border border-slate-700/50">{`${mcpOrigin}/api/mcp/token`}</code>
                                      <button onClick={() => copyText(`${mcpOrigin}/api/mcp/token`, 'Token Endpoint')} className="p-1.5 hover:text-teal-400 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between pt-4 border-t border-slate-700/50">
                              <p className="text-xs text-slate-500 leading-relaxed">
                                <span className="text-amber-400 font-medium">Security warning:</span> This key grants AI agents read/write access to your CRM. Never share it publicly.
                              </p>
                              <button
                                onClick={handleRotateToken}
                                className="text-[10px] uppercase font-bold tracking-widest text-slate-500 hover:text-amber-400 transition-colors flex items-center gap-1.5"
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
                        {(step.testPrompts || ((setupType === 'manus' || setupType === 'grok') && step.number === 6)) && (
                          <div className="mb-4">
                            <p className="text-slate-400 text-xs font-medium mb-3">
                              Try saying these to {setupType === 'claude' ? 'Claude' : setupType === 'manus' ? 'Manus' : 'Grok'}:
                            </p>
                            <div className="space-y-2">
                              {(setupType === 'manus' || setupType === 'grok' ? [
                                '"Show me all my leads"',
                                '"Add a new lead: Jane Smith, jane@acme.com, Acme Ltd"',
                                '"What is my outstanding revenue?"',
                                '"Draft an NDA for client Acme Ltd, 12-month term"',
                                '"Log a $50 expense for software subscription"',
                              ] : step.testPrompts ?? []).map((prompt: string) => (
                                <div key={prompt} className={`flex items-center gap-3 p-3 rounded-lg border ${setupType === 'manus' ? 'bg-teal-500/10 border-teal-500/20' : setupType === 'grok' ? 'bg-fuchsia-500/10 border-fuchsia-500/20' : 'bg-indigo-500/10 border-indigo-500/20'}`}>
                                  <MessageSquare className={`w-4 h-4 flex-shrink-0 ${setupType === 'manus' ? 'text-teal-400' : setupType === 'grok' ? 'text-fuchsia-400' : 'text-indigo-400'}`} />
                                  <span className={`text-sm font-medium ${setupType === 'manus' ? 'text-teal-300' : setupType === 'grok' ? 'text-fuchsia-300' : 'text-indigo-300'}`}>{prompt}</span>
                                </div>
                              ))}
                            </div>
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
            {setupType === 'claude' ? 'Claude' : setupType === 'manus' ? 'Manus' : 'Grok'} can now see and update your AlphaClone account. Just open the app and start talking. No more clicking through menus — just describe what you want!
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

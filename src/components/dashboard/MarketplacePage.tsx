'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Star, CheckCircle, Zap, Globe, Mail, Calendar, FileText,
  MessageSquare, TrendingUp, Users, Briefcase, DollarSign,
  Sparkles, Bot, Shield, ChevronLeft, Phone, BarChart2,
  ArrowRight, Package, Link2, Bell, CreditCard, Layers, Cpu,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import MCPSetupGuide from './integrations/MCPSetupGuide';
import { EnterprisePageHeader } from '@/components/dashboard/responsive/EnterpriseModuleChrome';

// ── Types ────────────────────────────────────────────────────────────────────

type Category = 'all' | 'ai' | 'integration' | 'email' | 'automation' | 'template';
type ItemStatus = 'free' | 'paid' | 'included';

interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: Category;
  status: ItemStatus;
  price?: number;
  rating: number;
  installs: number;
  icon: React.FC<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  features: string[];
  tags: string[];
  developer: string;
  actionUrl?: string;
  isMCP?: boolean;
<<<<<<< HEAD
  mcpType?: 'claude' | 'manus' | 'grok' | 'chatgpt';
=======
  mcpType?: 'claude' | 'manus' | 'grok';
>>>>>>> origin/main
  badge?: string;
}

// ── Catalogue ────────────────────────────────────────────────────────────────

const ITEMS: MarketplaceItem[] = [
  // ── AI & Agents ────────────────────────────────────────────────────────────
  {
    id: 'mcp-claude',
    name: 'Claude AI (MCP)',
    description: 'Connect Claude Desktop directly to your CRM, leads, deals, contracts, and accounting. Talk to your data in plain English.',
    category: 'ai',
    status: 'free',
    rating: 5.0,
    installs: 2840,
    icon: Bot,
    iconBg: 'bg-indigo-500/15',
    iconColor: 'text-indigo-400',
    features: ['Add & qualify leads', 'Draft contracts with AI', 'Log expenses by voice', 'Query CRM data', 'Schedule tasks & follow-ups', 'Check revenue instantly'],
    tags: ['ai', 'mcp', 'claude', 'productivity'],
    developer: 'AlphaClone',
    isMCP: true,
    mcpType: 'claude',
    badge: 'Featured',
  },
  {
    id: 'mcp-manus',
    name: 'Manus AI (MCP)',
    description: 'Let Manus autonomously research leads, enrich CRM data, and execute background tasks — connected live to your workspace.',
    category: 'ai',
    status: 'free',
    rating: 5.0,
    installs: 1620,
    icon: Sparkles,
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-400',
    features: ['Autonomous lead research', 'CRM enrichment', 'Background task execution', 'Deal creation', 'Expense logging', 'Contract drafting'],
    tags: ['ai', 'mcp', 'manus', 'autonomous'],
    developer: 'AlphaClone',
    isMCP: true,
    mcpType: 'manus',
    badge: 'Featured',
  },
  {
    id: 'mcp-grok',
    name: 'Grok AI (MCP)',
    description: 'Connect xAI Grok directly to your workspace. Real-time data access, deal creation, and autonomous research via Grok-1.5.',
    category: 'ai',
    status: 'free',
    rating: 5.0,
    installs: 920,
    icon: Sparkles,
    iconBg: 'bg-fuchsia-500/15',
    iconColor: 'text-fuchsia-400',
    features: ['Real-time CRM search', 'Autonomous prospecting', 'Deal forecasting', 'Contract drafting', 'Revenue insights'],
    tags: ['ai', 'mcp', 'grok', 'xai'],
    developer: 'AlphaClone',
    isMCP: true,
    mcpType: 'grok',
    badge: 'New',
  },
  {
<<<<<<< HEAD
    id: 'mcp-chatgpt',
    name: 'ChatGPT Connector (MCP)',
    description: 'Connect ChatGPT to AlphaClone with OAuth while keeping Claude and Manus available alongside it.',
    category: 'ai',
    status: 'free',
    rating: 5.0,
    installs: 640,
    icon: Bot,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    features: ['OAuth connect', 'Workspace-safe access', 'Tool usage', 'ChatGPT-ready setup'],
    tags: ['ai', 'mcp', 'chatgpt', 'oauth'],
    developer: 'AlphaClone',
    isMCP: true,
    mcpType: 'chatgpt',
    badge: 'New',
  },
  {
=======
>>>>>>> origin/main
    id: 'sales-agent',
    name: 'AI Sales Agent',
    description: 'Your in-platform AI agent for lead prospecting, outreach campaigns, deal qualification, and CRM automation.',
    category: 'ai',
    status: 'included',
    rating: 4.9,
    installs: 5100,
    icon: Cpu,
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    features: ['B2B lead prospecting', 'Outreach email drafting', 'Lead-to-deal conversion', 'Task scheduling', 'CRM sync'],
    tags: ['ai', 'sales', 'prospecting', 'outreach'],
    developer: 'AlphaClone',
    actionUrl: '/dashboard/sales-agent',
  },
  // ── Integrations ───────────────────────────────────────────────────────────
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    description: 'Two-way sync between HubSpot and AlphaClone. Contacts, deals, and activities stay in perfect alignment.',
    category: 'integration',
    status: 'paid',
    price: 19,
    rating: 4.8,
    installs: 3200,
    icon: Users,
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    features: ['Contact sync', 'Deal pipeline sync', 'Two-way updates', 'Activity tracking', 'Lead scoring'],
    tags: ['crm', 'hubspot', 'contacts', 'deals'],
    developer: 'HubSpot',
    actionUrl: '/dashboard/business/settings?tab=integrations',
  },
  {
    id: 'facebook',
    name: 'Facebook & Lead Ads',
    description: 'Connect your Facebook Pages, receive lead ads directly into CRM, manage Messenger inbox, and post content.',
    category: 'integration',
    status: 'free',
    rating: 4.7,
    installs: 2900,
    icon: Globe,
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    features: ['Lead Ads capture', 'Messenger inbox', 'Page post & photo publishing', 'Lead auto-creation', 'Campaign tracking'],
    tags: ['facebook', 'leads', 'social', 'messenger'],
    developer: 'Meta',
    actionUrl: '/dashboard/business/settings?tab=integrations',
  },
  {
    id: 'calendly',
    name: 'Calendly Booking',
    description: 'Let clients book directly into your calendar. Meeting links auto-generate from your Calendly account.',
    category: 'integration',
    status: 'free',
    rating: 4.9,
    installs: 4100,
    icon: Calendar,
    iconBg: 'bg-sky-500/15',
    iconColor: 'text-sky-400',
    features: ['Booking page embed', 'Meeting sync', 'Custom availability', 'Team scheduling', 'Buffer times'],
    tags: ['scheduling', 'booking', 'calendar', 'meetings'],
    developer: 'Calendly',
    actionUrl: '/dashboard/business/settings?tab=booking',
  },
  {
    id: 'stripe',
    name: 'Stripe Payments',
    description: 'Accept card payments, subscriptions, and invoices directly from AlphaClone. Real-time revenue tracking included.',
    category: 'integration',
    status: 'free',
    rating: 4.9,
    installs: 3800,
    icon: CreditCard,
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    features: ['Card & bank payments', 'Subscription billing', 'Invoice generation', 'Revenue dashboard', 'Webhook sync'],
    tags: ['payments', 'stripe', 'billing', 'subscriptions'],
    developer: 'Stripe',
    actionUrl: '/dashboard/business/settings?tab=integrations',
  },
  {
    id: 'zapier',
    name: 'Native Workflow Automation',
    description: 'Build multi-step automations for lead capture, follow-ups, tasks, and notifications.',
    category: 'automation',
    status: 'included',
    rating: 4.8,
    installs: 0,
    icon: Link2,
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    features: ['Trigger-based workflows', 'Multi-step actions', 'Lead auto-tagging', 'CRM updates', 'Audited runs'],
    tags: ['automation', 'workflow', 'no-code'],
    developer: 'AlphaClone',
    actionUrl: '/dashboard/business/workflows',
  },
  {
    id: 'google-workspace',
    name: 'Google Workspace',
    description: 'Sync Google Calendar, connect Gmail for outreach, and access Drive documents from within AlphaClone.',
    category: 'integration',
    status: 'free',
    rating: 4.8,
    installs: 0,
    icon: Globe,
    iconBg: 'bg-green-500/15',
    iconColor: 'text-green-400',
    features: ['Gmail sync', 'Calendar integration', 'Drive file access', 'Meet link generation', 'Contact import'],
    tags: ['google', 'gmail', 'calendar', 'workspace'],
    developer: 'Google',
    actionUrl: '/dashboard/business/settings?tab=integrations',
  },
  {
    id: 'slack',
    name: 'Slack Notifications',
    description: 'Get CRM alerts, new lead notifications, and task reminders delivered straight to your Slack channels.',
    category: 'integration',
    status: 'free',
    rating: 4.7,
    installs: 0,
    icon: MessageSquare,
    iconBg: 'bg-pink-500/15',
    iconColor: 'text-pink-400',
    features: ['New lead alerts', 'Deal stage updates', 'Task reminders', 'Revenue notifications', 'Custom channels'],
    tags: ['slack', 'notifications', 'alerts', 'team'],
    developer: 'Slack',
    actionUrl: '/dashboard/business/settings?tab=integrations',
  },
  {
    id: 'quickbooks',
    name: 'Native Accounting',
    description: 'Manage invoices, expenses, journals, reports, banking, and period close inside AlphaClone.',
    category: 'integration',
    status: 'included',
    rating: 4.6,
    installs: 0,
    icon: BarChart2,
    iconBg: 'bg-green-500/15',
    iconColor: 'text-green-400',
    features: ['Invoice sync', 'Expense mapping', 'Tax categories', 'P&L reports', 'Bank reconciliation'],
    tags: ['accounting', 'finance', 'bookkeeping'],
    developer: 'AlphaClone',
    actionUrl: '/dashboard/accounting',
  },
  // ── Email & Communication ──────────────────────────────────────────────────
  {
    id: 'resend',
    name: 'Resend Email',
    description: 'Developer-grade email delivery API. Used for transactional emails, outreach campaigns, and notifications.',
    category: 'email',
    status: 'free',
    rating: 4.8,
    installs: 1900,
    icon: Mail,
    iconBg: 'bg-slate-500/15',
    iconColor: 'text-slate-300',
    features: ['Email API', 'React Email templates', 'Delivery analytics', 'Webhooks', 'Domain authentication'],
    tags: ['email', 'resend', 'api', 'transactional'],
    developer: 'Resend',
    actionUrl: '/dashboard/business/settings?tab=integrations',
  },
  {
    id: 'sendgrid',
    name: 'SendGrid Email',
    description: 'High-volume email marketing with advanced analytics. Send campaigns, automations, and transactional emails.',
    category: 'email',
    status: 'free',
    rating: 4.7,
    installs: 2400,
    icon: Bell,
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    features: ['Campaign builder', 'A/B testing', 'Analytics dashboard', 'Automation rules', 'Contact segmentation'],
    tags: ['email', 'sendgrid', 'campaigns', 'marketing'],
    developer: 'Twilio SendGrid',
    actionUrl: '/dashboard/business/settings?tab=integrations',
  },
  {
    id: 'zoho-mail',
    name: 'Zoho Mail',
    description: 'Business email integrated with your AlphaClone workspace. Send outreach, manage threads, and track opens.',
    category: 'email',
    status: 'free',
    rating: 4.5,
    installs: 1300,
    icon: Mail,
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-400',
    features: ['Email outreach', 'Thread management', 'Open tracking', 'Business email', 'Calendar sync'],
    tags: ['email', 'zoho', 'outreach', 'business'],
    developer: 'Zoho',
    actionUrl: '/dashboard/business/settings?tab=integrations',
  },
  {
    id: 'sms',
    name: 'SMS Outreach',
    description: 'Send SMS messages to leads and clients directly from your CRM. Powered by Twilio.',
    category: 'email',
    status: 'free',
    rating: 4.6,
    installs: 0,
    icon: Phone,
    iconBg: 'bg-green-500/15',
    iconColor: 'text-green-400',
    features: ['Bulk SMS', 'Two-way messaging', 'Opt-out management', 'Delivery reports', 'Template library'],
    tags: ['sms', 'twilio', 'outreach', 'messaging'],
    developer: 'Twilio',
    actionUrl: '/dashboard/business/sms',
  },
  // ── Templates ──────────────────────────────────────────────────────────────
  {
    id: 'proposal-template',
    name: 'Business Proposal Pack',
    description: 'Professional proposal templates that convert. Includes NDA, MSA, SOW, and service agreement starters.',
    category: 'template',
    status: 'included',
    rating: 4.7,
    installs: 3400,
    icon: FileText,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    features: ['NDA template', 'MSA template', 'SOW template', 'Service agreement', 'AI-generated drafts'],
    tags: ['template', 'contracts', 'legal', 'proposals'],
    developer: 'AlphaClone',
    actionUrl: '/dashboard/business/settings?tab=integrations',
  },
  {
    id: 'invoice-template',
    name: 'Invoice & Quote Templates',
    description: 'Send professional invoices and quotes that match your brand. Includes payment tracking and tax support.',
    category: 'template',
    status: 'included',
    rating: 4.6,
    installs: 4200,
    icon: DollarSign,
    iconBg: 'bg-green-500/15',
    iconColor: 'text-green-400',
    features: ['Invoice builder', 'Quote templates', 'PDF export', 'Tax calculations', 'Payment links'],
    tags: ['invoice', 'quotes', 'billing', 'finance'],
    developer: 'AlphaClone',
    actionUrl: '/dashboard/business/settings?tab=integrations',
  },
];

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORIES: { id: Category; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'all', label: 'All', icon: Package },
  { id: 'ai', label: 'AI & Agents', icon: Sparkles },
  { id: 'integration', label: 'Integrations', icon: Link2 },
  { id: 'email', label: 'Email & Comms', icon: Mail },
  { id: 'automation', label: 'Automation', icon: Zap },
  { id: 'template', label: 'Templates', icon: FileText },
];

const STATUS_CONFIG: Record<ItemStatus, { label: string; cls: string }> = {
  free: { label: 'Free', cls: 'text-green-400 bg-green-500/10 border-green-500/20' },
  paid: { label: 'PRO', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  included: { label: 'Included', cls: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
};

// ── Component ─────────────────────────────────────────────────────────────────

const MarketplacePage: React.FC = () => {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('all');
<<<<<<< HEAD
  const [activeMcp, setActiveMcp] = useState<'claude' | 'manus' | 'grok' | 'chatgpt' | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set(['mcp-claude', 'mcp-manus', 'mcp-grok', 'mcp-chatgpt', 'sales-agent', 'proposal-template', 'invoice-template']));
=======
  const [activeMcp, setActiveMcp] = useState<'claude' | 'manus' | 'grok' | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set(['mcp-claude', 'mcp-manus', 'mcp-grok', 'sales-agent', 'proposal-template', 'invoice-template']));
>>>>>>> origin/main

  // Handle ?mcp=claude / ?mcp=manus deep link
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const mcp = p.get('mcp');
<<<<<<< HEAD
    if (mcp === 'claude' || mcp === 'manus' || mcp === 'grok' || mcp === 'chatgpt') setActiveMcp(mcp);
=======
    if (mcp === 'claude' || mcp === 'manus' || mcp === 'grok') setActiveMcp(mcp);
>>>>>>> origin/main
  }, []);

  const filtered = ITEMS.filter(item => {
    const matchSearch = !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      item.tags.some(t => t.includes(search.toLowerCase()));
    const matchCat = category === 'all' || item.category === category;
    return matchSearch && matchCat;
  });

  const handleAction = (item: MarketplaceItem) => {
    if (item.isMCP && item.mcpType) {
      setActiveMcp(item.mcpType);
      return;
    }
    if (item.actionUrl) {
      router.push(item.actionUrl);
      return;
    }
    setInstalled(prev => new Set([...prev, item.id]));
    toast.success(`${item.name} connected!`);
  };

  // ── MCP full-page view ─────────────────────────────────────────────────────
  if (activeMcp) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 bg-slate-950/90 backdrop-blur border-b border-slate-800">
          <button
            onClick={() => {
              setActiveMcp(null);
              // clean up URL param
              const url = new URL(window.location.href);
              url.searchParams.delete('mcp');
              window.history.replaceState({}, '', url.toString());
            }}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Marketplace
          </button>
          <span className="text-slate-700">|</span>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveMcp('claude')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeMcp === 'claude' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Claude AI
            </button>
            <button
              onClick={() => setActiveMcp('manus')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeMcp === 'manus' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Manus AI
            </button>
            <button
              onClick={() => setActiveMcp('grok')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeMcp === 'grok' ? 'bg-fuchsia-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Grok AI
            </button>
<<<<<<< HEAD
            <button
              onClick={() => setActiveMcp('chatgpt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeMcp === 'chatgpt' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              ChatGPT
            </button>
=======
>>>>>>> origin/main
          </div>
        </div>
        <MCPSetupGuide initialType={activeMcp} />
      </div>
    );
  }

  // ── Marketplace grid ───────────────────────────────────────────────────────
  return (
    <div className="min-h-0 ac-scroll-full ac-enterprise-module space-y-6 px-3 sm:px-4 py-4">
      <EnterprisePageHeader moduleKey="marketplace" />

      {/* AI Agents hero banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {ITEMS.filter(i => i.isMCP).map((item: any) => {
          const Icon = item.icon;
          const isActive = item.mcpType === 'claude';
          return (
            <motion.button
              key={item.id}
              onClick={() => handleAction(item)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`relative overflow-hidden text-left p-5 rounded-2xl border transition-all ${
                isActive
                  ? 'bg-gradient-to-br from-indigo-900/40 to-slate-900 border-indigo-500/40 hover:border-indigo-500/70'
                  : 'bg-gradient-to-br from-teal-900/30 to-slate-900 border-teal-500/30 hover:border-teal-500/60'
              }`}
            >
              <div className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-10 ${isActive ? 'bg-indigo-500' : 'bg-teal-500'}`} />
              <div className="flex items-start gap-4 relative">
                <div className={`w-12 h-12 rounded-2xl ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-6 h-6 ${item.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold">{item.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${isActive ? 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30' : 'text-teal-300 bg-teal-500/10 border-teal-500/30'}`}>Featured</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/10 border border-green-500/20 text-green-400">Free</span>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">{item.description}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                      <span className="text-slate-300 text-xs font-semibold">{item.rating}</span>
                    </div>
                    <span className="text-slate-500 text-xs">{item.installs.toLocaleString()} installs</span>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${isActive ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-teal-600 hover:bg-teal-500 text-white'}`}>
                  Connect
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Search + Category filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search integrations, tools, templates…"
            className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  active
                    ? 'bg-teal-600 border-teal-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Count */}
      <p className="text-slate-500 text-xs font-medium mb-4 uppercase tracking-wider">
        {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
      </p>

      {/* Grid */}
      <AnimatePresence mode="popLayout">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item, i) => {
            const Icon = item.icon;
            const isInstalled = installed.has(item.id);
            const statusCfg = STATUS_CONFIG[item.status];

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                className="group relative flex flex-col bg-slate-900/70 border border-slate-800 rounded-2xl p-5 transition-all hover:border-teal-500/30 hover:bg-slate-900 hover:shadow-xl hover:shadow-teal-900/10 cursor-pointer"
                onClick={() => handleAction(item)}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-teal-500/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-11 h-11 rounded-xl ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${item.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-semibold text-sm leading-tight group-hover:text-teal-300 transition-colors">
                        {item.name}
                      </h3>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded-md text-xs font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">{item.developer}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold border ${statusCfg.cls}`}>
                    {item.price ? `$${item.price}/mo` : statusCfg.label}
                  </span>
                </div>

                {/* Description */}
                <p className="text-slate-400 text-xs leading-relaxed mb-3 line-clamp-2 flex-1">
                  {item.description}
                </p>

                {/* Features (top 3) */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {item.features.slice(0, 3).map(f => (
                    <span key={f} className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded-md">
                      {f}
                    </span>
                  ))}
                  {item.features.length > 3 && (
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-500 text-xs rounded-md">
                      +{item.features.length - 3} more
                    </span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-current" />
                      {item.rating}
                    </span>
                    {item.installs > 0 && (
                      <span>{item.installs.toLocaleString()} installs</span>
                    )}
                  </div>
                  {isInstalled ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-teal-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 group-hover:text-teal-400 transition-colors">
                      {item.isMCP ? 'Setup guide' : item.actionUrl ? 'Configure' : 'Connect'}
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4">
            <Search className="w-7 h-7 text-slate-600" />
          </div>
          <h3 className="text-white font-semibold mb-1">No results found</h3>
          <p className="text-slate-500 text-sm">Try a different search term or category.</p>
        </div>
      )}
    </div>
  );
};

export default MarketplacePage;


'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search, Plus, Inbox, Star, Clock, Send, FileText, Archive, Trash2,
  AlertTriangle, Shield, Settings, CheckCircle2, ChevronRight, ChevronDown,
  Sparkles, Filter, RefreshCw, Calendar as CalendarIcon, Users, User,
  Building, DollarSign, ArrowRight, Zap, Play, Pause, BarChart3, Mail,
  Bot, Flame, Check, X, ArrowUpRight, MessageSquare, Phone, Paperclip,
  ExternalLink, Eye, MousePointer, Target, Activity, ShieldCheck, AlertCircle,
  HelpCircle, Command, CornerDownRight, MoreVertical, Edit3, Sliders, Layers,
  Globe, Smartphone, FileSpreadsheet, Lock, Sparkle, Split, Workflow, CheckSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// --- TYPES ---

export type WorkspaceTab = 'inbox' | 'campaigns' | 'sequences' | 'templates' | 'analytics' | 'health';

export type EmailFolder =
  | 'inbox'
  | 'priority'
  | 'unread'
  | 'starred'
  | 'scheduled'
  | 'sent'
  | 'drafts'
  | 'archive'
  | 'spam'
  | 'trash'
  | 'shared'
  | 'sequences'
  | 'campaigns'
  | 'templates'
  | 'automation'
  | 'analytics'
  | 'warmup'
  | 'contacts'
  | 'companies';

export interface EmailThread {
  id: string;
  senderName: string;
  senderEmail: string;
  senderAvatar?: string;
  companyName: string;
  crmStatus: 'Client' | 'Qualified Lead' | 'Enterprise Prospect' | 'Partner' | 'Vendor';
  priority: 'high' | 'medium' | 'normal';
  subject: string;
  preview: string;
  timestamp: string;
  unread: boolean;
  starred: boolean;
  scheduled?: boolean;
  scheduledTime?: string;
  hasAttachments: boolean;
  attachmentCount?: number;
  hasMeeting: boolean;
  meetingDetails?: { title: string; date: string; time: string; link: string };
  dealValue?: number;
  dealName?: string;
  aiSummary: string;
  replyCount: number;
  sentiment: 'Positive' | 'Neutral' | 'Urgent' | 'Objection';
  relationshipScore: number; // 0-100
  opportunityScore: number; // 0-100
  folder: EmailFolder;
  labels: string[];
  messages: Array<{
    id: string;
    fromName: string;
    fromEmail: string;
    fromAvatar?: string;
    to: string[];
    timestamp: string;
    body: string;
    attachments?: Array<{ name: string; size: string; type: string }>;
    isInternalNote?: boolean;
  }>;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'Running' | 'Paused' | 'Completed' | 'Draft' | 'Scheduled';
  audience: string;
  recipientCount: number;
  sentCount: number;
  deliveredRate: number;
  openRate: number;
  replyRate: number;
  ctr: number;
  meetingRate: number;
  positiveReplyRate: number;
  meetingsBooked: number;
  pipelineCreated: number;
  revenue: number;
  personalizationScore: number;
  health: 'Optimal' | 'Warning' | 'Needs Attention';
  owner: string;
  progress: number;
  lastActive: string;
}

// --- MOCK INITIAL DATA ---

const MOCK_THREADS: EmailThread[] = [
  {
    id: 'thread-1',
    senderName: 'Marcus Vance',
    senderEmail: 'marcus.vance@apexlogistics.io',
    senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    companyName: 'Apex Logistics Corp',
    crmStatus: 'Enterprise Prospect',
    priority: 'high',
    subject: 'Proposal Review & Q3 Autonomous Operating Contract',
    preview: 'Hi Bonnie, I reviewed the custom enterprise architecture document you sent over. The AI CRM integration looks solid...',
    timestamp: '10:42 AM',
    unread: true,
    starred: true,
    hasAttachments: true,
    attachmentCount: 2,
    hasMeeting: true,
    meetingDetails: {
      title: 'AlphaClone Platform Architecture Sync',
      date: 'Today',
      time: '3:00 PM - 3:30 PM EST',
      link: 'https://alphaclone.tech/meet/apex-sync'
    },
    dealValue: 125000,
    dealName: 'Apex Enterprise Rollout',
    aiSummary: 'Marcus approved the technical spec and requested a finalized contract with Q3 deployment timeline.',
    replyCount: 3,
    sentiment: 'Positive',
    relationshipScore: 92,
    opportunityScore: 95,
    folder: 'inbox',
    labels: ['Enterprise', 'VIP Deal', 'Contract Pending'],
    messages: [
      {
        id: 'msg-101',
        fromName: 'Marcus Vance',
        fromEmail: 'marcus.vance@apexlogistics.io',
        to: ['bonnie@alphaclone.tech'],
        timestamp: 'Yesterday at 4:15 PM',
        body: `<p>Hi Bonnie,</p><p>We are very impressed by the demo of AlphaClone Systems. We want to replace our fragmented HubSpot + Salesforce + Zendesk stack with your single Autonomous Operating Engine.</p><p>Could you send over the final statement of work and security compliance breakdown for our legal team?</p><p>Best regards,<br><strong>Marcus Vance</strong><br>CTO, Apex Logistics</p>`,
        attachments: [
          { name: 'Apex_Security_Requirements_2026.pdf', size: '2.4 MB', type: 'pdf' },
          { name: 'Architecture_Spec_v2.docx', size: '850 KB', type: 'doc' }
        ]
      },
      {
        id: 'msg-102',
        fromName: 'Bonnie (AI Assistant)',
        fromEmail: 'bonnie@alphaclone.tech',
        to: ['marcus.vance@apexlogistics.io'],
        timestamp: 'Yesterday at 5:02 PM',
        body: `<p>Hi Marcus,</p><p>Thank you for reaching out! Attached is our SOC2 Type II compliance audit report along with the custom multi-tenant deployment roadmap.</p><p>I have also scheduled a brief 30-minute sync for today at 3:00 PM EST to walk your legal team through the SLA.</p><p>Warmly,<br><strong>Bonnie</strong> | AlphaClone Systems Executive AI</p>`
      },
      {
        id: 'msg-103',
        fromName: 'Marcus Vance',
        fromEmail: 'marcus.vance@apexlogistics.io',
        to: ['bonnie@alphaclone.tech'],
        timestamp: '10:42 AM',
        body: `<p>Fantastic turnaround! The meeting is confirmed for 3:00 PM. Please have the proposal contract ready for signature right after the call.</p>`
      }
    ]
  },
  {
    id: 'thread-2',
    senderName: 'Sarah Jenkins',
    senderEmail: 's.jenkins@vertexsolutions.com',
    senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    companyName: 'Vertex Solutions',
    crmStatus: 'Client',
    priority: 'medium',
    subject: 'Monthly Invoicing & Custom Workflow Expansion',
    preview: 'We loved the new multi-channel inbox feature. Can we add 15 additional seats to our current plan starting next Monday?',
    timestamp: '9:15 AM',
    unread: true,
    starred: false,
    hasAttachments: false,
    hasMeeting: false,
    dealValue: 48000,
    dealName: 'Vertex Annual Renewal + Seats',
    aiSummary: 'Client wants to expand by 15 seats ($18,000 ARR increase). Requires updated invoice.',
    replyCount: 1,
    sentiment: 'Positive',
    relationshipScore: 88,
    opportunityScore: 84,
    folder: 'inbox',
    labels: ['Client Expansion', 'Billing'],
    messages: [
      {
        id: 'msg-201',
        fromName: 'Sarah Jenkins',
        fromEmail: 's.jenkins@vertexsolutions.com',
        to: ['team@alphaclone.tech'],
        timestamp: '9:15 AM',
        body: `<p>Hello AlphaClone Team,</p><p>Our operations team has transitioned 100% to AlphaClone. We need to add 15 additional user seats before next week's push.</p><p>Can you issue an updated invoice or adjust our subscription portal?</p><p>Best,<br>Sarah Jenkins</p>`
      }
    ]
  },
  {
    id: 'thread-3',
    senderName: 'David Koster',
    senderEmail: 'david@kostertech.de',
    senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    companyName: 'Koster Technologies',
    crmStatus: 'Qualified Lead',
    priority: 'normal',
    subject: 'Inquiry regarding custom API webhooks & LiveKit video integration',
    preview: 'Does AlphaClone support custom webhooks for automated invoice generation when a deal stage changes in our external database?',
    timestamp: 'Jul 29',
    unread: false,
    starred: true,
    hasAttachments: true,
    attachmentCount: 1,
    hasMeeting: false,
    dealValue: 35000,
    dealName: 'Koster API License',
    aiSummary: 'Technical inquiry regarding webhook payloads and API rate limits. Answered by Bonnie with API docs.',
    replyCount: 2,
    sentiment: 'Neutral',
    relationshipScore: 75,
    opportunityScore: 70,
    folder: 'inbox',
    labels: ['API Integration', 'Lead'],
    messages: [
      {
        id: 'msg-301',
        fromName: 'David Koster',
        fromEmail: 'david@kostertech.de',
        to: ['support@alphaclone.tech'],
        timestamp: 'Jul 29 at 2:10 PM',
        body: `<p>Hi there,</p><p>We are testing AlphaClone for our agency clients. Do you support bi-directional sync via webhooks for invoices and project milestones?</p>`
      }
    ]
  },
  {
    id: 'thread-4',
    senderName: 'Elena Rostova',
    senderEmail: 'elena@cyberdefense.global',
    senderAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    companyName: 'Global Cyber Defense',
    crmStatus: 'Enterprise Prospect',
    priority: 'high',
    subject: 'Re: Outbound Cold Email Sequence - Follow up on AI Security Audit',
    preview: 'Thanks for reaching out. We are currently evaluating security vendors for Q4. Can you send over a benchmark comparison?',
    timestamp: 'Jul 28',
    unread: false,
    starred: false,
    hasAttachments: false,
    hasMeeting: true,
    meetingDetails: {
      title: 'Security Compliance Discovery',
      date: 'Tomorrow',
      time: '11:00 AM EST',
      link: 'https://alphaclone.tech/meet/cyber-sec'
    },
    dealValue: 210000,
    dealName: 'CyberDefense Global Engine',
    aiSummary: 'Positive reply from cold sequence step 2. Discovery call scheduled for tomorrow.',
    replyCount: 4,
    sentiment: 'Positive',
    relationshipScore: 81,
    opportunityScore: 98,
    folder: 'inbox',
    labels: ['Outreach Lead', 'High Value'],
    messages: [
      {
        id: 'msg-401',
        fromName: 'Elena Rostova',
        fromEmail: 'elena@cyberdefense.global',
        to: ['outreach@alphaclone.tech'],
        timestamp: 'Jul 28 at 11:30 AM',
        body: `<p>Hello Bonnie,</p><p>Your personalized email caught my attention. We are actively looking for an AI operating platform that complies with strict EU GDPR and SOC2 guidelines.</p><p>Let us connect tomorrow at 11:00 AM EST.</p>`
      }
    ]
  }
];

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-1',
    name: 'Q3 Enterprise Lead Generation - SaaS Founders',
    status: 'Running',
    audience: 'US & EU B2B SaaS Founders ($5M-$50M ARR)',
    recipientCount: 1420,
    sentCount: 1180,
    deliveredRate: 99.4,
    openRate: 68.2,
    replyRate: 24.6,
    ctr: 18.1,
    meetingRate: 11.4,
    positiveReplyRate: 84.0,
    meetingsBooked: 38,
    pipelineCreated: 480000,
    revenue: 165000,
    personalizationScore: 96,
    health: 'Optimal',
    owner: 'Bonnie AI Engine',
    progress: 83,
    lastActive: '12 mins ago'
  },
  {
    id: 'camp-2',
    name: 'Existing Client Upsell - Autonomous CRM Module',
    status: 'Running',
    audience: 'Active AlphaClone Base (Tier 1)',
    recipientCount: 350,
    sentCount: 350,
    deliveredRate: 100,
    openRate: 84.5,
    replyRate: 41.2,
    ctr: 32.0,
    meetingRate: 22.8,
    positiveReplyRate: 91.5,
    meetingsBooked: 42,
    pipelineCreated: 310000,
    revenue: 195000,
    personalizationScore: 99,
    health: 'Optimal',
    owner: 'Sales Team',
    progress: 100,
    lastActive: '1 hour ago'
  },
  {
    id: 'camp-3',
    name: 'Cold Outreach - Professional Service Firms',
    status: 'Paused',
    audience: 'Legal & Accounting Partners',
    recipientCount: 800,
    sentCount: 410,
    deliveredRate: 98.1,
    openRate: 52.0,
    replyRate: 14.3,
    ctr: 8.5,
    meetingRate: 4.8,
    positiveReplyRate: 72.0,
    meetingsBooked: 12,
    pipelineCreated: 140000,
    revenue: 45000,
    personalizationScore: 88,
    health: 'Warning',
    owner: 'Bonnie AI Engine',
    progress: 51,
    lastActive: 'Yesterday'
  }
];

export default function AlphaCloneEmailWorkspace() {
  // Navigation & View States
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('inbox');
  const [activeFolder, setActiveFolder] = useState<EmailFolder>('inbox');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCrmOnly, setFilterCrmOnly] = useState(false);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [filterHasMeeting, setFilterHasMeeting] = useState(false);

  // Data & Selection States
  const [threads, setThreads] = useState<EmailThread[]>(MOCK_THREADS);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>('thread-1');
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);

  // Quick Action / AI Command Bar
  const [aiCommandInput, setAiCommandInput] = useState('');
  const [aiCommandProcessing, setAiCommandProcessing] = useState(false);

  // Composer Modal State
  const [composerOpen, setComposerOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeProvider, setComposeProvider] = useState('auto');
  const [composeAiLoading, setComposeAiLoading] = useState(false);
  const [composeScheduleSend, setComposeScheduleSend] = useState(false);

  // Connected Email Accounts State
  const [connectedProviders] = useState([
    { name: 'Microsoft 365 (Outlook)', status: 'Connected', email: 'bonnie@alphaclone.tech', primary: true },
    { name: 'Zoho Mail Enterprise', status: 'Connected', email: 'outreach@alphaclone.tech', primary: false },
    { name: 'SendGrid Engine', status: 'Active (Campaigns)', email: 'system@alphaclone.tech', primary: false },
    { name: 'Resend API', status: 'Active (Transactional)', email: 'notifications@alphaclone.tech', primary: false }
  ]);

  // Derived selected thread
  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  // Filtered Threads
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (activeFolder !== 'inbox' && t.folder !== activeFolder) {
        if (activeFolder === 'unread' && !t.unread) return false;
        if (activeFolder === 'priority' && t.priority !== 'high') return false;
        if (activeFolder === 'starred' && !t.starred) return false;
      }
      if (filterUnreadOnly && !t.unread) return false;
      if (filterCrmOnly && !t.crmStatus) return false;
      if (filterHasMeeting && !t.hasMeeting) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.senderName.toLowerCase().includes(q) ||
        t.senderEmail.toLowerCase().includes(q) ||
        t.companyName.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.preview.toLowerCase().includes(q) ||
        t.aiSummary.toLowerCase().includes(q)
      );
    });
  }, [threads, activeFolder, filterUnreadOnly, filterCrmOnly, filterHasMeeting, searchQuery]);

  // Folder Counts Calculation
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {
      inbox: threads.filter((t) => t.folder === 'inbox').length,
      priority: threads.filter((t) => t.priority === 'high').length,
      unread: threads.filter((t) => t.unread).length,
      starred: threads.filter((t) => t.starred).length,
      scheduled: threads.filter((t) => t.scheduled).length,
      sent: threads.filter((t) => t.folder === 'sent').length,
      drafts: threads.filter((t) => t.folder === 'drafts').length,
      archive: threads.filter((t) => t.folder === 'archive').length,
      spam: threads.filter((t) => t.folder === 'spam').length,
      trash: threads.filter((t) => t.folder === 'trash').length,
      campaigns: campaigns.length,
      sequences: 4,
      templates: 12
    };
    return counts;
  }, [threads, campaigns]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setComposerOpen(true);
      } else if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById('universal-email-search');
        searchInput?.focus();
      } else if (e.key === 'r' && selectedThread) {
        e.preventDefault();
        handleQuickReply();
      } else if (e.key === 'e' && selectedThreadId) {
        e.preventDefault();
        handleArchiveThread(selectedThreadId);
      } else if ((e.key === '#' || e.key === 'Delete') && selectedThreadId) {
        e.preventDefault();
        handleDeleteThread(selectedThreadId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedThread, selectedThreadId]);

  // Handler Actions
  const handleToggleStar = (threadId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, starred: !t.starred } : t))
    );
  };

  const handleArchiveThread = (threadId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, folder: 'archive' } : t))
    );
    toast.success('Thread archived', { icon: '📦' });
  };

  const handleDeleteThread = (threadId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, folder: 'trash' } : t))
    );
    toast.success('Moved to trash', { icon: '🗑️' });
  };

  const handleSelectAll = () => {
    if (selectedThreadIds.length === filteredThreads.length) {
      setSelectedThreadIds([]);
    } else {
      setSelectedThreadIds(filteredThreads.map((t) => t.id));
    }
  };

  const handleToggleSelectRow = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedThreadIds((prev) =>
      prev.includes(threadId) ? prev.filter((id) => id !== threadId) : [...prev, threadId]
    );
  };

  const handleQuickReply = () => {
    if (!selectedThread) return;
    setComposeTo(selectedThread.senderEmail);
    setComposeSubject(selectedThread.subject.startsWith('Re:') ? selectedThread.subject : `Re: ${selectedThread.subject}`);
    setComposeBody(`\n\n---\nOn ${selectedThread.timestamp}, ${selectedThread.senderName} wrote:\n${selectedThread.preview}`);
    setComposerOpen(true);
  };

  // AI Command Processing
  const handleExecuteAiCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiCommandInput.trim()) return;
    setAiCommandProcessing(true);

    setTimeout(() => {
      setAiCommandProcessing(false);
      toast.success(`Bonnie AI: Executed command "${aiCommandInput}"`, {
        icon: '🤖',
        duration: 4000
      });
      setAiCommandInput('');
    }, 1200);
  };

  // Bonnie AI Reply Generator inside Composer
  const handleGenerateAiReply = (tone: 'professional' | 'concise' | 'persuasive' | 'objection') => {
    setComposeAiLoading(true);
    setTimeout(() => {
      setComposeAiLoading(false);
      let text = '';
      if (tone === 'professional') {
        text = `Hi ${selectedThread?.senderName || 'there'},\n\nThank you for sharing the updated roadmap. Our technical team reviewed the requirements for ${selectedThread?.companyName || 'your organization'}, and we are ready to move forward with the Q3 autonomous engine deployment.\n\nI have generated the official statement of work and uploaded it to your customer vault. Let us know if you have any questions before our sync.\n\nBest regards,\nAlphaClone Systems Team`;
      } else if (tone === 'concise') {
        text = `Hi ${selectedThread?.senderName || 'there'},\n\nAll requirements look great. Meeting confirmed for 3:00 PM EST today. I will bring the finalized contract for sign-off.\n\nThanks,\nBonnie AI`;
      } else if (tone === 'persuasive') {
        text = `Hi ${selectedThread?.senderName || 'there'},\n\nBy consolidating your current stack into AlphaClone Systems, your team will reduce operational overhead by 42% while improving SLA response speeds to under 30 seconds.\n\nLet's finalize the contract today so we can kick off onboarding on Monday!`;
      } else {
        text = `Hi ${selectedThread?.senderName || 'there'},\n\nWe completely understand your focus on security compliance. AlphaClone is fully SOC2 Type II audited and all tenant data is isolated in dedicated encrypted containers.\n\nAttached is our latest security whitepaper. Let's address any remaining concerns during our 3:00 PM call.`;
      }
      setComposeBody(text);
      toast.success(`Generated ${tone} AI response!`, { icon: '✨' });
    }, 800);
  };

  return (
    <div className="flex flex-col h-full min-h-0 w-full bg-[#0B1220] text-slate-100 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER: UNIVERSAL SEARCH & SYSTEM ENGINE CONTROL */}
      {/* ------------------------------------------------------------- */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 bg-[#0F172A]/90 backdrop-blur-xl border-b border-white/10 shrink-0 z-20">
        
        {/* Left branding & Workspace tab selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-black">
              <Mail className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white">AlphaClone Comms</h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                  AI Business Workspace
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Synced with CRM, Deals, Marketing & Bonnie AI</p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-1 ml-4 p-1 rounded-xl bg-slate-950/60 border border-white/10">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'inbox'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              Inbox & Workspace
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'campaigns'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              Campaigns
              <span className="px-1.5 py-0.2 rounded bg-slate-900 text-[10px] text-emerald-400 font-bold border border-emerald-500/30">
                {campaigns.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('sequences')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'sequences'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              Sequences
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'templates'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Template Builder
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'analytics'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('health')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'health'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              Email Health
            </button>
          </div>
        </div>

        {/* Universal Search & Quick AI Bar */}
        <div className="flex-1 max-w-xl flex items-center gap-2">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="universal-email-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Universal Search (Emails, CRM, Deals, Docs, Meetings...)"
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-white/10">
              /
            </span>
          </div>

          {/* Quick AI Command */}
          <form onSubmit={handleExecuteAiCommand} className="hidden sm:flex items-center gap-1.5">
            <div className="relative">
              <Bot className="w-3.5 h-3.5 text-emerald-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={aiCommandInput}
                onChange={(e) => setAiCommandInput(e.target.value)}
                placeholder="Bonnie AI: 'Draft SOW'..."
                className="w-44 bg-emerald-950/30 border border-emerald-500/30 rounded-xl pl-8 pr-2 py-2 text-xs text-emerald-200 placeholder-emerald-500/60 focus:outline-none focus:w-60 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={aiCommandProcessing}
              className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Connected Status & User Profile */}
        <div className="flex items-center gap-3">
          {/* Accounts status badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">Outlook + Zoho Synced</span>
          </div>

          <button
            onClick={() => setComposerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            New Email
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CONTENT AREA BY TAB */}
      {/* ------------------------------------------------------------- */}

      {activeTab === 'inbox' && (
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          
          {/* --------------------------------------------------------- */}
          {/* LEFT SIDEBAR: FOLDERS & WORKSPACE DIRECTORY */}
          {/* --------------------------------------------------------- */}
          <aside
            className={`${
              sidebarCollapsed ? 'w-16' : 'w-64'
            } border-r border-white/10 bg-[#0F172A]/70 backdrop-blur-md flex flex-col transition-all duration-200 shrink-0 select-none`}
          >
            {/* Compose & Collapse toggle */}
            <div className="p-3 flex items-center justify-between border-b border-white/10">
              <button
                onClick={() => setComposerOpen(true)}
                className={`w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black transition-all ${
                  sidebarCollapsed ? 'px-0' : 'px-3'
                }`}
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                {!sidebarCollapsed && <span>Compose Email</span>}
              </button>

              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden md:flex p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 ml-1"
                title="Toggle Sidebar"
              >
                <Sliders className="w-4 h-4" />
              </button>
            </div>

            {/* Folder list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-4 text-xs">
              
              {/* CORE MAILBOX */}
              <div>
                {!sidebarCollapsed && (
                  <p className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    Mailbox Folders
                  </p>
                )}
                <div className="space-y-0.5">
                  <button
                    onClick={() => setActiveFolder('inbox')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                      activeFolder === 'inbox'
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Inbox className="w-4 h-4 text-emerald-400" />
                      {!sidebarCollapsed && <span>Inbox</span>}
                    </div>
                    {!sidebarCollapsed && folderCounts.inbox > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black">
                        {folderCounts.inbox}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveFolder('priority')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                      activeFolder === 'priority'
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Flame className="w-4 h-4 text-amber-400" />
                      {!sidebarCollapsed && <span>Priority AI</span>}
                    </div>
                    {!sidebarCollapsed && folderCounts.priority > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        {folderCounts.priority}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveFolder('starred')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                      activeFolder === 'starred'
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Star className="w-4 h-4 text-yellow-400" />
                      {!sidebarCollapsed && <span>Starred</span>}
                    </div>
                    {!sidebarCollapsed && folderCounts.starred > 0 && (
                      <span className="text-[10px] font-bold text-slate-400">{folderCounts.starred}</span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveFolder('sent')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                      activeFolder === 'sent'
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Send className="w-4 h-4 text-teal-400" />
                      {!sidebarCollapsed && <span>Sent</span>}
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveFolder('archive')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                      activeFolder === 'archive'
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Archive className="w-4 h-4 text-slate-400" />
                      {!sidebarCollapsed && <span>Archive</span>}
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveFolder('trash')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                      activeFolder === 'trash'
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      {!sidebarCollapsed && <span>Trash</span>}
                    </div>
                  </button>
                </div>
              </div>

              {/* CRM & WORKSPACE HUBS */}
              <div>
                {!sidebarCollapsed && (
                  <p className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    Workspace & Automation
                  </p>
                )}
                <div className="space-y-0.5">
                  <button
                    onClick={() => setActiveTab('campaigns')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:bg-white/5 hover:text-white transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Target className="w-4 h-4 text-emerald-400" />
                      {!sidebarCollapsed && <span>Campaign Hub</span>}
                    </div>
                    {!sidebarCollapsed && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        {campaigns.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('sequences')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:bg-white/5 hover:text-white transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Workflow className="w-4 h-4 text-teal-400" />
                      {!sidebarCollapsed && <span>Sequences</span>}
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('analytics')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:bg-white/5 hover:text-white transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <BarChart3 className="w-4 h-4 text-teal-400" />
                      {!sidebarCollapsed && <span>Attribution</span>}
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('health')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:bg-white/5 hover:text-white transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      {!sidebarCollapsed && <span>Domain Warmup</span>}
                    </div>
                    {!sidebarCollapsed && (
                      <span className="px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 text-[10px] font-bold">
                        98%
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* CONNECTED ACCOUNTS OVERVIEW */}
              {!sidebarCollapsed && (
                <div className="mt-auto p-3 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Connected Dispatchers</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Outlook 365</span>
                      <span className="text-emerald-400 font-bold">Active</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Zoho Enterprise</span>
                      <span className="text-emerald-400 font-bold">Active</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>SendGrid Engine</span>
                      <span className="text-teal-400">Bulk Ready</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </aside>

          {/* --------------------------------------------------------- */}
          {/* CENTER PANEL: EMAIL LIST & QUICK FILTERS */}
          {/* --------------------------------------------------------- */}
          <div
            className={`${
              selectedThreadId ? 'hidden md:flex' : 'flex'
            } w-full md:w-[380px] lg:w-[440px] border-r border-white/10 bg-[#0B1220] flex-col shrink-0 min-h-0 select-none`}
          >
            {/* Filter toolbar */}
            <div className="p-3 border-b border-white/10 bg-[#0F172A]/40 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => {
                    setFilterUnreadOnly(false);
                    setFilterCrmOnly(false);
                    setFilterHasMeeting(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    !filterUnreadOnly && !filterCrmOnly && !filterHasMeeting
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  All ({filteredThreads.length})
                </button>
                <button
                  onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    filterUnreadOnly ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  Unread
                </button>
                <button
                  onClick={() => setFilterCrmOnly(!filterCrmOnly)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    filterCrmOnly ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  CRM Deals
                </button>
                <button
                  onClick={() => setFilterHasMeeting(!filterHasMeeting)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    filterHasMeeting ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  Meetings
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleSelectAll}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
                  title="Select All"
                >
                  <CheckSquare className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Email Threads List */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {filteredThreads.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-3">
                  <Mail className="w-10 h-10 mx-auto text-slate-600 stroke-[1.5]" />
                  <p className="text-xs font-medium">No emails found matching your filters.</p>
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isSelected = selectedThreadId === thread.id;
                  const isChecked = selectedThreadIds.includes(thread.id);

                  return (
                    <div
                      key={thread.id}
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={`group relative p-3.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-emerald-500/10 border-l-4 border-emerald-400'
                          : thread.unread
                          ? 'bg-slate-900/80 hover:bg-slate-900'
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      {/* Top row: Checkbox, Avatar, Sender Name & Time */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            onClick={(e) => handleToggleSelectRow(thread.id, e)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                              isChecked
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                                : 'border-white/20 hover:border-white/40'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>

                          {thread.senderAvatar ? (
                            <img
                              src={thread.senderAvatar}
                              alt={thread.senderName}
                              className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                              {thread.senderName.charAt(0)}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs truncate ${
                                  thread.unread ? 'font-black text-white' : 'font-semibold text-slate-200'
                                }`}
                              >
                                {thread.senderName}
                              </span>
                              <span className="text-[10px] text-slate-500 truncate">({thread.companyName})</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-400 font-medium">{thread.timestamp}</span>
                          <button
                            onClick={(e) => handleToggleStar(thread.id, e)}
                            className="text-slate-500 hover:text-yellow-400 transition-colors"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${thread.starred ? 'fill-yellow-400 text-yellow-400' : ''}`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* CRM Badge & Deal value tag */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5 pl-6">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                          {thread.crmStatus}
                        </span>

                        {thread.dealValue && (
                          <span className="px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/30 text-[10px] font-bold text-teal-300 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            ${thread.dealValue.toLocaleString()}
                          </span>
                        )}

                        {thread.hasMeeting && (
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-[10px] font-bold text-blue-400 flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            Meeting
                          </span>
                        )}
                      </div>

                      {/* Subject */}
                      <p
                        className={`text-xs pl-6 mb-1 truncate ${
                          thread.unread ? 'font-bold text-slate-100' : 'font-medium text-slate-300'
                        }`}
                      >
                        {thread.subject}
                      </p>

                      {/* Preview Snippet */}
                      <p className="text-[11px] text-slate-400 line-clamp-1 pl-6 mb-2">{thread.preview}</p>

                      {/* AI Summary Pill */}
                      <div className="pl-6">
                        <div className="p-1.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 flex items-center gap-1.5 text-[10px] text-emerald-300">
                          <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="truncate">{thread.aiSummary}</span>
                        </div>
                      </div>

                      {/* Hover Actions overlay */}
                      <div className="absolute right-3 bottom-3 hidden group-hover:flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-white/10 shadow-xl">
                        <button
                          onClick={(e) => handleArchiveThread(thread.id, e)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
                          title="Archive"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteThread(thread.id, e)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/10"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* --------------------------------------------------------- */}
          {/* RIGHT PANEL: THREADED CONVERSATION VIEW & CRM TIMELINE */}
          {/* --------------------------------------------------------- */}
          <div className="flex-1 flex flex-col bg-[#080E1A] min-h-0 overflow-hidden">
            {selectedThread ? (
              <div className="flex-1 flex flex-col min-h-0">
                
                {/* Thread Header */}
                <div className="p-5 border-b border-white/10 bg-[#0F172A]/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 shrink-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-black text-white">{selectedThread.subject}</h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-bold text-emerald-300">
                        {selectedThread.crmStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Thread with <strong className="text-slate-200">{selectedThread.senderName}</strong> ({selectedThread.senderEmail}) — {selectedThread.companyName}
                    </p>
                  </div>

                  {/* Actions Header */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleQuickReply}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Reply
                    </button>
                    <button
                      onClick={() => handleArchiveThread(selectedThread.id)}
                      className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white"
                      title="Archive Thread"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteThread(selectedThread.id)}
                      className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-rose-400"
                      title="Delete Thread"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Main Thread Content & Context Sidebar */}
                <div className="flex-1 flex flex-col xl:flex-row min-h-0 overflow-hidden">
                  
                  {/* Messages Timeline */}
                  <div className="flex-1 p-6 space-y-6 overflow-y-auto min-h-0">
                    
                    {/* Bonnie AI Summary Banner */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-teal-950/40 border border-emerald-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-black">
                          <Sparkles className="w-4 h-4" />
                          <span>Bonnie AI Executive Thread Breakdown</span>
                        </div>
                        <span className="text-[10px] text-emerald-400/70 font-mono">Realtime CRM Sync</span>
                      </div>
                      <p className="text-xs text-emerald-200/90 leading-relaxed">
                        {selectedThread.aiSummary}
                      </p>
                      
                      {/* Sentiment & Opportunity Scores */}
                      <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-emerald-500/20 text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span>Sentiment:</span>
                          <span className="font-bold text-emerald-400">{selectedThread.sentiment}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span>Relationship Health:</span>
                          <span className="font-bold text-teal-400">{selectedThread.relationshipScore}%</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span>Opportunity Value:</span>
                          <span className="font-bold text-emerald-400">${selectedThread.dealValue?.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Thread Messages */}
                    {selectedThread.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-5 rounded-2xl bg-[#0F172A]/60 border border-white/10 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
                              {msg.fromName.charAt(0)}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">{msg.fromName}</h4>
                              <p className="text-[10px] text-slate-400">{msg.fromEmail}</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                        </div>

                        <div
                          className="text-xs text-slate-300 leading-relaxed space-y-2"
                          dangerouslySetInnerHTML={{ __html: msg.body }}
                        />

                        {/* Attachments if any */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="pt-3 border-t border-white/5 space-y-2">
                            <p className="text-[10px] font-bold uppercase text-slate-400">Attachments ({msg.attachments.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {msg.attachments.map((att, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300 hover:border-emerald-500/50 cursor-pointer"
                                >
                                  <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>{att.name}</span>
                                  <span className="text-[10px] text-slate-500">({att.size})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Quick Inline Reply Field */}
                    <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Reply to {selectedThread.senderEmail}...</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleGenerateAiReply('professional')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/20"
                          >
                            ✨ AI Professional Reply
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={composeBody}
                        onChange={(e) => setComposeBody(e.target.value)}
                        placeholder="Type your response or use Bonnie AI..."
                        className="w-full h-24 bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleQuickReply}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black"
                        >
                          Send Response
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* CRM & Deal Intelligence Right Context Bar */}
                  <div className="w-full xl:w-80 border-t xl:border-t-0 xl:border-l border-white/10 bg-[#0B1220] p-5 space-y-5 shrink-0">
                    
                    {/* Contact Profile */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">CRM Contact Card</h3>
                      <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
                        <div className="flex items-center gap-3">
                          {selectedThread.senderAvatar ? (
                            <img src={selectedThread.senderAvatar} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center">
                              {selectedThread.senderName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <h4 className="text-xs font-bold text-white">{selectedThread.senderName}</h4>
                            <p className="text-[10px] text-slate-400">{selectedThread.companyName}</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-white/5 space-y-1 text-[11px] text-slate-300">
                          <p><strong>Email:</strong> {selectedThread.senderEmail}</p>
                          <p><strong>CRM Status:</strong> <span className="text-emerald-400">{selectedThread.crmStatus}</span></p>
                        </div>
                      </div>
                    </div>

                    {/* Deal Info */}
                    {selectedThread.dealValue && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Pipeline Deal</h3>
                        <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{selectedThread.dealName}</span>
                            <span className="text-xs font-black text-emerald-400">${selectedThread.dealValue.toLocaleString()}</span>
                          </div>
                          <p className="text-[10px] text-slate-400">Stage: Contract Review (95% probability)</p>
                        </div>
                      </div>
                    )}

                    {/* Meeting Card */}
                    {selectedThread.hasMeeting && selectedThread.meetingDetails && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Scheduled Calendar Sync</h3>
                        <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                            <CalendarIcon className="w-4 h-4 text-blue-400" />
                            <span>{selectedThread.meetingDetails.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-300">
                            {selectedThread.meetingDetails.date} at {selectedThread.meetingDetails.time}
                          </p>
                          <a
                            href={selectedThread.meetingDetails.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold"
                          >
                            Join Video Call <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    )}

                  </div>

                </div>

              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-12 text-center text-slate-500">
                <p>Select an email thread from the left panel to open the business conversation.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CAMPAIGNS TAB */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'campaigns' && (
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Campaign Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Emails Sent</span>
              <p className="text-xl font-black text-white">1,940</p>
              <span className="text-[10px] text-emerald-400 font-bold">+14.2% this week</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Average Open Rate</span>
              <p className="text-xl font-black text-emerald-400">68.2%</p>
              <span className="text-[10px] text-emerald-400 font-bold">Industry top 1%</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Meetings Booked</span>
              <p className="text-xl font-black text-teal-300">92</p>
              <span className="text-[10px] text-teal-400 font-bold">Bonnie AI Auto-booked</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Pipeline Created</span>
              <p className="text-xl font-black text-emerald-400">$930,000</p>
              <span className="text-[10px] text-emerald-400 font-bold">Direct CRM Attribution</span>
            </div>
          </div>

          {/* Campaign List */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-white">Active Outreach Campaigns</h2>
              <button
                onClick={() => toast.success('Opening Visual Campaign Builder...', { icon: '⚙️' })}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold"
              >
                + Create Campaign
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-white/10">
                  <tr>
                    <th className="p-3">Campaign Name</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Recipients</th>
                    <th className="p-3">Open Rate</th>
                    <th className="p-3">Reply Rate</th>
                    <th className="p-3">Meetings</th>
                    <th className="p-3">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {campaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-white/5">
                      <td className="p-3 font-bold text-white">{camp.name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                          {camp.status}
                        </span>
                      </td>
                      <td className="p-3">{camp.recipientCount.toLocaleString()}</td>
                      <td className="p-3 text-emerald-400 font-bold">{camp.openRate}%</td>
                      <td className="p-3 text-teal-300 font-bold">{camp.replyRate}%</td>
                      <td className="p-3 font-bold">{camp.meetingsBooked}</td>
                      <td className="p-3 text-emerald-400 font-bold">${camp.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* OTHER TABS: SEQUENCES / TEMPLATES / ANALYTICS / HEALTH */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'sequences' && (
        <div className="flex-1 p-8 text-center text-slate-400 space-y-4">
          <Workflow className="w-12 h-12 text-emerald-400 mx-auto stroke-[1.5]" />
          <h2 className="text-lg font-bold text-white">Multi-Channel Sequences Visual Engine</h2>
          <p className="text-xs max-w-md mx-auto">
            Design multi-touch automated workflows combining Email, LinkedIn, Phone Calls, SMS, and CRM updates.
          </p>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="flex-1 p-8 text-center text-slate-400 space-y-4">
          <FileText className="w-12 h-12 text-teal-400 mx-auto stroke-[1.5]" />
          <h2 className="text-lg font-bold text-white">Drag & Drop Email Template Builder</h2>
          <p className="text-xs max-w-md mx-auto">
            Build responsive enterprise email templates with reusable snippets, proposal blocks, and product embeds.
          </p>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="flex-1 p-8 text-center text-slate-400 space-y-4">
          <BarChart3 className="w-12 h-12 text-emerald-400 mx-auto stroke-[1.5]" />
          <h2 className="text-lg font-bold text-white">Attribution & Heatmap Analytics</h2>
          <p className="text-xs max-w-md mx-auto">
            Track deal attribution, best open times, bounce trends, and AI performance metrics.
          </p>
        </div>
      )}

      {activeTab === 'health' && (
        <div className="flex-1 p-8 text-center text-slate-400 space-y-4">
          <ShieldCheck className="w-12 h-12 text-teal-400 mx-auto stroke-[1.5]" />
          <h2 className="text-lg font-bold text-white">Domain Health & Warmup Center</h2>
          <p className="text-xs max-w-md mx-auto">
            SPF: Valid | DKIM: Valid | DMARC: Valid. Warmup score: 98.4%.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* RICH EMAIL COMPOSER MODAL */}
      {/* ------------------------------------------------------------- */}
      {composerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white">New AlphaClone Message</h3>
              </div>
              <button
                onClick={() => setComposerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="w-12 text-slate-400 font-bold">To:</span>
                <input
                  type="text"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@company.com"
                  className="flex-1 bg-transparent border-none focus:outline-none text-white placeholder-slate-600"
                />
              </div>

              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="w-12 text-slate-400 font-bold">Subject:</span>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Enter message subject..."
                  className="flex-1 bg-transparent border-none focus:outline-none text-white font-bold placeholder-slate-600"
                />
              </div>

              {/* AI Quick Prompts Toolbar */}
              <div className="flex items-center gap-2 py-1 overflow-x-auto text-[10px]">
                <span className="text-slate-400 font-bold">Bonnie AI:</span>
                <button
                  onClick={() => handleGenerateAiReply('professional')}
                  className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold hover:bg-emerald-500/20"
                >
                  ✨ Professional
                </button>
                <button
                  onClick={() => handleGenerateAiReply('concise')}
                  className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold hover:bg-emerald-500/20"
                >
                  ✨ Short Sync
                </button>
                <button
                  onClick={() => handleGenerateAiReply('persuasive')}
                  className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold hover:bg-emerald-500/20"
                >
                  ✨ SOW Proposal
                </button>
              </div>

              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Write your email body..."
                className="w-full h-56 bg-slate-950/60 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div className="p-4 border-t border-white/10 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Dispatch:</span>
                <select
                  value={composeProvider}
                  onChange={(e) => setComposeProvider(e.target.value)}
                  className="bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                >
                  <option value="auto">Auto (Best Deliverability)</option>
                  <option value="outlook">Microsoft Outlook 365</option>
                  <option value="zoho">Zoho Mail Enterprise</option>
                  <option value="sendgrid">SendGrid Engine</option>
                </select>
              </div>

              <button
                onClick={() => {
                  toast.success('Email dispatched via AlphaClone Comms!', { icon: '🚀' });
                  setComposerOpen(false);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20"
              >
                Send Message
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

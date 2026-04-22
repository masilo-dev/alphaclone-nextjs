'use client';

import React from 'react';
import Link from 'next/link';
import {
    LayoutDashboard, Users, TrendingUp, Zap, CheckSquare,
    Briefcase, Mail, Video, DollarSign, BarChart3,
    FileText, Settings, CheckCircle2, Globe, Calendar,
    Receipt, Shield, ArrowRight, MessageSquare,
    ShieldCheck, Database, Bot, BookOpen, ExternalLink,
    Lock, Star, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import PublicNavigation from '@/components/PublicNavigation';
import LoomVideo from '@/components/ui/LoomVideo';

const sections = [
    'onboarding', 'home', 'crm', 'growth-agent', 'integrations',
    'financials', 'contracts', 'tasks', 'security', 'settings'
];

export default function DocsPageContent() {
    const [, setIsLoginOpen] = React.useState(false);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-teal-500/30">
            <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />

            <div className="pt-20 flex">
                {/* Sticky Sidebar Nav — Desktop */}
                <aside className="hidden lg:block w-64 flex-shrink-0 sticky top-20 self-start h-[calc(100vh-5rem)] overflow-y-auto border-r border-slate-800/50 py-8 px-4">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 px-2">On This Page</p>
                    <nav className="space-y-1">
                        {[
                            { id: 'onboarding', label: '1. Registration & Setup', icon: CheckCircle2 },
                            { id: 'home', label: '2. Business Home', icon: LayoutDashboard },
                            { id: 'crm', label: '3. CRM & Deals', icon: Users },
                            { id: 'growth-agent', label: '4. Growth Agent', icon: Zap },
                            { id: 'integrations', label: '5. Communications', icon: Globe },
                            { id: 'financials', label: '6. Financial Suite', icon: Receipt },
                            { id: 'contracts', label: '7. Contracts', icon: FileText },
                            { id: 'tasks', label: '8. Tasks & Projects', icon: CheckSquare },
                            { id: 'security', label: '9. Security', icon: ShieldCheck },
                            { id: 'settings', label: '10. Settings', icon: Settings },
                        ].map(item => (
                            <a
                                key={item.id}
                                href={`#${item.id}`}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                                <item.icon className="w-4 h-4 text-teal-500 flex-shrink-0" />
                                {item.label}
                            </a>
                        ))}
                    </nav>
                    <div className="mt-8 px-2">
                        <Link href="/guide" className="flex items-center gap-2 text-teal-400 hover:text-teal-300 text-xs font-semibold">
                            <BookOpen className="w-4 h-4" />
                            Full Onboarding Guide
                            <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 min-w-0 max-w-4xl mx-auto px-4 py-8 lg:py-16 w-full overflow-x-hidden">
                    {/* Sticky Mobile Nav */}
                    <div className="lg:hidden sticky top-20 z-40 bg-slate-950/95 backdrop-blur-xl pb-4 pt-4 border-b border-slate-800/50 mb-8 mx-[-1rem] px-4 -mt-8">
                        <div className="relative">
                            <select
                                className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 appearance-none focus:outline-none focus:border-teal-500 shadow-lg"
                                onChange={(e) => {
                                    if (!e.target.value) return;
                                    const element = document.getElementById(e.target.value);
                                    if (element) {
                                        const y = element.getBoundingClientRect().top + window.scrollY - 200; // increased offset for better visibility
                                        window.scrollTo({ top: y, behavior: 'smooth' });
                                    }
                                }}
                            >
                                <option value="">Jump to module...</option>
                                <option value="onboarding">1. Registration & Setup</option>
                                <option value="home">2. Business Home</option>
                                <option value="crm">3. CRM & Deals</option>
                                <option value="growth-agent">4. Growth Agent</option>
                                <option value="integrations">5. Communications</option>
                                <option value="financials">6. Financial Suite</option>
                                <option value="contracts">7. Contracts</option>
                                <option value="tasks">8. Tasks & Projects</option>
                                <option value="security">9. Security</option>
                                <option value="settings">10. Settings</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <ChevronRight className="w-5 h-5 text-slate-400 rotate-90" />
                            </div>
                        </div>
                    </div>

                    {/* Header */}
                    <header className="mb-16">
                        <div className="flex items-center gap-2 mb-4">
                            <BookOpen className="w-5 h-5 text-teal-400" />
                            <span className="text-teal-400 text-sm font-semibold tracking-widest uppercase">Documentation</span>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">AlphaClone Business OS — Full Reference</h1>
                        <p className="text-slate-400 text-lg leading-relaxed max-w-2xl">
                            The complete technical and operational reference for the AlphaClone Business OS. This documentation covers every platform feature with step-by-step instructions, navigation paths, and best practices. For a guided walkthrough, visit the <Link href="/guide" className="text-teal-400 hover:underline">Platform Guide</Link>.
                        </p>

                        <div className="mt-12 mb-10">
                            <LoomVideo 
                                videoId="3a7000c925c145b7882089688b0ceb5d" 
                                title="AlphaClone Documentation Tour"
                            />
                        </div>
                        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: '10 Modules', sub: 'fully documented' },
                                { label: '50+ Features', sub: 'explained in depth' },
                                { label: 'Step-by-step', sub: 'navigation paths' },
                                { label: 'Non-technical', sub: 'plain language' },
                            ].map((stat, i) => (
                                <div key={i} className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
                                    <div className="font-bold text-white text-sm">{stat.label}</div>
                                    <div className="text-slate-500 text-xs">{stat.sub}</div>
                                </div>
                            ))}
                        </div>
                    </header>

                    <section className="space-y-20">

                        {/* 1. Registration & Onboarding */}
                        <div id="onboarding" className="scroll-mt-24">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                                    <CheckCircle2 className="w-6 h-6 text-teal-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-teal-500 font-semibold uppercase tracking-wider mb-1">Module 1</p>
                                    <h2 className="text-3xl font-bold text-white">Registration & Onboarding</h2>
                                </div>
                            </div>
                            <p className="text-slate-400 leading-relaxed mb-6">
                                AlphaClone uses a guided onboarding wizard that walks new users through workspace setup, branding, and initial configuration. The entire process is designed to take under 30 minutes even for non-technical users.
                            </p>
                            <div className="space-y-4">
                                <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800">
                                    <h3 className="text-xl font-bold text-white mb-4">The AlphaClone Signup Process</h3>
                                    <ol className="space-y-6">
                                        {[
                                            {
                                                n: 1, title: 'Account Creation',
                                                body: 'Visit /register and provide your email and a secure password, or click "Sign in with Google" for one-click setup. A verification email is sent immediately — confirm it to activate your account. Google sign-in skips this step entirely.'
                                            },
                                            {
                                                n: 2, title: 'Plan Selection',
                                                body: 'All plans include every feature. You choose based on usage quotas: Starter ($15/mo — 5 users, 50 AI queries/mo), Pro ($45/mo — 25 users, 500 AI queries/mo), Enterprise ($80/mo — unlimited everything). 14-day free trial on all plans, no credit card required.'
                                            },
                                            {
                                                n: 3, title: 'Business Workspace Setup',
                                                body: 'Complete the onboarding wizard: enter your business name, upload your logo (minimum 400×400px PNG recommended), set your default currency, timezone, and business address. This data auto-populates all future invoices, contracts, and client-facing pages.'
                                            },
                                            {
                                                n: 4, title: 'Initial Integrations',
                                                body: 'During onboarding you\'re prompted to connect Gmail and Calendly. These are optional but highly recommended — connecting them immediately transforms the platform from a standalone tool into a unified business hub. Both connections take under 2 minutes each.'
                                            },
                                        ].map(step => (
                                            <li key={step.n} className="flex gap-4">
                                                <div className="w-7 h-7 rounded-full bg-teal-500 text-slate-950 flex-shrink-0 flex items-center justify-center text-xs font-bold">{step.n}</div>
                                                <div>
                                                    <p className="text-white font-semibold mb-1">{step.title}</p>
                                                    <p className="text-sm text-slate-400 leading-relaxed">{step.body}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            </div>
                        </div>

                        {/* 2. Business Home */}
                        <div id="home" className="scroll-mt-24">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                    <LayoutDashboard className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-blue-500 font-semibold uppercase tracking-wider mb-1">Module 2</p>
                                    <h2 className="text-3xl font-bold text-white">Business Home — Mission Control</h2>
                                </div>
                            </div>
                            <p className="text-slate-400 mb-8 leading-relaxed">
                                The Business Home is your real-time command center. From here you can see live stats across your entire operation, access any module via the sidebar, and use Global Command Search to navigate the platform instantly. Think of it as the Google Analytics and Slack notifications of your entire business combined into one screen.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    {
                                        color: 'text-indigo-400', title: 'Real-time Analytics Panel',
                                        desc: 'The header stats bar shows active projects (count), month-to-date revenue, number of outstanding invoices, pending deals in pipeline, and platform health indicator — all refreshed every 30 seconds automatically.'
                                    },
                                    {
                                        color: 'text-teal-400', title: 'Global Command Search (Ctrl+K)',
                                        desc: 'Press Ctrl+K from anywhere in the dashboard to open omni-search. Search across CRM contacts, invoices, contracts, projects, and documents simultaneously. Results appear in under 200ms. Click any result to navigate directly to that record.'
                                    },
                                    {
                                        color: 'text-blue-400', title: 'Quick Action Tray',
                                        desc: 'The blue "+" button in the bottom-right corner gives you a contextual quick-add menu: New Invoice, New Contact, New Task, New Meeting, or New Contract — always accessible regardless of which module you\'re currently viewing.'
                                    },
                                    {
                                        color: 'text-amber-400', title: 'Notification Feed',
                                        desc: 'The bell icon in the top bar shows real-time notifications: new lead qualifications from the Growth Agent, invoice payments received, upcoming meeting reminders, and team activity alerts. Configure which alerts you receive in Settings → Notifications.'
                                    },
                                ].map((item, i) => (
                                    <div key={i} className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                                        <h4 className={`${item.color} font-bold mb-3`}>{item.title}</h4>
                                        <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3. CRM & Deals */}
                        <div id="crm" className="scroll-mt-24">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                    <Users className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider mb-1">Module 3</p>
                                    <h2 className="text-3xl font-bold text-white">CRM & Deals</h2>
                                </div>
                            </div>
                            <p className="text-slate-400 mb-6 leading-relaxed">
                                The AlphaClone CRM is the central nervous system of the platform. Every client relationship, deal, communication, and financial interaction connects back to a CRM record. Unlike standalone CRM tools, AlphaClone's CRM is natively connected to invoicing, contracts, calendar events, and the AI Growth Agent — so context never needs to be duplicated between systems.
                            </p>
                            <div className="space-y-6">
                                {[
                                    {
                                        title: 'Contact Directory',
                                        body: 'The CRM Directory holds individual and organization records. Each contact profile includes: full contact details, communication history (emails via Gmail integration), all sent invoices and contracts, project associations, meeting history from calendar integration, AI outreach conversations, and custom tags and notes. Navigate to CRM → Contacts to access the full directory.',
                                    },
                                    {
                                        title: 'Sales Pipeline & Deal Management',
                                        body: 'The pipeline view (CRM → Deals) uses a drag-and-drop Kanban board with four standard stages: Discovery, Proposal, Negotiation, and Won. Moving a deal between stages automatically updates the associated project status. You can add custom stages for your specific sales process from Settings → CRM → Pipeline Stages. Each deal card shows deal value, contact name, last activity date, and next scheduled action.',
                                    },
                                    {
                                        title: 'Bulk Import & Export',
                                        body: 'Import contacts from any CSV file via CRM → Contacts → Import. The import wizard automatically detects column headers and suggests field mappings. Supports up to 5,000 contacts per import. Export all CRM data at any time via CRM → Contacts → Export as CSV or JSON. Exports are available immediately and include all custom fields and tags.',
                                    },
                                    {
                                        title: 'AI Lead Integration',
                                        body: 'Leads discovered by the Growth Agent appear directly in the CRM pipeline with an "AI Sourced" tag and full outreach conversation history. When the AI qualifies a lead as sales-ready, it creates a new deal in the Discovery stage and notifies you via the notification feed. From that point, you take over the conversation with full context already populated.',
                                    },
                                ].map((item, i) => (
                                    <div key={i} className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                                        <div className="flex items-center gap-2 mb-3">
                                            <ChevronRight className="w-4 h-4 text-teal-400" />
                                            <h4 className="text-white font-bold">{item.title}</h4>
                                        </div>
                                        <p className="text-sm text-slate-400 leading-relaxed">{item.body}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 4. Growth Agent */}
                        <div id="growth-agent" className="scroll-mt-24">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                                    <Zap className="w-6 h-6 text-teal-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-teal-500 font-semibold uppercase tracking-wider mb-1">Module 4</p>
                                    <h2 className="text-3xl font-bold text-white">AI Growth Agent</h2>
                                </div>
                            </div>
                            <p className="text-slate-400 mb-8 leading-relaxed">
                                The AI Growth Agent is AlphaClone's flagship feature — a continuously running automated sales development system that identifies leads, manages outreach, qualifies prospects through AI conversation, and delivers warm leads to your CRM. Available on Pro and Enterprise plans. No separate setup, third-party API keys, or technical configuration required.
                            </p>
                            <div className="bg-gradient-to-br from-teal-900/20 to-blue-900/20 rounded-3xl p-8 border border-white/5 mb-6">
                                <h4 className="text-teal-400 font-bold mb-6 text-lg">Using the Growth Agent — Step by Step</h4>
                                <ul className="space-y-6">
                                    {[
                                        {
                                            title: 'Step 1: Configure Business Context',
                                            body: 'Navigate to Growth Agent → Settings → Business Context. Describe your services, target market, typical client size, and primary pain points you solve. The more specific you are, the higher quality the AI\'s targeting and outreach messages. Recommended: spend 5–10 minutes writing thorough context. This is a one-time setup that dramatically improves all subsequent agent behavior.',
                                        },
                                        {
                                            title: 'Step 2: Lead Discovery (Scraping)',
                                            body: 'Go to Growth Agent → Discover Leads → Scrape. Enter a target description (e.g., "digital marketing agencies in Cape Town with under 30 employees"). The agent scans public business directories, LinkedIn-compatible sources, and industry databases. Results typically return within 2–5 minutes. Review the lead list, de-select any irrelevant entries, then click "Add to CRM" or "Begin Outreach."',
                                        },
                                        {
                                            title: 'Step 3: AI-Managed Outreach',
                                            body: 'When outreach is activated, the Growth Agent sends personalized first-contact messages to each lead. When a lead replies, the agent continues the conversation: asking discovery questions about their current tools, team size, pain points, and budget. It handles objections, provides information about your services, and continues the dialogue. You can review all active conversations in real time from the Growth Agent → Conversations tab.',
                                        },
                                        {
                                            title: 'Step 4: Lead Qualification & Handoff',
                                            body: 'When a lead meets your qualification criteria (budget confirmed, problem confirmed, timeline established), the Growth Agent flags the conversation as "Qualified — Ready for Human Handoff," moves the contact to your CRM pipeline in the Proposal stage, and sends you a notification. You then step in to close the deal with the full conversation context already available.',
                                        },
                                        {
                                            title: 'Step 5: Manual Context & Targeting',
                                            body: 'You can supplement the AI\'s discovery with manual lead lists. Upload a CSV of targets via Growth Agent → Manual Leads. The agent will send your configured outreach sequence to these leads as well, maintaining the same AI-managed conversation flow. This is ideal for targeting specific named accounts or event attendee lists.',
                                        },
                                    ].map((step, i) => (
                                        <li key={i} className="flex gap-4">
                                            <div className="mt-1"><CheckCircle2 className="w-5 h-5 text-teal-500 flex-shrink-0" /></div>
                                            <div>
                                                <p className="text-white font-bold mb-1">{step.title}</p>
                                                <p className="text-slate-400 text-sm leading-relaxed">{step.body}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* 5. Communications & Integrations */}
                        <div id="integrations" className="scroll-mt-24">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                    <Globe className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-blue-500 font-semibold uppercase tracking-wider mb-1">Module 5</p>
                                    <h2 className="text-3xl font-bold text-white">Communications & Integrations</h2>
                                </div>
                            </div>
                            <p className="text-slate-400 mb-8 leading-relaxed">
                                AlphaClone centralizes your communication stack with native Gmail integration, a built-in HD video platform, and smart scheduling via Calendly. All communication channels display CRM context simultaneously — you never need to switch tabs to see a client's history while reading their email or preparing for a call.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 flex flex-col">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Mail className="w-6 h-6 text-red-400" />
                                        <h4 className="text-xl font-bold text-white">Gmail Integration</h4>
                                    </div>
                                    <div className="space-y-3 flex-1">
                                        <p className="text-sm text-slate-400 leading-relaxed">Connect your Google account to read, draft, and send emails directly within the Business OS. Every email thread is contextually linked to the matching CRM contact automatically.</p>
                                        <p className="text-sm text-slate-400 leading-relaxed"><strong className="text-white">What you can do:</strong> read full inbox, compose and reply with full formatting, attach documents from Document Hub, view CRM profile alongside any email, create tasks directly from email threads, set email follow-up reminders.</p>
                                        <p className="text-sm text-slate-400 leading-relaxed"><strong className="text-white">Privacy:</strong> Emails are retrieved in real-time via Google's API. AlphaClone does not store your email content on its servers.</p>
                                    </div>
                                    <p className="text-[10px] text-teal-500/70 font-mono uppercase tracking-tighter mt-4">Navigation: Settings → Integrations → Gmail</p>
                                </div>

                                <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 flex flex-col">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Video className="w-6 h-6 text-blue-400" />
                                        <h4 className="text-xl font-bold text-white">HD Video Platform</h4>
                                    </div>
                                    <div className="space-y-3 flex-1">
                                        <p className="text-sm text-slate-400 leading-relaxed">AlphaClone includes a built-in HD video conferencing platform. Start instant calls with clients or join scheduled board meetings directly from the sidebar. No external app or Zoom account required.</p>
                                        <p className="text-sm text-slate-400 leading-relaxed"><strong className="text-white">Features:</strong> HD video and audio, screen sharing, meeting recording (saved to Document Hub), in-call task creation, shareable meeting links (clients join via browser — no app install), and team internal rooms.</p>
                                    </div>
                                    <p className="text-[10px] text-blue-500/70 font-mono uppercase tracking-tighter mt-4">Navigation: Dashboard → Active Meetings</p>
                                </div>

                                <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 flex flex-col md:col-span-2">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Calendar className="w-6 h-6 text-blue-500" />
                                        <h4 className="text-xl font-bold text-white">Calendly & Scheduling Integration</h4>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <p className="text-sm text-slate-400 leading-relaxed">
                                            Connect your Calendly account to enable branded client booking pages and automatic appointment syncing. Two connection methods are available:
                                            <br /><br />
                                            <strong className="text-white">Manual URL:</strong> Paste your Calendly URL in Settings → Integrations → Calendly. Immediate setup, no OAuth required. New appointments show in Calendly but not auto-synced to AlphaClone dashboard.
                                            <br /><br />
                                            <strong className="text-white">OAuth Integration:</strong> Full two-way sync. New bookings auto-create CRM contacts, add dashboard calendar events, and trigger confirmation emails branded to your workspace.
                                        </p>
                                        <div className="space-y-4">
                                            {[
                                                'Branded booking page (business name + logo applied)',
                                                'OAuth two-way sync for automatic appointment updates',
                                                'Auto-creates CRM contact for every new booking',
                                                'Confirmation emails with your branding',
                                                'Multiple meeting type configuration (Discovery, Check-In, Board)',
                                                'Buffer time and availability window management',
                                            ].map((feat, i) => (
                                                <div key={i} className="flex gap-3 text-xs">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
                                                    <span className="text-slate-300">{feat}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-teal-500/70 font-mono uppercase tracking-tighter mt-4">Navigation: Settings → Integrations → Calendly</p>
                                </div>
                            </div>
                        </div>

                        {/* 6. Financial Management */}
                        <div id="financials" className="scroll-mt-24">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                                    <Receipt className="w-6 h-6 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-green-500 font-semibold uppercase tracking-wider mb-1">Module 6</p>
                                    <h2 className="text-3xl font-bold text-white">Financial Suite & Accounting</h2>
                                </div>
                            </div>
                            <p className="text-slate-400 mb-6 leading-relaxed">
                                The AlphaClone Financial Suite replaces standalone accounting software like QuickBooks or FreshBooks for most small and medium businesses. It includes professional invoicing, quote management, full double-entry accounting, and financial reporting — all connected to your CRM so every financial transaction links to the right client record.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    {
                                        icon: DollarSign, color: 'text-green-400',
                                        title: 'Invoicing',
                                        items: [
                                            'Generate branded invoices in under 60 seconds',
                                            'Automatic client detail population from CRM',
                                            'Payment tracking (Paid / Pending / Overdue)',
                                            'Direct payment link included in every invoice',
                                            'Automated overdue payment reminders',
                                            'Convert quotes to invoices in one click',
                                            'PDF download and shareable link options',
                                        ]
                                    },
                                    {
                                        icon: BarChart3, color: 'text-emerald-400',
                                        title: 'Full Accounting Suite',
                                        items: [
                                            'Chart of Accounts (standard double-entry structure)',
                                            'Journal entry recording and audit trail',
                                            'Profit & Loss statement (real-time)',
                                            'Balance sheet reporting',
                                            'Cash flow tracking',
                                            'Expense categorization and tracking',
                                            'Tax-ready financial exports',
                                        ]
                                    },
                                ].map((col, i) => (
                                    <div key={i} className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                                        <div className="flex items-center gap-2 mb-4">
                                            <col.icon className={`w-5 h-5 ${col.color}`} />
                                            <h4 className="font-bold text-white">{col.title}</h4>
                                        </div>
                                        <ul className="space-y-2">
                                            {col.items.map((item, ii) => (
                                                <li key={ii} className="flex items-start gap-2 text-sm text-slate-400">
                                                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                                <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-1">Navigation Paths</p>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    {[
                                        'Finance → Invoices', 'Finance → Quotes',
                                        'Finance → Accounting', 'Finance → Reports',
                                        'Finance → Expenses', 'Finance → Settings',
                                    ].map((path, i) => (
                                        <p key={i} className="text-[10px] text-green-500/70 font-mono">{path}</p>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 7. Contracts */}
                        <div id="contracts" className="scroll-mt-24">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                                    <FileText className="w-6 h-6 text-violet-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-violet-500 font-semibold uppercase tracking-wider mb-1">Module 7</p>
                                    <h2 className="text-3xl font-bold text-white">Contract Engine & E-Signatures</h2>
                                </div>
                            </div>
                            <p className="text-slate-400 mb-6 leading-relaxed">
                                The Contract Engine allows you to draft professional legal contracts using AI assistance and collect legally valid electronic signatures — all without a separate DocuSign account or a lawyer for standard agreements. Navigation: Dashboard → Contracts.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { title: 'Create Contract', desc: 'Click "New Contract." Describe the scope, parties, and key terms. The AI drafts a professional contract framework. Review and edit before sending.' },
                                    { title: 'Send for Signature', desc: 'Click "Send for Signature." The client receives an email with a secure link. They can sign from any device — no AlphaClone account required on their end.' },
                                    { title: 'Storage & History', desc: 'Signed contracts are stored in Document Hub, linked to the client\'s CRM record. Both parties receive a signed PDF automatically upon completion.' },
                                ].map((step, i) => (
                                    <div key={i} className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-6 h-6 rounded-full bg-violet-500 text-white flex items-center justify-center text-xs font-bold">{i + 1}</div>
                                            <h4 className="font-bold text-white text-sm">{step.title}</h4>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 8. Tasks & Projects */}
                        <div id="tasks" className="scroll-mt-24">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                    <CheckSquare className="w-6 h-6 text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-amber-500 font-semibold uppercase tracking-wider mb-1">Module 8</p>
                                    <h2 className="text-3xl font-bold text-white">Task & Project Management</h2>
                                </div>
                            </div>
                            <p className="text-slate-400 mb-6 leading-relaxed">
                                AlphaClone includes a full project and task management system linked directly to your CRM and financial records. Projects are automatically created when deals move to "Won" in the pipeline, and tasks within those projects can be assigned to team members with deadlines and priority levels.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { title: 'Projects', desc: 'Projects group all work for a specific client engagement. Each project has a status (Active / Paused / Complete), associated CRM contact, linked invoices, task list, and team assignment. Navigate to Projects in the sidebar.' },
                                    { title: 'Task Boards', desc: 'Tasks use a Kanban board with customizable columns. Drag tasks between columns to update status. Each task supports priority levels, deadlines, file attachments, comments, and subtasks.' },
                                    { title: 'Team Assignment', desc: 'Assign tasks to any team member from the task card. Assignees receive a notification and the task appears in their personal My Tasks view. Managers can see all team tasks via the Team Board view.' },
                                    { title: 'Time Tracking', desc: 'Start a timer on any task to track time spent. Time logs are visible per task, per project, and per team member. Export time reports for client billing or internal productivity reviews.' },
                                ].map((item, i) => (
                                    <div key={i} className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                                        <h4 className="text-white font-bold mb-2">{item.title}</h4>
                                        <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 9. Security */}
                        <div id="security" className="scroll-mt-24">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                                    <ShieldCheck className="w-6 h-6 text-rose-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-rose-500 font-semibold uppercase tracking-wider mb-1">Module 9</p>
                                    <h2 className="text-3xl font-bold text-white">Security & Compliance</h2>
                                </div>
                            </div>
                            <p className="text-slate-400 mb-6 leading-relaxed">
                                AlphaClone implements enterprise-grade security at every layer — from individual data encryption to network-level DDoS protection. All security features are active by default; no configuration is required to benefit from baseline protection.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { title: 'RBAC', desc: 'Role-Based Access Control. Assign Admin, Manager, Member, or Viewer roles. Configure project-level access for contractors and external stakeholders. Navigate: Settings → Security → Access Roles.' },
                                    { title: 'SIEM Audit Logs', desc: 'Continuous audit trail of all platform activity. Logs include: who accessed what, when, from which IP. Available to Admin users via Settings → Security → Audit Log.' },
                                    { title: 'Perimeter Guard', desc: 'Real-time IP threat intelligence and automated DDoS mitigation. Operates at network level — no configuration required. Incident reports available via Settings → Security → Incident Log.' },
                                    { title: 'Data Encryption', desc: 'All data encrypted at rest (AES-256) and in transit (TLS 1.3). Database-level encryption for all CRM, financial, and document data.' },
                                    { title: 'GDPR Compliance', desc: 'Full GDPR-compliant data handling. Right to erasure supported — delete any contact and all associated data is purged from our systems permanently within 72 hours.' },
                                    { title: '2FA Authentication', desc: 'Two-factor authentication available for all accounts. Enable via Settings → Security → Two-Factor Authentication. Supports authenticator apps and SMS.' },
                                ].map((item, i) => (
                                    <div key={i} className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 text-center">
                                        <h5 className="text-white font-bold mb-2 text-sm">{item.title}</h5>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 10. Settings */}
                        <div id="settings" className="scroll-mt-24">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center">
                                    <Settings className="w-6 h-6 text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Module 10</p>
                                    <h2 className="text-3xl font-bold text-white">Settings & Configuration</h2>
                                </div>
                            </div>
                            <p className="text-slate-400 mb-6 leading-relaxed">
                                All platform-wide settings are available under the Settings icon in the sidebar. Organized into logical sections so you can find what you need without a search function.
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {[
                                    { section: 'Workspace', items: ['Business name & logo', 'Currency & timezone', 'Business address & VAT'] },
                                    { section: 'Integrations', items: ['Gmail OAuth', 'Calendly (OAuth + Manual)', 'Stripe Payments'] },
                                    { section: 'Team', items: ['Invite & manage members', 'Role assignment', 'Project access control'] },
                                    { section: 'Payments & Billing', items: ['Subscription plan', 'Payment method', 'Invoice history'] },
                                    { section: 'Finance', items: ['Invoice templates', 'Tax rates', 'Payment reminders'] },
                                    { section: 'Notifications', items: ['Email alert preferences', 'In-app notification settings', 'Digest frequency'] },
                                ].map((group, i) => (
                                    <div key={i} className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                                        <h5 className="text-teal-400 font-semibold text-sm mb-3">{group.section}</h5>
                                        <ul className="space-y-1">
                                            {group.items.map((item, ii) => (
                                                <li key={ii} className="text-xs text-slate-500">{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Support CTA */}
                        <div className="bg-gradient-to-r from-teal-500/10 to-blue-500/10 p-12 rounded-3xl border border-white/5 text-center">
                            <h3 className="text-2xl font-bold text-white mb-4">Need Help or a Custom Deployment?</h3>
                            <p className="text-slate-400 mb-8 max-w-xl mx-auto">
                                The AlphaClone engineering team can assist with custom AI integration flows, private database clusters, security compliance audits, and enterprise onboarding for large teams.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button
                                    onClick={() => window.location.href = 'mailto:support@alphaclonesystems.com'}
                                    className="bg-teal-500 text-slate-950 hover:bg-teal-400 font-bold px-10 py-4 h-auto text-base rounded-2xl shadow-xl shadow-teal-500/20"
                                >
                                    Contact Engineering Team
                                </Button>
                                <Link href="/guide">
                                    <Button variant="outline" className="border-slate-700 hover:bg-slate-800 px-10 py-4 h-auto text-base rounded-2xl">
                                        Read Full Guide
                                    </Button>
                                </Link>
                            </div>
                        </div>

                    </section>
                </main>
            </div>

            <footer className="border-t border-slate-900 py-12 text-center text-slate-600 text-sm">
                © {new Date().getFullYear()} AlphaClone Systems. Built for Scale.
                <span className="mx-4">·</span>
                <Link href="/guide" className="hover:text-slate-400 transition-colors">Full Onboarding Guide</Link>
                <span className="mx-4">·</span>
                <Link href="/services" className="hover:text-slate-400 transition-colors">All Services</Link>
                <span className="mx-4">·</span>
                <a href="mailto:support@alphaclonesystems.com" className="hover:text-slate-400 transition-colors">support@alphaclonesystems.com</a>
            </footer>
        </div>
    );
}

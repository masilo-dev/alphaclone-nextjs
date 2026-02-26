'use client';

import React from 'react';
import Link from 'next/link';
import {
    Bot, Database, Shield, Zap, BarChart3, Settings, Globe,
    CheckCircle, ArrowRight, Star, Clock, Users, DollarSign,
    Mail, Video, FileText, Calendar, TrendingUp, Layers,
    Award, Lock, RefreshCw, Phone
} from 'lucide-react';
import { Button } from '../ui/UIComponents';
import PublicNavigation from '../PublicNavigation';

const ServicesPage: React.FC = () => {
    const [, setIsLoginOpen] = React.useState(false);

    const blufSummary = `AlphaClone Systems is a single AI-powered Business Operating System that replaces your CRM, invoicing software, contract tools, video meetings platform, email client, and sales automation — all in one subscription starting at $15/month. If your business currently uses 5 or more separate SaaS tools to manage clients, finances, and communications, AlphaClone eliminates the overhead, the context-switching, and the combined monthly cost.`;

    const services = [
        {
            icon: Bot,
            title: 'AI Growth Agent',
            subtitle: 'Your always-on automated sales partner',
            color: 'from-teal-500 to-emerald-500',
            badge: 'Most Popular',
            description: `The AlphaClone AI Growth Agent is the most powerful feature on the platform — and one that no competing business tool offers at this price point. Think of it as hiring a full-time sales development representative who works 24 hours a day, 7 days a week, and never takes a vacation day.`,
            extendedDescription: `The Growth Agent works by scanning public business directories and professional databases to identify potential clients in your exact industry and target market. You tell it who you're looking for — "marketing agencies in London with under 50 employees" or "e-commerce brands doing over $1M revenue" — and it builds a qualified lead list automatically. Once it has the leads, it initiates outreach conversations using AI-powered messaging that is crafted to match your tone and service offering. It qualifies each lead by asking intelligent discovery questions, filters out unqualified prospects, and hands you only the warm conversations ready to close. For most businesses, this alone replaces the cost of a dedicated sales hire — at $45/month instead of $5,000/month.`,
            features: [
                'Automated lead discovery across public directories',
                'AI-powered outreach and qualification conversations',
                'Industry and geography targeting filters',
                'Lead scoring and prioritization',
                'Seamless handoff to your CRM when a lead is qualified',
                'Full conversation history and context tracking',
            ],
            impact: 'Average: 40+ qualified leads per month on autopilot',
        },
        {
            icon: Database,
            title: 'Enterprise CRM',
            subtitle: 'Know every client, every deal, every interaction',
            color: 'from-blue-500 to-indigo-500',
            badge: 'Core Feature',
            description: `Most small businesses track clients in spreadsheets, sticky notes, or their inbox. That approach breaks down the moment you have more than 20 active clients. AlphaClone's Enterprise CRM gives you a professional, searchable, interconnected database of every client relationship — the kind of system that enterprise companies pay $50,000/year for, available to your business from day one.`,
            extendedDescription: `Every client in the CRM has a full profile: contact history, all email threads (pulled from your Gmail integration), every invoice and contract sent, notes and call logs, associated projects and tasks, and their position in your sales pipeline. The pipeline management is drag-and-drop — you move deals from Discovery to Proposal to Negotiation to Won, and the system automatically updates project statuses and triggers follow-up reminders. The CRM also integrates directly with your calendar, so every meeting you schedule with a client appears on their profile, and every new booking from your public scheduling page automatically creates or updates the right client record. No manual data entry required.`,
            features: [
                'Full client profiles with communication history',
                'Visual drag-and-drop sales pipeline',
                'Automated deal stage management',
                'Global search across all records',
                'Client tagging and segmentation',
                'Activity logs, notes, and call records',
            ],
            impact: 'Save 5+ hours per week on client administration',
        },
        {
            icon: DollarSign,
            title: 'Financial Suite & Invoicing',
            subtitle: 'Professional accounting without the accountant',
            color: 'from-emerald-500 to-teal-500',
            badge: 'Replaces QuickBooks',
            description: `AlphaClone includes a complete financial management system that handles everything from sending your first invoice to producing year-end financial statements. For the vast majority of small businesses, it completely replaces the need for separate accounting software like QuickBooks or FreshBooks.`,
            extendedDescription: `You can generate, brand, and send a professional invoice in under 60 seconds. Invoices include your logo, itemized line items, payment terms, and a direct payment link. The system tracks payment status automatically — you see at a glance which invoices are paid, pending, or overdue. Beyond invoicing, the full accounting suite gives you a proper Chart of Accounts, journal entry recording, income statements, balance sheets, and cash flow reports. This is the same professional-grade accounting structure that your accountant expects to see at tax time — just presented in a way that a business owner without an accounting degree can actually understand and use.`,
            features: [
                'Branded professional invoice generation',
                'Automated payment status tracking',
                'Quote creation with one-click invoice conversion',
                'Full chart of accounts and journal entries',
                'P&L statements and balance sheets',
                'Expense tracking and categorization',
            ],
            impact: 'Eliminate $300+/month in accounting software costs',
        },
        {
            icon: FileText,
            title: 'Contract Engine & E-Signatures',
            subtitle: 'Legal contracts in minutes, signed without a lawyer',
            color: 'from-violet-500 to-purple-500',
            badge: 'Replaces DocuSign',
            description: `Every service business sends contracts — but most small businesses either use generic templates downloaded from the internet, or spend hundreds per hour on a lawyer. AlphaClone's Contract Engine solves this permanently by combining AI-assisted contract drafting with built-in electronic signature collection.`,
            extendedDescription: `When you need a service agreement, NDA, freelance contract, or onboarding agreement, you simply describe the scope of work and key terms, and AlphaClone drafts a professional contract framework in seconds. You review, customize the specifics, and send it to your client for e-signature — all within the same platform. The client receives an email with a secure signing link, signs with a legally valid electronic signature, and both parties receive a signed PDF copy automatically. The signed contracts are stored in your Document Hub, linked to the client's CRM record, so you always know what was agreed and when. This workflow alone saves most service businesses $200-500 per month compared to using DocuSign and a lawyer.`,
            features: [
                'AI-assisted contract drafting',
                'E-signature collection (legally valid)',
                'NDAs, service agreements, proposals',
                'Automatic signed copy distribution',
                'Contract storage linked to CRM profiles',
                'Signature status tracking and reminders',
            ],
            impact: 'From contract draft to signed in under 10 minutes',
        },
        {
            icon: Mail,
            title: 'Integrated Gmail & Communications',
            subtitle: 'All your client emails, inside your CRM',
            color: 'from-red-500 to-orange-500',
            badge: 'Context-Aware',
            description: `One of the most common frustrations for service business owners is the constant tab-switching between their email client and their CRM or project management tool. You get an email from a client, and then you have to go look them up somewhere else to see what's happening with their project. AlphaClone eliminates this completely by embedding your Gmail inbox directly inside the Business OS.`,
            extendedDescription: `Once you connect your Google account (a 60-second process), all your Gmail emails become visible inside AlphaClone with full CRM context alongside them. When you open a client email, you can simultaneously see their open projects, outstanding invoices, previous conversations, and next meeting — all without leaving the screen. You can draft and send replies with your full email signature, schedule follow-ups, and attach documents from your Document Hub. Every email thread is also automatically logged to the corresponding CRM record, so when a team member needs to catch up on a client relationship, the full history is there instantly.`,
            features: [
                'Gmail inbox embedded inside dashboard',
                'CRM context visible alongside emails',
                'Send, reply, and draft from within AlphaClone',
                'Auto-logging of emails to client profiles',
                'Follow-up scheduling and reminders',
                'Full email signature support',
            ],
            impact: 'Eliminate context-switching between email and CRM',
        },
        {
            icon: Video,
            title: 'HD Video Meetings',
            subtitle: 'Client calls without Zoom or Teams',
            color: 'from-blue-600 to-cyan-500',
            badge: 'Built-In',
            description: `Video conferencing has become as essential as having a phone number for modern service businesses. But maintaining a separate Zoom subscription, managing meeting links, and then manually updating your CRM after every call adds friction and cost. AlphaClone includes a full HD video meeting platform built directly into the dashboard.`,
            extendedDescription: `You can start an instant call with any client from their CRM profile with one click, or join scheduled board meetings through the Active Meetings panel. Meeting recordings are stored directly in your Document Hub, linked to the relevant client and project. There's no need to share invitation links via email, create dummy calendar events, or update meeting notes separately — everything happens in one place. For businesses that run multiple client calls per week, this alone saves significant time in meeting logistics and follow-up administration.`,
            features: [
                'HD video and audio quality',
                'One-click calls from any CRM profile',
                'Built-in meeting scheduling',
                'Recording storage in Document Hub',
                'Screen sharing and collaboration',
                'No external app or plugin required',
            ],
            impact: 'Run 10+ client calls per week with zero meeting overhead',
        },
        {
            icon: Calendar,
            title: 'Smart Scheduling & Calendly Integration',
            subtitle: 'Branded booking pages that sync automatically',
            color: 'from-indigo-500 to-blue-500',
            badge: 'Auto-Sync',
            description: `Professional scheduling is the first impression many clients have of your business. An unbranded or clunky booking experience undermines the premium positioning you're trying to establish. AlphaClone gives you a branded client-facing booking page and automatically syncs all new appointments to your dashboard without any manual work.`,
            extendedDescription: `AlphaClone supports both a quick-start manual URL connection (paste your existing Calendly link in 30 seconds) and a full OAuth integration for two-way automatic syncing. When a prospect books a meeting through your scheduling page, AlphaClone automatically creates or updates the corresponding CRM record, adds the meeting to your dashboard calendar, and sends confirmation details to both parties. If you're running multiple types of meetings — initial consultations, project check-ins, and board reviews, for example — you can configure different booking types with different durations, availability windows, and client question forms.`,
            features: [
                'Branded client booking pages',
                'OAuth automatic appointment syncing',
                'Manual Calendly URL integration option',
                'Multiple meeting type configuration',
                'Auto CRM record creation from bookings',
                'Confirmation and reminder emails',
            ],
            impact: 'Convert leads to booked meetings without back-and-forth',
        },
        {
            icon: Shield,
            title: 'Security, RBAC & Compliance',
            subtitle: 'Enterprise-grade protection for your business data',
            color: 'from-rose-500 to-red-600',
            badge: 'Enterprise-Grade',
            description: `Data breaches and unauthorized access are not just problems for big corporations — they can be catastrophically damaging for small businesses. A leaked client list, a compromised contract, or an employee accessing data they shouldn't see can mean losing clients, facing legal liability, and destroying the trust you've spent years building. AlphaClone is built with enterprise-grade security at every layer.`,
            extendedDescription: `Role-Based Access Control (RBAC) means you decide exactly what each team member or contractor can see and do inside the platform. Your accountant can access financial records but not client contracts. A junior project manager can update task status but not view invoices. An external stakeholder can be given limited dashboard access for their project only. Every action on the platform is logged in a continuous SIEM (Security Information and Event Management) audit trail — so you always know who accessed what, when, and from where. The platform also includes real-time IP threat intelligence and automated DDoS mitigation to protect against external attacks.`,
            features: [
                'Role-based access control (RBAC)',
                'Continuous SIEM audit logging',
                'Real-time IP threat monitoring',
                'DDoS mitigation',
                'Data encryption at rest and in transit',
                'GDPR-compliant data handling',
            ],
            impact: 'Security posture equivalent to Fortune 500 enterprises',
        },
        {
            icon: BarChart3,
            title: 'Analytics & Business Intelligence',
            subtitle: 'Real-time insights across your entire operation',
            color: 'from-amber-500 to-orange-500',
            badge: 'Data-Driven',
            description: `Making business decisions based on gut feeling is what keeps most small businesses stuck. AlphaClone's analytics layer turns all your operational data — client activity, revenue trends, pipeline movement, task completion rates, and team productivity — into clear, actionable dashboards that you can actually read and act on.`,
            extendedDescription: `The Mission Control dashboard gives you a real-time overview of your business health: active projects, month-to-date revenue, outstanding receivables, pipeline value, and team workloads — all visible in a single screen. You can drill down into any metric to see the underlying data. Revenue reports break down earnings by client, service type, and time period. Pipeline analytics show you conversion rates at each stage, average deal size, and the velocity of deals through your funnel. Team productivity metrics show task completion rates, time-to-completion, and workload distribution. All of this data is live and refreshes automatically — no manual reporting or spreadsheet compilation required.`,
            features: [
                'Real-time Mission Control dashboard',
                'Revenue analytics by client and service',
                'Pipeline conversion rate tracking',
                'Team productivity and workload metrics',
                'Custom date range reporting',
                'Exportable reports for stakeholders',
            ],
            impact: 'Make data-driven decisions without a data analyst',
        },
    ];

    const comparisonTools = [
        { name: 'HubSpot CRM', cost: '$90/mo', replaced: 'CRM & Pipeline' },
        { name: 'QuickBooks', cost: '$35/mo', replaced: 'Accounting & Invoicing' },
        { name: 'DocuSign', cost: '$25/mo', replaced: 'Contracts & E-Signatures' },
        { name: 'Zoom', cost: '$20/mo', replaced: 'Video Meetings' },
        { name: 'Calendly', cost: '$15/mo', replaced: 'Scheduling' },
        { name: 'Asana/Monday', cost: '$25/mo', replaced: 'Task Management' },
        { name: 'LinkedIn Sales Nav', cost: '$100/mo', replaced: 'Lead Generation' },
        { name: 'Notion', cost: '$20/mo', replaced: 'Docs & Knowledge Base' },
    ];

    const totalOld = comparisonTools.reduce((sum, t) => sum + parseInt(t.cost), 0);

    return (
        <div className="min-h-screen bg-transparent text-white">
            <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />

            {/* BLUF Summary — SSR rendered above the fold */}
            <div className="pt-20">
                <section className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/50 py-16">
                    <div className="max-w-4xl mx-auto px-4">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                            <span className="text-teal-400 text-sm font-semibold tracking-widest uppercase">The Bottom Line</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                            One Platform.{' '}
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-400">
                                Ten Tools. Replaced.
                            </span>
                        </h1>
                        <p className="text-xl text-slate-300 leading-relaxed max-w-3xl">
                            {blufSummary}
                        </p>
                        <div className="mt-8 flex flex-col sm:flex-row gap-4">
                            <Link href="/register">
                                <Button className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-8 py-4 h-auto text-lg">
                                    Start Free Trial
                                </Button>
                            </Link>
                            <Link href="/guide">
                                <Button variant="outline" className="border-slate-700 hover:bg-slate-800 px-8 py-4 h-auto text-lg">
                                    View Setup Guide
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Cost Comparison Banner */}
                <section className="py-16 bg-slate-950">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">
                                Stop Paying for 8 Subscriptions
                            </h2>
                            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                                The average small business spends ${totalOld}/month on the tools AlphaClone replaces. We charge $45/month for all of them.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                            {comparisonTools.map((tool, idx) => (
                                <div key={idx} className="bg-white/[0.04] backdrop-blur-sm border border-slate-700/60 rounded-xl p-4 relative group">
                                    <div className="absolute inset-0 bg-red-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="text-slate-500 line-through text-sm">{tool.cost}/mo</div>
                                    <div className="font-semibold text-slate-300 text-sm mt-1">{tool.name}</div>
                                    <div className="text-xs text-teal-500 mt-1">{tool.replaced}</div>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-center gap-6 text-center p-6 bg-gradient-to-r from-teal-900/30 to-blue-900/30 rounded-2xl border border-teal-500/20">
                            <div>
                                <div className="text-4xl font-bold text-slate-500 line-through">${totalOld}/mo</div>
                                <div className="text-sm text-slate-500">8 separate tools</div>
                            </div>
                            <ArrowRight className="w-8 h-8 text-teal-400 flex-shrink-0" />
                            <div>
                                <div className="text-4xl font-bold text-teal-400">$45/mo</div>
                                <div className="text-sm text-teal-300">everything unified</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Services — Full Detail */}
                <section className="py-16 bg-slate-950">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">Every Service, In Depth</h2>
                            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                                Here's exactly what you get when you join AlphaClone — no marketing fluff, just a clear explanation of every capability and why it matters for your business.
                            </p>
                        </div>

                        <div className="space-y-16">
                            {services.map((service, idx) => (
                                <div
                                    key={idx}
                                    className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all"
                                >
                                    {/* Left: Header + Description */}
                                    <div>
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${service.color} flex items-center justify-center flex-shrink-0`}>
                                                <service.icon className="w-6 h-6 text-white" />
                                            </div>
                                            {service.badge && (
                                                <span className="px-3 py-1 bg-teal-500/10 border border-teal-500/30 rounded-full text-teal-400 text-xs font-semibold">
                                                    {service.badge}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-2xl font-bold mb-1">{service.title}</h3>
                                        <p className="text-teal-400 text-sm mb-4">{service.subtitle}</p>
                                        <p className="text-slate-300 leading-relaxed mb-4">{service.description}</p>
                                        <p className="text-slate-400 leading-relaxed text-sm">{service.extendedDescription}</p>
                                        <div className="mt-6 p-4 bg-teal-500/5 border border-teal-500/20 rounded-xl">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="w-4 h-4 text-teal-400 flex-shrink-0" />
                                                <span className="text-teal-300 text-sm font-semibold">{service.impact}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Right: Features */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">What's Included</h4>
                                        <ul className="space-y-3">
                                            {service.features.map((f, fi) => (
                                                <li key={fi} className="flex items-start gap-3">
                                                    <CheckCircle className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                                                    <span className="text-slate-300 text-sm leading-relaxed">{f}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="mt-8 flex flex-col gap-3">
                                            <Link href="/register">
                                                <Button className="w-full bg-teal-600 hover:bg-teal-500 font-semibold">
                                                    Try This Free
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="outline"
                                                className="w-full border-slate-700 hover:bg-slate-800"
                                                onClick={() => window.open('https://calendly.com/bonniiehendrix/30min', '_blank')}
                                            >
                                                Book a Demo Call
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Why Not Technical Users Love AlphaClone */}
                <section className="py-16 bg-white/[0.02] backdrop-blur-sm border-y border-slate-800/50">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">
                                "I'm Not Technical" — That's Exactly Who This Is For
                            </h2>
                            <p className="text-slate-400 text-lg max-w-3xl mx-auto">
                                AlphaClone was built specifically for business owners who want enterprise-grade software but don't have an IT department, a CTO, or a technical co-founder. If you can use Gmail, you can run AlphaClone.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                {
                                    icon: Clock,
                                    title: 'Set Up in 30 Minutes',
                                    desc: 'No installation, no configuration files, no developer required. The onboarding wizard walks you through every step in plain English. Most users have their full workspace operational within half an hour of signing up.',
                                },
                                {
                                    icon: Layers,
                                    title: 'Everything Connected Automatically',
                                    desc: "When you send an invoice, it automatically links to the right client and project. When a meeting is booked, it updates your calendar and CRM simultaneously. You don't configure these connections — they just work.",
                                },
                                {
                                    icon: Users,
                                    title: 'Human Support When You Need It',
                                    desc: 'Every AlphaClone plan includes access to the support team via email. Enterprise plans include priority response. You\'re never alone trying to figure something out — and our average response time is under 4 hours.',
                                },
                                {
                                    icon: RefreshCw,
                                    title: 'Import Your Existing Data',
                                    desc: 'Already have clients in a spreadsheet or another CRM? Import them in minutes with our CSV import tool. Your data comes with you — no rebuilding from scratch.',
                                },
                                {
                                    icon: Lock,
                                    title: 'No Hidden Complexity',
                                    desc: 'Every feature has a clear purpose that a business owner can understand. We don\'t use technical jargon in the interface. If you\'re unsure what something does, the tooltip explains it in one sentence.',
                                },
                                {
                                    icon: Award,
                                    title: 'Proven by Businesses Like Yours',
                                    desc: 'AlphaClone serves agencies, consultancies, freelancers, and professional service firms. The people using it every day are accountants, designers, coaches, lawyers, and marketing agencies — not software engineers.',
                                },
                            ].map((item, i) => (
                                <div key={i} className="p-6 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-slate-700/60">
                                    <item.icon className="w-8 h-8 text-teal-400 mb-4" />
                                    <h3 className="text-lg font-bold mb-3">{item.title}</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Testimonial / Social Proof Strip */}
                <section className="py-12 bg-slate-950">
                    <div className="max-w-4xl mx-auto px-4 text-center">
                        <div className="flex justify-center gap-1 mb-4">
                            {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />)}
                        </div>
                        <blockquote className="text-xl text-slate-200 italic leading-relaxed mb-6">
                            "Before AlphaClone, I was paying over $300/month across six different tools, and I still felt disorganized. Now everything is in one place, my AI agent books discovery calls while I sleep, and I actually know the financial health of my business for the first time."
                        </blockquote>
                        <cite className="text-teal-400 font-semibold">— Agency Owner, Professional Services</cite>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="py-20 bg-gradient-to-b from-slate-950 to-slate-900">
                    <div className="max-w-3xl mx-auto px-4 text-center">
                        <h2 className="text-3xl md:text-4xl font-bold mb-6">
                            Ready to Run Your Entire Business from One Dashboard?
                        </h2>
                        <p className="text-slate-400 text-lg mb-10 leading-relaxed">
                            Start your free trial today. No credit card required for the first 14 days. Cancel anytime. Most businesses see a positive ROI within the first month.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Link href="/register">
                                <Button className="text-lg px-10 py-4 h-auto bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-xl shadow-teal-500/20">
                                    Start 14-Day Free Trial
                                </Button>
                            </Link>
                            <Button
                                variant="outline"
                                className="text-lg px-10 py-4 h-auto border-slate-700 hover:bg-slate-800"
                                onClick={() => window.open('https://calendly.com/bonniiehendrix/30min', '_blank')}
                            >
                                <Phone className="w-5 h-5 mr-2" />
                                Book a Live Demo
                            </Button>
                        </div>
                        <p className="mt-6 text-slate-500 text-sm">
                            Starter from $15/mo · Pro from $45/mo · Enterprise from $80/mo · Cancel anytime
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ServicesPage;

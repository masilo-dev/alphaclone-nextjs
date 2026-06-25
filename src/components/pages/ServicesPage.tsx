'use client';

import React from 'react';
import Link from 'next/link';
import {
    Zap, Database, Shield, BarChart3, Settings, Globe,
    ArrowRight, Clock, Users, DollarSign,
    Mail, Video, FileText, Calendar, TrendingUp, Layers,
    Award, Lock, RefreshCw, Phone, ChevronRight
} from 'lucide-react';
import { Button } from '../ui/UIComponents';
import PublicNavigation from '../PublicNavigation';
import dynamic from 'next/dynamic';
import AnimateIn from '../common/AnimateIn';
import MarketingFooter from '../landing/MarketingFooter';
import { MarketingTestimonialsCarousel } from '@/components/marketing/ui/carousel';
import { MARKETING_TESTIMONIALS } from '@/config/marketingTestimonials';

const HeroBackground = dynamic(() => import('@/components/landing/HeroBackground'), {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-slate-950" />,
});

const ServicesPage: React.FC = () => {
    const [, setIsLoginOpen] = React.useState(false);

    const blufSummary = `AlphaClone Systems is a unified AI-powered Business Operating Platform for service companies. It centralizes CRM, finance, contracts, meetings, messaging, scheduling, and execution workflows in one operational system designed for daily use by founders and teams.`;

    const services = [
        {
            icon: Zap,
            title: 'AI Growth Agent',
            subtitle: 'AI-assisted lead and outreach workflows',
            color: 'from-teal-500 to-emerald-500',
            badge: 'Lead Workflow',
            description: `The AlphaClone AI Growth Agent helps service teams find public business leads, prepare outreach, and move qualified opportunities into the CRM without scattering work across spreadsheets and inboxes.`,
            extendedDescription: `The Growth Agent supports targeted searches across public business sources, then helps enrich records, score fit, and prepare outreach drafts that match your services. Teams can review the suggested messages, track responses, and hand qualified conversations into the CRM with context intact.`,
            features: [
                'Automated lead discovery across public directories',
                'AI-powered outreach and qualification conversations',
                'Industry and geography targeting filters',
                'Lead scoring and prioritization',
                'Seamless handoff to your CRM when a lead is qualified',
                'Full conversation history and context tracking',
            ],
            impact: 'Lead discovery, enrichment, outreach drafts, and CRM handoff in one flow',
        },
        {
            icon: Database,
            title: 'Enterprise CRM',
            subtitle: 'Know every client, every deal, every interaction',
            color: 'from-blue-500 to-indigo-500',
            badge: 'Core Feature',
            description: `Most small businesses track clients in spreadsheets, notes, or their inbox. AlphaClone's CRM gives you a searchable database for client relationships, deals, communication history, projects, and billing context.`,
            extendedDescription: `Every client in the CRM has a full profile: contact history, all email threads (pulled from your Gmail integration), every invoice and contract sent, notes and call logs, associated projects and tasks, and their position in your sales pipeline. The pipeline management is drag-and-drop — you move deals from Discovery to Proposal to Negotiation to Won, and the system automatically updates project statuses and triggers follow-up reminders. The CRM also integrates directly with your calendar, so every meeting you schedule with a client appears on their profile, and every new booking from your public scheduling page automatically creates or updates the right client record. No manual data entry required.`,
            features: [
                'Full client profiles with communication history',
                'Visual drag-and-drop sales pipeline',
                'Automated deal stage management',
                'Global search across all records',
                'Client tagging and segmentation',
                'Activity logs, notes, and call records',
            ],
            impact: 'Client records, pipeline, meetings, invoices, and notes in one profile',
        },
        {
            icon: DollarSign,
            title: 'Financial Suite & Invoicing',
            subtitle: 'Professional accounting without the accountant',
            color: 'from-emerald-500 to-teal-500',
            badge: 'Professional Accounting',
            description: `AlphaClone includes financial workflows for invoices, quotes, receipts, chart of accounts, journal entries, and financial reports. Teams should confirm their accounting and tax requirements before replacing dedicated accounting software.`,
            extendedDescription: `You can generate, brand, and send a professional invoice in under 60 seconds. Invoices include your logo, itemized line items, payment terms, and a direct payment link. The system tracks payment status automatically — you see at a glance which invoices are paid, pending, or overdue. Beyond invoicing, the full accounting suite gives you a proper Chart of Accounts, journal entry recording, income statements, balance sheets, and cash flow reports. This is the same professional-grade accounting structure that your accountant expects to see at tax time — just presented in a way that a business owner without an accounting degree can actually understand and use.`,
            features: [
                'Branded professional invoice generation',
                'Automated payment status tracking',
                'Quote creation with one-click invoice conversion',
                'Full chart of accounts and journal entries',
                'P&L statements and balance sheets',
                'Expense tracking and categorization',
            ],
            impact: 'Invoice, quote, receipt, and reporting workflows connected to CRM records',
        },
        {
            icon: FileText,
            title: 'Contract Engine & E-Signatures',
            subtitle: 'Draft, review, send, and track agreements',
            color: 'from-violet-500 to-purple-500',
            badge: 'Replaces DocuSign',
            description: `Every service business sends contracts, but scattered templates and signature tools make it hard to track what was sent, changed, and signed. AlphaClone combines AI-assisted drafting with electronic signature collection and CRM-linked storage.`,
            extendedDescription: `When you need a service agreement, NDA, freelance contract, or onboarding agreement, describe the scope of work and key terms, then review and customize the generated draft before sending it for e-signature. Signed contracts are stored in your Document Hub and linked to the client record. Contract drafts should still be reviewed for your jurisdiction and business context before use.`,
            features: [
                'AI-assisted contract drafting',
                'E-signature collection and audit trail',
                'NDAs, service agreements, proposals',
                'Automatic signed copy distribution',
                'Contract storage linked to CRM profiles',
                'Signature status tracking and reminders',
            ],
            impact: 'Drafting, signature status, storage, and CRM context in one workflow',
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
            impact: 'Meeting links, CRM context, and follow-up notes stay in one workspace',
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
            description: `Data breaches and unauthorized access can be damaging for small businesses. AlphaClone includes role-based access control, audit logging, and account-level controls for teams handling client and financial data.`,
            extendedDescription: `Role-Based Access Control (RBAC) means you decide what each team member or contractor can see and do inside the platform. Your accountant can access financial records while other team members stay focused on delivery workflows. Audit logs help you understand key account activity, and public policy pages explain privacy, deletion, and security practices.`,
            features: [
                'Role-based access control (RBAC)',
                'Audit logging for account activity',
                'Security policy and support channels',
                'Account-level access controls',
                'Data encryption at rest and in transit',
                'GDPR-compliant data handling',
            ],
            impact: 'Role-based access, audit logging, and policy visibility for teams',
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

    return (
        <div className="min-h-screen page-network-bg text-white">
            {/* Persistent full-page animated network background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <HeroBackground />
            </div>

            <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />

            {/* BLUF Summary — SSR rendered above the fold */}
            <div className="pt-20 relative overflow-hidden">
                <section className="relative min-h-[60vh] flex flex-col items-center justify-center py-16">

                    <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
                        <AnimateIn type="fadeIn">
                            <div className="flex items-center justify-center gap-2 mb-4">
                                <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                                <span className="text-teal-400 text-sm font-semibold tracking-widest uppercase">The Bottom Line</span>
                            </div>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.1}>
                            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight text-white">
                                Business Operating{' '}
                                <span className="hero-metallic-text">
                                    Platform.
                                </span>
                            </h1>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.2}>
                            <p className="text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto">
                                {blufSummary}
                            </p>
                            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
                                <Link href="/register">
                                    <Button className="bg-teal-500 text-slate-950 font-bold px-10 py-5 h-auto text-lg rounded-2xl button-fill-hover">
                                        <span className="relative z-10">Start Free Trial</span>
                                    </Button>
                                </Link>
                                <Link href="/guide">
                                    <Button variant="outline" className="px-10 py-5 h-auto text-lg rounded-2xl button-fill-hover">
                                        <span className="relative z-10">View Setup Guide</span>
                                    </Button>
                                </Link>
                            </div>
                        </AnimateIn>
                    </div>
                </section>

                {/* Services — Full Detail */}
                <section className="py-16 bg-transparent">
                    <div className="max-w-6xl mx-auto px-4">
                        <AnimateIn type="fadeUp">
                            <div className="text-center mb-16">
                                <h2 className="text-3xl md:text-4xl font-bold mb-4">Every Service, In Depth</h2>
                                <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                                    Here's exactly what you get when you join AlphaClone — no marketing fluff, just a clear explanation of every capability and why it matters for your business.
                                </p>
                            </div>
                        </AnimateIn>

                        <div className="space-y-16">
                            {services.map((service, idx) => (
                                <AnimateIn key={idx} type={idx % 2 === 0 ? 'fadeLeft' : 'fadeRight'} delay={0.05}>
                                    <div
                                        className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start py-8 border-b border-slate-800/70"
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
                                            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Capabilities</h4>
                                            <div className="space-y-3">
                                                {service.features.map((f, fi) => (
                                                    <p key={fi} className="text-slate-300 text-sm leading-relaxed border-l-2 border-slate-700 pl-3">
                                                        {f}
                                                    </p>
                                                ))}
                                            </div>
                                            <div className="mt-8 flex flex-col gap-3">
                                                <Link href="/register">
                                                    <Button className="w-full bg-teal-600 font-bold py-4 rounded-xl button-fill-hover">
                                                        <span className="relative z-10 text-slate-950">Try This Free</span>
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="outline"
                                                    className="w-full py-4 rounded-xl button-fill-hover"
                                                    onClick={() => window.open('https://calendly.com/bonniealphaclonesystems/30min', '_blank')}
                                                >
                                                    <span className="relative z-10">Book a Demo Call</span>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </AnimateIn>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Why Not Technical Users Love AlphaClone */}
                <section className="py-16 bg-white/[0.02] backdrop-blur-sm border-y border-slate-800/50">
                    <div className="max-w-6xl mx-auto px-4">
                        <AnimateIn type="fadeUp">
                            <div className="text-center mb-12">
                                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                                    "I'm Not Technical" — That's Exactly Who This Is For
                                </h2>
                                <p className="text-slate-400 text-lg max-w-3xl mx-auto">
                                    AlphaClone was built for business owners who want operational software without hiring an internal tools team. If you can use Gmail, you can get started in AlphaClone.
                                </p>
                            </div>
                        </AnimateIn>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                {
                                    icon: Clock,
                                    title: 'Set Up in 30 Minutes',
                                    desc: 'No installation, no configuration files, no developer required. The onboarding flow walks you through setup in plain English.',
                                },
                                {
                                    icon: Layers,
                                    title: 'Everything Connected Automatically',
                                    desc: 'When you send an invoice, it can link to the right client and project. When a meeting is booked, it can update your calendar and CRM context from the same workspace.',
                                },
                                {
                                    icon: Users,
                                    title: 'Human Support When You Need It',
                                    desc: 'Every AlphaClone plan includes access to support via email. Use the public support channel when you need help with setup or account questions.',
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
                                    desc: 'AlphaClone is designed for agencies, consultancies, freelancers, and professional service firms that need one operational workspace.',
                                },
                            ].map((item, i) => (
                                <AnimateIn key={i} type="stagger" index={i}>
                                    <div className="p-6 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-slate-700/60 h-full">
                                        <item.icon className="w-8 h-8 text-teal-400 mb-4" />
                                        <h3 className="text-lg font-bold mb-3">{item.title}</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                                    </div>
                                </AnimateIn>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Testimonial / Social Proof Strip */}
                <section className="py-12 bg-transparent">
                    <AnimateIn type="scaleIn">
                        <div className="max-w-5xl mx-auto px-4">
                            <MarketingTestimonialsCarousel items={MARKETING_TESTIMONIALS} />
                        </div>
                    </AnimateIn>
                </section>

                {/* Final CTA */}
                <section className="py-20 bg-gradient-to-b from-transparent to-slate-900/40">
                    <div className="max-w-3xl mx-auto px-4 text-center">
                        <AnimateIn type="scaleIn">
                            <h2 className="text-3xl md:text-4xl font-black mb-6 text-white tracking-tight">
                                Ready to Run Your Entire Business <br />
                                from <span className="hero-metallic-text">One Dashboard?</span>
                            </h2>
                            <p className="text-slate-400 text-lg mb-10 leading-relaxed max-w-2xl mx-auto">
                                Start your free trial today. No credit card required for the first 14 days. Cancel anytime from your account.
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center gap-4">
                                <Link href="/register">
                                    <Button className="text-lg px-10 py-5 h-auto bg-teal-500 text-slate-950 font-black shadow-xl shadow-teal-500/20 rounded-2xl button-fill-hover">
                                        <span className="relative z-10">Start 14-Day Free Trial</span>
                                    </Button>
                                </Link>
                                <Button
                                    variant="outline"
                                    className="text-lg px-10 py-5 h-auto rounded-2xl button-fill-hover"
                                    onClick={() => window.open('https://calendly.com/bonniealphaclonesystems/30min', '_blank')}
                                >
                                    <span className="relative z-10 flex items-center">
                                        <Phone className="w-5 h-5 mr-2" />
                                        Book a Live Demo
                                    </span>
                                </Button>
                            </div>
                            <p className="mt-8 text-slate-500 text-sm font-semibold uppercase tracking-widest">
                                Starter $15/mo · Pro $45/mo · Enterprise $80/mo · 14-day trial · No card required
                            </p>
                        </AnimateIn>
                    </div>
                </section>
            </div>
            <MarketingFooter />
        </div>
    );
};

export default ServicesPage;

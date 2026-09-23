'use client';

import React from 'react';
import {
    ListFilter, Database, Shield, BarChart3, Settings, Globe,
    Clock, Users, DollarSign,
    Mail, Video, FileText, Calendar, TrendingUp, Layers,
    Award, Lock, RefreshCw
} from 'lucide-react';
import AnimateIn from '../common/AnimateIn';
import { MARKETING_PRICING } from '@/config/pricingPlans';
import { PrimaryCTA, SecondaryCTA } from '@/components/marketing/system/CtaButtons';

const ServicesPage: React.FC = () => {
    const blufSummary = `AlphaClone Systems is an AI Business Execution Layer for service companies. It connects compatible AI assistants such as ChatGPT and Claude to CRM, finance, contracts, meetings, messaging, scheduling, and execution workflows in one operational workspace for founders and teams.`;

    const services = [
        {
            icon: ListFilter,
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
                'Reviewable handoff to CRM when a lead is qualified',
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
            extendedDescription: `Each CRM record can keep contact details, communication history from supported connections, invoices, contracts, notes, calls, projects, tasks, and pipeline position together. Teams can move deals through the visual pipeline, create the next delivery step, and keep meeting or booking context attached to the same relationship. Available behavior depends on the connections and permissions configured for the workspace.`,
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
            subtitle: 'Connected invoicing and financial workflows',
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
            badge: 'Connected E-Signatures',
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
            title: 'Connected Email & Communications',
            subtitle: 'Keep outreach and client context together',
            color: 'from-red-500 to-orange-500',
            badge: 'Context-Aware',
            description: `Email work becomes difficult when provider inboxes, CRM records, and follow-up tasks live in separate places. AlphaClone connects supported email providers to the workspace so teams can prepare outreach, send approved messages, and keep the activity associated with the relevant business record.`,
            extendedDescription: `Connect a supported provider such as Outlook, Zoho, or Brevo according to the workflows available for that account. AlphaClone can prepare messages, execute approved sends, record delivery status, and keep follow-up work visible beside CRM context. Exact capabilities depend on provider permissions and connection status.`,
            features: [
                'Supported provider connections',
                'CRM context visible alongside emails',
                'Send, reply, and draft from within AlphaClone',
                'Activity records linked to client profiles',
                'Follow-up scheduling and reminders',
                'Full email signature support',
            ],
            impact: 'Eliminate context-switching between email and CRM',
        },
        {
            icon: Video,
            title: 'HD Video Meetings',
            subtitle: 'Client calls without Zoom or Teams',
            color: 'from-blue-600 to-teal-500',
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
            title: 'Smart Scheduling & Cal.com Booking',
            subtitle: 'Branded booking pages that sync automatically',
            color: 'from-indigo-500 to-blue-500',
            badge: 'Auto-Sync',
            description: `Professional scheduling is the first impression many clients have of your business. An unbranded or clunky booking experience undermines the premium positioning you're trying to establish. AlphaClone gives you a branded client-facing booking page and automatically syncs new appointments to your dashboard without manual work.`,
            extendedDescription: `AlphaClone includes native booking pages at /book/your-slug plus Cal.com for platform demo scheduling. When a prospect books a meeting through your scheduling page, AlphaClone automatically creates or updates the corresponding CRM record, adds the meeting to your dashboard calendar, and sends confirmation details to both parties. If you're running multiple types of meetings — initial consultations, project check-ins, and board reviews, for example — you can configure different booking types with different durations, availability windows, and client question forms.`,
            features: [
                'Branded client booking pages',
                'Cal.com demo scheduling for prospects',
                'Native AlphaClone booking at /book/your-slug',
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
        <div className="min-h-screen bg-white text-[#07152f]">
            {/* BLUF Summary — SSR rendered above the fold */}
            <div className="relative overflow-hidden">
                <section className="relative flex flex-col items-center justify-center py-16 px-4">
                    <div className="relative z-10 max-w-4xl mx-auto text-center">
                        <AnimateIn type="fadeIn">
                            <div className="inline-flex items-center justify-center gap-2 mb-6 px-3.5 py-1.5 rounded-full bg-[#edf6ff] border border-[#d0e4ff] text-[#075fc7] type-caption font-bold uppercase tracking-wider">
                                <div className="w-2 h-2 rounded-full bg-[#0878f9]" />
                                <span>The Bottom Line</span>
                            </div>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.1}>
                            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold font-marketing-heading tracking-tight text-[#07152f] mb-6 leading-tight">
                                AI Business Execution{' '}
                                <span className="text-[#0878f9]">
                                    Layer.
                                </span>
                            </h1>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.2}>
                            <p className="text-lg sm:text-xl text-[#52627b] leading-relaxed max-w-3xl mx-auto">
                                {blufSummary}
                            </p>
                            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
                                <PrimaryCTA href="/book-demo" className="w-full sm:w-auto">Book a demo</PrimaryCTA>
                                <SecondaryCTA href="/#workflow" className="w-full sm:w-auto">See a 30-second workflow</SecondaryCTA>
                            </div>
                        </AnimateIn>
                    </div>
                </section>

                {/* Services — Full Detail */}
                <section className="py-16 bg-white border-t border-[#dfe6ef]">
                    <div className="max-w-6xl mx-auto px-4">
                        <AnimateIn type="fadeUp">
                            <div className="text-center mb-16">
                                <h2 className="text-3xl md:text-4xl font-bold font-marketing-heading text-[#07152f] mb-4 tracking-tight">Every Service, In Depth</h2>
                                <p className="text-[#52627b] text-lg max-w-2xl mx-auto leading-relaxed">
                                    Here&apos;s exactly what you get when you join AlphaClone — no marketing fluff, just a clear explanation of every capability and why it matters for your business.
                                </p>
                            </div>
                        </AnimateIn>

                        <div className="space-y-12">
                            {services.map((service, idx) => (
                                <AnimateIn key={idx} type={idx % 2 === 0 ? 'fadeLeft' : 'fadeRight'} delay={0.05}>
                                    <div
                                        id={service.title.toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}
                                        className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start py-8 border-b border-[#dfe6ef]"
                                    >
                                        {/* Left: Header + Description */}
                                        <div>
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${service.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                                    <service.icon className="w-6 h-6 text-white" />
                                                </div>
                                                {service.badge && (
                                                    <span className="px-3 py-1 bg-[#edf6ff] border border-[#d0e4ff] rounded-full text-[#075fc7] type-caption font-semibold">
                                                        {service.badge}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-2xl font-bold font-marketing-heading text-[#07152f] mb-1 tracking-tight">{service.title}</h3>
                                            <p className="text-[#0878f9] type-card-description font-semibold mb-3">{service.subtitle}</p>
                                            <p className="text-[#33445e] leading-relaxed mb-3">{service.description}</p>
                                            <p className="text-[#52627b] leading-relaxed type-card-description">{service.extendedDescription}</p>
                                            <div className="mt-6 p-4 bg-[#edf6ff] border border-[#d0e4ff] rounded-xl">
                                                <div className="flex items-center gap-2">
                                                    <TrendingUp className="w-4 h-4 text-[#0878f9] flex-shrink-0" />
                                                    <span className="text-[#075fc7] type-ui font-semibold">{service.impact}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Right: Features */}
                                        <div>
                                            <h4 className="type-caption font-bold text-[#76849a] uppercase tracking-wider mb-4">Capabilities</h4>
                                            <div className="space-y-3">
                                                {service.features.map((f, fi) => (
                                                    <p key={fi} className="text-[#33445e] type-card-description leading-relaxed border-l-2 border-[#d0e4ff] pl-3">
                                                        {f}
                                                    </p>
                                                ))}
                                            </div>
                                            <div className="mt-8 flex flex-col gap-3">
                                                <PrimaryCTA className="w-full">Try This Free</PrimaryCTA>
                                                <SecondaryCTA className="w-full">Book a Demo Call</SecondaryCTA>
                                            </div>
                                        </div>
                                    </div>
                                </AnimateIn>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Why Not Technical Users Love AlphaClone */}
                <section className="py-16 bg-[#f7f9fc] border-y border-[#dfe6ef]">
                    <div className="max-w-6xl mx-auto px-4">
                        <AnimateIn type="fadeUp">
                            <div className="text-center mb-12">
                                <h2 className="text-3xl md:text-4xl font-bold font-marketing-heading text-[#07152f] mb-4 tracking-tight">
                                    &ldquo;I&apos;m Not Technical&rdquo; — That&apos;s Exactly Who This Is For
                                </h2>
                                <p className="text-[#52627b] text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
                                    AlphaClone was built for business owners who want operational software without hiring an internal tools team. The core workflows use familiar records, approvals, and clear next actions.
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
                                    title: 'Built for Businesses Like Yours',
                                    desc: 'AlphaClone is designed for agencies, consultancies, freelancers, and professional service firms that need one operational workspace.',
                                },
                            ].map((item, i) => (
                                <AnimateIn key={i} type="stagger" index={i}>
                                    <div className="p-6 rounded-2xl bg-white border border-[#dfe6ef] shadow-sm h-full">
                                        <item.icon className="w-8 h-8 text-[#0878f9] mb-4" />
                                        <h3 className="text-lg font-bold font-marketing-heading text-[#07152f] mb-2">{item.title}</h3>
                                        <p className="text-[#52627b] type-card-description leading-relaxed">{item.desc}</p>
                                    </div>
                                </AnimateIn>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="py-20 bg-white">
                    <div className="max-w-3xl mx-auto px-4 text-center">
                        <AnimateIn type="scaleIn">
                            <h2 className="text-3xl md:text-4xl font-bold font-marketing-heading mb-4 text-[#07152f] tracking-tight">
                                Ready to Run Your Entire Business <br />
                                from <span className="text-[#0878f9]">One Workspace?</span>
                            </h2>
                            <p className="text-[#52627b] text-base sm:text-lg mb-8 leading-relaxed max-w-2xl mx-auto">
                                Choose the plan that fits your execution needs, or book a demo to see the workflow before you begin.
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center gap-4">
                                <PrimaryCTA className="w-full sm:w-auto">Get started</PrimaryCTA>
                                <SecondaryCTA className="w-full sm:w-auto">Book a Live Demo</SecondaryCTA>
                            </div>
                            <p className="mt-6 text-[#76849a] type-caption font-bold uppercase tracking-wider">
                                {MARKETING_PRICING.startingPriceLine} · See pricing for current details
                            </p>
                        </AnimateIn>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ServicesPage;

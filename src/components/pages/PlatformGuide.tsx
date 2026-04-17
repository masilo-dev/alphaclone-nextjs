'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    CheckCircle2, ArrowRight, User, CreditCard, Settings, Mail,
    Calendar, Users, DollarSign, Bot, Video, Shield, ChevronDown,
    ChevronUp, Globe, Zap, Clock, Star, Terminal, Layers,
    BookOpen, TrendingUp, Lock, Building2
} from 'lucide-react';
import { Button } from '../ui/UIComponents';
import PublicNavigation from '../PublicNavigation';

const PlatformGuide: React.FC = () => {
    const [, setIsLoginOpen] = React.useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    const steps = [
        {
            icon: User,
            color: 'from-teal-500 to-emerald-500',
            step: 1,
            title: 'Create Your Account',
            subtitle: 'Takes 2 minutes — no credit card required for trial',
            detail: `Visit alphaclone.tech/register and click "Create Account." You'll need to provide your email address and create a password. That's it — there's no form with 20 fields, no company size questions, no department dropdowns. We believe in letting you experience the platform before we ask for anything.

After confirming your email via the link we send, you'll be taken directly into the onboarding wizard. If you have an existing Google account and prefer, you can sign up with Google in a single click, which also pre-fills your name and profile photo automatically.

Your account is created with the Pro plan on a 14-day free trial. You won't be charged anything until the trial ends, and you can cancel at any point during the trial with no cost. After the trial, you choose which plan you'd like to continue on.`,
            tips: [
                'Use your main business email — this becomes your account identifier',
                'The password must be at least 8 characters with one number or symbol',
                'Check your spam folder if the confirmation email doesn\'t arrive within 2 minutes',
                'Google sign-in is the fastest option if you use Gmail for business',
            ],
        },
        {
            icon: CreditCard,
            color: 'from-blue-500 to-indigo-500',
            step: 2,
            title: 'Activate Your Plan',
            subtitle: 'One simple public price: $15 per month',
            detail: `After registration, you will see one public plan for the full platform.

**AlphaClone Platform: $15/month**

This includes CRM, deals, projects, tasks, social publishing, messaging, invoicing, documents, and core automations in one workspace.

You start with a 14-day free trial and no credit card is required to begin. At the end of trial, you can continue on the same plan.

There is no founder involvement needed to start. Setup is self-serve and guided directly inside the app.`,
            tips: [
                'You only need one decision: start the trial and complete onboarding',
                'The same platform modules are available from day one',
                'Billing is visible in Settings so owners can review at any time',
                'No founder call is required to configure the workspace',
            ],
        },
        {
            icon: Settings,
            color: 'from-violet-500 to-purple-500',
            step: 3,
            title: 'Configure Your Business Workspace',
            subtitle: 'Personalize your platform in under 5 minutes',
            detail: `Once inside the dashboard, the onboarding wizard will guide you through configuring your workspace. This is where AlphaClone transitions from a generic platform to your business's operating system.

You'll set your business name (which appears on invoices, contracts, and client-facing pages), upload your logo (which is automatically sized and applied everywhere), and configure your default currency and timezone. These settings ensure that every invoice, every calendar slot, and every financial report is calibrated to your actual business location and operating currency.

Next, you'll complete your business profile — your phone number, business address, and VAT/tax registration number (if applicable). This information is used to auto-populate professional invoices and contracts, so you never have to type your own business details again.

Finally, you can optionally set notification preferences — which events trigger email alerts to you, and which team members receive which types of notifications.`,
            tips: [
                'Upload a high-resolution PNG logo (at least 400x400px) for crisp display across all documents',
                'Set the correct timezone now — changing it later affects how historical calendar events display',
                'Adding your VAT/tax number here means it auto-populates on every invoice',
                'Notifications can be changed at any time in Settings > Notifications',
            ],
        },
        {
            icon: Mail,
            color: 'from-red-500 to-orange-500',
            step: 4,
            title: 'Connect Your Gmail',
            subtitle: 'Link your email to your CRM in 60 seconds',
            detail: `This is one of the most transformative connections you'll make. Connecting Gmail means your entire email inbox becomes visible inside AlphaClone, with full CRM context alongside every conversation.

To connect, navigate to **Settings → Integrations → Gmail**. Click "Connect Google Account." You'll be redirected to Google's standard OAuth authorization screen — the same type of screen you see when any app requests access to your Google account. You'll see the specific permissions being requested: read emails, send emails, and manage labels. No access to calendar or Drive files is requested.

Click "Allow" and you'll be redirected back to AlphaClone, where your inbox will begin populating within 15-30 seconds.

Once connected, when you click on any client in your CRM, you can see all historical email threads with that client alongside their project history and invoices — no switching tabs required. You can also reply to emails, star messages for follow-up, and draft new messages to clients all from within the dashboard.

**Privacy note:** Your emails are displayed inside AlphaClone but are not stored permanently on our servers. We retrieve them in real time from Gmail's API. If you disconnect Gmail at any time, the email data is immediately removed from your AlphaClone view.`,
            tips: [
                'You must connect the email address you actually use to communicate with clients',
                'If you have multiple Gmail accounts, you can connect the primary one for now',
                'Your personal emails are private — only emails linked to CRM contacts appear contextually',
                'The connection can be disconnected from Settings > Integrations at any time',
            ],
        },
        {
            icon: Calendar,
            color: 'from-indigo-500 to-blue-500',
            step: 5,
            title: 'Set Up Your Scheduling Page',
            subtitle: 'Give clients a professional booking experience',
            detail: `A branded, professional booking page is one of the fastest ways to elevate how your business presents itself to prospective clients. Rather than the manual back-and-forth of "are you free Tuesday at 2?" over email, you send a single booking link and clients pick from your available time slots themselves.

AlphaClone offers two setup methods:

**Quick Setup (Manual URL — 30 seconds):** If you already have a Calendly account, simply paste your Calendly URL into **Settings → Integrations → Calendly → Manual URL**. Your booking link immediately appears on your client-facing profile and can be shared from your CRM. New meetings booked through this link aren't automatically synced to your AlphaClone calendar, but they will appear in Calendly as normal.

**Full Integration (OAuth — 2 minutes):** This is the recommended approach. Go to **Settings → Integrations → Calendly → Connect with OAuth**. After authorizing the connection, AlphaClone will two-way sync your Calendly calendar. When a prospect books a meeting, a new calendar event appears in your AlphaClone dashboard, the prospect's CRM contact is created or updated automatically, and both parties receive confirmation emails branded with your logo.

You can also configure availability windows directly in AlphaClone without a Calendly account if you prefer a simpler setup.`,
            tips: [
                'The OAuth integration is worth the extra 90 seconds for automatic CRM sync',
                'Set your buffer time between meetings in Calendly before connecting',
                'Create separate meeting types for "Discovery Call" vs "Active Client Check-In" for cleaner context',
                'Your booking link appears automatically in outgoing emails when you use the CRM email templates',
            ],
        },
        {
            icon: Users,
            color: 'from-teal-500 to-cyan-500',
            step: 6,
            title: 'Import Your CRM Contacts',
            subtitle: 'Bring your existing client list in minutes',
            detail: `Most businesses coming to AlphaClone have existing client relationships managed somewhere — a spreadsheet, another CRM, a contact list in their email, or even a pile of business cards photographed on a phone. We support importing from all of these.

**CSV Import (Recommended for most users):** Export your contacts from your current tool as a CSV file. Go to **CRM → Contacts → Import**. Upload your CSV, and AlphaClone will detect your columns automatically and suggest mappings (Company Name, First Name, Last Name, Email, Phone, etc.). You confirm the mapping, click Import, and all your contacts are created instantly. For lists of up to 1,000 contacts, the entire process takes under 3 minutes.

**Manual Entry:** For smaller contact lists or individual key clients, you can create contacts manually. Click "New Contact" in the CRM, fill in the details, and click Save. Each contact can have multiple email addresses, phone numbers, and associated company records.

**From Booked Meetings:** Once your Calendly integration is active, any new prospect who books a meeting automatically appears as a new CRM contact. You never have to manually add someone who's already interacted with your booking page.

After import, take an extra few minutes to tag your contacts by type (e.g., "Active Client," "Former Client," "Prospect") using the tagging system. This makes segmentation and targeted outreach much more powerful.`,
            tips: [
                'Clean up duplicate email addresses in your CSV before importing to avoid duplicates',
                'The "Company" field in your CSV maps to organization records — useful for B2B setups',
                'Tags can be added in bulk after import by selecting multiple contacts',
                'You can import the same CSV multiple times safely — duplicates are detected by email address',
            ],
        },
        {
            icon: DollarSign,
            color: 'from-emerald-500 to-teal-500',
            step: 7,
            title: 'Send Your First Invoice',
            subtitle: 'Professional billing from day one',
            detail: `AlphaClone's invoicing system is designed to get you from "client says yes" to "invoice sent" in under 60 seconds. Here's the exact process:

Navigate to **Finance → Invoices → New Invoice**. A new invoice form opens with your business branding, logo, and business details already populated from your workspace settings.

Select the client from your CRM — the invoice is automatically linked to their profile, so payment history appears on their record. Add your line items — description, quantity, and unit price. You can add as many line items as needed, and the system calculates subtotals, any applicable taxes, and the final amount automatically.

Set your payment terms (immediately, Net 7, Net 15, Net 30), add any notes or payment instructions, and click "Send Invoice." Your client receives a professionally branded email containing the invoice as a PDF attachment and a direct payment link.

You can also set invoices to "Draft" status to prepare them in advance without sending, generate a shareable link instead of emailing directly, or download the PDF for any reason.

Payment status is tracked automatically. When a client pays (via the payment link), the invoice status updates to "Paid" instantly and a receipt is sent to both parties. From your Finance dashboard, you always see at a glance which invoices are paid, pending, or overdue.`,
            tips: [
                'Set up a product/service catalog in Finance → Products to re-use line items across invoices',
                'Enable automated payment reminders (Settings → Finance) to chase overdue invoices for you',
                'Use the "Send Preview" button to see exactly what your client will receive before sending',
                'You can create a quote first and convert it to an invoice with one click when approved',
            ],
        },
        {
            icon: Bot,
            color: 'from-teal-500 to-green-500',
            step: 8,
            title: 'Activate the AI Growth Agent',
            subtitle: 'Your automated sales machine — turn it on once',
            detail: `The AI Growth Agent is the most powerful feature in AlphaClone, and setting it up is surprisingly simple. Navigate to the **Growth Agent** section in the left sidebar. You'll see a simple interface with two main controls: Lead Discovery and Outreach Settings.

**Lead Discovery:** Click "Scrape Leads" and you'll see a targeting form. Enter your ideal client profile in plain language — the industry, geography, business size, and any other relevant characteristics. For example: "Marketing agencies in the United States with 5-50 employees." The Growth Agent will search public business directories and professional databases, and return a qualified lead list typically within 2-5 minutes depending on the scope of your search.

Review the discovered leads and de-select any that aren't relevant. Then click "Add to Pipeline" to move them into your CRM, or "Begin Outreach" to start the AI-managed contact sequence immediately.

**Outreach Management:** When outreach is active, the Growth Agent sends personalized initial messages to your leads, responds to replies using context-aware AI, asks qualifying questions (budget, timeline, specific needs), and flags conversations that are ready for your direct involvement. You only enter a conversation when the AI determines the lead is warm and qualified.

**Providing Context:** The better context you give the Growth Agent about your business, services, and ideal client, the more targeted and effective its outreach will be. Go to Growth Agent → Settings → Business Context and describe your services, your target client, and any specific pain points you solve. The AI uses this to personalize every message it sends.`,
            tips: [
                'Start with a specific niche target for your first scrape — narrower is more effective than broad',
                'Review 10-15 AI-drafted outreach messages before enabling automated sending, so you can check the tone',
                'The Growth Agent respects business hours — it won\'t send messages outside your configured window',
                'Check the "Warm Leads" filter daily to see which conversations the AI has qualified for you',
            ],
        },
        {
            icon: Video,
            color: 'from-blue-600 to-cyan-500',
            step: 9,
            title: 'Run Client Video Meetings',
            subtitle: 'Built-in HD video — no Zoom account needed',
            detail: `AlphaClone's built-in video platform means you can run client meetings, team check-ins, and partner calls without leaving the dashboard or managing external app accounts.

To start an instant call: Navigate to any client's CRM profile and click "Start Call" in the communication section. A video meeting room opens immediately in your browser. Share the meeting link with your client (it's a simple URL they can open in any browser — no app download required on their end).

For scheduled meetings: Your calendar shows all upcoming meetings from your Calendly integration. Click on any meeting event to open the meeting room at the scheduled time.

During the meeting, you have access to HD video and audio, screen sharing, and meeting recording. Recordings are automatically saved to your Document Hub, linked to the relevant client and project records. If you discussed something in a meeting that needs follow-up, you can create a task directly from the meeting interface without ending the call.

For team-internal meetings: Use the Active Meetings section in the sidebar. Any team member can start a meeting room that other team members can join through their dashboard. This is ideal for daily standups, project reviews, and team planning sessions.`,
            tips: [
                'Share the meeting link in advance via the CRM email function so the client has it ready',
                'Test your audio and camera in Settings → Video before your first client call',
                'Use screen sharing to walk clients through proposals and invoices live',
                'Recordings are stored for 30 days on Starter and Pro — download important ones for longer retention',
            ],
        },
        {
            icon: Users,
            color: 'from-amber-500 to-orange-500',
            step: 10,
            title: 'Invite Your Team Members',
            subtitle: 'Collaborate with full access controls',
            detail: `If you work with other people — employees, contractors, or business partners — you can give them access to the platform with specific permissions. Navigate to **Settings → Team → Invite Member**.

Enter the team member's email address and assign them a role. The built-in roles are:

**Admin:** Full access to all features — use this for business partners or your most trusted employees. Admins can see financials, manage integrations, and adjust platform settings.

**Manager:** Access to CRM, projects, tasks, and calendar, but no access to financial records or platform settings. Ideal for project managers or account managers who need full operational visibility.

**Member:** Standard operational access — can see projects and tasks assigned to them, can communicate with clients, but doesn't see other team members' work unless explicitly added to a project.

**Viewer:** Read-only access to specific sections. Useful for external stakeholders who need visibility into project progress without being able to make changes.

The invited person receives an email with a secure invitation link. When they click it, they set their own password and are taken directly into the workspace with their assigned permissions already applied.`,
            tips: [
                'Use the "Project-level access" option to give contractors visibility into only specific projects',
                'Admins can see all financial data — be thoughtful about who gets this role',
                'Team members can only see CRM contacts assigned to them unless they\'re Admin or Manager',
                'You can revoke access instantly at any time from Settings → Team if someone leaves the organization',
            ],
        },
    ];

    const faqs = [
        {
            q: 'How long does the complete setup take from start to finish?',
            a: 'Most users complete the full setup — account creation, workspace configuration, Gmail connection, Calendly integration, CRM import, and first invoice — in under 30 minutes. The AI Growth Agent can typically be activated within the first hour of use. If you skip the CRM import (because you want to start fresh), setup time drops to under 15 minutes.',
        },
        {
            q: 'Do I need to know anything about software or technology?',
            a: "No. AlphaClone is designed specifically for business owners who are experts in their field — not in technology. Every step in the setup process is guided by plain-language instructions. If you can use Gmail or book a meeting on an online calendar, you have all the technical knowledge you need to run AlphaClone fully.",
        },
        {
            q: "What happens if I'm already using HubSpot, QuickBooks, or another tool?",
            a: "You can migrate to AlphaClone at your own pace. Most users start by importing their client contacts from their existing CRM (CSV export/import takes under 5 minutes), then gradually shift their invoicing and communication workflows over. You don't have to switch everything on day one. Many users run AlphaClone alongside their existing tools for the first 2-4 weeks while they get familiar with the platform.",
        },
        {
            q: 'Can I try AlphaClone without committing to a paid plan?',
            a: "Yes. All plans start with a 14-day free trial. No credit card is required to begin the trial. You get full access to all features during the trial period — including the AI Growth Agent and financial suite. At the end of 14 days, you select a plan and enter payment details. If you decide not to continue, your account simply expires with no charge.",
        },
        {
            q: 'What happens to my data if I cancel?',
            a: "If you cancel your subscription, you have 30 days to export all your data — CRM contacts, invoices, contracts, documents — in standard formats (CSV, PDF, JSON). After 30 days, the data is permanently deleted from our servers. We provide clear export instructions and will assist you with bulk data exports if needed.",
        },
        {
            q: 'Is AlphaClone suitable for a business with only one person?',
            a: "Absolutely. Many AlphaClone users are solo operators — freelancers, independent consultants, and single-person businesses. The Starter plan is priced specifically for this use case. Even as a solo business owner, having a proper CRM, professional invoicing, contract management, and a scheduling page makes an enormous difference to how your business presents itself and how organized your operations are.",
        },
        {
            q: 'Can multiple people from my team use AlphaClone simultaneously?',
            a: "Yes. AlphaClone is a multi-user platform with real-time collaboration. Multiple team members can be logged in simultaneously, update the same project records, see live changes to the CRM, and communicate within the same workspace. Changes are reflected instantly across all sessions — no refresh required.",
        },
        {
            q: 'How does the AI Growth Agent know what to say to my leads?',
            a: "The Growth Agent uses the business context you provide (in Growth Agent → Settings → Business Context) to understand your services, target market, and value proposition. It then generates personalized outreach messages that reflect your specific expertise and the specific pain points of each lead's industry. The more detail you provide about your business, the more targeted and effective the outreach becomes. You can always review and approve message templates before enabling automated sending.",
        },
    ];

    const whyPoints = [
        {
            icon: Layers,
            title: 'Stop Managing 10 Tools. Start Managing Your Business.',
            desc: 'The average business owner opens 12+ apps per day. Every switch between apps is a context loss — you forget what you were doing, re-read messages to catch up, and lose momentum. AlphaClone puts everything in one interface so your context never breaks.',
        },
        {
            icon: TrendingUp,
            title: 'The AI Works While You Work — and While You Sleep',
            desc: 'The Growth Agent is finding and qualifying leads at 2am while you\'re asleep. By the time you open your laptop in the morning, there are warm conversations ready. This is leverage that would cost $5,000/month to hire a human to do.',
        },
        {
            icon: Building2,
            title: 'Look Like a Large Company When You\'re Still Small',
            desc: 'Branded invoices, professional contracts, a smart booking page, and an HD meeting room — clients see a polished, organized business from day one. First impressions determine whether someone decides to trust you with their money.',
        },
        {
            icon: Clock,
            title: 'Get 15+ Hours of Your Week Back',
            desc: 'Manual invoicing, chasing payments, scheduling back-and-forth, manually logging client conversations — AlphaClone automates or eliminates all of these. Most users reclaim over 15 hours per week that they can redirect to revenue-generating work.',
        },
        {
            icon: Globe,
            title: 'See Your Whole Business in One View',
            desc: 'How much revenue did you generate this month? Who owes you money? Which deals are stuck? How many leads did the AI find last week? Your AlphaClone dashboard answers all of these questions in real time without any manual reporting.',
        },
    ];

    return (
        <div className="min-h-screen bg-transparent text-white">
            <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />

            <div className="pt-20">
                {/* Hero — BLUF Answer Section */}
                <section className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/50 py-20">
                    <div className="max-w-4xl mx-auto px-4">
                        <div className="flex items-center gap-2 mb-4">
                            <BookOpen className="w-5 h-5 text-teal-400" />
                            <span className="text-teal-400 text-sm font-semibold tracking-widest uppercase">Platform Guide</span>
                        </div>
                        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                            User Guide for First-Time Teams{' '}
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-400">
                                No Technical Background Required
                            </span>
                        </h1>
                        <p className="text-xl text-slate-300 leading-relaxed">
                            This guide explains the platform in plain language so any new user can navigate confidently. It is designed for full self-service onboarding without founder involvement, technical training, or engineering support.
                        </p>
                        <div className="mt-8 grid grid-cols-3 gap-6 max-w-xl">
                            {[
                                { icon: Clock, label: '30 min', sub: 'average setup time' },
                                { icon: Zap, label: '10 steps', sub: 'clear navigation path' },
                                { icon: Star, label: 'No IT needed', sub: 'plain-language guide' },
                            ].map((item, i) => (
                                <div key={i} className="text-center">
                                    <item.icon className="w-6 h-6 text-teal-400 mx-auto mb-2" />
                                    <div className="font-bold text-white">{item.label}</div>
                                    <div className="text-slate-500 text-xs">{item.sub}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* First-time navigation map */}
                <section className="py-16 bg-slate-950">
                    <div className="max-w-4xl mx-auto px-4">
                        <h2 className="text-3xl font-bold mb-4">Where to Go in the Platform</h2>
                        <p className="text-slate-400 leading-relaxed mb-10">
                            Use this map if you are new and want direct navigation without guessing module names.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { area: 'Dashboard', purpose: 'See your business summary and today priorities.' },
                                { area: 'Leads', purpose: 'Find and qualify new prospects.' },
                                { area: 'Deals', purpose: 'Track active opportunities and pipeline value.' },
                                { area: 'Projects', purpose: 'Manage delivery work after a deal closes.' },
                                { area: 'Tasks', purpose: 'Assign and complete day-to-day actions.' },
                                { area: 'Social', purpose: 'Create, schedule, and publish content.' },
                                { area: 'Messages', purpose: 'Handle conversations in one place.' },
                                { area: 'Finance', purpose: 'Create invoices, monitor payments, and reports.' },
                            ].map((item, i) => (
                                <div key={i} className="p-5 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-slate-700/60">
                                    <h3 className="font-bold text-white mb-1">{item.area}</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed">{item.purpose}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Why AlphaClone — before the how */}
                <section className="py-16 bg-slate-950">
                    <div className="max-w-4xl mx-auto px-4">
                        <h2 className="text-3xl font-bold mb-4">Why AlphaClone Changes How You Run Your Business</h2>
                        <p className="text-slate-400 leading-relaxed mb-10">
                            Before diving into setup, here's why thousands of business owners made the switch — and what changes the moment you start using a unified Business OS.
                        </p>
                        <div className="space-y-4">
                            {whyPoints.map((point, i) => (
                                <div key={i} className="flex gap-4 p-5 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-slate-700/60">
                                    <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
                                        <point.icon className="w-5 h-5 text-teal-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white mb-1">{point.title}</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">{point.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Step-by-Step Guide */}
                <section className="py-16 bg-white/[0.02] backdrop-blur-sm border-y border-slate-800/50">
                    <div className="max-w-4xl mx-auto px-4">
                        <h2 className="text-3xl font-bold mb-4">The Complete Setup Guide</h2>
                        <p className="text-slate-400 mb-12 text-lg">10 steps. Read each section fully before moving to the next — there are tips at the end of each step that save time.</p>

                        <div className="space-y-8">
                            {steps.map((step, idx) => (
                                <div key={idx} className="relative">
                                    {/* Connector line */}
                                    {idx < steps.length - 1 && (
                                        <div className="absolute left-6 top-16 bottom-0 w-px bg-slate-800 -mb-8" />
                                    )}

                                    <div className="flex gap-6">
                                        {/* Step number + icon */}
                                        <div className="flex flex-col items-center flex-shrink-0">
                                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
                                                <step.icon className="w-6 h-6 text-white" />
                                            </div>
                                        </div>

                                        {/* Step content */}
                                        <div className="flex-1 pb-12">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Step {step.step} of {steps.length}</span>
                                            </div>
                                            <h3 className="text-2xl font-bold text-white mb-1">{step.title}</h3>
                                            <p className="text-teal-400 text-sm mb-6">{step.subtitle}</p>

                                            <div className="bg-white/[0.04] backdrop-blur-sm rounded-xl border border-slate-800 p-6 mb-4">
                                                {step.detail.split('\n\n').map((para, pi) => (
                                                    <p key={pi} className={`text-slate-300 leading-relaxed ${pi < step.detail.split('\n\n').length - 1 ? 'mb-4' : ''}`}>
                                                        {para.split(/(\*\*[^*]+\*\*)/).map((part, bi) =>
                                                            part.startsWith('**') && part.endsWith('**')
                                                                ? <strong key={bi} className="text-white font-semibold">{part.slice(2, -2)}</strong>
                                                                : part
                                                        )}
                                                    </p>
                                                ))}
                                            </div>

                                            {/* Tips */}
                                            <div className="bg-teal-500/5 border border-teal-500/20 rounded-xl p-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Terminal className="w-4 h-4 text-teal-400" />
                                                    <span className="text-teal-400 text-xs font-semibold uppercase tracking-wider">Pro Tips for This Step</span>
                                                </div>
                                                <ul className="space-y-2">
                                                    {step.tips.map((tip, ti) => (
                                                        <li key={ti} className="flex items-start gap-2">
                                                            <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                                                            <span className="text-slate-300 text-sm">{tip}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Integration Quick Reference */}
                <section className="py-16 bg-slate-950">
                    <div className="max-w-4xl mx-auto px-4">
                        <h2 className="text-3xl font-bold mb-4">Integration Quick Reference</h2>
                        <p className="text-slate-400 mb-8">Where to find each integration in the Settings panel:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { name: 'Gmail', nav: 'Settings → Integrations → Gmail', time: '60 seconds', icon: Mail },
                                { name: 'Calendly', nav: 'Settings → Integrations → Calendly', time: '2 minutes', icon: Calendar },
                                { name: 'Stripe Payments', nav: 'Settings → Payments → Connect Stripe', time: '3 minutes', icon: CreditCard },
                                { name: 'Team Members', nav: 'Settings → Team → Invite Member', time: '30 seconds per member', icon: Users },
                                { name: 'Growth Agent Context', nav: 'Growth Agent → Settings → Business Context', time: '5 minutes', icon: Bot },
                                { name: 'Brand & Logo', nav: 'Settings → Workspace → Branding', time: '2 minutes', icon: Building2 },
                                { name: 'Access Control (RBAC)', nav: 'Settings → Security → Access Roles', time: '5 minutes', icon: Lock },
                                { name: 'Invoice Templates', nav: 'Finance → Settings → Invoice Template', time: '3 minutes', icon: DollarSign },
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-slate-700/60">
                                    <item.icon className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <div className="font-semibold text-white text-sm">{item.name}</div>
                                        <div className="text-teal-400/70 text-xs font-mono mt-1">{item.nav}</div>
                                        <div className="text-slate-500 text-xs mt-1">Approx. {item.time}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* FAQ Section with JSON-LD compatible content */}
                <section className="py-16 bg-slate-900/50 border-t border-slate-800">
                    <div className="max-w-4xl mx-auto px-4">
                        <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
                        <p className="text-slate-400 mb-8">Answers to the most common questions from new AlphaClone users:</p>
                        <div className="space-y-3">
                            {faqs.map((faq, i) => (
                                <div key={i} className="bg-white/[0.04] backdrop-blur-sm border border-slate-700/60 rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/50 transition-colors"
                                    >
                                        <span className="font-semibold text-white pr-4">{faq.q}</span>
                                        {openFaq === i
                                            ? <ChevronUp className="w-5 h-5 text-teal-400 flex-shrink-0" />
                                            : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                                        }
                                    </button>
                                    {openFaq === i && (
                                        <div className="px-5 pb-5 border-t border-slate-800">
                                            <p className="text-slate-400 leading-relaxed pt-4">{faq.a}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="py-20">
                    <div className="max-w-3xl mx-auto px-4 text-center">
                        <Shield className="w-12 h-12 text-teal-400 mx-auto mb-6" />
                        <h2 className="text-3xl font-bold mb-6">Ready to Get Started?</h2>
                        <p className="text-slate-400 text-lg mb-10 leading-relaxed">
                            Create your free account now. The setup wizard inside the platform mirrors this guide step by step so first-time users can onboard without founder involvement.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Link href="/register">
                                <Button className="text-lg px-10 py-4 h-auto bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-xl shadow-teal-500/20">
                                    Start Free Trial
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                            </Link>
                            <Link href="/docs">
                                <Button variant="outline" className="text-lg px-10 py-4 h-auto border-slate-700 hover:bg-slate-800">
                                    View Documentation
                                </Button>
                            </Link>
                        </div>
                        <p className="mt-6 text-slate-500 text-sm">$15/month after trial · No credit card required to start · Cancel anytime</p>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default PlatformGuide;

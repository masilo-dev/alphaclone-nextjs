'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    LayoutDashboard, Users, TrendingUp, Zap, CheckSquare,
    Briefcase, Mail, Video, DollarSign, BarChart3,
    FileText, Settings, CheckCircle2, Globe, Calendar,
    Receipt, Shield, ArrowRight, ExternalLink, MessageSquare,
    ShieldCheck, Database
} from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';

export default function DocsPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-teal-500/30">
            {/* Header */}
            <nav className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">
                        AlphaClone Docs
                    </Link>
                    <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
                        Back to Home
                    </Link>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 py-16">
                <header className="mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Business Dashboard Guide</h1>
                    <p className="text-slate-400 text-lg leading-relaxed">
                        Welcome to the comprehensive guide for the AlphaClone Business OS. This documentation is structured to match your dashboard experience, providing step-by-step instructions for every page.
                    </p>
                </header>

                <section className="space-y-20">
                    {/* 1. Registration & Onboarding */}
                    <div id="onboarding" className="scroll-mt-24">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6 text-teal-400" />
                            </div>
                            <h2 className="text-3xl font-bold text-white">1. Secure Registration</h2>
                        </div>
                        <div className="space-y-8">
                            <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800">
                                <h3 className="text-xl font-bold text-white mb-4">The AlphaClone Signup Process</h3>
                                <ol className="space-y-6">
                                    <li className="flex gap-4">
                                        <div className="w-6 h-6 rounded-full bg-teal-500 text-slate-950 flex-shrink-0 flex items-center justify-center text-xs font-bold">1</div>
                                        <div>
                                            <p className="text-white font-semibold">Account Creation</p>
                                            <p className="text-sm text-slate-400 mt-1">Visit the <Link href="/login" className="text-teal-400 hover:underline">Login Page</Link> and select "Create Account". Provide your email and a secure password.</p>
                                        </div>
                                    </li>
                                    <li className="flex gap-4">
                                        <div className="w-6 h-6 rounded-full bg-teal-500 text-slate-950 flex-shrink-0 flex items-center justify-center text-xs font-bold">2</div>
                                        <div>
                                            <p className="text-white font-semibold">Plan Selection</p>
                                            <p className="text-sm text-slate-400 mt-1">Choose between **Starter ($15)**, **Pro ($45)**, or **Enterprise ($80)** based on your users and storage requirements.</p>
                                        </div>
                                    </li>
                                    <li className="flex gap-4">
                                        <div className="w-6 h-6 rounded-full bg-teal-500 text-slate-950 flex-shrink-0 flex items-center justify-center text-xs font-bold">3</div>
                                        <div>
                                            <p className="text-white font-semibold">Business OS Setup</p>
                                            <p className="text-sm text-slate-400 mt-1">Complete the onboarding wizard to name your workspace, set your logo, and configure your basic currency and timezone settings.</p>
                                        </div>
                                    </li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    {/* 2. Business Home */}
                    <div id="home" className="scroll-mt-24">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <Globe className="w-6 h-6 text-blue-400" />
                            </div>
                            <h2 className="text-3xl font-bold text-white">2. Business Home</h2>
                        </div>
                        <p className="text-slate-400 mb-8 leading-relaxed">
                            Your Command Center. From the Business Home, you can see real-time stats for your projects, pending invoices, and unread messages. Use the **Global Command (Ctrl+K)** to search across your entire CRM.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                                <h4 className="text-indigo-400 font-bold mb-2">Real-time Analytics</h4>
                                <p className="text-sm text-slate-400 text-slate-400">Track active projects, revenue (MTD), and system health directly from the header stats.</p>
                            </div>
                            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                                <h4 className="text-teal-400 font-bold mb-2">Omni-Search</h4>
                                <p className="text-sm text-slate-400 text-slate-400">Search for clients, transactions, or documents without leaving the home screen.</p>
                            </div>
                        </div>
                    </div>

                    {/* 3. CRM & Leads */}
                    <div id="crm" className="scroll-mt-24">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                <Shield className="w-6 h-6 text-indigo-400" />
                            </div>
                            <h2 className="text-3xl font-bold text-white">3. CRM & Deals</h2>
                        </div>
                        <div className="space-y-6">
                            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                                <h4 className="text-white font-bold mb-4 flex items-center gap-2"><ArrowRight className="w-4 h-4 text-teal-400" /> CRM Directory</h4>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    The CRM Directory maintains high-fidelity profiles for every client. Click on any client to view their history, assigned projects, and communication logs.
                                </p>
                            </div>
                            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                                <h4 className="text-white font-bold mb-4 flex items-center gap-2"><ArrowRight className="w-4 h-4 text-teal-400" /> Leads & Deals</h4>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Manage your sales pipeline via the Deals view. Drag and drop leads between stages (Discovery, Proposal, Negotiation, Won) to automatically update project status.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 4. Growth Agent (Sales Partner) */}
                    <div id="growth-agent" className="scroll-mt-24">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-zap-500/10 border border-teal-500/20 flex items-center justify-center">
                                <Zap className="w-6 h-6 text-teal-400" />
                            </div>
                            <h2 className="text-3xl font-bold text-white">4. Growth Agent</h2>
                        </div>
                        <p className="text-slate-400 mb-8 leading-relaxed">
                            The AlphaClone Growth Agent is a pre-deployed sales partner ready to assist your organization. It is built directly into the dashboard and does not require a separate installation or deployment process.
                        </p>
                        <div className="bg-gradient-to-br from-teal-900/20 to-blue-900/20 rounded-3xl p-8 border border-white/5">
                            <h4 className="text-teal-400 font-bold mb-4 text-lg">Using the Growth Agent</h4>
                            <ul className="space-y-6">
                                <li className="flex gap-4">
                                    <div className="mt-1"><CheckCircle2 className="w-5 h-5 text-teal-500" /></div>
                                    <div>
                                        <p className="text-white font-bold">Intelligent Lead Discovery</p>
                                        <p className="text-slate-400 text-sm mt-1">Access the Growth Agent tab to use the **Scrape** tool. Simply enter your target industry or niche, and the agent will extract high-fidelity leads from public business directories.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <div className="mt-1"><CheckCircle2 className="w-5 h-5 text-teal-500" /></div>
                                    <div>
                                        <p className="text-white font-bold">AI outreach & Chat</p>
                                        <p className="text-slate-400 text-sm mt-1">Interactions with leads are managed by the agent. It can qualify potential deals through automated chat and identify the best time for you to take over the conversation.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <div className="mt-1"><CheckCircle2 className="w-5 h-5 text-teal-500" /></div>
                                    <div>
                                        <p className="text-white font-bold">Manual Leads & Context</p>
                                        <p className="text-slate-400 text-sm mt-1">You can provide the agent with additional business context or new lead data manually to refine its outreach strategy for specific market segments.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* 5. Communications & Integrations */}
                    <div id="integrations" className="scroll-mt-24">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <Globe className="w-6 h-6 text-blue-400" />
                            </div>
                            <h2 className="text-3xl font-bold text-white">5. Communications & Integrations</h2>
                        </div>
                        <p className="text-slate-400 mb-8 leading-relaxed">
                            AlphaClone centralizes your communication stack. Connect your existing tools to manage everything from a single interface.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Gmail */}
                            <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 flex flex-col">
                                <div className="flex items-center gap-3 mb-4">
                                    <Mail className="w-6 h-6 text-red-400" />
                                    <h4 className="text-xl font-bold text-white">Gmail</h4>
                                </div>
                                <p className="text-sm text-slate-400 mb-6 flex-1">
                                    Connect your Google account to read, draft, and send emails directly within the Business OS. This keeps your communication context right next to your CRM data.
                                </p>
                                <p className="text-[10px] text-teal-500/70 font-mono uppercase tracking-tighter">Setup: Settings {" > "} Gmail Integration</p>
                            </div>

                            {/* Video Platform */}
                            <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 flex flex-col">
                                <div className="flex items-center gap-3 mb-4">
                                    <Video className="w-6 h-6 text-blue-400" />
                                    <h4 className="text-xl font-bold text-white">Video Platform</h4>
                                </div>
                                <p className="text-sm text-slate-400 mb-6 flex-1">
                                    AlphaClone includes a built-in HD video conferencing platform. Start instant calls with clients or join scheduled board meetings directly from the sidebar.
                                </p>
                                <p className="text-[10px] text-blue-500/70 font-mono uppercase tracking-tighter">Usage: Active Meetings Tab</p>
                            </div>

                            {/* Calendly */}
                            <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 flex flex-col md:col-span-2">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex gap-2 items-center">
                                        <Calendar className="w-6 h-6 text-blue-500" />
                                        <h4 className="text-xl font-bold text-white">Calendly / Scheduling</h4>
                                    </div>
                                </div>
                                <div className="grid md:grid-cols-2 gap-8">
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        Enable the automated booking system by connecting your Calendly account. AlphaClone will automatically skin your booking page to match your brand and sync new appointments to your dashboard.
                                    </p>
                                    <div className="space-y-4">
                                        <div className="flex gap-3 text-xs">
                                            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1" />
                                            <span className="text-slate-300">OAuth Connect for automated appointment syncing</span>
                                        </div>
                                        <div className="flex gap-3 text-xs">
                                            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1" />
                                            <span className="text-slate-300">Manual URL support for quick booking setup</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[10px] text-teal-500/70 font-mono uppercase tracking-tighter mt-6">Setup: Settings {" > "} Calendly Integration</p>
                            </div>
                        </div>
                    </div>

                    {/* 6. Financial Management */}
                    <div id="financials" className="scroll-mt-24">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                                <Receipt className="w-6 h-6 text-green-400" />
                            </div>
                            <h2 className="text-3xl font-bold text-white">6. Financial Management</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h4 className="text-white font-bold flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-400" /> Billing & Invoices</h4>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Manage your platform subscription and generate client invoices. Business Tenants can access "Plans & Billing" to upgrade or manage payment methods.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-white font-bold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-green-400" /> Accounting Suite</h4>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Full Chart of Accounts, Journal Entries, and Financial Reporting. Track every dollar spent and earned across your organization with professional-grade reporting.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 6. Security & Protocols */}
                    <div id="security" className="scroll-mt-24">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                                <ShieldCheck className="w-6 h-6 text-rose-400" />
                            </div>
                            <h2 className="text-3xl font-bold text-white">6. Security & Protocols</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 text-center">
                                <h5 className="text-white font-bold mb-2">RBAC Control</h5>
                                <p className="text-[10px] text-slate-500">Fine-grained access control for team members and external stakeholders.</p>
                            </div>
                            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 text-center">
                                <h5 className="text-white font-bold mb-2">SIEM Logs</h5>
                                <p className="text-[10px] text-slate-500">Continuous audit trail of all platform activity and potential security events.</p>
                            </div>
                            <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 text-center">
                                <h5 className="text-white font-bold mb-2">Perimeter Guard</h5>
                                <p className="text-[10px] text-slate-500">Real-time IP threat intelligence and automated DDoS mitigation.</p>
                            </div>
                        </div>
                    </div>

                    {/* Support CTA */}
                    <div className="bg-gradient-to-r from-teal-500/10 to-blue-500/10 p-12 rounded-3xl border border-white/5 mt-16 text-center">
                        <h3 className="text-2xl font-bold text-white mb-4">Need Custom Deployment?</h3>
                        <p className="text-slate-400 mb-8 max-w-xl mx-auto">
                            The AlphaClone engineering team can help you build custom AI integration flows, private database clusters, and specialized security parameters.
                        </p>
                        <Button
                            onClick={() => window.location.href = 'mailto:support@alphaclone.tech'}
                            className="bg-teal-500 text-slate-950 hover:bg-teal-400 font-bold px-12 py-6 h-auto text-lg rounded-2xl shadow-xl shadow-teal-500/20"
                        >
                            Contact Engineering
                        </Button>
                    </div>
                </section>

            </main>

            <footer className="border-t border-slate-900 py-12 text-center text-slate-600 text-sm">
                &copy; {new Date().getFullYear()} AlphaClone Systems. Built for Scale.
            </footer>
        </div>
    );
}


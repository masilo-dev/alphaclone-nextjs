'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, Shield, Zap, Globe, MessageSquare } from 'lucide-react';
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
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">How to Use AlphaClone</h1>
                    <p className="text-slate-400 text-lg leading-relaxed">
                        Welcome to the official AlphaClone documentation. This guide will help you understand our platform's core features and integrations.
                    </p>
                </header>

                <section className="space-y-12">
                    {/* Core Features */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                            <Shield className="w-8 h-8 text-teal-400 mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Unified CRM</h3>
                            <p className="text-slate-400 text-sm">Manage all your clients, leads, and prospects in one high-performance dashboard with automated pipelines.</p>
                        </div>
                        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                            <Zap className="w-8 h-8 text-blue-400 mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Financial Control</h3>
                            <p className="text-slate-400 text-sm">Create invoices, manage subscriptions, and track revenue streams with deep Stripe integration.</p>
                        </div>
                    </div>

                    {/* Integrations */}
                    <div className="pt-12 border-t border-slate-800">
                        <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                            <Globe className="w-6 h-6 text-teal-500" />
                            Connected Ecosystem
                        </h2>

                        <div className="space-y-8">
                            <div className="flex gap-6">
                                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
                                    <Database className="w-6 h-6 text-teal-400" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-white mb-2">Supabase Infrastructure</h4>
                                    <p className="text-slate-400 text-sm leading-relaxed mb-4">
                                        All your data is securely stored and managed using Supabase. This ensures real-time updates across all your devices and SIEM-grade security for your business information.
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-teal-500 font-bold uppercase tracking-wider">
                                        <CheckCircle2 className="w-4 h-4" />
                                        End-to-end Encrypted
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-6">
                                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
                                    <Calendar className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-white mb-2">Calendly Meetings</h4>
                                    <p className="text-slate-400 text-sm leading-relaxed mb-4">
                                        Schedule meetings directly within the platform. Our Calendly integration allows you to sync your availability and let clients book discovery calls without leaving the dashboard.
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-blue-500 font-bold uppercase tracking-wider">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Auto-Sync Availability
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Support */}
                    <div className="bg-gradient-to-r from-teal-500/10 to-blue-500/10 p-8 rounded-3xl border border-white/5 mt-16 text-center">
                        <h3 className="text-xl font-bold text-white mb-4">Need more help?</h3>
                        <p className="text-slate-400 text-sm mb-8">Our engineering team is available 24/7 for Enterprise customers.</p>
                        <Button onClick={() => window.location.href = 'mailto:support@alphaclone.tech'} className="bg-white text-slate-950 hover:bg-slate-200">
                            Contact Support
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

function Database(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5V19A9 3 0 0 0 21 19V5" />
            <path d="M3 12A9 3 0 0 0 21 12" />
        </svg>
    )
}

function Calendar(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
    )
}

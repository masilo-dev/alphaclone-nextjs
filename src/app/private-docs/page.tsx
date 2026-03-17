'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, Activity, Server, Database, Code } from 'lucide-react';

export default function PrivateDocsPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-teal-500/30">
            {/* Header */}
            <nav className="border-b border-white/5 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center border border-red-500/30">
                            <Lock className="w-4 h-4 text-red-400" />
                        </div>
                        <span className="font-bold text-white">INTERNAL DOCUMENTATION</span>
                    </div>
                    <Link href="/" className="text-xs text-slate-500 hover:text-white transition-colors uppercase tracking-widest font-bold">
                        Exit Portal
                    </Link>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-4 py-20">
                <div className="mb-20">
                    <h1 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">System Architecture & Backend SOP</h1>
                    <p className="text-slate-500 font-medium">Confidential - AlphaClone Engineering Only</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Security */}
                    <div className="md:col-span-2 space-y-12">
                        <section>
                            <h2 className="text-sm font-black text-teal-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                Deployment Pipeline
                            </h2>
                            <div className="bg-slate-900/50 rounded-2xl p-8 border border-white/5 space-y-6">
                                <div>
                                    <h4 className="text-white font-bold mb-2">Vercel & Next.js</h4>
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        Production deployments are continuous via Vercel. Ensure all environment variables (Supabase, Stripe, Gmail OAuth) are mirrored in the Vercel dashboard.
                                    </p>
                                </div>
                                <div className="p-4 bg-slate-950 rounded-xl border border-white/5 font-mono text-[11px] text-teal-500">
                                    # Trigger production build<br />
                                    git push origin main
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Server className="w-4 h-4" />
                                Database Schema
                            </h2>
                            <div className="bg-slate-900/50 rounded-2xl p-8 border border-white/5">
                                <p className="text-sm text-slate-400 mb-6">
                                    Our multi-tenant architecture relies on the `tenants` table for scoping. Every request must be filtered by `tenant_id` to prevent cross-leakage.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-950 rounded-xl border border-white/5">
                                        <div className="text-[10px] text-slate-600 font-bold mb-1">AUTH</div>
                                        <div className="text-xs text-slate-300">Supabase Auth hooks handles role assignment.</div>
                                    </div>
                                    <div className="p-4 bg-slate-950 rounded-xl border border-white/5">
                                        <div className="text-[10px] text-slate-600 font-bold mb-1">STORAGE</div>
                                        <div className="text-xs text-slate-300">S3 protocol via Supabase Buckets.</div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Sidebar */}
                    <aside className="space-y-8">
                        <div className="p-6 rounded-2xl bg-blue-900/10 border border-blue-500/20">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Quick Links</h3>
                            <ul className="space-y-3 text-xs">
                                <li><a href="https://supabase.com" target="_blank" className="text-slate-400 hover:text-blue-400 flex items-center gap-2"><Database className="w-3 h-3" /> Supabase Console</a></li>
                                <li><a href="https://dashboard.stripe.com" target="_blank" className="text-slate-400 hover:text-blue-400 flex items-center gap-2"><Code className="w-3 h-3" /> Stripe Dashboard</a></li>
                                <li><a href="https://vercel.com" target="_blank" className="text-slate-400 hover:text-blue-400 flex items-center gap-2"><Lock className="w-3 h-3" /> Vercel Deployments</a></li>
                            </ul>
                        </div>

                        <div className="p-6 rounded-2xl border border-red-500/20 bg-red-500/5">
                            <h3 className="text-sm font-black text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4" />
                                Security Alert
                            </h3>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                Never commit raw `.env` files. Rotate Stripe API keys every 90 days.
                            </p>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
}

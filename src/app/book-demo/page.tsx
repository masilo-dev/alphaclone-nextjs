'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, CheckCircle2, Users, Zap, Shield } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';

const WHAT_TO_EXPECT = [
  {
    icon: <Zap className="w-5 h-5 text-teal-400" />,
    title: 'Live product walkthrough',
    desc: 'See every module — CRM, invoicing, contracts, scheduling, and AI agents — running in a real account.',
  },
  {
    icon: <Users className="w-5 h-5 text-blue-400" />,
    title: 'Tailored to your business',
    desc: 'We focus on the workflows most relevant to your team size and industry.',
  },
  {
    icon: <Shield className="w-5 h-5 text-purple-400" />,
    title: 'Security & compliance overview',
    desc: 'Data handling, GDPR readiness, and multi-tenant isolation explained clearly.',
  },
  {
    icon: <CheckCircle2 className="w-5 h-5 text-green-400" />,
    title: 'Q&A and next steps',
    desc: 'Ask anything. We walk you through onboarding and pricing in the last 10 minutes.',
  },
];

export default function BookDemoPage() {
  return (
    <div className="min-h-screen bg-[#020D1A] text-slate-200 selection:bg-teal-500/30 relative overflow-x-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-teal-500/8 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-[50%] -right-20 w-[400px] h-[400px] bg-blue-500/8 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/6 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <nav className="fixed w-full z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/60 pt-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18 py-4">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative w-9 h-9 flex-shrink-0">
                <Image
                  src="/logo.png"
                  alt="AlphaClone Systems Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">AlphaClone</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                href="/auth/login"
                className="hidden sm:inline-flex items-center h-9 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link href="/auth/login?register=true&type=business&plan=starter">
                <button className="h-9 px-5 bg-teal-500 hover:bg-teal-400 active:scale-95 text-slate-950 text-sm font-bold rounded-xl shadow-lg shadow-teal-500/20 transition-all">
                  Start Free Trial
                </button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-28 pb-24 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page Hero */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-bold tracking-widest uppercase mb-6">
              <Calendar className="w-3.5 h-3.5" />
              Schedule a Demo
            </span>

            <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight text-white mb-5">
              See AlphaClone{' '}
              <span className="text-teal-400">in 30 minutes</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Pick a time that works for you. We'll show you exactly how AlphaClone replaces your
              entire SaaS stack — live, with your questions answered in real time.
            </p>

            {/* Trust pills */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              {[
                { icon: <Clock className="w-3.5 h-3.5" />, label: '30 min · no sales pressure' },
                { icon: <Users className="w-3.5 h-3.5" />, label: 'Live with a product expert' },
                { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Free · no card needed' },
              ].map((pill) => (
                <span
                  key={pill.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-300 text-xs font-semibold"
                >
                  {pill.icon}
                  {pill.label}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Main Layout: Calendly + Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 items-start">
            {/* Calendly Widget */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="relative"
            >
              {/* Decorative glow ring */}
              <div className="absolute -inset-px bg-gradient-to-br from-teal-500/25 via-blue-500/10 to-purple-500/10 rounded-[2rem] blur-xl pointer-events-none" />

              <div className="relative bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl shadow-black/40">
                {/* Widget header bar */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5 bg-slate-950/40">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                  <span className="text-xs text-slate-500 font-mono ml-2">calendly.com/bonniealphaclonesystems</span>
                </div>

                {/* Calendly Inline Widget */}
                <div
                  className="calendly-inline-widget"
                  data-url="https://calendly.com/bonniealphaclonesystems/30min?text_color=04241a&primary_color=4c53af"
                  style={{ minWidth: '320px', height: '700px' }}
                />
                <Script
                  src="https://assets.calendly.com/assets/external/widget.js"
                  strategy="lazyOnload"
                />
              </div>
            </motion.div>

            {/* Sidebar: What to expect */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="space-y-6 lg:sticky lg:top-28"
            >
              {/* What to expect card */}
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/8 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-5">What to expect</h2>
                <div className="space-y-5">
                  {WHAT_TO_EXPECT.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.08 }}
                      className="flex items-start gap-3"
                    >
                      <div className="p-2 bg-white/5 rounded-lg flex-shrink-0 mt-0.5">{item.icon}</div>
                      <div>
                        <p className="text-sm font-semibold text-white mb-0.5">{item.title}</p>
                        <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Platform badges */}
              <div className="bg-slate-900/40 border border-white/6 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
                  We'll cover
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    'CRM & Pipeline',
                    'Invoicing',
                    'Contracts',
                    'Scheduling',
                    'Projects',
                    'AI Agents',
                    'Email Campaigns',
                    'Team Chat',
                    'Analytics',
                    'Automations',
                  ].map((badge) => (
                    <span
                      key={badge}
                      className="px-2.5 py-1 bg-teal-500/10 border border-teal-500/20 rounded-full text-teal-300 text-xs font-medium"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA fallback */}
              <div className="bg-gradient-to-br from-teal-500/10 to-blue-500/10 border border-teal-500/20 rounded-2xl p-6 text-center">
                <p className="text-sm text-slate-300 mb-1 font-medium">Prefer a self-serve trial?</p>
                <p className="text-xs text-slate-500 mb-4">14 days free — no card required</p>
                <Link href="/auth/login?register=true&type=business&plan=starter">
                  <button className="w-full h-11 bg-teal-500 hover:bg-teal-400 active:scale-95 text-slate-950 font-bold rounded-xl shadow-lg shadow-teal-500/20 transition-all text-sm">
                    Start Free Trial
                  </button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Footer background light */}
      <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-gradient-to-t from-teal-500/5 to-transparent pointer-events-none" />
    </div>
  );
}

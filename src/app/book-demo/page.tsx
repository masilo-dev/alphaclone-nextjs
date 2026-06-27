'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, CheckCircle2, Users, Zap, Shield } from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';

const CALENDLY_URL = 'https://calendly.com/bonniealphaclonesystems/30min';

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
  const widgetRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);

  // Once the Calendly script is loaded, initialise the inline widget
  useEffect(() => {
    if (!scriptLoaded) return;
    if (!widgetRef.current) return;

    const win = window as any;

    const init = () => {
      if (win.Calendly && typeof win.Calendly.initInlineWidget === 'function') {
        win.Calendly.initInlineWidget({
          url: CALENDLY_URL,
          parentElement: widgetRef.current!,
          prefill: {},
          utm: {},
        });
        setWidgetReady(true);
      }
    };

    // Small delay to let Calendly finish its own setup
    const t = setTimeout(init, 300);
    return () => clearTimeout(t);
  }, [scriptLoaded]);

  return (
    <div className="min-h-screen bg-[#020D1A] text-slate-200 selection:bg-teal-500/30 relative overflow-x-hidden">
      {/* Calendly stylesheet */}
      <link
        href="https://assets.calendly.com/assets/external/widget.css"
        rel="stylesheet"
      />

      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-teal-500/8 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-[50%] -right-20 w-[400px] h-[400px] bg-blue-500/8 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/6 blur-[120px] rounded-full pointer-events-none" />

      <main className="relative z-10 py-8 pb-24 px-4">
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

          <div className="text-center mb-8">
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-10 py-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-2xl text-lg shadow-xl shadow-teal-500/25 transition-colors"
            >
              <Calendar className="w-5 h-5" />
              Book your 30-minute call
            </a>
            <p className="text-xs text-slate-500 mt-3">Opens Calendly in a new tab — works even if the embed below is blocked.</p>
          </div>

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
                  <a
                    href={CALENDLY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-400 hover:text-teal-300 ml-2 underline underline-offset-2"
                  >
                    Book a 30-minute call
                  </a>
                </div>

                {/* Loading placeholder — hidden once widget is ready */}
                {!widgetReady && (
                  <div className="flex flex-col items-center justify-center gap-4 py-20 text-slate-500">
                    <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm">Loading calendar…</p>
                  </div>
                )}

                {/* Calendly Inline Widget target */}
                <div
                  ref={widgetRef}
                  style={{ minWidth: '320px', height: widgetReady ? '700px' : '0px', overflow: 'hidden' }}
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

      {/* Calendly script — load after page is interactive */}
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
   Check,
   Zap,
   Database,
   Smartphone,
   TrendingUp,
   Layers,
   Briefcase,
   ShieldCheck,
   Mail,
   ArrowRight,
   Video,
} from 'lucide-react';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Button } from './ui/UIComponents';
import PublicNavigation from './PublicNavigation';
import MarketingFooter from './landing/MarketingFooter';
import MarketingPricingToggle, { type BillingPeriod } from '@/components/marketing/MarketingPricingToggle';
import { MarketingTestimonialsCarousel } from '@/components/marketing/ui/carousel';
import { MARKETING_TESTIMONIALS } from '@/config/marketingTestimonials';
import {
   BEFORE_AFTER_WORKFLOWS,
   OUTCOME_HERO_BULLETS,
   OUTCOME_PROMISE,
   OUTCOME_PROOF_STATS,
   OUTCOME_TRUST_POINTS,
} from '@/config/marketingOutcomes';
import VerifiedPartnersMarquee from './landing/VerifiedPartnersMarquee';
import { ServiceCard } from './landing/ServiceCard';
import { AIWorkerGraphic } from './ui/AIWorkerGraphic';
const HeroBackground = dynamic(() => import('./landing/HeroBackground'), {
   ssr: false,
   loading: () => <div className="absolute inset-0 bg-slate-950" />,
});

const VideoExplainer = dynamic(() => import('./dashboard/VideoExplainer'), {
   ssr: false,
});

import { PLATFORM_CALENDLY_URL } from '@/constants';
import { PUBLIC_PRICING_PLANS } from '@/config/pricingPlans';

const BUSINESS_SIGNUP_HREF = '/auth/login?register=true&type=business&plan=starter';
const LOGIN_HREF = '/auth/login';



const LandingPage = () => {
   const router = useRouter();
   const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
   const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
   const [contactForm, setContactForm] = useState({
      name: '',
      email: '',
      subject: '',
      message: ''
   });

   const heroOutcomePoints = [...OUTCOME_HERO_BULLETS];
   const heroTrustPoints = [...OUTCOME_TRUST_POINTS];

   // Handle contact form submission
   const handleContactSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      // Basic client-side validation to match server schema
      if (contactForm.message.length < 10) {
         import('react-hot-toast').then(({ toast }) => 
            toast.error('Message must be at least 10 characters long.')
         );
         return;
      }
      
      setFormStatus('sending');
      
      try {
         const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contactForm),
         });

         const data = await response.json();

         if (!response.ok) {
            // Check for validation details in response
            const errorMsg = data.details?.fieldErrors?.message?.[0] || data.error || 'Failed to send message';
            throw new Error(errorMsg);
         }

         setFormStatus('success');
         setContactForm({ name: '', email: '', subject: '', message: '' });
         setTimeout(() => setFormStatus('idle'), 5000);
      } catch (error: any) {
         console.error('Contact form error:', error);
         setFormStatus('error');
         import('react-hot-toast').then(({ toast }) => 
            toast.error(error.message || 'Failed to send message. Please try again.')
         );
         setTimeout(() => setFormStatus('idle'), 3000);
      }
   };

   return (
      <div className="min-h-screen page-network-bg marketing-theme font-marketing-body text-slate-200 selection:bg-teal-500/30">
         {/* Persistent full-page background */}
         <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            <HeroBackground />
         </div>
         <div className="fixed inset-0 z-[1] pointer-events-none bg-slate-950/25" />

         <PublicNavigation onLoginClick={() => router.push(LOGIN_HREF)} />

         <main className="relative z-10">
            {/* Hero Section */}
            <section id="home" className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden pt-16 sm:pt-20">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[600px] opacity-40 z-0">
                  <AIWorkerGraphic />
               </div>
               
               <motion.div 
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-6 sm:py-12 lg:py-16 rounded-2xl bg-slate-950/40 border border-cyan-500/15 shadow-[0_0_80px_-20px_rgba(0,255,255,0.12)]"
               >
                  <motion.div
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ duration: 0.5 }}
                  >
                     {/* Brand pill */}
                     <div className="inline-flex items-center gap-2.5 bg-cyan-500/10 border border-cyan-500/40 rounded-full px-5 py-2 mb-8">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                        <span className="text-sm font-semibold text-cyan-300 tracking-wide uppercase">{OUTCOME_PROMISE.badge}</span>
                     </div>

                     {/* Headline */}
                     <h1 className="font-marketing-heading font-black text-white mb-6 tracking-tight">
                        {OUTCOME_PROMISE.headline}{' '}
                        <span className="text-cyan-400">{OUTCOME_PROMISE.headlineAccent}</span>
                     </h1>
                     <p className="text-base sm:text-lg md:text-xl text-slate-300 mb-4 max-w-3xl mx-auto leading-relaxed">
                        {OUTCOME_PROMISE.subhead}
                     </p>
                     <p className="text-sm sm:text-base text-slate-400 mb-6 sm:mb-8 max-w-3xl mx-auto">
                        {OUTCOME_PROMISE.icp}
                     </p>

                     {/* CTAs */}
                     <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6 mt-6">
                        <Button
                           onClick={() => router.push(BUSINESS_SIGNUP_HREF)}
                           className="h-14 px-8 text-lg font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-xl shadow-cyan-500/20"
                        >
                           Start 14-Day Trial
                           <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                        <button
                           onClick={() => window.open(PLATFORM_CALENDLY_URL, '_blank', 'noopener,noreferrer')}
                           className="h-14 px-8 text-lg font-medium text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-all"
                        >
                           Book a Demo
                        </button>
                     </div>

                     {/* Outcome bullets — stack on phone, grid on tablet+ */}
                     <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-8 sm:mb-12 max-w-4xl mx-auto text-left">
                        {heroOutcomePoints.map((point) => (
                           <div
                              key={point}
                              className="flex items-start gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/40 px-4 py-3 shadow-[0_0_30px_-18px_rgba(34,211,238,0.25)]"
                           >
                              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-400">
                                 <Check className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-sm leading-relaxed text-slate-200">{point}</span>
                           </div>
                        ))}
                     </div>

                     <div className="flex flex-wrap justify-center gap-2 mb-10">
                        {heroTrustPoints.map((point) => (
                           <div key={point} className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/40 px-3.5 py-1.5 text-xs font-medium text-slate-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              {point}
                           </div>
                        ))}
                     </div>

                     {/* Trial block */}
                     <div className="mb-8 sm:mb-10 rounded-2xl sm:rounded-3xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-slate-950/60 to-blue-500/10 px-4 py-4 sm:px-6 sm:py-6 text-left max-w-4xl mx-auto marketing-shadow-md">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                           <div>
                              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300 mb-3">
                                 Try before you buy
                              </div>
                              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                 Get set up in minutes, not weeks.
                              </h2>
                              <p className="mt-2 max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
                                 Run a real client workflow in your 14-day trial — from lead to invoice — and decide with evidence, not a slide deck.
                              </p>
                           </div>
                           <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                              <Button
                                 onClick={() => router.push(BUSINESS_SIGNUP_HREF)}
                                 className="h-12 px-6 text-sm sm:text-base font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-xl shadow-cyan-500/20"
                              >
                                 Start Free Trial
                              </Button>
                              <button
                                 onClick={() => window.open(PLATFORM_CALENDLY_URL, '_blank', 'noopener,noreferrer')}
                                 className="h-12 px-6 text-sm sm:text-base font-semibold text-slate-200 border border-slate-700 hover:border-slate-500 rounded-xl transition-all"
                              >
                                 Book a Demo
                              </button>
                           </div>
                        </div>
                     </div>

                     {/* Proof stats */}
                     <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-center">
                        {OUTCOME_PROOF_STATS.map(({ value, label, detail }) => (
                           <div key={label} className="px-4 py-3 rounded-xl bg-cyan-500/5 border border-cyan-500/15 min-w-[140px] max-w-[180px]">
                              <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-marketing-data">{value}</div>
                              <div className="text-xs text-slate-300 mt-0.5 font-semibold uppercase tracking-wide">{label}</div>
                              <div className="text-[11px] text-slate-500 mt-1 leading-snug">{detail}</div>
                           </div>
                        ))}
                     </div>
                  </motion.div>
               </motion.div>
            </section>

            {/* ─── Verified partner integrations ─── */}
            <section className="py-10 border-y border-slate-800/60 bg-slate-950/60 overflow-hidden">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-6">
                  <p className="text-[11px] uppercase tracking-[0.28em] font-bold text-slate-500">
                     Works with the tools you already use
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                     Connect Stripe, Google, Microsoft, LinkedIn, Facebook, and more — without rebuilding your client workflow.
                  </p>
               </div>
               <VerifiedPartnersMarquee />
            </section>



            {/* Competitive Comparison Section */}
            <motion.section 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.8 }}
               className="py-16 relative overflow-hidden bg-slate-950/40 border-y border-slate-900"
            >
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                  <div className="text-center mb-10">
                     <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">
                        One workspace beats <span className="text-cyan-400">tool sprawl</span>
                     </h2>
                     <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                        AlphaClone combines the core systems most founders need, so you can act faster without switching apps all day.
                     </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                     {[
                        {
                           title: 'Replace the stack',
                           body: 'CRM, invoicing, contracts, projects, and meetings live in one workflow instead of five separate tools.',
                        },
                        {
                           title: 'Sell and deliver faster',
                           body: 'Move from lead to proposal to invoice without losing context or creating duplicate work.',
                        },
                        {
                           title: 'See value quickly',
                           body: 'Start a free trial, explore the workspace, and decide with a live system instead of a slide deck.',
                        },
                     ].map((item) => (
                        <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                           <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                              <Check className="h-5 w-5" />
                           </div>
                           <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                           <p className="text-sm leading-relaxed text-slate-300">{item.body}</p>
                        </div>
                     ))}
                  </div>

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
                     <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1">14-day free trial</span>
                     <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1">No card required</span>
                     <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1">$15/month starter plan</span>
                  </div>
               </div>
            </motion.section>

            {/* Before / After */}
            <section className="py-16 bg-slate-950/50 border-b border-slate-900">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center mb-10">
                     <h2 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">
                        What changes when your tools share one client record
                     </h2>
                     <p className="text-slate-400 max-w-2xl mx-auto">
                        Most teams don&apos;t need more software. They need fewer handoffs.
                     </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {BEFORE_AFTER_WORKFLOWS.map((row) => (
                        <div key={row.before} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-left">
                           <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-400/90 mb-2">Before</p>
                           <p className="text-sm text-slate-400 mb-4 leading-relaxed">{row.before}</p>
                           <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-400 mb-2">After AlphaClone</p>
                           <p className="text-sm text-slate-200 leading-relaxed">{row.after}</p>
                        </div>
                     ))}
                  </div>
                  <div className="mt-8 text-center">
                     <Link href="/results" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                        See workflow stories by team type
                        <ArrowRight className="h-4 w-4" />
                     </Link>
                  </div>
               </div>
            </section>

            {/* Workflow and Product Preview */}
            <section className="py-16 border-y border-slate-800 bg-[#050B14]/80">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                     <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="rounded-2xl border border-cyan-500/20 bg-[#081228]/90 p-5"
                     >
                        <h3 className="text-xl font-bold text-white mb-2">Chat-Driven Execution</h3>
                           <p className="text-sm text-slate-300 mb-4">
                           Trigger business workflows from chat while staying in your workspace. The platform runs CRM, tasks, invoices, and social operations in sequence.
                        </p>
                        <div className="space-y-2 text-sm">
                           {[
                              'User: Schedule this week of LinkedIn page posts and add leads to CRM',
                              'AlphaClone: Creating social queue, validating media, assigning leads',
                              'AlphaClone: Generated tasks, due-date reminders, and summary digest',
                           ].map((line, index) => (
                              <motion.div
                                 key={line}
                                 initial={{ opacity: 0.35, x: -8 }}
                                 whileInView={{ opacity: 1, x: 0 }}
                                 viewport={{ once: true }}
                                 transition={{ delay: index * 0.2, duration: 0.9, ease: 'easeOut' }}
                                 className="rounded-lg border border-cyan-500/15 bg-slate-950/80 px-3 py-2 text-slate-300"
                              >
                                 {line}
                              </motion.div>
                           ))}
                        </div>
                        <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                           <div className="flex items-center gap-2">
                              <motion.span
                                 className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-300"
                                 animate={{ opacity: [0.35, 1, 0.35] }}
                                 transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                              />
                              <p className="text-xs text-cyan-200">Automation active: CRM update, deal probability refresh, and follow-up task creation in progress.</p>
                           </div>
                        </div>
                     </motion.div>
                     <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="grid grid-cols-2 gap-3"
                     >
                        {[
                           { title: 'Project Management', caption: 'Milestones, ownership, and delivery health' },
                           { title: 'Task Scheduler', caption: 'Due-date visibility and reminders' },
                           { title: 'CRM Pipeline', caption: 'Lead qualification and outreach stage' },
                           { title: 'Invoice Workspace', caption: 'Draft, sent, overdue, and paid tracking' },
                        ].map((item) => (
                           <div key={item.title} className="rounded-xl border border-cyan-500/15 bg-[#081228]/90 p-3">
                              <div className="relative w-full h-20 mb-2 opacity-80">
                                 <Image 
                                    src="/window.svg" 
                                    alt={`${item.title} workflow preview`} 
                                    fill
                                    className="object-contain" 
                                 />
                              </div>
                              <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                              <p className="text-xs text-slate-300">{item.caption}</p>
                           </div>
                        ))}
                     </motion.div>
                  </div>
               </div>
            </section>

            {/* Platform Capabilities */}
            <section className="py-16 bg-slate-950/70">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="mb-10 text-center">
                     <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
                        Everything your business needs. Nothing it does not.
                     </h2>
                     <p className="text-slate-300 max-w-3xl mx-auto">
                        Built for business operators. Manage leads, tasks, projects, social publishing, and billing from a consistent interface with clear execution states.
                     </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {[
                        {
                           title: 'Lead Operations',
                           points: ['Capture and qualify leads', 'Track source and trust score', 'Move leads into deals and tasks'],
                        },
                        {
                           title: 'Revenue and Legal',
                           points: ['Proposal, quote, and contract flow', 'Invoice draft and due-date monitoring', 'Risk and overdue visibility'],
                        },
                        {
                           title: 'Delivery Automation',
                           points: ['Daily posting workflows', 'Notification and summary routing', 'Agent actions with audit trail'],
                        },
                     ].map((card, index) => (
                        <motion.div
                           key={card.title}
                           initial={{ opacity: 0, y: 12 }}
                           whileInView={{ opacity: 1, y: 0 }}
                           viewport={{ once: true }}
                           transition={{ delay: index * 0.18, duration: 0.85, ease: 'easeOut' }}
                           className="rounded-2xl border border-cyan-500/15 bg-[#081228]/90 p-5"
                        >
                           <h4 className="text-lg font-bold text-cyan-200 mb-3">{card.title}</h4>
                           <ul className="space-y-2">
                              {card.points.map((point) => (
                                 <li key={point} className="text-sm text-slate-300 flex items-start gap-2">
                                    <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-cyan-300" />
                                    {point}
                                 </li>
                              ))}
                           </ul>
                        </motion.div>
                     ))}
                  </div>
               </div>
            </section>




            {/* Privacy and Compliance */}
            <section className="hidden sm:block py-14 border-y border-slate-800 bg-slate-950/70">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                     <div className="rounded-2xl border border-cyan-500/15 bg-[#081228]/90 p-6">
                        <h3 className="text-2xl font-black text-white mb-3">Privacy and Compliance</h3>
                        <p className="text-sm text-slate-300 leading-relaxed mb-4">
                           AlphaClone is built for operational trust. We provide clear legal policies, data handling disclosures, and account-level controls for businesses and teams.
                        </p>
                        <div className="flex flex-wrap gap-3">
                           <Link href="/privacy-policy" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition-colors">
                              Privacy Policy
                           </Link>
                           <Link href="/terms-of-service" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition-colors">
                              Terms of Service
                           </Link>
                           <Link href="/cookie-policy" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition-colors">
                              Cookie Policy
                           </Link>
                           <Link href="/data-deletion" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition-colors">
                              Data Deletion
                           </Link>
                        </div>
                     </div>
                     <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
                        <h4 className="text-lg font-bold text-white mb-3">Why teams trust the platform</h4>
                        <ul className="space-y-2">
                           {[
                              'Encryption in transit and at rest with tenant isolation between workspaces.',
                              'Role-based access and audit logging for teams handling client and financial data.',
                              'Public privacy, security, and data-deletion policies — linked from every page.',
                              'Human support via sales and support email when you need onboarding help.',
                           ].map((item) => (
                              <li key={item} className="text-sm text-slate-300 flex items-start gap-2 leading-relaxed">
                                 <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-cyan-300" />
                                 {item}
                              </li>
                           ))}
                        </ul>
                     </div>
                  </div>
               </div>
            </section>

            {/* Outcome highlights */}
            <section className="hidden sm:block py-12 border-y border-slate-800 bg-slate-950/50">
               <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 2.5 }}
                  className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"
               >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
                     {[
                        { value: 'Win', label: 'Keep pipeline and follow-ups in one place' },
                        { value: 'Deliver', label: 'Projects tied to the deal that sold them' },
                        { value: 'Get paid', label: 'Invoices linked to contracts and delivery' },
                     ].map((stat, idx) => (
                        <motion.div
                           key={stat.label}
                           initial={{ opacity: 0, y: 20 }}
                           whileInView={{ opacity: 1, y: 0 }}
                           viewport={{ once: true }}
                           transition={{ delay: idx * 0.2, duration: 0.9, ease: 'easeOut' }}
                           className="space-y-2"
                        >
                           <div className="text-2xl sm:text-3xl font-black text-white">{stat.value}</div>
                           <div className="text-xs text-slate-300 uppercase tracking-wide">{stat.label}</div>
                        </motion.div>
                     ))}
                  </div>
               </motion.div>
            </section>

            {/* Features / Services Section */}
            <section id="services" className="py-20 bg-[#040A12]">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                  <motion.div 
                     initial={{ opacity: 0, y: 30 }}
                     whileInView={{ opacity: 1, y: 0 }}
                     viewport={{ once: true }}
                     className="text-center mb-16"
                  >
                     <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
                        You are not running a business. You are managing software.
                     </h2>
                     <p className="text-lg text-slate-300 max-w-3xl mx-auto">
                        Each capability below removes a handoff — so you spend time on clients, not copying data between apps.
                     </p>
                  </motion.div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                     {[
                        {
                           icon: Database,
                           title: 'Win clients',
                           desc: 'Capture leads, track pipeline, and follow up before opportunities go cold.',
                           color: 'from-blue-500 to-cyan-500'
                        },
                        {
                           icon: Briefcase,
                           title: 'Deliver work',
                           desc: 'Run projects and tasks with the same context sales promised the client.',
                           color: 'from-purple-500 to-indigo-500'
                        },
                        {
                           icon: TrendingUp,
                           title: 'Get paid',
                           desc: 'Send quotes and invoices tied to the deal — see what is paid, pending, or overdue.',
                           color: 'from-green-500 to-emerald-500'
                        },
                        {
                           icon: Zap,
                           title: 'Grow without admin drag',
                           desc: 'AI-assisted outreach and follow-up prep while you focus on delivery.',
                           color: 'from-yellow-500 to-orange-500'
                        },
                        {
                           icon: Video,
                           title: 'Meet clients in context',
                           desc: 'Start a call from the client record — notes and follow-ups stay attached.',
                           color: 'from-cyan-500 to-blue-500'
                        },
                        {
                           icon: Layers,
                           title: 'Stay visible online',
                           desc: 'Schedule LinkedIn and Facebook business posts without a separate social stack.',
                           color: 'from-indigo-500 to-violet-500'
                        },
                        {
                           icon: ShieldCheck,
                           title: 'Protect client data',
                           desc: 'Role-based access and audit trails for teams handling sensitive records.',
                           color: 'from-red-500 to-blue-500'
                        },
                        {
                           icon: Smartphone,
                           title: 'Work from anywhere',
                           desc: 'Check tasks, messages, and billing from mobile when you are away from desk.',
                           color: 'from-indigo-500 to-purple-500'
                        }
                     ].map((service, idx) => (
                        <ServiceCard
                           key={service.title}
                           index={idx}
                           service={{
                              id: service.title.toLowerCase().replace(/\s+/g, '-'),
                              icon: service.icon,
                              title: service.title,
                              summary: service.desc,
                              details: [],
                              gradient: service.color,
                           }}
                        />
                     ))}
                  </div>
               </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-20 bg-slate-950/60">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <motion.div 
                     initial={{ opacity: 0, y: 30 }}
                     whileInView={{ opacity: 1, y: 0 }}
                     viewport={{ once: true }}
                     className="text-center mb-16"
                  >
                     <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
                        One price. Your whole client operation connected.
                     </h2>
                     <p className="text-lg text-slate-300 max-w-3xl mx-auto">
                        No hidden fees. Test the full workflow free for 14 days — then keep the plan that matches your team.
                     </p>
                  </motion.div>

                  <MarketingPricingToggle
                     value={billingPeriod}
                     onChange={setBillingPeriod}
                     className="mb-10 flex justify-center"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
                     {PUBLIC_PRICING_PLANS.map((p) => ({
                        name: p.name,
                        price: billingPeriod === 'monthly' ? `$${p.price}` : `$${p.yearly}`,
                        period: billingPeriod === 'monthly' ? '/mo' : '/yr',
                        desc: p.tagline,
                        features: p.features,
                        note: p.badge || 'All features included',
                        popular: !!p.highlight,
                     })).map((plan, i) => (
                        <motion.div
                           key={i}
                           initial={{ opacity: 0, y: 30 }}
                           whileInView={{ opacity: 1, y: 0 }}
                           viewport={{ once: true }}
                           transition={{ delay: i * 0.1 }}
                           className={`relative p-8 sm:p-10 rounded-[2rem] border ${plan.popular ? 'bg-slate-900 border-teal-500 shadow-2xl shadow-teal-500/10 md:scale-105 z-10' : 'bg-slate-900/50 border-slate-800'} flex flex-col`}
                        >
                           {plan.popular && (
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-cyan-400 text-slate-950 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-tighter">
                                 Best for growing teams
                              </div>
                           )}
                           <h3 className="text-xl sm:text-2xl font-black text-white mb-1">{plan.name}</h3>
                           <p className="text-slate-400 text-sm mb-6">{plan.desc}</p>
                           <div className="flex items-baseline gap-1 mb-3">
                              <span className="text-4xl sm:text-5xl font-black text-white">{plan.price}</span>
                              <span className="text-slate-500 font-bold">{plan.period}</span>
                           </div>
                           <div className="inline-flex items-center gap-1.5 mb-6 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300" />
                              <span className="text-xs text-cyan-300 font-semibold">{plan.note}</span>
                           </div>
                           <ul className="space-y-3 mb-8 flex-grow">
                              {plan.features.map((feat, idx) => (
                                 <li key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                                    <Check className="w-4 h-4 text-teal-400 flex-shrink-0" />
                                    {feat}
                                 </li>
                              ))}
                           </ul>
                           <Button
                              onClick={() => router.push(BUSINESS_SIGNUP_HREF)}
                              className={`h-12 sm:h-14 w-full text-base sm:text-lg font-bold ${plan.popular ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
                           >
                              Start Free Trial
                           </Button>
                           <p className="text-xs text-slate-600 text-center mt-3">14-day free trial · No card required</p>
                        </motion.div>
                     ))}
                  </div>
               </div>
            </section>

            {/* Social proof carousel */}
            <section className="py-16 sm:py-20 border-y border-slate-800/60 bg-slate-950/40">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <motion.div
                     initial={{ opacity: 0, y: 20 }}
                     whileInView={{ opacity: 1, y: 0 }}
                     viewport={{ once: true }}
                     className="text-center mb-10"
                  >
                     <p className="text-[11px] uppercase tracking-[0.28em] font-bold text-slate-500 mb-3">
                        Typical outcomes
                     </p>
                     <h2 className="font-marketing-heading text-2xl sm:text-3xl font-black text-white tracking-tight">
                        What changes when handoffs disappear
                     </h2>
                     <p className="mt-3 text-sm text-slate-400 max-w-xl mx-auto">
                        Representative scenarios from teams like yours.{' '}
                        <Link href="/results" className="text-cyan-400 hover:text-cyan-300 font-semibold">
                           Read full workflow stories →
                        </Link>
                     </p>
                  </motion.div>
                  <MarketingTestimonialsCarousel items={MARKETING_TESTIMONIALS} />
               </div>
            </section>

            {/* Contact Section */}
            <section id="contact" className="py-16 sm:py-20 bg-gradient-to-b from-slate-900/30 to-slate-950">
               <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center mb-10">
                     <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">
                        Built for founders who run lean and move fast.
                     </h2>
                     <p className="text-base text-slate-300 max-w-xl mx-auto mb-8">
                        Create your workspace, connect the basics, and ask our team for onboarding support when you need it.
                     </p>
                     
                     <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16">
                        <a href="mailto:sales@alphaclonesystems.com" className="group flex items-center gap-3 px-6 py-4 bg-slate-900/50 border border-slate-800 hover:border-teal-500/50 rounded-xl transition-all">
                           <Mail className="w-5 h-5 text-teal-400" />
                           <div className="text-left">
                              <div className="text-xs text-slate-500 font-medium">Sales</div>
                              <div className="text-white font-semibold">sales@alphaclonesystems.com</div>
                           </div>
                        </a>
                        <a href="mailto:support@alphaclonesystems.com" className="group flex items-center gap-3 px-6 py-4 bg-slate-900/50 border border-slate-800 hover:border-teal-500/50 rounded-xl transition-all">
                           <Mail className="w-5 h-5 text-teal-400" />
                           <div className="text-left">
                              <div className="text-xs text-slate-500 font-medium">Support</div>
                              <div className="text-white font-semibold">support@alphaclonesystems.com</div>
                           </div>
                        </a>
                     </div>

                     {/* Contact Form */}
                     {formStatus === 'success' ? (
                        <motion.div
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center"
                        >
                           <h3 className="text-lg font-semibold text-green-400 mb-2">Message Sent</h3>
                           <p className="text-slate-300">We will get back to you within 24 hours.</p>
                        </motion.div>
                     ) : (
                        <form onSubmit={handleContactSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8">
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                              <div>
                                 <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                                 <input
                                    type="text"
                                    value={contactForm.name}
                                    onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 transition-all"
                                    placeholder="Your name"
                                    required
                                 />
                              </div>
                              <div>
                                 <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                                 <input
                                    type="email"
                                    value={contactForm.email}
                                    onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 transition-all"
                                    placeholder="your@email.com"
                                    required
                                 />
                              </div>
                           </div>
                           <div className="mb-6">
                              <label className="block text-sm font-medium text-slate-300 mb-2">Subject</label>
                              <input
                                 type="text"
                                 value={contactForm.subject}
                                 onChange={(e) => setContactForm(prev => ({ ...prev, subject: e.target.value }))}
                                 className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 transition-all"
                                 placeholder="How can we help?"
                                 required
                              />
                           </div>
                           <div className="mb-6">
                              <label className="block text-sm font-medium text-slate-300 mb-2">Message</label>
                              <textarea
                                 value={contactForm.message}
                                 onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                                 className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-slate-900 focus:ring-2 focus:ring-teal-500/20 transition-all resize-none"
                                 rows={6}
                                 placeholder="Tell us more about your needs..."
                                 required
                              />
                           </div>
                           <button
                              type="submit"
                              disabled={formStatus === 'sending'}
                              className="w-full py-4 px-6 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition-all flex items-center justify-center gap-3 group"
                           >
                              {formStatus === 'sending' ? (
                                 <>
                                    <motion.div
                                       animate={{ rotate: 360 }}
                                       transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                                       className="w-5 h-5 border-2 border-slate-950/20 border-t-slate-950 rounded-full"
                                    />
                                       Sending...
                                 </>
                              ) : (
                                 <>
                                    Send message
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                 </>
                              )}
                           </button>
                        </form>
                     )}
                  </div>
               </div>
            </section>
         </main>

         <div className="relative z-10">
            <MarketingFooter />
         </div>

      </div>
   );
};

export default LandingPage;

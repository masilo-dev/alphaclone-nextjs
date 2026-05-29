'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle, Mail, Menu, X } from 'lucide-react';
import { Button } from './ui/UIComponents';
import MarketingFooter from './landing/MarketingFooter';

const HeroBackground = React.lazy(() => import('./landing/HeroBackground'));

const LandingPageClean = ({ onLogin }: { onLogin?: () => void }) => {
   const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
   const [contactForm, setContactForm] = useState({
      name: '',
      email: '',
      subject: '',
      message: ''
   });
   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

   const handleContactSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setFormStatus('sending');
      
      try {
         const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contactForm),
         });

         if (response.ok) {
            setFormStatus('success');
            setContactForm({ name: '', email: '', subject: '', message: '' });
            setTimeout(() => setFormStatus('idle'), 5000);
         }
      } catch (error) {
         setFormStatus('error');
         setTimeout(() => setFormStatus('idle'), 3000);
      }
   };

   return (
      <div className="min-h-screen page-network-bg text-slate-200 selection:bg-teal-500/30">
         {/* Persistent full-page animated network background with Jarvis */}
         <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            {/* Base Jarvis Image Layer */}
            <div 
               className="absolute inset-0 bg-cover bg-center opacity-15 mix-blend-screen scale-110"
               style={{ backgroundImage: 'url("/images/jarvis-bg.png")' }}
            />
            
            {/* ICT Overlays: Scanlines & Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.8)_100%)] z-[1]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] z-[1] bg-[length:100%_3px,3px_100%] pointer-events-none opacity-20" />
            
            <HeroBackground />
         </div>

         {/* Navigation */}
         <nav className="fixed top-0 left-0 right-0 z-[100] bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
               <div className="flex justify-between items-center h-20">
                  {/* Logo */}
                  <div className="flex items-center gap-3 cursor-pointer group">
                     <div className="relative w-9 h-9 flex-shrink-0 flex items-center justify-center">
                        <img
                           src="/logo.png"
                           alt="AlphaClone Systems Logo"
                           width={36}
                           height={36}
                           className="rounded-lg"
                        />
                     </div>
                     <span className="text-xl font-bold text-white group-hover:text-teal-400 transition-colors">
                        AlphaClone Systems
                     </span>
                  </div>

                  {/* Desktop Navigation */}
                  <div className="hidden md:flex items-center gap-8">
                     <button
                        onClick={() => document.getElementById('impact')?.scrollIntoView({ behavior: 'smooth' })}
                        className="text-slate-300 hover:text-white transition-colors"
                     >
                        How It Works
                     </button>
                     <button
                        onClick={() => document.getElementById('trust')?.scrollIntoView({ behavior: 'smooth' })}
                        className="text-slate-300 hover:text-white transition-colors"
                     >
                        Who It's For
                     </button>
                     <button
                        onClick={() => window.location.href = '/register'}
                        className="bg-teal-500 hover:bg-teal-400 text-slate-950 px-6 py-2 rounded-lg font-medium transition-colors"
                     >
                        Start Free Trial
                     </button>
                  </div>

                  {/* Mobile Menu Button */}
                  <button
                     onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                     className="md:hidden text-slate-300 hover:text-white"
                  >
                     {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                  </button>
               </div>

               {/* Mobile Menu */}
               <AnimatePresence>
                  {mobileMenuOpen && (
                     <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="md:hidden border-t border-slate-800 py-4"
                     >
                        <div className="flex flex-col gap-4">
                           <button
                              onClick={() => {
                                 document.getElementById('impact')?.scrollIntoView({ behavior: 'smooth' });
                                 setMobileMenuOpen(false);
                              }}
                              className="text-slate-300 hover:text-white transition-colors text-left"
                           >
                              How It Works
                           </button>
                           <button
                              onClick={() => {
                                 document.getElementById('trust')?.scrollIntoView({ behavior: 'smooth' });
                                 setMobileMenuOpen(false);
                              }}
                              className="text-slate-300 hover:text-white transition-colors text-left"
                           >
                              Who It's For
                           </button>
                           <button
                              onClick={() => {
                                 window.location.href = '/register';
                                 setMobileMenuOpen(false);
                              }}
                              className="bg-teal-500 hover:bg-teal-400 text-slate-950 px-6 py-2 rounded-lg font-medium transition-colors text-left"
                           >
                              Start Free Trial
                           </button>
                        </div>
                     </motion.div>
                  )}
               </AnimatePresence>
            </div>
         </nav>

         {/* Hero Section */}
         <section className="relative py-20 lg:py-32 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
               <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-4xl mx-auto"
               >
                  <h1 className="text-5xl md:text-7xl font-black text-white mb-6">
                     AlphaClone <span className="text-teal-400">Systems</span>
                  </h1>
                  <p className="text-xl md:text-2xl text-slate-400 mb-8 max-w-3xl mx-auto leading-relaxed">
                     The Business OS that replaces 12 tools with one unified platform. 
                     Stop juggling apps and start growing revenue.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
                     <Button
                        onClick={() => window.location.href = '/register'}
                        className="h-14 px-8 text-lg font-bold bg-teal-500 hover:bg-teal-400 text-slate-950"
                     >
                        Start Free Trial
                        <ArrowRight className="w-5 h-5 ml-2" />
                     </Button>
                     <button
                        onClick={() => window.location.href = '/demo'}
                        className="h-14 px-8 text-lg font-medium text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-all"
                     >
                        Book a Demo
                     </button>
                  </div>

                  <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
                     <span>✓ No credit card required</span>
                     <span>✓ 14-day free trial</span>
                     <span>✓ Cancel anytime</span>
                  </div>

                  {/* Proof stats */}
                  <div className="flex flex-wrap justify-center gap-6 sm:gap-10 text-center mt-12">
                     {[
                        { value: '12', label: 'core modules' },
                        { value: '1', label: 'shared workspace' },
                        { value: '14', label: 'trial days' },
                        { value: '$0', label: 'card required' },
                     ].map(({ value, label }) => (
                        <div key={label}>
                           <div className="text-2xl sm:text-3xl font-black text-teal-400">{value}</div>
                           <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                        </div>
                     ))}
                  </div>
               </motion.div>
            </div>
         </section>

         {/* Business Impact Section */}
         <section id="impact" className="py-24 bg-slate-950/40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
               <div className="text-center mb-16">
                  <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
                     The <span className="text-teal-400">Business OS</span> That Works
                  </h2>
                  <p className="text-xl text-slate-400 max-w-3xl mx-auto">
                     Stop juggling disconnected tools. AlphaClone brings your core operating workflows into one workspace.
                  </p>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <motion.div
                     initial={{ opacity: 0, x: -30 }}
                     whileInView={{ opacity: 1, x: 0 }}
                     viewport={{ once: true }}
                     className="space-y-8"
                  >
                     {[
                        {
                           title: '12 Tools → 1 Platform',
                           desc: 'CRM, invoicing, projects, contracts, and more in one login.',
                           impact: 'One place for core workflows'
                        },
                        {
                           title: 'Revenue-First Workflow',
                           desc: 'Built-in sequences that turn leads into cash automatically.',
                           impact: 'Follow-up and pipeline visibility'
                        },
                        {
                           title: 'AI-Powered Growth',
                           desc: 'AI-assisted outreach workflows that help prepare and track follow-up.',
                           impact: 'Lead context connected to CRM'
                        }
                     ].map((item, idx) => (
                        <motion.div
                           key={item.title}
                           initial={{ opacity: 0, y: 20 }}
                           whileInView={{ opacity: 1, y: 0 }}
                           viewport={{ once: true }}
                           transition={{ delay: idx * 0.1 }}
                           className="flex gap-4"
                        >
                           <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
                              <CheckCircle className="w-6 h-6 text-teal-400" />
                           </div>
                           <div>
                              <h3 className="text-lg font-bold text-white mb-1">{item.title}</h3>
                              <p className="text-slate-400 text-sm mb-2">{item.desc}</p>
                              <p className="text-teal-400 text-sm font-medium">{item.impact}</p>
                           </div>
                        </motion.div>
                     ))}
                  </motion.div>

                  <motion.div
                     initial={{ opacity: 0, x: 30 }}
                     whileInView={{ opacity: 1, x: 0 }}
                     viewport={{ once: true }}
                     className="bg-slate-800/60 border border-slate-800 rounded-2xl p-8"
                  >
                     <div className="text-center mb-8">
                        <h3 className="text-2xl font-bold text-white mb-2">Operational Signals</h3>
                        <p className="text-slate-400">What AlphaClone helps you track in one workspace</p>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-6 mb-8">
                        {[
                           { label: 'CRM', value: '1', desc: 'Client source of truth' },
                           { label: 'Finance', value: '1', desc: 'Billing workspace' },
                           { label: 'Contracts', value: '1', desc: 'Agreement workflow' },
                           { label: 'Meetings', value: '1', desc: 'Client call context' }
                        ].map((stat) => (
                           <div key={stat.label} className="text-center">
                              <div className="text-3xl font-black text-teal-400 mb-1">{stat.value}</div>
                              <div className="text-sm font-medium text-white mb-1">{stat.label}</div>
                              <div className="text-xs text-slate-500">{stat.desc}</div>
                           </div>
                        ))}
                     </div>

                     <Button
                        onClick={() => window.location.href = '/register'}
                        className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
                     >
                        Start Getting Results
                        <ArrowRight className="w-4 h-4 ml-2" />
                     </Button>
                  </motion.div>
               </div>
            </div>
         </section>

         {/* Trust Section */}
         <section id="trust" className="py-20 bg-[#050B14]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
               <div className="text-center mb-12">
                  <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                     Built for <span className="text-teal-400">Serious Business</span>
                  </h2>
                  <p className="text-slate-400 max-w-2xl mx-auto">
                     Built for agencies, freelancers, and startups that want core operations in one workspace.
                  </p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                     { title: 'Agencies', desc: 'Unified ops for client delivery.' },
                     { title: 'Freelancers', desc: 'Pro tools for solo makers.' },
                     { title: 'Startups', desc: 'The OS for high-growth teams.' }
                  ].map((item) => (
                     <motion.div
                        key={item.title}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 hover:border-teal-500/30 transition-all text-center"
                     >
                        <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                        <p className="text-slate-500 text-sm">{item.desc}</p>
                     </motion.div>
                  ))}
               </div>
            </div>
         </section>

         {/* Final CTA */}
         <section className="py-24 relative overflow-hidden">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
               <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
               >
                  <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
                     Ready to <span className="text-teal-400">Replace</span> Your Business Stack?
                  </h2>
                  <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
                     Stop wasting time and money on disconnected tools. Get everything you need to run your business in one platform.
                  </p>
                  
                  <Button
                     onClick={() => window.location.href = '/register'}
                     className="h-14 px-8 text-lg font-bold bg-teal-500 hover:bg-teal-400 text-slate-950"
                  >
                     Start Free Trial
                     <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
               </motion.div>
            </div>
         </section>

         <MarketingFooter />
      </div>
   );
};

export default LandingPageClean;

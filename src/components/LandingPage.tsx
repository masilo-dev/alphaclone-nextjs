'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { 
   Check, 
   Zap, 
   Database, 
   Smartphone, 
   BarChart, 
   TrendingUp, 
   Layers, 
   Briefcase, 
   User as UserIcon, 
   ShieldCheck, 
   X, 
   Mail, 
   ArrowRight,
} from 'lucide-react';

import dynamic from 'next/dynamic';
import { Button } from './ui/UIComponents';
import MarketingFooter from './landing/MarketingFooter';

const HeroBackground = dynamic(() => import('./landing/HeroBackground'), {
   ssr: false,
   loading: () => <div className="absolute inset-0 bg-slate-950" />,
});

const VideoExplainer = dynamic(() => import('./dashboard/VideoExplainer'), {
   ssr: false,
});

const HamburgerIcon = ({ isOpen }: { isOpen: boolean }) => (
   <div className="relative w-6 h-6 flex flex-col justify-center items-center">
      <span className={`block w-5 h-0.5 bg-current rounded-full transition-all duration-300 ease-out ${isOpen ? 'rotate-45 translate-y-0.5' : '-translate-y-1'}`} />
      <span className={`block w-5 h-0.5 bg-current rounded-full transition-all duration-300 ease-out my-0.5 ${isOpen ? 'opacity-0' : 'opacity-100'}`} />
      <span className={`block w-5 h-0.5 bg-current rounded-full transition-all duration-300 ease-out ${isOpen ? '-rotate-45 -translate-y-0.5' : 'translate-y-1'}`} />
   </div>
);

const LandingPage = ({ projects = [], onLogin }: { projects?: any[]; onLogin?: () => void }) => {
   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
   const [scrolled, setScrolled] = useState(false);
   const [visible, setVisible] = useState(true);
   const [lastScrollY, setLastScrollY] = useState(0);
   const [activeService, setActiveService] = useState('crm');
   const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
   const [isLoginOpen, setIsLoginOpen] = useState(false);
   const [publicProjects, setPublicProjects] = useState<any[]>([]);

   const [contactForm, setContactForm] = useState({
      name: '',
      email: '',
      subject: '',
      message: ''
   });
   const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

   useEffect(() => {
      const handleScroll = () => {
         const currentScrollY = window.scrollY;
         setScrolled(currentScrollY > 50);
         // Always keep nav visible on homepage - no auto-hide
         setVisible(true);
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
   }, []);

   const scrollToSection = (id: string) => {
      const element = document.getElementById(id);
      if (element) {
         element.scrollIntoView({ behavior: 'smooth' });
         setMobileMenuOpen(false);
      }
   };

   const handleContactSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setFormStatus('sending');
      
      try {
         const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contactForm),
         });

         const data = await response.json();

         if (!response.ok) {
            throw new Error(data.error || 'Failed to send message');
         }

         setFormStatus('success');
         setContactForm({ name: '', email: '', subject: '', message: '' });
         setTimeout(() => setFormStatus('idle'), 5000);
      } catch (error) {
         console.error('Contact form error:', error);
         setFormStatus('error');
         import('react-hot-toast').then(({ toast }) => 
            toast.error('Failed to send message. Please try again or email us directly.')
         );
         setTimeout(() => setFormStatus('idle'), 3000);
      }
   };

   return (
      <div className="min-h-screen bg-[#020D1A] text-slate-200 selection:bg-teal-500/30">
         {/* Navigation */}
         <nav
            className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 border-b ${
               scrolled ? 'bg-slate-950/80 backdrop-blur-xl border-slate-800' : 'bg-transparent border-transparent'
            } ${
               visible ? 'translate-y-0' : '-translate-y-full'
            }`}
         >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
               <div className="flex justify-between items-center h-20">
                  {/* Logo */}
                  <div 
                     className="flex items-center gap-3 cursor-pointer group"
                     onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  >
                     <div className="relative w-9 h-9 flex-shrink-0 flex items-center justify-center">
                        <Image
                           src="/logo.png"
                           alt="AlphaClone Systems Logo"
                           width={36}
                           height={36}
                           className="object-contain"
                           priority
                           onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                     </div>
                     <span className="text-xl font-bold tracking-tight text-white font-marketing-heading">AlphaClone</span>
                  </div>

                  {/* Desktop Nav */}
                  <div className="hidden lg:flex items-center gap-8">
                     <button onClick={() => scrollToSection('services')} className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Platform</button>
                     <button onClick={() => scrollToSection('pricing')} className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Pricing</button>
                     <Link href="/docs" className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Docs</Link>
                     <Link href="/ecosystem" className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Ecosystem</Link>
                     <button onClick={() => scrollToSection('contact')} className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Contact</button>

                     <div className="flex items-center gap-3 ml-6 pl-6 border-l border-white/10">
                        <button 
                           onClick={() => window.location.href = '/login'}
                           className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                        >
                           Login
                        </button>
                        <Button
                           onClick={() => window.location.href = '/register'}
                           className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-6 h-10"
                        >
                           Start Now
                        </Button>
                     </div>
                  </div>

                  {/* Mobile Menu Trigger */}
                  <div className="lg:hidden">
                     <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                        className={`w-12 h-12 flex items-center justify-center rounded-xl border transition-all duration-300 ${mobileMenuOpen
                           ? 'text-teal-400 bg-slate-900 border-teal-500/50'
                           : 'text-white bg-white/5 border-white/10 hover:border-white/20'
                           }`}
                     >
                        <HamburgerIcon isOpen={mobileMenuOpen} />
                     </button>
                  </div>
               </div>
            </div>
         </nav>

         {/* Mobile Menu - Full Screen Overlay */}
         <AnimatePresence>
            {mobileMenuOpen && (
               <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 bg-slate-950 z-[200] lg:hidden overflow-y-auto"
               >
                  <div className="min-h-screen flex flex-col">
                     {/* Mobile Menu Header */}
                     <div className="flex items-center justify-between px-4 py-5 border-b border-slate-800">
                        <Link href="/" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
                           <div className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center">
                              <img
                                 src="/logo.png"
                                 alt="AlphaClone"
                                 width={32}
                                 height={32}
                                 className="object-contain"
                              />
                           </div>
                           <span className="text-lg font-bold text-white">AlphaClone</span>
                        </Link>
                        <button
                           onClick={() => setMobileMenuOpen(false)}
                           className="p-2 text-slate-400 hover:text-white transition-colors"
                           aria-label="Close menu"
                        >
                           <X className="w-6 h-6" />
                        </button>
                     </div>

                     {/* Mobile Menu Content */}
                     <div className="flex-1 px-4 py-8">
                        <nav className="space-y-2">
                           {['services', 'pricing', 'contact'].map((item) => (
                              <button
                                 key={item}
                                 onClick={() => scrollToSection(item)}
                                 className="w-full text-left px-4 py-4 text-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-900 rounded-xl transition-colors capitalize"
                              >
                                 {item === 'services' ? 'Platform' : item}
                              </button>
                           ))}
                           <Link 
                              href="/docs" 
                              onClick={() => setMobileMenuOpen(false)}
                              className="block w-full text-left px-4 py-4 text-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-900 rounded-xl transition-colors"
                           >
                              Docs
                           </Link>
                           <Link 
                              href="/ecosystem" 
                              onClick={() => setMobileMenuOpen(false)}
                              className="block w-full text-left px-4 py-4 text-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-900 rounded-xl transition-colors"
                           >
                              Ecosystem
                           </Link>
                        </nav>
                     </div>

                     {/* Mobile Menu Footer */}
                     <div className="border-t border-slate-800 p-4 space-y-3">
                        <button
                           onClick={() => window.location.href = '/register'}
                           className="w-full py-4 px-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-teal-500/20"
                        >
                           Start Free Trial
                        </button>
                        <button
                           onClick={() => window.location.href = '/login'}
                           className="w-full py-4 px-4 border border-slate-700 text-white hover:bg-slate-900 font-semibold rounded-xl transition-all"
                        >
                           Log in
                        </button>
                     </div>
                  </div>
               </motion.div>
            )}
         </AnimatePresence>

         <main>
            {/* Hero Section */}
            <section id="home" className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden pt-12 sm:pt-20">
               <div className="absolute inset-0 z-0">
                  <HeroBackground />
               </div>
               <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-10 sm:py-20 lg:py-32">
                  <motion.div
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ duration: 0.6 }}
                  >
                     {/* Brand pill */}
                     <div className="inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700/60 rounded-full px-4 py-1.5 mb-8 text-xs sm:text-sm text-slate-300 backdrop-blur-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                        The all-in-one Business OS for agencies &amp; teams
                     </div>

                     {/* Headline */}
                     <h1 className="font-black text-white mb-6 tracking-tight">
                        AlphaClone Systems
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500">
                           One platform. Every tool.
                        </span>
                     </h1>

                     {/* Solution subheadline */}
                     <p className="text-base sm:text-lg md:text-xl text-slate-400 mb-4 max-w-3xl mx-auto leading-relaxed">
                        AlphaClone gives agencies, freelancers, and service businesses a single platform for their <span className="text-white font-medium">CRM, invoicing, contracts, project management,</span> and <span className="text-teal-400 font-medium">AI-powered sales automation</span> — replacing a dozen tools with one login.
                     </p>

                     {/* Platform modules */}
                     <div className="flex flex-wrap justify-center gap-2 mb-10 sm:mb-12 max-w-2xl mx-auto">
                        {[
                           'CRM & Pipeline',
                           'Invoicing',
                           'Contracts',
                           'Projects',
                           'Bookings',
                           'AI Sales Agent',
                        ].map(label => (
                           <div key={label} className="bg-slate-800/50 border border-teal-500/20 rounded-full px-3 py-1 text-xs text-slate-300">
                              {label}
                           </div>
                        ))}
                     </div>

                     {/* CTAs */}
                     <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-10 sm:mb-12">
                        <Button
                           onClick={() => window.location.href = '/register'}
                           className="h-13 px-8 text-base font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-lg shadow-teal-500/25 w-full sm:w-auto"
                        >
                           Start Free — No Card Required
                           <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                        <button
                           onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
                           className="h-13 px-8 text-base font-medium text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-all w-full sm:w-auto py-3"
                        >
                           See what's inside
                        </button>
                     </div>

                     {/* Proof stats */}
                     <div className="flex flex-wrap justify-center gap-6 sm:gap-10 text-center">
                        {[
                           { value: '12+', label: 'tools replaced' },
                           { value: '14 days', label: 'free trial' },
                           { value: '$15/mo', label: 'to start' },
                           { value: '0', label: 'credit card to begin' },
                        ].map(({ value, label }) => (
                           <div key={label}>
                              <div className="text-xl sm:text-2xl font-black text-white">{value}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                           </div>
                        ))}
                     </div>
                  </motion.div>
               </div>
            </section>

            {/* Features / Services Section */}
            <section id="services" className="py-12 sm:py-20 relative overflow-hidden">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                  <div className="text-center mb-12">
                     <h2 className="font-black text-white mb-4 tracking-tight">Everything you need.<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500">Nothing you don't.</span></h2>
                     <p className="text-slate-400 max-w-2xl mx-auto">Each module works together — CRM, invoices, contracts, projects, and AI sales automation in one login.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                     {[
                        {
                           id: 'crm',
                           icon: Database,
                           title: 'Unified CRM',
                           desc: 'Client data, pipeline, and communication history in one place.',
                           features: ['Visual Pipelines', 'Lead Automation', 'Real-time Analytics']
                        },
                        {
                           id: 'projects',
                           icon: Layers,
                           title: 'Project Engine',
                           desc: 'Task management and project tracking for high-output teams.',
                           features: ['Milestone Tracking', 'Collaborative Boards', 'Asset Management']
                        },
                        {
                           id: 'billing',
                           icon: BarChart,
                           title: 'Finance & Billing',
                           desc: 'Automate invoices, track revenue, and manage payments.',
                           features: ['One-click Invoicing', 'Stripe Integration', 'Revenue Forecasting']
                        },
                        {
                           id: 'ai-growth',
                           icon: Zap,
                           title: 'AI Sales Agent',
                           desc: 'Autopilot outreach. Qualify leads and book meetings automatically.',
                           features: ['GPT-4o Powered', 'Multi-channel Outreach', 'Auto Qualification']
                        },
                        {
                           id: 'security',
                           icon: ShieldCheck,
                           title: 'Safe Ops',
                           desc: 'End-to-end encryption and granular access controls.',
                           features: ['RBAC Permissions', 'Encrypted Video', 'Audit Trails']
                        },
                        {
                           id: 'mobile',
                           icon: Smartphone,
                           title: 'Mobile Ready',
                           desc: 'Manage your business from anywhere with full PWA support.',
                           features: ['Real-time Alerts', 'Mobile Dashboard', 'Offline Mode']
                        }
                     ].map((item, i) => (
                        <div
                           key={i}
                           className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 hover:border-teal-500/30 transition-all flex flex-col h-full"
                        >
                           <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center mb-4">
                              <item.icon className="w-5 h-5 text-teal-400" />
                           </div>
                           <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                           <p className="text-slate-400 text-sm mb-4 flex-grow">{item.desc}</p>
                           <ul className="space-y-1.5">
                              {item.features.map((feat, idx) => (
                                 <li key={idx} className="flex items-center gap-2 text-xs text-teal-400/80">
                                    <div className="w-1 h-1 rounded-full bg-teal-500 flex-shrink-0" />
                                    {feat}
                                 </li>
                              ))}
                           </ul>
                        </div>
                     ))}
                  </div>
               </div>
            </section>

            {/* Who We Serve Section */}
            <section className="py-16 bg-[#050B14]">
               <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center mb-10">
                     <h2 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">
                        Built for the <span className="text-teal-400">Ambitious</span>
                     </h2>
                     <p className="text-base text-slate-400 max-w-xl mx-auto">
                        For agencies, freelancers, and startups that want enterprise control without enterprise overhead.
                     </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                     {[
                        { title: 'Agencies', desc: 'Scale client delivery without adding more software.', icon: Briefcase },
                        { title: 'Freelancers', desc: 'Run a professional solo business with unified ops.', icon: UserIcon },
                        { title: 'Startups', desc: 'Consolidate 10+ subscriptions into one Business OS.', icon: TrendingUp }
                     ].map((item) => (
                        <div
                           key={item.title}
                           className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-teal-500/40 transition-all"
                        >
                           <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-4">
                              <item.icon className="w-5 h-5 text-teal-400" />
                           </div>
                           <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                           <p className="text-slate-400 text-sm">{item.desc}</p>
                        </div>
                     ))}
                  </div>
               </div>
            </section>

            {/* Video Explainer Section */}
            <VideoExplainer />

            {/* Stats / Proof Section */}
            <section className="py-12 border-y border-slate-800 bg-slate-950/50">
               <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                     {[
                        { label: 'Uptime', value: '99.9%' },
                        { label: 'Tools Replaced', value: '12+' },
                        { label: 'Support', value: '24/7' },
                        { label: 'Encryption', value: 'AES-256' }
                     ].map((stat, i) => (
                        <div key={i}>
                           <div className="text-3xl sm:text-4xl font-black text-white mb-1">{stat.value}</div>
                           <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">{stat.label}</div>
                        </div>
                     ))}
                  </div>
               </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-16 sm:py-20 relative">
               <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center mb-12">
                     <h2 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">Simple, Transparent Pricing</h2>
                     <p className="text-base text-slate-400 max-w-xl mx-auto">
                        One price for total control. No hidden fees. No surprises.
                     </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
                     {[
                        {
                           name: 'Starter', price: '$15', desc: 'Solo founders & freelancers',
                           features: [
                              '5 Users · 5GB Storage',
                              '10 Projects · 10 Contracts',
                              '50 AI queries / mo',
                              '10 AI Agent runs / mo',
                              'Standard support (48h)',
                           ],
                           note: 'All features included',
                           popular: false
                        },
                        {
                           name: 'Pro', price: '$45', desc: 'High-growth teams & agencies',
                           features: [
                              '25 Users · 25GB Storage',
                              '100 Projects · 100 Contracts',
                              '500 AI queries / mo',
                              '200 AI Agent runs / mo',
                              'Priority support (12h)',
                           ],
                           note: 'All features included',
                           popular: true
                        },
                        {
                           name: 'Enterprise', price: '$80', desc: 'Large scale operations',
                           features: [
                              'Unlimited Users & Storage',
                              'Unlimited Projects & Contracts',
                              'Unlimited AI queries',
                              'Unlimited AI Agent runs',
                              'Dedicated support (4h)',
                           ],
                           note: 'All features included',
                           popular: false
                        }
                     ].map((plan, i) => (
                        <div key={i} className={`relative p-8 sm:p-10 rounded-[2rem] border ${plan.popular ? 'bg-slate-900 border-teal-500 shadow-2xl shadow-teal-500/10 md:scale-105 z-10' : 'bg-slate-900/50 border-slate-800'} flex flex-col`}>
                           {plan.popular && (
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-teal-500 text-slate-950 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-tighter">
                                 Most Popular
                              </div>
                           )}
                           <h3 className="text-xl sm:text-2xl font-black text-white mb-1">{plan.name}</h3>
                           <p className="text-slate-400 text-sm mb-6">{plan.desc}</p>
                           <div className="flex items-baseline gap-1 mb-3">
                              <span className="text-4xl sm:text-5xl font-black text-white">{plan.price}</span>
                              <span className="text-slate-500 font-bold">/mo</span>
                           </div>
                           <div className="inline-flex items-center gap-1.5 mb-6 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                              <span className="text-xs text-teal-400 font-semibold">{plan.note}</span>
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
                              onClick={() => window.location.href = '/register'}
                              className={`h-12 sm:h-14 w-full text-base sm:text-lg font-bold ${plan.popular ? 'bg-teal-500 hover:bg-teal-400 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
                           >
                              Start Free Trial
                           </Button>
                           <p className="text-xs text-slate-600 text-center mt-3">14-day free trial · No card required</p>
                        </div>
                     ))}
                  </div>
               </div>
            </section>

            {/* Contact Section */}
            <section id="contact" className="py-16 sm:py-20 bg-gradient-to-b from-slate-900/30 to-slate-950">
               <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center mb-10">
                     <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">
                        Get in Touch
                     </h2>
                     <p className="text-base text-slate-400 max-w-xl mx-auto mb-8">
                        Have questions? Reach out to our team directly.
                     </p>
                     
                     <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16">
                        <a href="mailto:sales@alphaclone.tech" className="group flex items-center gap-3 px-6 py-4 bg-slate-900/50 border border-slate-800 hover:border-teal-500/50 rounded-xl transition-all">
                           <Mail className="w-5 h-5 text-teal-400" />
                           <div className="text-left">
                              <div className="text-xs text-slate-500 font-medium">Sales</div>
                              <div className="text-white font-semibold group-hover:text-teal-400 transition-colors">sales@alphaclone.tech</div>
                           </div>
                        </a>
                        <a href="mailto:support@alphaclone.tech" className="group flex items-center gap-3 px-6 py-4 bg-slate-900/50 border border-slate-800 hover:border-teal-500/50 rounded-xl transition-all">
                           <Mail className="w-5 h-5 text-teal-400" />
                           <div className="text-left">
                              <div className="text-xs text-slate-500 font-medium">Support</div>
                              <div className="text-white font-semibold group-hover:text-teal-400 transition-colors">support@alphaclone.tech</div>
                           </div>
                        </a>
                     </div>
                  </div>

                  <div className="max-w-xl mx-auto">
                     {formStatus === 'success' ? (
                        <motion.div 
                           initial={{ opacity: 0, scale: 0.95 }}
                           animate={{ opacity: 1, scale: 1 }}
                           className="text-center py-20 bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-3xl shadow-2xl"
                        >
                           <div className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-green-500/10">
                              <Check className="w-10 h-10 text-green-400" />
                           </div>
                           <h3 className="text-3xl font-black text-white mb-3">Message sent</h3>
                           <p className="text-slate-400 text-lg">We'll get back to you within 24 hours.</p>
                        </motion.div>
                     ) : (
                        <form onSubmit={(e) => {
                           e.preventDefault();
                           if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactForm.email)) {
                              import('react-hot-toast').then(({ toast }) => toast.error('Please enter a valid email address'));
                              return;
                           }
                           handleContactSubmit(e);
                        }} className="space-y-6">
                           <div className="relative group">
                              <input
                                 type="text"
                                 id="name"
                                 required
                                 value={contactForm.name}
                                 onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                                 className="peer w-full px-4 pt-6 pb-2 bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-2xl text-white placeholder-transparent focus:outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 transition-all duration-200"
                                 placeholder="Name"
                              />
                              <label 
                                 htmlFor="name"
                                 className="absolute left-4 top-2 text-xs font-semibold text-slate-500 transition-all duration-200 peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-placeholder-shown:text-slate-500 peer-focus:top-2 peer-focus:text-xs peer-focus:text-teal-400"
                              >
                                 Name
                              </label>
                              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-teal-500/0 via-teal-500/5 to-teal-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                           </div>

                           <div className="relative group">
                              <input
                                 type="email"
                                 id="email"
                                 required
                                 value={contactForm.email}
                                 onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                                 className="peer w-full px-4 pt-6 pb-2 bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-2xl text-white placeholder-transparent focus:outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 transition-all duration-200"
                                 placeholder="Email"
                              />
                              <label 
                                 htmlFor="email"
                                 className="absolute left-4 top-2 text-xs font-semibold text-slate-500 transition-all duration-200 peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-placeholder-shown:text-slate-500 peer-focus:top-2 peer-focus:text-xs peer-focus:text-teal-400"
                              >
                                 Email
                              </label>
                              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-teal-500/0 via-teal-500/5 to-teal-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                           </div>

                           <div className="relative group">
                              <textarea
                                 id="message"
                                 required
                                 value={contactForm.message}
                                 onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                                 className="peer w-full px-4 pt-6 pb-2 bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-2xl text-white placeholder-transparent focus:outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 min-h-[140px] resize-none transition-all duration-200"
                                 placeholder="Message"
                              />
                              <label 
                                 htmlFor="message"
                                 className="absolute left-4 top-2 text-xs font-semibold text-slate-500 transition-all duration-200 peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-placeholder-shown:text-slate-500 peer-focus:top-2 peer-focus:text-xs peer-focus:text-teal-400"
                              >
                                 Message
                              </label>
                              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-teal-500/0 via-teal-500/5 to-teal-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                           </div>

                           <button
                              type="submit"
                              disabled={formStatus === 'sending'}
                              className="group relative w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-bold py-5 px-6 rounded-2xl transition-all duration-200 shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/40 disabled:cursor-not-allowed disabled:shadow-none overflow-hidden"
                           >
                              <span className="relative z-10 flex items-center justify-center gap-2">
                                 {formStatus === 'sending' ? (
                                    <>
                                       <motion.div
                                          animate={{ rotate: 360 }}
                                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
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
                              </span>
                              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                           </button>
                        </form>
                     )}
                  </div>
               </div>
            </section>
         </main>

         <MarketingFooter />
      </div>
   );
};

export default LandingPage;

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
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
   Video,
} from 'lucide-react';

import dynamic from 'next/dynamic';
import { Button } from './ui/UIComponents';
import MarketingFooter from './landing/MarketingFooter';
import { ServiceCard } from './landing/ServiceCard';
import { AIWorkerGraphic } from './ui/AIWorkerGraphic';
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
   const [activeService, setActiveService] = useState('');
   const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
   const [isLoginOpen, setIsLoginOpen] = useState(false);
   const [publicProjects] = useState(projects);
   const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
   const [contactForm, setContactForm] = useState({
      name: '',
      email: '',
      subject: '',
      message: ''
   });

   // Enhanced scroll handling with smooth transitions
   useEffect(() => {
      const handleScroll = () => {
         const currentScrollY = window.scrollY;
         setVisible(currentScrollY < lastScrollY || currentScrollY < 10);
         setScrolled(currentScrollY > 20);
         setLastScrollY(currentScrollY);
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
   }, [lastScrollY]);

   // Smooth scroll function
   const scrollToSection = useCallback((sectionId: string) => {
      setMobileMenuOpen(false);
      const element = document.getElementById(sectionId);
      if (element) {
         element.scrollIntoView({ behavior: 'smooth', block: 'start' });
         return;
      }
      window.location.href = `/#${sectionId}`;
   }, []);

   // Handle contact form submission
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
      <div className="min-h-screen page-network-bg marketing-theme font-marketing-body text-slate-200 selection:bg-teal-500/30">
         {/* Persistent full-page background */}
         <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            <HeroBackground />
         </div>

         {/* Enhanced Navigation with better transitions */}
         <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
            scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 shadow-lg' : 'bg-slate-950/80 backdrop-blur-lg'
         } ${visible ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
               <div className="flex justify-between items-center h-16 sm:h-[4.5rem]">
                  {/* Logo */}
                  <div className="flex items-center gap-3 cursor-pointer group">
                     <div className="relative w-9 h-9 flex-shrink-0 flex items-center justify-center">
                        <img
                           src="/logo.png"
                           alt="AlphaClone"
                           width={36}
                           height={36}
                           className="object-contain"
                           onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                     </div>
                     <span className="text-xl font-bold tracking-tight text-white font-marketing-heading">AlphaClone</span>
                  </div>

                  {/* Desktop Nav */}
                  <div className="hidden lg:flex items-center gap-8">
                     <Link href="/" className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Home</Link>
                     <Link href="/guide" className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Guide</Link>
                     <button onClick={() => scrollToSection('services')} className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Platform</button>
                     <button onClick={() => scrollToSection('pricing')} className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Pricing</button>
                     <Link href="/docs" className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Docs</Link>
                     <Link href="/faq" className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">FAQ</Link>
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
                  transition={{ duration: 0.5 }}
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
                     <div className="flex-1 px-4 py-6">
                        <nav className="space-y-1">
                           <Link
                              href="/"
                              onClick={() => setMobileMenuOpen(false)}
                              className="block w-full text-left px-4 py-4 text-lg font-semibold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                           >
                              Home
                           </Link>
                           <Link
                              href="/guide"
                              onClick={() => setMobileMenuOpen(false)}
                              className="block w-full text-left px-4 py-4 text-lg font-semibold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                           >
                              Guide
                           </Link>
                           {['services', 'pricing', 'contact'].map((item) => (
                              <button
                                 key={item}
                                 onClick={() => scrollToSection(item)}
                                 className="w-full text-left px-4 py-4 text-lg font-semibold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl transition-colors capitalize"
                              >
                                 {item === 'services' ? 'Platform' : item.charAt(0).toUpperCase() + item.slice(1)}
                              </button>
                           ))}
                           <Link
                              href="/docs"
                              onClick={() => setMobileMenuOpen(false)}
                              className="block w-full text-left px-4 py-4 text-lg font-semibold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                           >
                              Docs
                           </Link>
                           <Link
                              href="/faq"
                              onClick={() => setMobileMenuOpen(false)}
                              className="block w-full text-left px-4 py-4 text-lg font-semibold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                           >
                              FAQ
                           </Link>
                           <Link
                              href="/ecosystem"
                              onClick={() => setMobileMenuOpen(false)}
                              className="block w-full text-left px-4 py-4 text-lg font-semibold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                           >
                              Ecosystem
                           </Link>

                           {/* Login - prominent in nav, not hidden at bottom */}
                           <div className="pt-4 mt-4 border-t border-slate-800">
                              <Link
                                 href="/login"
                                 onClick={() => setMobileMenuOpen(false)}
                                 className="flex items-center justify-between w-full px-4 py-4 text-lg font-bold text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 rounded-xl transition-colors border border-teal-500/20"
                              >
                                 Log In
                                 <ArrowRight className="w-5 h-5" />
                              </Link>
                           </div>
                        </nav>
                     </div>

                     {/* Mobile Menu Footer CTA */}
                     <div className="border-t border-slate-800 p-4">
                        <button
                           onClick={() => { window.location.href = '/register'; }}
                           className="w-full py-4 px-4 bg-teal-500 hover:bg-teal-400 active:scale-95 text-slate-950 font-black text-lg rounded-2xl transition-all shadow-xl shadow-teal-500/30"
                        >
                           Start Free Trial
                        </button>
                        <p className="text-center text-xs text-slate-500 mt-2">14-day free trial · No card required</p>
                     </div>
                  </div>
               </motion.div>
            )}
         </AnimatePresence>

         <main>
            {/* Hero Section */}
            <section id="home" className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden pt-16 sm:pt-20">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[600px] opacity-40 z-0">
                  <AIWorkerGraphic />
               </div>
               
               <motion.div 
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-6 sm:py-12 lg:py-16"
               >
                  <motion.div
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ duration: 0.5 }}
                  >
                     {/* Brand pill */}
                     <div className="inline-flex items-center gap-2 bg-slate-900/80 border border-cyan-500/20 rounded-lg px-4 py-2 mb-8 text-sm text-slate-300">
                        <span className="font-bold">Business Management Platform</span>
                     </div>

                     {/* Headline */}
                     <h1 className="font-black text-white mb-6 tracking-tight">
                        Your entire business. One AI. $15 a month.
                     </h1>

                     {/* Solution subheadline */}
                     <p className="text-base sm:text-lg md:text-xl text-slate-300 mb-4 max-w-3xl mx-auto leading-relaxed">
                        Most business software was built for companies with departments. You do not have departments. You are the department: the CEO, the marketer, the accountant, the closer, and the admin, all before lunch. Alphaclone is the AI business operating system built for founders, consultants, and small teams that need to move fast, spend less, and stop managing a dozen tools just to run one business.
                     </p>
                     <p className="text-sm sm:text-base text-slate-400 mb-8 max-w-3xl mx-auto">
                        Built for business teams. Social automation supports LinkedIn pages and Facebook business pages, with no personal account posting flow.
                     </p>

                     {/* Platform modules */}
                     <div className="flex flex-wrap justify-center gap-2 mb-10 sm:mb-12 max-w-2xl mx-auto">
                        {[
                           'CRM & Pipeline',
                           'Lead Management',
                           'Invoicing',
                           'Quotations',
                           'Receipts',
                           'Contracts',
                           'Projects',
                           'Bookings',
                           'AI Sales Agent',
                           'AI Agents',
                           'Video Calls',
                           'Email Campaigns',
                           'Analytics',
                           'Team Chat'
                        ].map(label => (
                           <div key={label} className="bg-slate-900/70 border border-cyan-500/20 rounded-full px-3 py-1 text-xs text-slate-300">
                              {label}
                           </div>
                        ))}
                     </div>

                     {/* CTAs */}
                     <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
                        <Button
                           onClick={() => window.location.href = '/register'}
                           className="h-14 px-8 text-lg font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-xl shadow-cyan-500/20"
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

                     {/* Proof stats */}
                     <div className="flex flex-wrap justify-center gap-6 sm:gap-10 text-center">
                        {[
                           { value: '12+', label: 'tools replaced' },
                           { value: '67%', label: 'time saved' },
                           { value: '3x', label: 'faster deals' },
                           { value: '0', label: 'overwhelm' },
                        ].map(({ value, label }) => (
                           <div key={label}>
                                 <div className="text-2xl sm:text-3xl font-black text-cyan-300">{value}</div>
                              <div className="text-xs text-slate-300 mt-0.5">{label}</div>
                           </div>
                        ))}
                     </div>
                  </motion.div>
               </motion.div>
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
                              <img src="/window.svg" alt={`${item.title} workflow preview`} className="w-full h-20 object-contain opacity-80 mb-2" />
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

            {/* Product Screens */}
            <section className="py-16 bg-[#040A12]">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="mb-10 text-center">
                     <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
                        Other platforms give you features. Alphaclone gives you outcomes.
                     </h2>
                     <p className="text-slate-300 max-w-3xl mx-auto">
                        Real screens from lead management, deal pipeline, social integrations, and mobile operations.
                     </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                     {[
                        {
                           src: '/screenshots/lead-detail.png',
                           title: 'Lead Detail Workspace',
                           caption: 'Execute full lead flow, validation, and conversion steps.',
                           span: 'lg:col-span-2',
                           mediaClass: 'h-56 lg:h-64 object-cover',
                        },
                        {
                           src: '/screenshots/deals-dashboard.png',
                           title: 'Deal Pipeline Board',
                           caption: 'Forecast, weighted pipeline, and next-action guidance.',
                           span: 'lg:col-span-1',
                           mediaClass: 'h-56 lg:h-64 object-cover',
                        },
                        {
                           src: '/screenshots/facebook-integration.png',
                           title: 'Facebook Business Integration',
                           caption: 'Business page posting and lead capture controls.',
                           span: 'lg:col-span-1',
                           mediaClass: 'h-52 lg:h-56 object-cover',
                        },
                        {
                           src: '/screenshots/mobile-crm.png',
                           title: 'Mobile CRM Pipeline',
                           caption: 'Field workflow for stage moves and deal actions.',
                           span: 'lg:col-span-1',
                           mediaClass: 'h-52 lg:h-56 object-contain bg-slate-950',
                        },
                        {
                           src: '/screenshots/mobile-marketplace.png',
                           title: 'Mobile Integrations',
                           caption: 'Connect AI tools and platform integrations in-app.',
                           span: 'lg:col-span-1',
                           mediaClass: 'h-52 lg:h-56 object-contain bg-slate-950',
                        },
                     ].map((shot, index) => (
                        <motion.article
                           key={shot.title}
                           initial={{ opacity: 0, y: 12 }}
                           whileInView={{ opacity: 1, y: 0 }}
                           viewport={{ once: true }}
                           transition={{ delay: index * 0.16, duration: 0.85, ease: 'easeOut' }}
                           className={`group rounded-2xl border border-cyan-500/15 bg-[#081228]/90 p-3 ${shot.span}`}
                        >
                           <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950/80">
                              <img
                                 src={shot.src}
                                 alt={shot.title}
                                 className={`w-full ${shot.mediaClass} transition-transform duration-500 group-hover:scale-[1.02]`}
                              />
                           </div>
                           <h4 className="mt-3 text-base font-bold text-cyan-200">{shot.title}</h4>
                           <p className="mt-1 text-sm text-slate-300 leading-relaxed">{shot.caption}</p>
                        </motion.article>
                     ))}
                  </div>
               </div>
            </section>

            {/* Privacy and Compliance */}
            <section className="py-14 border-y border-slate-800 bg-slate-950/70">
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
                        <h4 className="text-lg font-bold text-white mb-3">Verification Signals</h4>
                        <ul className="space-y-2">
                           {[
                              'Dedicated legal pages linked directly from the homepage footer and trust section.',
                              'Public support and security contact channels for policy and account requests.',
                              'Clear business-only social posting scope and platform behavior disclosures.',
                              'Data deletion endpoint and policy references for account lifecycle transparency.',
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

            {/* Stats / Proof Section */}
            <section className="py-12 border-y border-slate-800 bg-slate-950/50">
               <motion.div 
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 2.5 }}
                  className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"
               >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                     {[
                        { value: '10,000+', label: 'Businesses Trust AlphaClone' },
                        { value: '$2.5M+', label: 'Saved on Software Costs' },
                        { value: '500K+', label: 'Projects Managed' },
                        { value: '99.9%', label: 'Uptime SLA' },
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
                        Stop juggling 12 different tools. AlphaClone replaces your entire business stack with one unified system across CRM, all leads, project management, AI agents, invoices, quotations, receipts, contracts, and video operations.
                     </p>
                  </motion.div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                     {[
                        {
                           icon: Database,
                           title: 'Unified CRM',
                           desc: 'Manage contacts, deals, and pipeline in one place. No more disconnected spreadsheets.',
                           color: 'from-blue-500 to-cyan-500'
                        },
                        {
                           icon: Briefcase,
                           title: 'Project Engine',
                           desc: 'Track projects, tasks, and deadlines with intelligent automation and team collaboration.',
                           color: 'from-purple-500 to-indigo-500'
                        },
                        {
                           icon: TrendingUp,
                           title: 'Finance & Billing',
                           desc: 'Create invoices, quotations, and receipts with end-to-end revenue and accounting visibility.',
                           color: 'from-green-500 to-emerald-500'
                        },
                        {
                           icon: Zap,
                           title: 'AI Sales Agent',
                           desc: 'AI-powered lead generation, qualification, outreach support, and meeting booking.',
                           color: 'from-yellow-500 to-orange-500'
                        },
                        {
                           icon: Video,
                           title: 'Business Video System',
                           desc: 'Integrated video workspaces for client demos, team reviews, and execution updates.',
                           color: 'from-cyan-500 to-blue-500'
                        },
                        {
                           icon: Layers,
                           title: 'Social Media Automation',
                           desc: 'Daily posting and media workflows for LinkedIn pages and Facebook business pages.',
                           color: 'from-indigo-500 to-violet-500'
                        },
                        {
                           icon: ShieldCheck,
                           title: 'Safe & Secure',
                           desc: 'Bank-level security, SOC 2 compliance, and regular security audits.',
                           color: 'from-red-500 to-blue-500'
                        },
                        {
                           icon: Smartphone,
                           title: 'Mobile Ready',
                           desc: 'Full-featured mobile apps for iOS and Android. Work from anywhere.',
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
                        One price. Every feature. No games.
                     </h2>
                     <p className="text-lg text-slate-300 max-w-3xl mx-auto">
                        No hidden fees. No surprise charges. Just powerful software that grows with your business.
                     </p>
                  </motion.div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                     {[
                        {
                           name: 'Starter',
                           price: '$15',
                           desc: 'Full access to all platform modules',
                           features: [
                              'CRM, projects, contracts, invoices, tasks',
                              'LinkedIn and Facebook workflow support',
                              'AI workflows and automation tools',
                              'Team collaboration and analytics',
                              'Full system access',
                           ],
                           note: 'All features included',
                           popular: false
                        },
                        {
                           name: 'Pro Video',
                           price: '$35',
                           desc: 'Full access plus integrated video meetings',
                           features: [
                              'Everything in Starter',
                              'Daily and LiveKit video meeting support',
                              'Hosted client calls and team meetings',
                              'Meeting operations and controls',
                              'Full system access',
                           ],
                           note: 'All features included',
                           popular: true
                        }
                     ].map((plan, i) => (
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
                                 Most Popular
                              </div>
                           )}
                           <h3 className="text-xl sm:text-2xl font-black text-white mb-1">{plan.name}</h3>
                           <p className="text-slate-400 text-sm mb-6">{plan.desc}</p>
                           <div className="flex items-baseline gap-1 mb-3">
                              <span className="text-4xl sm:text-5xl font-black text-white">{plan.price}</span>
                              <span className="text-slate-500 font-bold">/mo</span>
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
                              onClick={() => window.location.href = '/register'}
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

            {/* Contact Section */}
            <section id="contact" className="py-16 sm:py-20 bg-gradient-to-b from-slate-900/30 to-slate-950">
               <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center mb-10">
                     <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">
                        Built for founders who run lean and move fast.
                     </h2>
                     <p className="text-base text-slate-300 max-w-xl mx-auto mb-8">
                        From signup to running your business in under ten minutes. Reach out to our team for onboarding support.
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

         <MarketingFooter />
      </div>
   );
};

export default LandingPage;

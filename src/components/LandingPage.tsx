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
      const element = document.getElementById(sectionId);
      if (element) {
         element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
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

         {/* Enhanced Navigation with better transitions */}
         <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
            scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 shadow-lg' : 'bg-slate-950/80 backdrop-blur-lg'
         } ${visible ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
               <div className="flex justify-between items-center h-20">
                  {/* Logo */}
                  <div className="flex items-center gap-3 cursor-pointer group">
                     <div className="relative w-9 h-9 flex-shrink-0 flex items-center justify-center">
                        <img
                           src="/logo.png"
                           alt="AlphaClone"
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
                     <div className="flex-1 px-4 py-6">
                        <nav className="space-y-1">
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
            <section id="home" className="relative min-h-[95vh] flex flex-col items-center justify-center overflow-hidden pt-24 sm:pt-32">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[600px] opacity-40 z-0">
                  <AIWorkerGraphic />
               </div>
               
               <motion.div 
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-10 sm:py-20 lg:py-32"
               >
                  <motion.div
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ duration: 0.6 }}
                  >
                     {/* Brand pill */}
                     <div className="inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700/60 rounded-full px-4 py-1.5 mb-8 text-xs sm:text-sm text-slate-300 backdrop-blur-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                        <span className="font-bold">Replace 12+ Tools. Save $300+/mo.</span>
                     </div>

                     {/* Headline */}
                     <h1 className="font-black text-white mb-6 tracking-tight">
                        Stop Paying for
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500">
                           Dozens of SaaS Tools
                        </span>
                     </h1>

                     {/* Solution subheadline */}
                     <p className="text-base sm:text-lg md:text-xl text-slate-400 mb-4 max-w-3xl mx-auto leading-relaxed">
                        Stop paying <span className="text-red-400 font-bold">$300+/month</span> for HubSpot, QuickBooks, DocuSign, Asana, Mailchimp, Zoom, and 6 other tools. AlphaClone gives you <span className="text-teal-400 font-bold">everything in one platform</span> for <span className="text-green-400 font-bold">$45/month</span>.
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
                           'Video Calls',
                           'Email Campaigns',
                           'Analytics',
                           'Team Chat'
                        ].map(label => (
                           <div key={label} className="bg-slate-800/50 border border-teal-500/20 rounded-full px-3 py-1 text-xs text-slate-300">
                              {label}
                           </div>
                        ))}
                     </div>

                     {/* CTAs */}
                     <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
                        <Button
                           onClick={() => window.location.href = '/register'}
                           className="h-14 px-8 text-lg font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-xl shadow-teal-500/20"
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
                              <div className="text-2xl sm:text-3xl font-black text-teal-400">{value}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                           </div>
                        ))}
                     </div>
                  </motion.div>
               </motion.div>
            </section>

            {/* Stats / Proof Section */}
            <section className="py-12 border-y border-slate-800 bg-slate-950/50">
               <motion.div 
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1 }}
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
                           transition={{ delay: idx * 0.1 }}
                           className="space-y-2"
                        >
                           <div className="text-2xl sm:text-3xl font-black text-white">{stat.value}</div>
                           <div className="text-xs text-slate-500 uppercase tracking-wide">{stat.label}</div>
                        </motion.div>
                     ))}
                  </div>
               </motion.div>
            </section>

            {/* Features / Services Section */}
            <section id="services" className="py-20 bg-[#050B14]">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                  <motion.div 
                     initial={{ opacity: 0, y: 30 }}
                     whileInView={{ opacity: 1, y: 0 }}
                     viewport={{ once: true }}
                     className="text-center mb-16"
                  >
                     <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
                        The Business OS That <span className="text-teal-400">Actually Works</span>
                     </h2>
                     <p className="text-xl text-slate-400 max-w-3xl mx-auto">
                        Stop juggling 12 different tools. AlphaClone replaces your entire business stack with one unified system.
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
                           color: 'from-purple-500 to-pink-500'
                        },
                        {
                           icon: TrendingUp,
                           title: 'Finance & Billing',
                           desc: 'Send invoices, track payments, and manage financials with automated reporting.',
                           color: 'from-green-500 to-emerald-500'
                        },
                        {
                           icon: Zap,
                           title: 'AI Sales Agent',
                           desc: 'AI-powered lead generation, email sequences, and meeting booking while you sleep.',
                           color: 'from-yellow-500 to-orange-500'
                        },
                        {
                           icon: ShieldCheck,
                           title: 'Safe & Secure',
                           desc: 'Bank-level security, SOC 2 compliance, and regular security audits.',
                           color: 'from-red-500 to-pink-500'
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
                           icon={service.icon}
                           title={service.title}
                           description={service.desc}
                           gradient={service.color}
                           delay={idx * 0.1}
                        />
                     ))}
                  </div>
               </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-20 bg-slate-950/50">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <motion.div 
                     initial={{ opacity: 0, y: 30 }}
                     whileInView={{ opacity: 1, y: 0 }}
                     viewport={{ once: true }}
                     className="text-center mb-16"
                  >
                     <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
                        Simple, <span className="text-teal-400">Transparent Pricing</span>
                     </h2>
                     <p className="text-xl text-slate-400 max-w-3xl mx-auto">
                        No hidden fees. No surprise charges. Just powerful software that grows with your business.
                     </p>
                  </motion.div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                     {[
                        {
                           name: 'Starter',
                           price: '$15',
                           desc: 'Perfect for freelancers and solopreneurs',
                           features: [
                              '1 User · 5GB Storage',
                              '10 Projects · 10 Contracts',
                              '50 AI queries / mo',
                              '10 AI Agent runs / mo',
                              'Standard support (48h)',
                           ],
                           note: 'All features included',
                           popular: false
                        },
                        {
                           name: 'Pro',
                           price: '$45',
                           desc: 'High-growth teams & agencies',
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
                           name: 'Enterprise',
                           price: '$80',
                           desc: 'Large scale operations',
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
                        <motion.div
                           key={i}
                           initial={{ opacity: 0, y: 30 }}
                           whileInView={{ opacity: 1, y: 0 }}
                           viewport={{ once: true }}
                           transition={{ delay: i * 0.1 }}
                           className={`relative p-8 sm:p-10 rounded-[2rem] border ${plan.popular ? 'bg-slate-900 border-teal-500 shadow-2xl shadow-teal-500/10 md:scale-105 z-10' : 'bg-slate-900/50 border-slate-800'} flex flex-col`}
                        >
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
                              <div className="text-white font-semibold">sales@alphaclone.tech</div>
                           </div>
                        </a>
                        <a href="mailto:support@alphaclone.tech" className="group flex items-center gap-3 px-6 py-4 bg-slate-900/50 border border-slate-800 hover:border-teal-500/50 rounded-xl transition-all">
                           <Mail className="w-5 h-5 text-teal-400" />
                           <div className="text-left">
                              <div className="text-xs text-slate-500 font-medium">Support</div>
                              <div className="text-white font-semibold">support@alphaclone.tech</div>
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
                        <form onSubmit={handleContactSubmit} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 sm:p-8">
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                              <div>
                                 <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                                 <input
                                    type="text"
                                    value={contactForm.name}
                                    onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
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
                                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
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
                                 className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                                 placeholder="How can we help?"
                                 required
                              />
                           </div>
                           <div className="mb-6">
                              <label className="block text-sm font-medium text-slate-300 mb-2">Message</label>
                              <textarea
                                 value={contactForm.message}
                                 onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                                 className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors resize-none"
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

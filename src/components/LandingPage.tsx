'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { 
   Check, 
   Target, 
   Zap, 
   Award, 
   Database, 
   Smartphone, 
   BarChart, 
   Settings, 
   MessageSquare, 
   TrendingUp, 
   ChevronRight, 
   ChevronLeft, 
   Home, 
   Globe, 
   Layers, 
   Briefcase, 
   Info, 
   PhoneCall, 
   User as UserIcon, 
   ShieldCheck, 
   Menu, 
   X, 
   Mail, 
   Phone, 
   MapPin, 
   Video, 
   FileCheck,
   ArrowRight,
   Play
} from 'lucide-react';

import { Button, Input } from './ui/UIComponents';
import LoomVideo from './ui/LoomVideo';
import { ServiceCard } from './landing/ServiceCard';
import HeroBackground from './landing/HeroBackground';
import AITerminal from './dashboard/AITerminal';
import PortfolioShowcase from './PortfolioShowcase';
import InteractiveMap from './dashboard/InteractiveMap';
import InfiniteTicker from './InfiniteTicker';
import MarketingFooter from './landing/MarketingFooter';

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
         setScrolled(window.scrollY > 50);
      };
      window.addEventListener('scroll', handleScroll);
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
         // Mock API call
         await new Promise(resolve => setTimeout(resolve, 1500));
         setFormStatus('success');
         setContactForm({ name: '', email: '', subject: '', message: '' });
         setTimeout(() => setFormStatus('idle'), 5000);
      } catch (error) {
         setFormStatus('error');
         setTimeout(() => setFormStatus('idle'), 3000);
      }
   };

   return (
      <div className="min-h-screen bg-[#020D1A] text-slate-200 selection:bg-teal-500/30">
         {/* Navigation */}
         <nav
            className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 border-b ${scrolled ? 'bg-slate-950/80 backdrop-blur-xl border-slate-800' : 'bg-transparent border-transparent'
               }`}
         >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
               <div className="flex justify-between items-center h-20">
                  {/* Logo */}
                  <div 
                     className="flex items-center gap-3 cursor-pointer group"
                     onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  >
                     <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center shadow-lg shadow-teal-500/20 group-hover:scale-110 transition-transform">
                        <span className="text-slate-950 font-black text-xl">AS</span>
                     </div>
                     <span className="text-xl font-bold tracking-tight text-white font-marketing-heading">AlphaClone</span>
                  </div>

                  {/* Desktop Nav */}
                  <div className="hidden lg:flex items-center gap-8">
                     <button onClick={() => scrollToSection('home')} className="text-sm font-semibold text-slate-300 hover:text-white transition-colors tracking-wide uppercase">Home</button>
                     <button onClick={() => scrollToSection('services')} className="text-sm font-semibold text-slate-300 hover:text-white transition-colors tracking-wide uppercase">Platform</button>
                     <button onClick={() => scrollToSection('pricing')} className="text-sm font-semibold text-slate-300 hover:text-white transition-colors tracking-wide uppercase">Pricing</button>
                     <Link href="/docs" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors tracking-wide uppercase">Docs</Link>
                     <button onClick={() => scrollToSection('about')} className="text-sm font-semibold text-slate-300 hover:text-white transition-colors tracking-wide uppercase">About</button>
                     <button onClick={() => scrollToSection('contact')} className="text-sm font-semibold text-slate-300 hover:text-white transition-colors tracking-wide uppercase">Contact</button>

                     <div className="flex items-center gap-4 ml-6 pl-6 border-l border-white/10">
                        <button 
                           onClick={() => window.location.href = '/login'}
                           className="text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                        >
                           Login
                        </button>
                        <Button
                           onClick={() => window.location.href = '/register'}
                           className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-6"
                        >
                           Start Now
                        </Button>
                     </div>
                  </div>

                  {/* Mobile Menu Trigger */}
                  <div className="lg:hidden">
                     <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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

         {/* Mobile Menu Backdrop */}
         <AnimatePresence>
            {mobileMenuOpen && (
               <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setMobileMenuOpen(false)}
                  className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[90] lg:hidden"
               />
            )}
         </AnimatePresence>

         {/* Mobile Menu Panel */}
         <AnimatePresence>
            {mobileMenuOpen && (
               <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-slate-900 border-l border-slate-800 z-[100] lg:hidden p-8 shadow-2xl"
               >
                  <div className="flex flex-col gap-6 pt-12">
                     {['home', 'services', 'pricing', 'about', 'contact'].map((item) => (
                        <button
                           key={item}
                           onClick={() => scrollToSection(item)}
                           className="text-2xl font-bold text-white capitalize text-left hover:text-teal-400 transition-colors"
                        >
                           {item}
                        </button>
                     ))}
                     <Link href="/docs" className="text-2xl font-bold text-white uppercase text-left hover:text-teal-400 transition-colors">Docs</Link>
                     <div className="h-px bg-slate-800 my-4" />
                     <Button 
                        onClick={() => window.location.href = '/register'}
                        className="w-full h-14 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xl"
                     >
                        Get Started
                     </Button>
                     <button 
                        onClick={() => window.location.href = '/login'}
                        className="w-full h-14 border border-slate-700 rounded-xl font-bold text-white"
                     >
                        Login
                     </button>
                  </div>
               </motion.div>
            )}
         </AnimatePresence>

         <main>
            {/* Hero Section */}
            <section id="home" className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20">
               <div className="absolute inset-0 z-0">
                  <HeroBackground />
               </div>
               
               <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
                  <motion.div
                     initial={{ opacity: 0, y: 30 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  >
                     <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-bold mb-8 mx-auto">
                        <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                        Next-Gen Business OS
                     </div>
                     <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[100px] font-black tracking-tighter leading-[0.9] text-white mb-8 font-marketing-heading">
                        UNIFIED <br />
                        <span className="bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">BUSINESS OS</span>
                     </h1>
                     <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                        The ultimate high-performance operating system for agencies and freelancers. 
                        CRM, Projects, and Billing—unified in one cinematic interface.
                     </p>
                     
                     <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        <Button
                           onClick={() => window.location.href = '/register'}
                           className="h-16 px-10 text-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black shadow-2xl shadow-teal-500/20 hover:scale-105 transition-transform"
                        >
                           Start Free Trial
                        </Button>
                        <Button
                           variant="outline"
                           onClick={() => scrollToSection('walkthrough')}
                           className="h-16 px-10 text-xl border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-white font-bold flex items-center gap-3"
                        >
                           <Play className="w-5 h-5 fill-current" />
                           Watch Demo
                        </Button>
                     </div>
                  </motion.div>
               </div>

               {/* Hero Decorative Elements */}
               <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#020D1A] to-transparent z-10" />
            </section>

            {/* PLATFORM WALKTHROUGH SECTION - HIGH PERFORMANCE VIDEO */}
            <section id="walkthrough" className="py-32 bg-slate-950 px-4">
               <div className="max-w-6xl mx-auto">
                  <div className="text-center mb-16">
                     <h2 className="text-4xl md:text-5xl font-black text-white mb-6 uppercase tracking-tight">The Platform in Action</h2>
                     <p className="text-slate-400 text-xl max-w-2xl mx-auto">
                        Experience the AlphaClone architecture. See how we process leads, manage projects, and automate billing in real-time.
                     </p>
                  </div>
                  
                  <div className="relative group">
                     {/* Decorative glow behind video */}
                     <div className="absolute -inset-1 bg-gradient-to-r from-teal-500 to-blue-600 rounded-[2.5rem] blur-2xl opacity-20 group-hover:opacity-40 transition duration-1000" />
                     
                     <div className="relative bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                        <div className="aspect-video w-full">
                           <LoomVideo 
                              videoId="3a7000c925c145b7882089688b0ceb5d" 
                              className="w-full h-full"
                           />
                        </div>
                     </div>
                  </div>
               </div>
            </section>

            {/* Features / Services Section */}
            <section id="services" className="py-32 relative overflow-hidden">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                  <div className="text-center mb-24">
                     <h2 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tighter uppercase">Powering Your Growth</h2>
                     <div className="w-24 h-1.5 bg-gradient-to-r from-teal-400 to-blue-500 mx-auto rounded-full" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                     {[
                        {
                           id: 'crm',
                           icon: Database,
                           title: 'Unified CRM',
                           desc: 'Your client data, communication history, and sales pipeline in one place. No more switching tools.',
                           features: ['Visual Pipelines', 'Real-time Analytics', 'Lead Automation']
                        },
                        {
                           id: 'projects',
                           icon: Layers,
                           title: 'Project Engine',
                           desc: 'High-performance task management and project tracking built for high-output individuals.',
                           features: ['Milestone Tracking', 'Collaborative Boards', 'Asset Management']
                        },
                        {
                           id: 'billing',
                           icon: BarChart,
                           title: 'Finance & Billing',
                           desc: 'Automate invoices, track revenue, and manage subscriptions with enterprise-grade precision.',
                           features: ['One-click Invoicing', 'Stripe Integration', 'Revenue Forecasting']
                        },
                        {
                           id: 'ai-growth',
                           icon: Zap,
                           title: 'AI Sales Agent',
                           desc: 'Autopilot for your outreach. Qualify leads and book meetings while you sleep.',
                           features: ['GPT-4o Powered', 'Multi-channel Outreach', 'Automated Qualification']
                        },
                        {
                           id: 'security',
                           icon: ShieldCheck,
                           title: 'Safe Ops',
                           desc: 'End-to-end encryption for your communication and absolute data ownership.',
                           features: ['RBAC Permissions', 'Encrypted Video', 'Audit Trails']
                        },
                        {
                           id: 'mobile',
                           icon: Smartphone,
                           title: 'Business Mobile',
                           desc: 'Manage your entire ecosystem from your pocket with native iOS and Android apps.',
                           features: ['Real-time Alerts', 'Mobile Dashboard', 'Offline Mode']
                        }
                     ].map((item, i) => (
                        <motion.div
                           key={i}
                           whileHover={{ y: -10 }}
                           className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl hover:border-teal-500/30 transition-all flex flex-col h-full"
                        >
                           <div className="w-14 h-14 bg-teal-500/10 rounded-2xl flex items-center justify-center mb-6">
                              <item.icon className="w-8 h-8 text-teal-400" />
                           </div>
                           <h3 className="text-2xl font-bold text-white mb-4">{item.title}</h3>
                           <p className="text-slate-400 mb-8 flex-grow">{item.desc}</p>
                           <ul className="space-y-3">
                              {item.features.map((feat, idx) => (
                                 <li key={idx} className="flex items-center gap-2 text-sm text-teal-400/80">
                                    <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                    {feat}
                                 </li>
                              ))}
                           </ul>
                        </motion.div>
                     ))}
                  </div>
               </div>
            </section>

            {/* Who We Serve Section */}
            <section className="py-32 bg-[#050B14]">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                     <div>
                        <h2 className="text-4xl md:text-5xl font-black text-white mb-8 tracking-tighter uppercase leading-none">
                           BUILT FOR THE <br />
                           <span className="text-teal-400">AMBITIOUS</span>
                        </h2>
                        <p className="text-xl text-slate-400 mb-10 leading-relaxed">
                           AlphaClone isn't for everyone. It's for the creators, the builders, and the agencies who demand enterprise control without the enterprise friction.
                        </p>
                        
                        <div className="space-y-6">
                           {[
                              { title: 'Agencies', desc: 'Scale client delivery without adding more software.' },
                              { title: 'Freelancers', desc: 'Run a 7-figure solo business with unified ops.' },
                              { title: 'Startups', desc: 'Consolidate 10+ subscriptions into one Business OS.' }
                           ].map((item, i) => (
                              <div key={i} className="flex gap-4 p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-teal-500/30 transition-colors">
                                 <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0 text-slate-950 font-black">
                                    {i + 1}
                                 </div>
                                 <div>
                                    <h4 className="text-white font-bold text-lg mb-1">{item.title}</h4>
                                    <p className="text-slate-400 text-sm">{item.desc}</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                     
                     <div className="relative">
                        <div className="absolute -inset-4 bg-teal-500/20 blur-[100px] rounded-full" />
                        <AITerminal />
                     </div>
                  </div>
               </div>
            </section>

            {/* Portfolio Section */}
            <section id="portfolio" className="py-32">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <PortfolioShowcase projects={projects} />
               </div>
            </section>

            {/* Stats / Proof Section */}
            <section className="py-20 border-y border-slate-800 bg-slate-950/50 backdrop-blur-xl">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
                     {[
                        { label: 'Uptime', value: '99.9%' },
                        { label: 'Performance', value: '100/100' },
                        { label: 'Support', value: '24/7' },
                        { label: 'Security', value: 'AES-256' }
                     ].map((stat, i) => (
                        <div key={i} className="group">
                           <div className="text-4xl sm:text-5xl font-black text-white mb-2 group-hover:text-teal-400 transition-colors">{stat.value}</div>
                           <div className="text-sm font-bold uppercase tracking-widest text-slate-500">{stat.label}</div>
                        </div>
                     ))}
                  </div>
               </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-32 relative">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center mb-24">
                     <h2 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tighter uppercase">Transparent Scaling</h2>
                     <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                        One simple price for total control. Choose the plan that fits your growth trajectory.
                     </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                     {[
                        { name: 'Starter', price: '$15', desc: 'Solo founders & freelancers', features: ['5 Users', 'Core CRM', '5GB Storage'] },
                        { name: 'Professional', price: '$45', desc: 'High-growth teams', features: ['25 Users', 'Unlimited CRM', 'AI Sales Bot'], popular: true },
                        { name: 'Enterprise', price: '$80', desc: 'Large scale operations', features: ['Unlimited Users', 'Dedicated DB', 'API Access'] }
                     ].map((plan, i) => (
                        <div key={i} className={`relative p-10 rounded-[2.5rem] border ${plan.popular ? 'bg-slate-900 border-teal-500 shadow-2xl shadow-teal-500/10 scale-105 z-10' : 'bg-slate-900/50 border-slate-800'} flex flex-col`}>
                           {plan.popular && (
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-teal-500 text-slate-950 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-tighter">
                                 Recommended
                              </div>
                           )}
                           <h3 className="text-2xl font-black text-white mb-2 uppercase">{plan.name}</h3>
                           <p className="text-slate-400 text-sm mb-8">{plan.desc}</p>
                           <div className="flex items-baseline gap-1 mb-8">
                              <span className="text-5xl font-black text-white">{plan.price}</span>
                              <span className="text-slate-500 font-bold">/mo</span>
                           </div>
                           <ul className="space-y-4 mb-10 flex-grow">
                              {plan.features.map((feat, idx) => (
                                 <li key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                                    <Check className="w-4 h-4 text-teal-400" />
                                    {feat}
                                 </li>
                              ))}
                           </ul>
                           <Button
                              onClick={() => window.location.href = '/register'}
                              className={`h-14 w-full text-lg font-black uppercase ${plan.popular ? 'bg-teal-500 hover:bg-teal-400 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
                           >
                              Get Started
                           </Button>
                        </div>
                     ))}
                  </div>
               </div>
            </section>

            {/* Contact Section */}
            <section id="contact" className="py-32 bg-slate-900/30">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
                     <div>
                        <h2 className="text-4xl md:text-5xl font-black text-white mb-8 tracking-tighter uppercase leading-none">
                           PLAN YOUR <br />
                           <span className="text-teal-400">ROLLOUT</span>
                        </h2>
                        <p className="text-xl text-slate-400 mb-12 leading-relaxed">
                           Ready to unify your business operations? Our engineers are standing by to help you map your transition to AlphaClone.
                        </p>
                        
                        <div className="space-y-10">
                           <div className="flex items-center gap-6">
                              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                                 <Mail className="w-7 h-7 text-teal-400" />
                              </div>
                              <div>
                                 <div className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-1">Email Us</div>
                                 <a href="mailto:sales@alphaclone.tech" className="text-xl font-bold text-white hover:text-teal-400 transition-colors">sales@alphaclone.tech</a>
                              </div>
                           </div>
                           <div className="flex items-center gap-6">
                              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                                 <Phone className="w-7 h-7 text-teal-400" />
                              </div>
                              <div>
                                 <div className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-1">Call Support</div>
                                 <a href="tel:+48517809674" className="text-xl font-bold text-white hover:text-teal-400 transition-colors">+48 517 809 674</a>
                              </div>
                           </div>
                        </div>
                     </div>
                     
                     <div className="bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 blur-3xl rounded-full" />
                        
                        {formStatus === 'success' ? (
                           <div className="text-center py-20">
                              <div className="w-20 h-20 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                 <Check className="w-10 h-10 text-teal-400" />
                              </div>
                              <h3 className="text-2xl font-black text-white mb-2 uppercase">Message Received</h3>
                              <p className="text-slate-400">An engineer will reach out to you within 2 hours.</p>
                           </div>
                        ) : (
                           <form onSubmit={handleContactSubmit} className="space-y-6">
                              <div className="grid grid-cols-2 gap-6">
                                 <Input 
                                    placeholder="Name" 
                                    value={contactForm.name} 
                                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} 
                                    required 
                                 />
                                 <Input 
                                    placeholder="Email" 
                                    type="email" 
                                    value={contactForm.email} 
                                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} 
                                    required 
                                 />
                              </div>
                              <Input 
                                 placeholder="Subject" 
                                 value={contactForm.subject} 
                                 onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })} 
                                 required 
                              />
                              <textarea
                                 className="w-full h-40 bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
                                 placeholder="Tell us about your requirements..."
                                 value={contactForm.message}
                                 onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                                 required
                              />
                              <Button
                                 type="submit"
                                 disabled={formStatus === 'sending'}
                                 className="w-full h-16 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xl flex items-center justify-center gap-3 transition-all"
                              >
                                 {formStatus === 'sending' ? 'Transmitting...' : (
                                    <>
                                       Send Briefing
                                       <ChevronRight className="w-6 h-6" />
                                    </>
                                 )}
                              </Button>
                           </form>
                        )}
                     </div>
                  </div>
               </div>
            </section>
         </main>

         <InfiniteTicker />
         <MarketingFooter />
      </div>
   );
};

export default LandingPage;

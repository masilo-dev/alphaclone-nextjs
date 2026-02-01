'use client';

import React, { useState } from 'react';
import {
   CheckCircle2,
   Target,
   Zap,
   Award,
   Bot,
   Database,
   Smartphone,
   BarChart,
   Settings,
   MessageSquare,
   TrendingUp,
   ShieldCheck,
   Menu,
   X,
   Mail,
   Phone,
   MapPin,
   Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Input } from './ui/UIComponents';
import LoginModal from './auth/LoginModal';
import { Project, User } from '../types';
import Link from 'next/link';
import { contactService } from '../services/contactService';
import { projectService } from '../services/projectService';
import InfiniteTicker from './InfiniteTicker';
const PortfolioShowcase = React.lazy(() => import('./dashboard/PortfolioShowcase'));

interface LandingPageProps {
   onLogin: (user: User) => void;
   projects: Project[];
}

const PrismBackground = React.memo(() => {
   const [mounted, setMounted] = React.useState(false);

   React.useEffect(() => {
      // Defer animation start to improve initial paint
      const timer = setTimeout(() => setMounted(true), 100);
      return () => clearTimeout(timer);
   }, []);

   return (
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true" style={{ contain: 'layout style paint' }}>
         {/* Base Background */}
         <div className="absolute inset-0 bg-slate-950" />

         {/* Moving Gradient Orbs - Reduced blur for performance */}
         {mounted && (
            <>
               <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-500/8 blur-[80px] animate-blob mix-blend-screen will-change-transform transform-gpu" style={{ animationDuration: '20s' }} />
               <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-600/8 blur-[80px] animate-blob mix-blend-screen will-change-transform transform-gpu" style={{ animationDelay: '6s', animationDuration: '25s' }} />
            </>
         )}

         {/* Grid Pattern Overlay - Simplified */}
         <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10" />
      </div>
   );
});

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, projects }) => {
   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
   const [isLoginOpen, setIsLoginOpen] = useState(false);

   // Contact Form State
   const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
   const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

   // Public Portfolio State
   const [publicProjects, setPublicProjects] = useState<Project[]>([]);

   // Defer non-critical data loading - load after initial render
   React.useEffect(() => {
      // Use requestIdleCallback for non-critical data
      const loadData = () => {
         projectService.getPublicProjects().then(({ projects }) => {
            setPublicProjects(projects);
         });
      };

      if ('requestIdleCallback' in window) {
         requestIdleCallback(loadData, { timeout: 2000 });
      } else {
         setTimeout(loadData, 100);
      }
   }, []);

   const scrollToSection = (id: string) => {
      const element = document.getElementById(id);
      if (element) {
         element.scrollIntoView({ behavior: 'smooth' });
      }
      setMobileMenuOpen(false);
   };

   const handleContactSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setFormStatus('sending');

      const { error } = await contactService.submitContact(
         contactForm.name,
         contactForm.email,
         `${contactForm.subject}\n\n${contactForm.message}`
      );

      if (!error) {
         setFormStatus('success');
         setContactForm({ name: '', email: '', subject: '', message: '' });
         setTimeout(() => setFormStatus('idle'), 5000);
      } else {
         setFormStatus('error');
         setTimeout(() => setFormStatus('idle'), 3000);
      }
   };



   return (
      <div className="min-h-screen text-slate-200 font-sans selection:bg-teal-500/30 relative">
         <PrismBackground />

         <LoginModal
            isOpen={isLoginOpen}
            onClose={() => setIsLoginOpen(false)}
            onLogin={onLogin}
         />

         {/* Main Content Wrapper */}
         <div className="relative z-10">
            {/* Navigation */}
            <nav className="fixed w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50 pt-safe">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex items-center justify-between h-20">
                     {/* Logo */}
                     <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
                        <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">
                           AlphaClone
                        </span>
                     </div>

                     {/* Desktop Nav */}
                     <div className="hidden lg:flex items-center gap-8">
                        {['Home', 'Ecosystem', 'Services', 'About', 'Contact'].map((item) => (
                           <button
                              key={item}
                              onClick={() => scrollToSection(item.toLowerCase())}
                              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
                           >
                              {item}
                           </button>
                        ))}
                        <Link
                           href="/portfolio"
                           className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
                        >
                           Portfolio
                        </Link>
                        <div className="flex items-center gap-4 ml-4">
                           <button onClick={() => setIsLoginOpen(true)} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                              Login
                           </button>
                           <Button onClick={() => window.location.href = '/register'} className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-6 shadow-lg shadow-teal-500/20">
                              Start for Free
                           </Button>
                        </div>
                     </div>

                     {/* Mobile Menu Button */}
                     <div className="lg:hidden">
                        <button
                           onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                           className="text-slate-300"
                           aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                        >
                           {mobileMenuOpen ? <X /> : <Menu />}
                        </button>
                     </div>
                  </div>
               </div>

               {/* Mobile Nav */}
               {mobileMenuOpen && (
                  <div className="lg:hidden bg-slate-900 border-b border-slate-800 p-4 space-y-4">
                     {['Home', 'Ecosystem', 'Services', 'About', 'Contact'].map((item) => (
                        <button
                           key={item}
                           onClick={() => scrollToSection(item.toLowerCase())}
                           className="block w-full text-left text-sm font-medium text-slate-300 hover:text-white py-2"
                        >
                           {item}
                        </button>
                     ))}
                     <Link
                        href="/portfolio"
                        className="block w-full text-left text-sm font-medium text-slate-300 hover:text-white py-2"
                        onClick={() => setMobileMenuOpen(false)}
                     >
                        Portfolio
                     </Link>
                     <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
                        <Button onClick={() => setIsLoginOpen(true)} variant="outline" className="w-full justify-center">Login</Button>
                        <Button onClick={() => window.location.href = '/register'} className="w-full justify-center bg-teal-500 text-slate-950 font-bold">Start for Free</Button>
                     </div>
                  </div>
               )}
            </nav>

            {/* Hero Section */}
            <section id="home" className="pt-24 pb-16 lg:pt-48 lg:pb-32 relative overflow-hidden">
               {/* Local Glow for Hero Emphasis */}
               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-teal-500/10 blur-[120px] -z-10 rounded-full" />

               <div className="max-w-5xl mx-auto px-4 text-center">
                  <motion.div
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/50 backdrop-blur border border-slate-700/50 text-teal-400 text-sm font-medium mb-8 shadow-lg shadow-teal-900/20"
                  >
                     <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                     AlphaClone Business OS v2.0 • 14 Day Free Trial
                  </motion.div>

                  <motion.h1
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: 0.1 }}
                     className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white mb-6 md:mb-8 leading-[1.1]"
                  >
                     Run Your Business<br />
                     <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 via-blue-400 to-violet-400">
                        At Warp Speed
                     </span>
                  </motion.h1>

                  <motion.p
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: 0.2 }}
                     className="text-lg sm:text-xl md:text-2xl text-slate-400 mb-8 md:mb-12 leading-relaxed max-w-3xl mx-auto"
                  >
                     The only platform that combines high-performance CRM, Project Management, and AI Agents into one seamless, premium ecosystem.
                  </motion.p>

                  <motion.div
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: 0.3 }}
                     className="flex flex-col sm:flex-row items-center justify-center gap-6 px-4 sm:px-0"
                  >
                     <Button
                        onClick={() => window.location.href = '/register'}
                        size="lg"
                        className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-10 h-14 w-full sm:w-auto text-lg shadow-xl shadow-teal-500/20 hover:scale-105 transition-transform"
                     >
                        Start For Free
                     </Button>
                     <Button
                        size="lg"
                        variant="outline"
                        onClick={() => window.open('https://calendly.com/bonniiehendrix/30min', '_blank')}
                        className="border-slate-700 bg-slate-900/50 backdrop-blur hover:bg-slate-800 text-white px-10 h-14 w-full sm:w-auto text-lg hover:border-slate-500"
                     >
                        Book a Demo
                     </Button>
                  </motion.div>
               </div>
            </section>
            {/* Who We Serve Section */}
            <section id="who-we-serve" className="py-24 bg-slate-950/80 backdrop-blur-sm border-y border-slate-800/50">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center mb-16">
                     <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl md:text-5xl font-bold text-white mb-6"
                     >
                        Who We Serve
                     </motion.h2>
                     <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-slate-400 max-w-2xl mx-auto text-xl"
                     >
                        AlphaClone is the operating system for high-growth teams who demand unified control and premium performance.
                     </motion.p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                     {/* Growing Agencies */}
                     <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 hover:border-teal-500/50 transition-all group backdrop-blur-md">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center">
                              <Target className="w-6 h-6 text-teal-400" />
                           </div>
                           <h3 className="text-xl font-bold text-white">Growing Agencies</h3>
                        </div>
                        <div className="space-y-4">
                           <div>
                              <p className="text-sm font-semibold text-slate-300 mb-2">Your Challenge:</p>
                              <p className="text-sm text-slate-400">Managing multiple clients across different tools, losing time switching contexts, and struggling with expensive per-seat pricing.</p>
                           </div>
                           <div>
                              <p className="text-sm font-semibold text-teal-400 mb-2">How We Help:</p>
                              <ul className="text-sm text-slate-400 space-y-1">
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                                    <span>Multi-tenant architecture for unlimited clients</span>
                                 </li>
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                                    <span>Unified dashboard for all client projects</span>
                                 </li>
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                                    <span>White-label client portals</span>
                                 </li>
                              </ul>
                           </div>
                        </div>
                     </div>

                     {/* SaaS Startups */}
                     <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 hover:border-blue-500/50 transition-all group backdrop-blur-md">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                              <Zap className="w-6 h-6 text-blue-400" />
                           </div>
                           <h3 className="text-xl font-bold text-white">SaaS Startups</h3>
                        </div>
                        <div className="space-y-4">
                           <div>
                              <p className="text-sm font-semibold text-slate-300 mb-2">Your Challenge:</p>
                              <p className="text-sm text-slate-400">Burning cash on 10+ SaaS subscriptions while trying to reach profitability. Need enterprise features without enterprise costs.</p>
                           </div>
                           <div>
                              <p className="text-sm font-semibold text-blue-400 mb-2">How We Help:</p>
                              <ul className="text-sm text-slate-400 space-y-1">
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                    <span>Replace $2,000+/mo in subscriptions</span>
                                 </li>
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                    <span>Built-in CRM, video calls, and AI agents</span>
                                 </li>
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                    <span>Self-hostable for data control</span>
                                 </li>
                              </ul>
                           </div>
                        </div>
                     </div>

                     {/* Consulting Firms */}
                     <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 hover:border-purple-500/50 transition-all group backdrop-blur-md">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                              <Award className="w-6 h-6 text-purple-400" />
                           </div>
                           <h3 className="text-xl font-bold text-white">Consulting Firms</h3>
                        </div>
                        <div className="space-y-4">
                           <div>
                              <p className="text-sm font-semibold text-slate-300 mb-2">Your Challenge:</p>
                              <p className="text-sm text-slate-400">Need professional client management, secure video meetings, and project tracking without the complexity of enterprise software.</p>
                           </div>
                           <div>
                              <p className="text-sm font-semibold text-purple-400 mb-2">How We Help:</p>
                              <ul className="text-sm text-slate-400 space-y-1">
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                                    <span>Professional client portals</span>
                                 </li>
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                                    <span>Integrated video conferencing</span>
                                 </li>
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                                    <span>Time tracking & invoicing</span>
                                 </li>
                              </ul>
                           </div>
                        </div>
                     </div>

                     {/* Emerging Market Founders */}
                     <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 hover:border-orange-500/50 transition-all group backdrop-blur-md">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center">
                              <TrendingUp className="w-6 h-6 text-orange-400" />
                           </div>
                           <h3 className="text-xl font-bold text-white">Emerging Market Founders</h3>
                        </div>
                        <div className="space-y-4">
                           <div>
                              <p className="text-sm font-semibold text-slate-300 mb-2">Your Challenge:</p>
                              <p className="text-sm text-slate-400">Enterprise tools price you out. Need world-class features at prices that make sense for your market.</p>
                           </div>
                           <div>
                              <p className="text-sm font-semibold text-orange-400 mb-2">How We Help:</p>
                              <ul className="text-sm text-slate-400 space-y-1">
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                                    <span>Affordable all-in-one pricing</span>
                                 </li>
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                                    <span>No hidden fees or per-seat charges</span>
                                 </li>
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                                    <span>Full feature access from day one</span>
                                 </li>
                              </ul>
                           </div>
                        </div>
                     </div>

                     {/* Privacy-First Teams */}
                     <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 hover:border-green-500/50 transition-all group backdrop-blur-md">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                              <ShieldCheck className="w-6 h-6 text-green-400" />
                           </div>
                           <h3 className="text-xl font-bold text-white">Privacy-First Teams</h3>
                        </div>
                        <div className="space-y-4">
                           <div>
                              <p className="text-sm font-semibold text-slate-300 mb-2">Your Challenge:</p>
                              <p className="text-sm text-slate-400">Can't trust third-party SaaS with sensitive data. Need full control over where your data lives.</p>
                           </div>
                           <div>
                              <p className="text-sm font-semibold text-green-400 mb-2">How We Help:</p>
                              <ul className="text-sm text-slate-400 space-y-1">
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                    <span>Self-hostable on your infrastructure</span>
                                 </li>
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                    <span>Open-source transparency</span>
                                 </li>
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                    <span>Complete data ownership</span>
                                 </li>
                              </ul>
                           </div>
                        </div>
                     </div>

                     {/* Remote Teams */}
                     <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 hover:border-cyan-500/50 transition-all group backdrop-blur-md">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                              <Video className="w-6 h-6 text-cyan-400" />
                           </div>
                           <h3 className="text-xl font-bold text-white">Remote Teams</h3>
                        </div>
                        <div className="space-y-4">
                           <div>
                              <p className="text-sm font-semibold text-slate-300 mb-2">Your Challenge:</p>
                              <p className="text-sm text-slate-400">Scattered across Slack, Zoom, Trello, and email. Need everything in one place to stay aligned.</p>
                           </div>
                           <div>
                              <p className="text-sm font-semibold text-cyan-400 mb-2">How We Help:</p>
                              <ul className="text-sm text-slate-400 space-y-1">
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                                    <span>Built-in video conferencing</span>
                                 </li>
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                                    <span>Real-time collaboration tools</span>
                                 </li>
                                 <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                                    <span>Unified communication hub</span>
                                 </li>
                              </ul>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="mt-16 text-center">
                     <p className="text-slate-400 mb-6">Don't see yourself here? We work with all types of businesses.</p>
                     <Button
                        onClick={() => window.open('https://calendly.com/bonniiehendrix/30min', '_blank')}
                        className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-8"
                     >
                        Book a Free Consultation
                     </Button>
                  </div>
               </div>
            </section>

            {/* Why Choose Custom */}
            <section className="py-24 bg-slate-900/50 backdrop-blur-sm" id="ecosystem">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-16">Why Choose Custom Development?</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                     {[
                        { title: "Perfect Business Fit", desc: "Built exactly for your workflows, processes, and business logic - no compromises or workarounds required." },
                        { title: "Scalable Architecture", desc: "Built with growth in mind, our solutions scale seamlessly as your business expands and requirements evolve." },
                        { title: "Full Ownership", desc: "You own the complete source code and intellectual property - no vendor lock-in or ongoing licensing fees." },
                        { title: "Competitive Advantage", desc: "Custom solutions provide unique capabilities that your competitors using generic platforms simply cannot match." }
                     ].map((item, i) => (
                        <div key={i} className="flex gap-4">
                           <div className="mt-1 flex-shrink-0">
                              <CheckCircle2 className="w-6 h-6 text-teal-400" />
                           </div>
                           <div>
                              <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                              <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </section>

            {/* About Section */}
            <section id="about" className="py-24 bg-slate-950/50 backdrop-blur-sm">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center mb-16">
                     <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">About AlphaClone Systems</h2>
                     <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                        We are custom development specialists who believe every business deserves technology built specifically for their unique challenges and opportunities.
                     </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     {[
                        { icon: Target, title: "Custom-First Approach", desc: "We reject templates and generic solutions. Every line of code is written specifically for your business requirements." },
                        { icon: Zap, title: "Rapid Custom Development", desc: "Our streamlined process delivers complex custom solutions in 14 days or less, faster than most companies can implement generic platforms." },
                        { icon: Award, title: "Proven Track Record", desc: "Our custom solutions have helped businesses increase efficiency by 67%, reduce costs by 34%, and achieve measurable ROI within 90 days." }
                     ].map((card, i) => (
                        <motion.div
                           key={i}
                           initial={{ opacity: 0, y: 20 }}
                           whileInView={{ opacity: 1, y: 0 }}
                           viewport={{ once: true }}
                           transition={{ delay: i * 0.1 }}
                           whileHover={{ y: -5 }}
                           className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 hover:border-teal-500/30 transition-all group backdrop-blur-md"
                        >
                           <div className="w-14 h-14 bg-slate-800/50 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                              <card.icon className="w-7 h-7 text-teal-400" />
                           </div>
                           <h3 className="text-xl font-bold text-white mb-4">{card.title}</h3>
                           <p className="text-slate-400 leading-relaxed">{card.desc}</p>
                        </motion.div>
                     ))}
                  </div>
               </div>
            </section>

            {/* Services Grid (Detailed) */}
            <section id="services" className="py-24 bg-slate-900/50 backdrop-blur-sm">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center mb-16">
                     <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Platform Capabilities</h2>
                     <p className="text-slate-400 max-w-2xl mx-auto">Everything you need to grow your business, integrated into one secure platform.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                     {/* AI Chatbot */}
                     <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        whileHover={{ y: -5 }}
                        className="bg-slate-950/60 rounded-3xl p-8 border border-slate-800/50 hover:border-green-500/30 transition-colors backdrop-blur-md relative overflow-hidden group"
                     >
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-green-500/20 group-hover:scale-110 transition-transform">
                           <Bot className="w-9 h-9 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">AI Sales Agents</h3>
                        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                           Intelligent AI that captures leads, qualifies prospects, and books meetings 24/7 on autopilot.
                        </p>
                        <ul className="space-y-3 mb-8">
                           {['Auto-Lead Qualification', '24/7 Availability', 'Instant Responses', 'CRM Integration'].map((item, i) => (
                              <li key={i} className="flex items-center text-sm text-slate-300">
                                 <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                                 {item}
                              </li>
                           ))}
                        </ul>
                        <div className="flex flex-col gap-3 relative z-10">
                           <Button onClick={() => window.open('https://calendly.com/bonniiehendrix/30min', '_blank')} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold h-12">
                              Book Consultation
                           </Button>
                        </div>
                     </motion.div>

                     {/* CRM */}
                     <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        whileHover={{ y: -5 }}
                        className="bg-slate-950/60 rounded-3xl p-8 border border-slate-800/50 hover:border-orange-500/30 transition-colors backdrop-blur-md relative overflow-hidden group"
                     >
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                           <Database className="w-9 h-9 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">CRM & Sales Pipeline</h3>
                        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                           Track every deal, manage customer relationships, and visualize your sales funnel in real-time.
                        </p>
                        <ul className="space-y-3 mb-8">
                           {['Visual Deal Pipelines', 'Contact Management', 'Automated Workflows', 'Revenue Forecasting'].map((item, i) => (
                              <li key={i} className="flex items-center text-sm text-slate-300">
                                 <CheckCircle2 className="w-4 h-4 text-orange-500 mr-2 flex-shrink-0" />
                                 {item}
                              </li>
                           ))}
                        </ul>
                        <div className="flex flex-col gap-3 relative z-10">
                           <Button onClick={() => window.open('https://calendly.com/bonniiehendrix/30min', '_blank')} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold h-12">
                              Book Consultation
                           </Button>
                        </div>
                     </motion.div>

                     {/* Security Center */}
                     <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        whileHover={{ y: -5 }}
                        className="bg-slate-950/60 rounded-3xl p-8 border border-slate-800/50 hover:border-red-500/30 transition-colors backdrop-blur-md relative overflow-hidden group"
                     >
                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-red-500/20 group-hover:scale-110 transition-transform">
                           <ShieldCheck className="w-9 h-9 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Security Command Center</h3>
                        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                           Monitor your digital footprint for vulnerabilities. Check SSL, headers, and reputation instantly.
                        </p>
                        <ul className="space-y-3 mb-8">
                           {['SSL/TLS Validation', 'Vulnerability Scanning', 'Trust Score Analysis', 'Daily Monitoring'].map((item, i) => (
                              <li key={i} className="flex items-center text-sm text-slate-300">
                                 <CheckCircle2 className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" />
                                 {item}
                              </li>
                           ))}
                        </ul>
                        <div className="flex flex-col gap-3 relative z-10">
                           <Button onClick={() => window.open('https://calendly.com/bonniiehendrix/30min', '_blank')} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold h-12">
                              Book Consultation
                           </Button>
                        </div>
                     </motion.div>

                     {/* Video Platform */}
                     <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 }}
                        whileHover={{ y: -5 }}
                        className="bg-slate-950/60 rounded-3xl p-8 border border-slate-800/50 hover:border-indigo-500/30 transition-colors backdrop-blur-md relative overflow-hidden group"
                     >
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                           <Video className="w-9 h-9 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Unified Video Platform</h3>
                        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                           Host high-quality video meetings directly within your project workspace. No external links needed.
                        </p>
                        <ul className="space-y-3 mb-8">
                           {['HD Video Conferencing', 'Screen Sharing', 'Chat Integration', '20min Free / Client'].map((item, i) => (
                              <li key={i} className="flex items-center text-sm text-slate-300">
                                 <CheckCircle2 className="w-4 h-4 text-indigo-400 mr-2 flex-shrink-0" />
                                 {item}
                              </li>
                           ))}
                        </ul>
                        <div className="flex flex-col gap-3 relative z-10">
                           <Button onClick={() => window.open('https://calendly.com/bonniiehendrix/30min', '_blank')} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-12">
                              Schedule Meeting
                           </Button>
                        </div>
                     </motion.div>

                     {/* Mobile Apps */}
                     <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.4 }}
                        whileHover={{ y: -5 }}
                        className="bg-slate-950/60 rounded-3xl p-8 border border-slate-800/50 hover:border-pink-500/30 transition-colors backdrop-blur-md relative overflow-hidden group"
                     >
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-pink-500/20 group-hover:scale-110 transition-transform">
                           <Smartphone className="w-9 h-9 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Mobile Companion App</h3>
                        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                           Manage your business on the go. Available for iOS and Android for all Business OS users.
                        </p>
                        <ul className="space-y-3 mb-8">
                           {['Push Notifications', 'Offline Access', 'Real-time Chat', 'Task Management'].map((item, i) => (
                              <li key={i} className="flex items-center text-sm text-slate-300">
                                 <CheckCircle2 className="w-4 h-4 text-pink-400 mr-2 flex-shrink-0" />
                                 {item}
                              </li>
                           ))}
                        </ul>
                        <div className="flex flex-col gap-3 relative z-10">
                           <Button onClick={() => window.open('https://calendly.com/bonniiehendrix/30min', '_blank')} className="flex-1 bg-pink-600 hover:bg-pink-500 text-white font-bold h-12">
                              Book Consultation
                           </Button>
                        </div>
                     </motion.div>

                     {/* Dashboards */}
                     <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 }}
                        whileHover={{ y: -5 }}
                        className="bg-slate-950/60 rounded-3xl p-8 border border-slate-800/50 hover:border-cyan-500/30 transition-colors backdrop-blur-md relative overflow-hidden group"
                     >
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-cyan-500/20 group-hover:scale-110 transition-transform">
                           <BarChart className="w-9 h-9 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Financial Analytics</h3>
                        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                           Transform your data into actionable insights with intelligent dashboards that drive informed decision-making.
                        </p>
                        <ul className="space-y-3 mb-8">
                           {['Revenue Tracking', 'Expense Management', 'Profit & Loss Reports', 'Team Performance'].map((item, i) => (
                              <li key={i} className="flex items-center text-sm text-slate-300">
                                 <CheckCircle2 className="w-4 h-4 text-cyan-400 mr-2 flex-shrink-0" />
                                 {item}
                              </li>
                           ))}
                        </ul>
                        <div className="flex flex-col gap-3 relative z-10">
                           <Button onClick={() => window.open('https://calendly.com/bonniiehendrix/30min', '_blank')} className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-12">
                              Book Demo
                           </Button>
                        </div>
                     </motion.div>
                  </div>
               </div>
            </section>

            {/* Portfolio Section */}
            <section id="portfolio" className="py-24 bg-slate-950/50 backdrop-blur-sm">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  {/* PortfolioShowcase handles its own header and filtering */}
                  <React.Suspense fallback={<div className="h-96 flex items-center justify-center"><div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div></div>}>
                     <PortfolioShowcase projects={publicProjects.length > 0 ? publicProjects : projects} />
                  </React.Suspense>
               </div>
            </section>

            {/* Stats Section */}
            <section className="py-16 bg-slate-950/50 border-y border-slate-900/50 backdrop-blur-sm">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                     {[
                        { label: "Delivery Guarantee*", value: "18-Day", desc: "*18% discount if we delay" },
                        { label: "Custom Built", value: "100%", desc: "No templates used" },
                        { label: "Support Available", value: "24/7", desc: "Dedicated team" },
                        { label: "PageSpeed Score", value: "90+", desc: "Performance optimized" }
                     ].map((stat, i) => (
                        <div key={i} className="bg-slate-900/50 p-8 rounded-2xl text-center border border-slate-800/50 backdrop-blur-md">
                           <div className="text-3xl md:text-4xl font-bold text-teal-400 mb-2">{stat.value}</div>
                           <div className="text-white font-medium mb-1">{stat.label}</div>
                           <div className="text-xs text-slate-500">{stat.desc}</div>
                        </div>
                     ))}
                  </div>
               </div>
            </section>

            {/* Verified Team */}
            <section className="py-20 bg-blue-900/20 backdrop-blur-sm">
               <div className="max-w-4xl mx-auto px-4 text-center">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Verified Professional Team</h2>
                  <p className="text-slate-300 mb-10">
                     Our developers are verified professionals on leading freelance platforms.
                  </p>
                  <div className="flex flex-wrap justify-center gap-8 md:gap-16">
                     <div className="flex items-center gap-3 bg-slate-900/50 px-6 py-4 rounded-xl border border-slate-700/50 backdrop-blur-md">
                        <ShieldCheck className="w-8 h-8 text-teal-400" />
                        <div className="text-left">
                           <div className="font-bold text-white">Braintrust</div>
                           <div className="text-xs text-slate-400">Verified Freelancers</div>
                        </div>
                     </div>
                     <div className="flex items-center gap-3 bg-slate-900/50 px-6 py-4 rounded-xl border border-slate-700/50 backdrop-blur-md">
                        <ShieldCheck className="w-8 h-8 text-blue-400" />
                        <div className="text-left">
                           <div className="font-bold text-white">Arc.dev</div>
                           <div className="text-xs text-slate-400">Top 3% Developers</div>
                        </div>
                     </div>
                  </div>
               </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-32 bg-slate-950/50 backdrop-blur-sm relative overflow-hidden">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-teal-500/5 blur-[120px] -z-10 rounded-full" />

               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center mb-20">
                     <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Simple, Transparent Pricing</h2>
                     <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                        Scale your business with an operating system that grows with you. No hidden fees, no per-seat charges.
                     </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                     {/* Starter Plan */}
                     <motion.div
                        whileHover={{ y: -10 }}
                        className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 flex flex-col backdrop-blur-xl relative overflow-hidden group"
                     >
                        <div className="absolute inset-0 bg-gradient-to-b from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative mb-8">
                           <h3 className="text-xl font-bold text-white mb-2">Starter</h3>
                           <p className="text-slate-400 text-sm">Best for solo founders & small teams.</p>
                        </div>
                        <div className="relative mb-8 flex items-baseline gap-1">
                           <span className="text-4xl font-bold text-white">$16</span>
                           <span className="text-slate-500">/mo</span>
                        </div>
                        <ul className="space-y-4 mb-10 flex-grow">
                           {['5 Multi-tenant Users', 'Core CRM Pipeline', '5GB Secure Storage', 'Standard Project MGMT', '2 Video Meetings/Mo'].map((feat) => (
                              <li key={feat} className="flex items-center gap-3 text-sm text-slate-300">
                                 <CheckCircle2 className="w-4 h-4 text-teal-500" />
                                 {feat}
                              </li>
                           ))}
                        </ul>
                        <Button
                           onClick={() => window.location.href = '/register'}
                           className="w-full h-12 bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-700"
                        >
                           Start Free Trial
                        </Button>
                     </motion.div>

                     {/* Professional Plan (Highlighted) */}
                     <motion.div
                        whileHover={{ y: -10 }}
                        className="bg-slate-900/80 border-2 border-teal-500/50 rounded-3xl p-8 flex flex-col backdrop-blur-xl relative overflow-hidden shadow-2xl shadow-teal-500/10"
                     >
                        <div className="absolute top-0 right-0 bg-teal-500 text-slate-950 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                           Most Popular
                        </div>
                        <div className="relative mb-8">
                           <h3 className="text-2xl font-bold text-white mb-2 text-teal-400">Professional</h3>
                           <p className="text-slate-400 text-sm">The power of AlphaClone Business OS.</p>
                        </div>
                        <div className="relative mb-8 flex items-baseline gap-1">
                           <span className="text-5xl font-bold text-white">$48</span>
                           <span className="text-slate-500">/mo</span>
                        </div>
                        <ul className="space-y-4 mb-10 flex-grow">
                           {['25 Multi-tenant Users', 'Infinite CRM Pipelines', 'AI Sales Automation', '25GB Secure Storage', 'Priority Meeting Support', 'Custom Branding'].map((feat) => (
                              <li key={feat} className="flex items-center gap-3 text-sm text-slate-200">
                                 <CheckCircle2 className="w-5 h-5 text-teal-400" />
                                 {feat}
                              </li>
                           ))}
                        </ul>
                        <Button
                           onClick={() => window.location.href = '/register'}
                           className="w-full h-14 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-lg shadow-lg shadow-teal-500/20"
                        >
                           Start Growth Trial
                        </Button>
                     </motion.div>

                     {/* Enterprise Plan */}
                     <motion.div
                        whileHover={{ y: -10 }}
                        className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 flex flex-col backdrop-blur-xl relative overflow-hidden group"
                     >
                        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative mb-8">
                           <h3 className="text-xl font-bold text-white mb-2">Enterprise</h3>
                           <p className="text-slate-400 text-sm">Total scale and custom infrastructure.</p>
                        </div>
                        <div className="relative mb-8 flex items-baseline gap-1">
                           <span className="text-4xl font-bold text-white">$299</span>
                           <span className="text-slate-500">/mo</span>
                        </div>
                        <ul className="space-y-4 mb-10 flex-grow">
                           {['Unlimited Users', 'Dedicated DB Instance', 'White-labeled Ecosystem', 'API Access', '24/7 Priority Engineer', 'On-premise Options'].map((feat) => (
                              <li key={feat} className="flex items-center gap-3 text-sm text-slate-300">
                                 <CheckCircle2 className="w-4 h-4 text-blue-500" />
                                 {feat}
                              </li>
                           ))}
                        </ul>
                        <Button
                           variant="outline"
                           onClick={() => window.open('https://calendly.com/bonniiehendrix/30min', '_blank')}
                           className="w-full h-12 border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-white font-bold"
                        >
                           Contact Sales
                        </Button>
                     </motion.div>
                  </div>
               </div>
            </section>

            {/* Contact Section */}
            <section id="contact" className="py-24 bg-slate-950/50 border-t border-slate-900/50 backdrop-blur-sm">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                     <div>
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Start Your Custom Project</h2>
                        <p className="text-slate-400 text-lg mb-12">
                           Ready to build something extraordinary? Whether you need a complete digital transformation or a specific custom tool, our team is ready to architect your solution.
                        </p>

                        <div className="space-y-8">
                           <div className="flex items-start gap-4">
                              <div className="w-12 h-12 bg-slate-900/80 rounded-xl flex items-center justify-center border border-slate-800">
                                 <Mail className="w-6 h-6 text-teal-500" />
                              </div>
                              <div>
                                 <h4 className="text-white font-bold mb-1">Email Us</h4>
                                 <a href="mailto:info@alphaclone.tech" className="text-slate-400 hover:text-white transition-colors">info@alphaclone.tech</a>
                              </div>
                           </div>
                           <div className="flex items-start gap-4">
                              <div className="w-12 h-12 bg-slate-900/80 rounded-xl flex items-center justify-center border border-slate-800">
                                 <Phone className="w-6 h-6 text-teal-500" />
                              </div>
                              <div>
                                 <h4 className="text-white font-bold mb-1">Phone</h4>
                                 <a href="tel:+48517809674" className="text-teal-400 hover:text-teal-300 block">
                                    +48 517 809 674
                                 </a>
                              </div>
                           </div>
                           <div className="flex items-start gap-4">
                              <div className="w-12 h-12 bg-slate-900/80 rounded-xl flex items-center justify-center border border-slate-800">
                                 <MapPin className="w-6 h-6 text-teal-500" />
                              </div>
                              <div>
                                 <h4 className="text-white font-bold mb-1">Global Operations</h4>
                                 <p className="text-slate-400">Worldwide Remote</p>
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="bg-slate-900/60 p-8 md:p-10 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-md">
                        {formStatus === 'success' ? (
                           <div className="h-full flex flex-col items-center justify-center text-center py-12">
                              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
                                 <CheckCircle2 className="w-10 h-10 text-green-500" />
                              </div>
                              <h3 className="text-2xl font-bold text-white mb-2">Message Sent</h3>
                              <p className="text-slate-400">We'll be in touch with you shortly to discuss your project.</p>
                           </div>
                        ) : (
                           <div className="space-y-6">
                              <h3 className="text-xl font-bold text-white mb-6">Book a Consultation</h3>

                              <div className="p-4 bg-teal-500/10 border border-teal-500/30 rounded-xl mb-6">
                                 <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div>
                                       <h4 className="text-teal-400 font-bold mb-1">Schedule Directly</h4>
                                       <p className="text-sm text-slate-400">Pick a time that works for you via Calendly.</p>
                                    </div>
                                    <Button
                                       onClick={() => window.open('https://calendly.com/bonniiehendrix/30min', '_blank')}
                                       className="bg-teal-600 hover:bg-teal-500 text-white"
                                    >
                                       Book Meeting
                                    </Button>
                                 </div>
                              </div>

                              <div className="relative mb-6">
                                 <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-700"></div>
                                 </div>
                                 <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-slate-900 text-slate-500">Or send us a message</span>
                                 </div>
                              </div>

                              <form onSubmit={handleContactSubmit} className="space-y-6">
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Input
                                       label="Name"
                                       placeholder="John Doe"
                                       required
                                       value={contactForm.name}
                                       onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                                    />
                                    <Input
                                       label="Email"
                                       type="email"
                                       placeholder="john@company.com"
                                       required
                                       value={contactForm.email}
                                       onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                                    />
                                 </div>
                                 <Input
                                    label="Project Type"
                                    placeholder="Web Dev, AI, Mobile App..."
                                    required
                                    value={contactForm.subject}
                                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                                 />
                                 <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Message</label>
                                    <textarea
                                       className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 min-h-[120px]"
                                       placeholder="Tell us about your requirements..."
                                       required
                                       value={contactForm.message}
                                       onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                                    />
                                 </div>
                                 <Button
                                    type="submit"
                                    className="w-full h-12 bg-slate-800 hover:bg-slate-700 text-lg font-semibold border border-slate-700"
                                    isLoading={formStatus === 'sending'}
                                 >
                                    Send Message
                                 </Button>
                              </form>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </section>

            {/* Ticker */}
            <InfiniteTicker />

            {/* Footer */}
            <footer className="bg-slate-950/90 border-t border-slate-900/50 pt-20 pb-10 backdrop-blur-md">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-16">
                     <div className="col-span-2">
                        <div className="flex items-center gap-2 mb-6">
                           <span className="text-2xl font-bold text-white">AlphaClone</span>
                        </div>
                        <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                           Custom development solutions built for success. Specializing in high-performance web, mobile, and AI applications.
                        </p>
                     </div>
                     <div>
                        <h4 className="text-white font-bold mb-6">Services</h4>
                        <ul className="space-y-4 text-sm text-slate-400">
                           <li><button onClick={() => scrollToSection('services')} className="hover:text-teal-400">Web Development</button></li>
                           <li><button onClick={() => scrollToSection('services')} className="hover:text-teal-400">Mobile Apps</button></li>
                           <li><button onClick={() => scrollToSection('services')} className="hover:text-teal-400">AI Solutions</button></li>
                           <li><button onClick={() => scrollToSection('services')} className="hover:text-teal-400">Dashboards</button></li>
                        </ul>
                     </div>
                     <div>
                        <h4 className="text-white font-bold mb-6">Company</h4>
                        <ul className="space-y-4 text-sm text-slate-400">
                           <li><button onClick={() => scrollToSection('about')} className="hover:text-teal-400">About Us</button></li>
                           <li><button onClick={() => scrollToSection('portfolio')} className="hover:text-teal-400">Portfolio</button></li>
                           <li><button onClick={() => scrollToSection('contact')} className="hover:text-teal-400">Contact</button></li>
                           <li><Link href="/guide" className="hover:text-teal-400">Platform Guide</Link></li>
                        </ul>
                     </div>
                     <div>
                        <h4 className="text-white font-bold mb-6">Legal</h4>
                        <ul className="space-y-4 text-sm text-slate-400">
                           <li><Link href="/privacy-policy" className="hover:text-teal-400">Privacy Policy</Link></li>
                           <li><Link href="/terms-of-service" className="hover:text-teal-400">Terms of Service</Link></li>
                           <li><Link href="/cookie-policy" className="hover:text-teal-400">Cookie Policy</Link></li>

                        </ul>
                     </div>
                  </div>
                  <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
                     <div className="flex gap-6">
                        <span className="text-slate-600">Secure & Compliant</span>
                     </div>
                     <p suppressHydrationWarning>&copy; {new Date().getFullYear()} AlphaClone Systems. All rights reserved.</p>
                  </div>
               </div>
            </footer>
         </div>
      </div>
   );
};

export default LandingPage;

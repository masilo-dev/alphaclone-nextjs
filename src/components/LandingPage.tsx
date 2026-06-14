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
   Video,
   ChevronDown,
} from 'lucide-react';

/* ─────────────────────────── Integrations Marquee ─────────────────────────── */
const INTEGRATIONS = [
  { name: 'Microsoft Teams', color: '#6264A7', bg: '#1a1a3a', letter: 'T' },
  { name: 'Stripe', color: '#635BFF', bg: '#1a183d', letter: 'S' },
  { name: 'Gmail', color: '#EA4335', bg: '#2a1010', letter: 'G' },
  { name: 'WhatsApp', color: '#25D366', bg: '#0a2d1a', letter: 'W' },
  { name: 'Outlook', color: '#0078D4', bg: '#0a1e2d', letter: 'O' },
  { name: 'Facebook', color: '#1877F2', bg: '#0a1a2d', letter: 'F' },
  { name: 'LinkedIn', color: '#0A66C2', bg: '#0a1a2d', letter: 'L' },
  { name: 'Supabase', color: '#3FCF8E', bg: '#0a2d1f', letter: 'SB' },
  { name: 'Claude AI', color: '#F7A06A', bg: '#2d1a0a', letter: 'AI' },
  { name: 'Gemini', color: '#4285F4', bg: '#0a1a2d', letter: 'G' },
  { name: 'OpenAI', color: '#10A37F', bg: '#0a2d22', letter: 'O' },
  { name: 'Google Calendar', color: '#4285F4', bg: '#0a1a2d', letter: 'GC' },
];

const IntegrationChip = ({ item }: { item: typeof INTEGRATIONS[0] }) => (
  <div
    className="flex-shrink-0 flex items-center gap-3 px-5 py-3 rounded-2xl border mx-3"
    style={{
      background: item.bg,
      borderColor: `${item.color}30`,
      boxShadow: `0 0 20px ${item.color}12`,
    }}
  >
    <span
      className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black"
      style={{ background: `${item.color}22`, color: item.color }}
    >
      {item.letter}
    </span>
    <span className="text-sm font-semibold text-slate-200 whitespace-nowrap">{item.name}</span>
    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: item.color }} />
  </div>
);

const InfiniteMarquee = () => {
  // Duplicate list for seamless loop
  const items = [...INTEGRATIONS, ...INTEGRATIONS, ...INTEGRATIONS];
  return (
    <div className="relative overflow-hidden w-full" aria-hidden="true">
      {/* Left/right fade masks */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10" style={{ background: 'linear-gradient(to right, #020D1A, transparent)' }} />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10" style={{ background: 'linear-gradient(to left, #020D1A, transparent)' }} />
      <div
        className="flex w-max"
        style={{
          animation: 'marquee-scroll 38s linear infinite',
        }}
      >
        {items.map((item, i) => (
          <IntegrationChip key={`${item.name}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
};

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
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

import { PLATFORM_CALENDLY_URL } from '@/constants';

const BUSINESS_SIGNUP_HREF = '/auth/login?register=true&type=business&plan=starter';
const LOGIN_HREF = '/auth/login';

// CPU and Terminal Icons for HUD Simulator
const CpuIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <rect x="5" y="5" width="14" height="14" rx="2" />
    <path d="M9 1v4M15 1v4M9 19v4M15 19v4M20 9h3M20 15h3M1 9h3M1 15h3" />
  </svg>
);

const ClaudeHudSimulator = () => {
   const [activeTab, setActiveTab] = useState<'invoices' | 'leads' | 'contracts'>('invoices');
   
   const contents = {
      invoices: {
         prompt: 'AlphaClone, check for overdue invoices and sync this month\'s payments.',
         toolCalls: [
            { name: 'list_invoices', args: '{ status: "overdue" }', duration: '800ms' },
            { name: 'sync_general_ledger', args: '{ tenant_id: "tenant_9a2f" }', duration: '1200ms' }
         ],
         response: "I've successfully synced the payments. I also found one overdue invoice for Acme Corp ($1,200). I can draft and send a polite payment reminder email. Shall I proceed?",
         subPrompt: 'Yes, draft and send it.',
         subToolCalls: [
            { name: 'send_email', args: '{ to: "billing@acme.com", subject: "Invoice reminder #2024-91" }', duration: '900ms' }
         ],
         subResponse: 'Payment reminder email sent successfully to Acme Corp! The communication has been logged to your CRM database.'
      },
      leads: {
         prompt: 'Find recent tech companies in Boston and enrich them as leads.',
         toolCalls: [
            { name: 'scrape_business_data', args: '{ query: "tech", location: "Boston" }', duration: '1500ms' },
            { name: 'verify_business_emails', args: '{ domains: ["bostondevs.com", "hubtech.io"] }', duration: '1000ms' },
            { name: 'create_crm_leads', args: '{ count: 3 }', duration: '700ms' }
         ],
         response: "I've imported 3 verified leads from Boston into your CRM pipeline:\n\n1. Boston Devs Inc (Trust Score: 92%)\n2. HubTech (Trust Score: 88%)\n3. Vertex Labs (Trust Score: 85%)\n\nWould you like me to queue an introductory outreach sequence?",
         subPrompt: 'Yes, queue them.',
         subToolCalls: [
            { name: 'nexus_sales_campaign', args: '{ campaign_id: "camp_b102", target_leads: 3 }', duration: '1100ms' }
         ],
         subResponse: 'Campaign sequence queued! The AI will execute outreach daily. You can monitor progress under the Campaigns tab.'
      },
      contracts: {
         prompt: 'Draft a standard service contract for client "DevFlow LLC" for $5,000.',
         toolCalls: [
            { name: 'generate_contract_draft', args: '{ client: "DevFlow LLC", amount: 5000, type: "service_agreement" }', duration: '1600ms' }
         ],
         response: "Contract drafted and saved to your workspace as 'Service Agreement: DevFlow LLC'.\n\nKey Terms Summary:\n- Value: $5,000 USD\n- Deposit: 50% ($2,500)\n- Jurisdiction: Delaware\n- Governing Law: Delaware State Laws\n\nWould you like me to request client signature via e-sign?",
         subPrompt: 'Yes, email it for signature.',
         subToolCalls: [
            { name: 'send_contract_signature_request', args: '{ contract_id: "cont_99a8" }', duration: '1200ms' }
         ],
         subResponse: 'E-sign request sent to DevFlow LLC! E-signature status is now tracked under the Contracts dashboard.'
      }
   };

   const [step, setStep] = useState(0);

   useEffect(() => {
      setStep(0);
      const t1 = setTimeout(() => setStep(1), 600);
      const t2 = setTimeout(() => setStep(2), 1800);
      const t3 = setTimeout(() => setStep(3), 3200);
      const t4 = setTimeout(() => setStep(4), 4200);
      const t5 = setTimeout(() => setStep(5), 5500);
      return () => {
         clearTimeout(t1);
         clearTimeout(t2);
         clearTimeout(t3);
         clearTimeout(t4);
         clearTimeout(t5);
      };
   }, [activeTab]);

   const activeContent = contents[activeTab];

   return (
      <div className="w-full max-w-5xl mx-auto rounded-2xl overflow-hidden border border-cyan-500/30 bg-slate-950/80 backdrop-blur-xl shadow-[0_0_50px_-10px_rgba(0,255,255,0.15)] flex flex-col md:flex-row h-[480px] text-left">
         {/* Sidebar */}
         <div className="hidden md:flex flex-col w-64 border-r border-slate-800 bg-[#060D19] p-4 shrink-0">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Integrations</div>
            <div className="space-y-2">
               {[
                  { name: 'AlphaClone MCP', desc: 'Core platform systems', active: true },
                  { name: 'Stripe Billing', desc: 'Invoice & payment reconciliation', active: true },
                  { name: 'Gmail Workspace', desc: 'Outreach & inbox tracking', active: true },
                  { name: 'Supabase Database', desc: 'CRM & general ledger', active: true }
               ].map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/30 border border-slate-800/40">
                     <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                     </span>
                     <div>
                        <div className="text-xs font-semibold text-slate-300">{item.name}</div>
                        <div className="text-[10px] text-slate-500">{item.desc}</div>
                     </div>
                  </div>
               ))}
            </div>
            
            <div className="mt-auto pt-4 border-t border-slate-900">
               <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Simulated Scopes</div>
               <div className="flex flex-col gap-1.5 font-sans">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                     <Check className="w-3.5 h-3.5 text-cyan-400" />
                     <span>Read/Write CRM</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                     <Check className="w-3.5 h-3.5 text-cyan-400" />
                     <span>Draft Contracts</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                     <Check className="w-3.5 h-3.5 text-cyan-400" />
                     <span>Send Emails</span>
                  </div>
               </div>
            </div>
         </div>

         {/* Chat Area */}
         <div className="flex-1 flex flex-col h-full bg-slate-950/40">
            {/* Header */}
            <div className="px-4 py-3 bg-[#0B1527] border-b border-slate-800 flex items-center justify-between">
               <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  <span className="text-[11px] font-mono text-slate-400 ml-2">claude-3.5-sonnet-workspace</span>
               </div>
               <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">MCP Server Active</span>
               </div>
            </div>

            {/* Messages body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 font-sans text-xs custom-scrollbar">
               {/* 1. Prompt */}
               {step >= 0 && (
                  <div className="flex items-start gap-3">
                     <div className="w-7 h-7 rounded-xl bg-cyan-950 border border-cyan-800/50 flex items-center justify-center text-cyan-400 shrink-0 font-bold">
                        U
                     </div>
                     <div className="bg-slate-900/50 border border-slate-800 px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-slate-200 max-w-[85%]">
                        {activeContent.prompt}
                     </div>
                  </div>
               )}

               {/* 2. Tool Calls */}
               {step >= 1 && (
                  <div className="space-y-1.5 pl-10">
                     {activeContent.toolCalls.map((tool, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-cyan-400/90 font-mono text-[10px] bg-cyan-950/20 border border-cyan-500/10 rounded-lg py-1.5 px-3">
                           <span className="animate-spin h-3.5 w-3.5 border-2 border-cyan-400 border-t-transparent rounded-full shrink-0" style={{ display: step === 1 && idx === activeContent.toolCalls.length - 1 ? 'block' : 'none' }} />
                           {(step > 1 || idx < activeContent.toolCalls.length - 1) && (
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                           )}
                           <span>Calling Tool: <strong className="text-cyan-300 font-bold">{tool.name}</strong>({tool.args})</span>
                           <span className="ml-auto text-slate-500 text-[9px]">{tool.duration}</span>
                        </div>
                     ))}
                  </div>
               )}

               {/* 3. Claude Response */}
               {step >= 2 && (
                  <div className="flex items-start gap-3 animate-in fade-in duration-300">
                     <div className="w-7 h-7 rounded-xl bg-orange-950 border border-orange-800/45 flex items-center justify-center shrink-0">
                        <CpuIcon className="w-4 h-4 text-orange-400" />
                     </div>
                     <div className="bg-[#10192A]/60 border border-slate-800 px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-slate-200 max-w-[85%] whitespace-pre-line leading-relaxed shadow-sm">
                        {activeContent.response}
                     </div>
                  </div>
               )}

               {/* 4. SubPrompt */}
               {step >= 3 && (
                  <div className="flex items-start gap-3 animate-in fade-in duration-300">
                     <div className="w-7 h-7 rounded-xl bg-cyan-950 border border-cyan-800/50 flex items-center justify-center text-cyan-400 shrink-0 font-bold">
                        U
                     </div>
                     <div className="bg-slate-900/50 border border-slate-800 px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-slate-200 max-w-[85%]">
                        {activeContent.subPrompt}
                     </div>
                  </div>
               )}

               {/* 5. SubTool Calls */}
               {step >= 4 && (
                  <div className="space-y-1.5 pl-10 animate-in fade-in duration-300">
                     {activeContent.subToolCalls.map((tool, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-cyan-400/90 font-mono text-[10px] bg-cyan-950/20 border border-cyan-500/10 rounded-lg py-1.5 px-3">
                           <span className="animate-spin h-3.5 w-3.5 border-2 border-cyan-400 border-t-transparent rounded-full shrink-0" style={{ display: step === 4 ? 'block' : 'none' }} />
                           {step > 4 && (
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                           )}
                           <span>Calling Tool: <strong className="text-cyan-300 font-bold">{tool.name}</strong>({tool.args})</span>
                           <span className="ml-auto text-slate-500 text-[9px]">{tool.duration}</span>
                        </div>
                     ))}
                  </div>
               )}

               {/* 6. SubResponse */}
               {step >= 5 && (
                  <div className="flex items-start gap-3 animate-in fade-in duration-300">
                     <div className="w-7 h-7 rounded-xl bg-orange-950 border border-orange-800/45 flex items-center justify-center shrink-0">
                        <CpuIcon className="w-4 h-4 text-orange-400" />
                     </div>
                     <div className="bg-[#10192A]/60 border border-slate-800 px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-slate-200 max-w-[85%] whitespace-pre-line leading-relaxed shadow-sm">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                           <Check className="w-4 h-4" /> Workflow Executed
                        </div>
                        {activeContent.subResponse}
                     </div>
                  </div>
               )}
            </div>

            {/* Interactive Demo Controllers */}
            <div className="p-3 border-t border-slate-800/80 bg-[#060D19]/60 flex flex-wrap gap-2 justify-center sm:justify-start items-center">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1 shrink-0">Try Workflows:</span>
               {[
                  { id: 'invoices', label: 'Reconcile Revenue' },
                  { id: 'leads', label: 'Enrich CRM Pipeline' },
                  { id: 'contracts', label: 'Draft Client Agreement' }
               ].map((tab) => (
                  <button
                     key={tab.id}
                     onClick={() => setActiveTab(tab.id as any)}
                     className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                        activeTab === tab.id
                           ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/10'
                           : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                     }`}
                  >
                     {tab.label}
                  </button>
               ))}
            </div>
         </div>
      </div>
   );
};

const LandingPage = () => {
   const router = useRouter();
   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
   const [mobilePlatformOpen, setMobilePlatformOpen] = useState(false);
   const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
   const [mobileCompanyOpen, setMobileCompanyOpen] = useState(false);
   const [scrolled, setScrolled] = useState(false);
   const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
   const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
   const [contactForm, setContactForm] = useState({
      name: '',
      email: '',
      subject: '',
      message: ''
   });

   // Smooth scroll function
   const scrollToSection = useCallback((sectionId: string) => {
      setMobileMenuOpen(false);
      setServicesDropdownOpen(false);
      const element = document.getElementById(sectionId);
      if (element) {
         element.scrollIntoView({ behavior: 'smooth', block: 'start' });
         return;
      }
      router.push(`/#${sectionId}`);
   }, [router]);

   const platformMenuItems = useMemo(() => ([
      { label: 'CRM and Pipeline', action: () => scrollToSection('services') },
      { label: 'Messaging and Meetings', action: () => scrollToSection('video') },
      { label: 'Finance and Billing', action: () => scrollToSection('pricing') },
      { label: 'Lead Operations', action: () => scrollToSection('services') },
   ]), [scrollToSection]);

   const heroOutcomePoints = [
      'Replace CRM, invoicing, contracts, and project tools',
      'Keep every client workflow in one workspace',
      'Start free for 14 days, no card required',
   ];

   const heroTrustPoints = [
      'Built for service businesses',
      'GDPR-friendly controls',
      'Live demo available anytime',
   ];

   // Scroll handling for navbar styling only.
   useEffect(() => {
      const handleScroll = () => {
         const currentScrollY = window.scrollY;
         setScrolled(currentScrollY > 20);
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
   }, []);

   useEffect(() => {
      if (mobileMenuOpen) {
         document.body.classList.add('menu-open');
      } else {
         document.body.classList.remove('menu-open');
      }
      return () => document.body.classList.remove('menu-open');
   }, [mobileMenuOpen]);

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

         {/* Enhanced Navigation with better transitions */}
         <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
            scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 shadow-lg' : 'bg-slate-950/80 backdrop-blur-lg'
         } translate-y-0`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
               <div className="flex items-center justify-between gap-4 h-16 sm:h-[4.5rem]">
                  {/* Logo */}
                  <Link href="/" className="flex items-center gap-3 cursor-pointer group shrink-0">
                     <div className="relative w-9 h-9 flex-shrink-0 flex items-center justify-center">
                        <Image
                           src="/logo.png"
                           alt="AlphaClone"
                           width={36}
                           height={36}
                           className="object-contain"
                        />
                     </div>
                     <span className="text-xl font-bold tracking-tight text-white font-marketing-heading">AlphaClone</span>
                  </Link>

                  {/* Desktop Nav */}
                  <div className="hidden lg:flex flex-1 items-center justify-center gap-7 px-4">
                     <Link href="/" className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Home</Link>
                     <Link href="/guide" className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Guide</Link>
                     <div
                        className="relative"
                        onMouseEnter={() => setServicesDropdownOpen(true)}
                        onMouseLeave={() => setServicesDropdownOpen(false)}
                     >
                        <button
                           onClick={() => setServicesDropdownOpen((open) => !open)}
                           className="inline-flex items-center gap-1 h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                           aria-expanded={servicesDropdownOpen}
                           aria-label="Toggle platform menu"
                        >
                           Platform
                           <ChevronDown className={`w-4 h-4 transition-transform ${servicesDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {servicesDropdownOpen && (
                           <div className="absolute left-1/2 top-full mt-3 w-64 -translate-x-1/2 rounded-2xl border border-slate-800 bg-slate-950/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
                              {platformMenuItems.map((item) => (
                                 <button
                                    key={item.label}
                                    onClick={item.action}
                                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-300 transition-colors hover:bg-slate-900 hover:text-white"
                                 >
                                    <span>{item.label}</span>
                                    <ArrowRight className="w-4 h-4 text-teal-400" />
                                 </button>
                              ))}
                           </div>
                        )}
                     </div>
                     <button onClick={() => scrollToSection('pricing')} className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Pricing</button>
                     <Link href="/docs" className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Docs</Link>
                     <Link href="/faq" className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">FAQ</Link>
                     <Link href="/ecosystem" className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Ecosystem</Link>
                     <button onClick={() => scrollToSection('contact')} className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors">Contact</button>
                  </div>

                  <div className="hidden lg:flex items-center gap-3 shrink-0">
                     <Link
                        href={LOGIN_HREF}
                        className="inline-flex items-center h-10 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                     >
                        Login
                     </Link>
                     <Link href="/book-demo" className="inline-flex items-center">
                        <Button variant="outline" className="border-slate-600 hover:border-teal-500/50 text-slate-300 hover:text-teal-400 px-4 h-10 text-sm font-semibold transition-all">
                           Book Demo
                        </Button>
                     </Link>
                     <Link href={BUSINESS_SIGNUP_HREF} className="inline-flex items-center">
                        <Button className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-6 h-10">
                           Start Free
                        </Button>
                     </Link>
                  </div>

                  {/* Mobile Menu Trigger */}
                  <div className="lg:hidden flex items-center gap-2">
                     <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                        className={`w-11 h-11 flex items-center justify-center rounded-xl border transition-all duration-300 ${mobileMenuOpen
                           ? 'text-teal-400 bg-slate-900 border-teal-500/50 shadow-lg shadow-teal-500/10'
                           : 'text-white bg-white/5 border-white/10 hover:border-teal-500/30'
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
                              <Image
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
                        <nav className="space-y-2">
                           <Link
                              href="/"
                              onClick={() => setMobileMenuOpen(false)}
                              className="block w-full text-left px-4 py-3 text-lg font-semibold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                           >
                              Home
                           </Link>

                           {/* Platform Dropdown */}
                           <div className="space-y-1">
                              <button
                                 onClick={() => setMobilePlatformOpen(!mobilePlatformOpen)}
                                 className="flex items-center justify-between w-full px-4 py-3 text-lg font-semibold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                              >
                                 Platform
                                 <ChevronDown className={`w-5 h-5 transition-transform ${mobilePlatformOpen ? 'rotate-180' : ''}`} />
                              </button>
                              <AnimatePresence>
                                 {mobilePlatformOpen && (
                                    <motion.div
                                       initial={{ height: 0, opacity: 0 }}
                                       animate={{ height: 'auto', opacity: 1 }}
                                       exit={{ height: 0, opacity: 0 }}
                                       className="overflow-hidden pl-4 space-y-1"
                                    >
                                       {platformMenuItems.map((item) => (
                                          <button
                                             key={item.label}
                                             onClick={() => { item.action(); setMobileMenuOpen(false); }}
                                             className="w-full text-left px-4 py-2 text-base font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                                          >
                                             {item.label}
                                          </button>
                                       ))}
                                       <button
                                          onClick={() => { scrollToSection('services'); setMobileMenuOpen(false); }}
                                          className="w-full text-left px-4 py-2 text-base font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                                       >
                                          Capabilities
                                       </button>
                                    </motion.div>
                                 )}
                              </AnimatePresence>
                           </div>

                           {/* Resources Dropdown */}
                           <div className="space-y-1">
                              <button
                                 onClick={() => setMobileResourcesOpen(!mobileResourcesOpen)}
                                 className="flex items-center justify-between w-full px-4 py-3 text-lg font-semibold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                              >
                                 Resources
                                 <ChevronDown className={`w-5 h-5 transition-transform ${mobileResourcesOpen ? 'rotate-180' : ''}`} />
                              </button>
                              <AnimatePresence>
                                 {mobileResourcesOpen && (
                                    <motion.div
                                       initial={{ height: 0, opacity: 0 }}
                                       animate={{ height: 'auto', opacity: 1 }}
                                       exit={{ height: 0, opacity: 0 }}
                                       className="overflow-hidden pl-4 space-y-1"
                                    >
                                       {[
                                          { label: 'Guide', href: '/guide' },
                                          { label: 'Docs', href: '/docs' },
                                          { label: 'FAQ', href: '/faq' },
                                          { label: 'Ecosystem', href: '/ecosystem' }
                                       ].map((item) => (
                                          <Link
                                             key={item.label}
                                             href={item.href}
                                             onClick={() => setMobileMenuOpen(false)}
                                             className="block w-full text-left px-4 py-2 text-base font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                                          >
                                             {item.label}
                                          </Link>
                                       ))}
                                    </motion.div>
                                 )}
                              </AnimatePresence>
                           </div>

                           {/* Company Dropdown */}
                           <div className="space-y-1">
                              <button
                                 onClick={() => setMobileCompanyOpen(!mobileCompanyOpen)}
                                 className="flex items-center justify-between w-full px-4 py-3 text-lg font-semibold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                              >
                                 Company
                                 <ChevronDown className={`w-5 h-5 transition-transform ${mobileCompanyOpen ? 'rotate-180' : ''}`} />
                              </button>
                              <AnimatePresence>
                                 {mobileCompanyOpen && (
                                    <motion.div
                                       initial={{ height: 0, opacity: 0 }}
                                       animate={{ height: 'auto', opacity: 1 }}
                                       exit={{ height: 0, opacity: 0 }}
                                       className="overflow-hidden pl-4 space-y-1"
                                    >
                                       {[
                                          { label: 'Pricing', section: 'pricing' },
                                          { label: 'Contact', section: 'contact' }
                                       ].map((item) => (
                                          <button
                                             key={item.label}
                                             onClick={() => { scrollToSection(item.section); setMobileMenuOpen(false); }}
                                             className="w-full text-left px-4 py-2 text-base font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                                          >
                                             {item.label}
                                          </button>
                                       ))}
                                    </motion.div>
                                 )}
                              </AnimatePresence>
                           </div>

                           {/* Login + Start Free Trial - prominent in nav */}
                           <div className="pt-4 mt-4 border-t border-slate-800 space-y-3">
                              <Link
                                 href={LOGIN_HREF}
                                 onClick={() => setMobileMenuOpen(false)}
                                 className="flex items-center justify-between w-full px-4 py-4 text-lg font-bold text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 rounded-xl transition-colors border border-teal-500/20"
                              >
                                 Log In
                                 <ArrowRight className="w-5 h-5" />
                              </Link>
                              <Link
                                 href={BUSINESS_SIGNUP_HREF}
                                 onClick={() => setMobileMenuOpen(false)}
                                 className="flex items-center justify-center gap-2 w-full px-4 py-4 text-lg font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-xl transition-colors shadow-lg shadow-teal-500/20"
                              >
                                 Start Free Trial
                                 <Zap className="w-5 h-5" />
                              </Link>
                           </div>
                        </nav>
                     </div>

                     {/* Mobile Menu Footer CTA hidden to keep clean */}
                  </div>
               </motion.div>
            )}
         </AnimatePresence>

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
                        <span className="text-sm font-semibold text-cyan-300 tracking-wide uppercase">AlphaClone — AI Business OS</span>
                     </div>

                     {/* Headline */}
                     <h1 className="font-marketing-heading font-black text-white mb-6 tracking-tight">
                        Run your business from{' '}
                        <span className="text-cyan-400">one AI workspace.</span>
                     </h1>                     {/* Solution subheadline */}
                     <p className="text-base sm:text-lg md:text-xl text-slate-300 mb-4 max-w-3xl mx-auto leading-relaxed">
                        AlphaClone replaces scattered CRM, billing, contracts, and project tools with one system that helps founders move faster and keep every client workflow connected.
                     </p>
                     <p className="hidden sm:block text-sm sm:text-base text-slate-400 mb-8 max-w-3xl mx-auto">
                        Built for service businesses. Social automation supports LinkedIn pages and Facebook business pages, without needing a personal account.
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

                     {/* Outcome bullets */}
                     <div className="hidden sm:grid gap-3 sm:grid-cols-3 mb-10 sm:mb-12 max-w-4xl mx-auto text-left">
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

                     {/* Offer block */}
                     <div className="hidden sm:block mb-10 rounded-3xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-slate-950/60 to-blue-500/10 px-5 py-5 sm:px-6 sm:py-6 text-left max-w-4xl mx-auto">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                           <div>
                              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300 mb-3">
                                 Limited-time offer
                              </div>
                              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                 Get set up in minutes, not weeks.
                              </h2>
                              <p className="mt-2 max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
                                 Start a 14-day trial, see your business workspace in one place, and decide after you’ve tested the CRM, billing, contracts, and workflow tools.
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
                        {[
                           { value: '12', label: 'modules in one place' },
                           { value: '1', label: 'shared workspace' },
                           { value: '14', label: 'free trial days' },
                           { value: '$0', label: 'card required' },
                        ].map(({ value, label }) => (
                           <div key={label} className="px-4 py-2 rounded-xl bg-cyan-500/5 border border-cyan-500/15 min-w-[140px]">
                              <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-marketing-data">{value}</div>
                              <div className="text-xs text-slate-400 mt-0.5 font-medium uppercase tracking-wide">{label}</div>
                           </div>
                        ))}
                     </div>
                  </motion.div>
               </motion.div>
            </section>

            {/* ─── Integrations Marquee Strip ─── */}
            <section className="py-10 border-y border-slate-800/60 bg-slate-950/60 overflow-hidden">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-6">
                  <p className="text-[11px] uppercase tracking-[0.28em] font-bold text-slate-500">
                     Connected to the tools your business already uses
                  </p>
               </div>
               <InfiniteMarquee />
            </section>

            {/* Run your business from Claude HUD Section */}
            <section className="py-12 bg-[#020617] border-y border-slate-800">
               <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                  <h3 className="text-2xl md:text-3xl font-black text-white mb-4">
                     Do your business while in <span className="text-cyan-400">Claude</span>
                  </h3>
                  <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
                     Manage leads, automation, and deals from the same command center.
                  </p>
                  <motion.div 
                     initial={{ opacity: 0, y: 20 }}
                     whileInView={{ opacity: 1, y: 0 }}
                     viewport={{ once: true }}
                     className="w-full max-w-5xl mx-auto"
                  >
                     <ClaudeHudSimulator />
                  </motion.div>
               </div>
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
                        { value: '2', label: 'Public pricing plans' },
                        { value: '4', label: 'Policy pages linked' },
                        { value: '3', label: 'Support contact channels' },
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
                        Stop juggling disconnected tools. AlphaClone brings CRM, lead operations, project management, AI agents, invoices, quotations, receipts, contracts, and video operations into one workspace.
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
                           desc: 'Role-based access, audit logging, and security policy links for operational control.',
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
                        No hidden fees. No surprise charges. One operating system for the work you run every day.
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
                                 Includes Video
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

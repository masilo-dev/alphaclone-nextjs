'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const LegalLayout: React.FC<{ title: string, lastUpdated: string, children: React.ReactNode }> = ({ title, lastUpdated, children }) => (
   <div className="min-h-screen bg-black text-slate-300 font-sans selection:bg-teal-500/30">
      <nav className="border-b border-slate-800 bg-slate-900 sticky top-0 z-50">
         <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
               <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <span className="font-bold text-white text-sm sm:text-base">AlphaClone Legal</span>
         </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
         <div className="mb-8 sm:mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 sm:mb-4">{title}</h1>
            <p className="text-slate-500 text-xs sm:text-sm">Last Updated: {lastUpdated}</p>
         </div>
         <div className="space-y-6 text-slate-300 leading-relaxed">
            {children}
         </div>
      </main>
      <footer className="border-t border-slate-800 py-6 sm:py-8 text-center text-slate-600 text-xs sm:text-sm">
         &copy; {new Date().getFullYear()} AlphaClone Systems. All rights reserved.
      </footer>
   </div>
);

export const PrivacyPolicy = () => (
   <LegalLayout title="Privacy Policy" lastUpdated="October 24, 2025">
      <h3 className="text-xl font-bold text-white mt-8 mb-4">1. Information We Collect</h3>
      <p className="mb-4">We collect information you provide directly to us, such as when you create an account, fill out a form, or communicate with us. This may include your name, email address, phone number, and company details.</p>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">2. How We Use Your Information</h3>
      <p className="mb-4">We use the information we collect to provide, maintain, and improve our services, to process your transactions, and to communicate with you about new projects, services, and updates.</p>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">3. Data Protection</h3>
      <p className="mb-4">AlphaClone Systems employs enterprise-grade security measures (SOC2 Type II standards) to protect your personal information from unauthorized access, use, or disclosure.</p>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">4. Contact Us</h3>
      <p>If you have any questions about this Privacy Policy, please contact us at <span className="text-teal-400">legal@alphaclone.tech</span>.</p>
   </LegalLayout>
);

export const TermsOfService = () => (
   <LegalLayout title="Terms of Service" lastUpdated="October 24, 2025">
      <h3 className="text-xl font-bold text-white mt-8 mb-4">1. Acceptance of Terms</h3>
      <p className="mb-4">By accessing or using our website and services, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">2. Intellectual Property</h3>
      <p className="mb-4">Unless otherwise stated in a specific Master Services Agreement (MSA), AlphaClone Systems retains intellectual property rights for platform components, while custom code developed for clients is transferred upon full payment.</p>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">3. Limitation of Liability</h3>
      <p className="mb-4">AlphaClone Systems shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your access to or use of, or inability to access or use, the services.</p>
   </LegalLayout>
);

export const CookiePolicy = () => (
   <LegalLayout title="Cookie Policy" lastUpdated="October 24, 2025">
      <p className="mb-6">This policy explains how AlphaClone Systems uses cookies and similar technologies.</p>
      <div className="space-y-4">
         <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
            <h4 className="font-bold text-white">Essential Cookies</h4>
            <p className="text-sm">Necessary for the website to function, such as authentication and security.</p>
         </div>
         <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
            <h4 className="font-bold text-white">Analytics Cookies</h4>
            <p className="text-sm">Help us understand how visitors interact with our website to improve performance.</p>
         </div>
      </div>
   </LegalLayout>
);

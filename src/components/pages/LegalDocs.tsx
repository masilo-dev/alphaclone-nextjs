'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const LegalLayout: React.FC<{ title: string, lastUpdated: string, children: React.ReactNode }> = ({ title, lastUpdated, children }) => (
   <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-teal-500/30">
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
      <h3 className="text-xl font-bold text-white mt-8 mb-4">1. Introduction</h3>
      <p className="mb-4">Welcome to AlphaClone Systems. We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about this policy, or our practices with regards to your personal information, please contact us at <span className="text-teal-400">legal@alphaclone.tech</span>.</p>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">2. Information We Collect</h3>
      <p className="mb-4">We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services or otherwise when you contact us.</p>
      <ul className="list-disc pl-5 space-y-2 mb-4">
         <li><strong>Personal Data:</strong> Name, email address, phone number, and company details.</li>
         <li><strong>Authentication Data:</strong> Passwords, password hints, and similar security information used for authentication and account access.</li>
         <li><strong>Payment Data:</strong> We may collect data necessary to process your payment if you make purchases, such as your payment instrument number (such as a credit card number), and the security code associated with your payment instrument. All payment data is stored by our payment processor (Stripe).</li>
      </ul>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">3. How We Use Your Information</h3>
      <p className="mb-4">We use personal information collected via our Services for a variety of business purposes described below. We process your personal information for these purposes in reliance on our legitimate business interests, in order to enter into or perform a contract with you, with your consent, and/or for compliance with our legal obligations.</p>
      <ul className="list-disc pl-5 space-y-2 mb-4">
         <li>To facilitate account creation and logon process.</li>
         <li>To send you marketing and promotional communications.</li>
         <li>To send administrative information to you.</li>
         <li>To fulfill and manage your orders.</li>
         <li>To protect our Services (e.g. fraud monitoring and prevention).</li>
         <li>To deliver targeted advertising to you.</li>
      </ul>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">4. Sharing Your Information</h3>
      <p className="mb-4">We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations. We may process or share your data that we hold based on the following legal basis:</p>
      <ul className="list-disc pl-5 space-y-2 mb-4">
         <li><strong>Consent:</strong> We may process your data if you have given us specific consent to use your personal information for a specific purpose.</li>
         <li><strong>Legitimate Interests:</strong> We may process your data when it is reasonably necessary to achieve our legitimate business interests.</li>
         <li><strong>Performance of a Contract:</strong> Where we have entered into a contract with you, we may process your personal information to fulfill the terms of our contract.</li>
      </ul>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">5. Data Retention</h3>
      <p className="mb-4">We will only keep your personal information for as long as it is necessary for the purposes set out in this privacy notice, unless a longer retention period is required or permitted by law (such as tax, accounting or other legal requirements).</p>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">6. Security of Your Information</h3>
      <p className="mb-4">AlphaClone Systems employs enterprise-grade security measures (SOC2 Type II standards) to protect your personal information from unauthorized access, use, or disclosure. However, please also remember that we cannot guarantee that the internet itself is 100% secure. Although we will do our best to protect your personal information, transmission of personal information to and from our Services is at your own risk. You should only access the services within a secure environment.</p>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">7. Contact Us</h3>
      <p>If you have questions or comments about this policy, you may email us at <span className="text-teal-400">legal@alphaclone.tech</span> or by post to:</p>
      <div className="mt-4 p-4 bg-slate-900 border border-slate-800 rounded-lg inline-block">
         <p className="font-bold text-white">AlphaClone Systems HQ</p>
         <p>123 Innovation Drive</p>
         <p>Tech City, TC 90210</p>
         <p>United States</p>
      </div>
   </LegalLayout>
);

export const TermsOfService = () => (
   <LegalLayout title="Terms of Service" lastUpdated="October 24, 2025">
      <h3 className="text-xl font-bold text-white mt-8 mb-4">1. Agreement to Terms</h3>
      <p className="mb-4">These Terms of Service constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and AlphaClone Systems ("Company", "we", "us", or "our"), concerning your access to and use of the AlphaClone platform and services. By accessing the Services, you acknowledge that you have read, understood, and agree to be bound by all of these Terms of Service.</p>

      <p className="mb-4 font-bold text-teal-400/80">IF YOU DO NOT AGREE WITH ALL OF THESE TERMS OF SERVICE, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SITE AND YOU MUST DISCONTINUE USE IMMEDIATELY.</p>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">2. Intellectual Property Rights</h3>
      <p className="mb-4">Unless otherwise indicated, the Site is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Site (collectively, the "Content") and the trademarks, service marks, and logos contained therein (the "Marks") are owned or controlled by us or licensed to us, and are protected by copyright and trademark laws and various other intellectual property rights and unfair competition laws of the United States, foreign jurisdictions, and international conventions.</p>

      <div className="bg-slate-900 border-l-4 border-teal-500 p-4 my-4">
         <p className="text-sm italic">Note regarding Client Work: Unless otherwise stated in a specific Master Services Agreement (MSA), custom code developed specifically for a client is transferred to the client upon full payment of all associated invoices. Platform components and reusable libraries remain the property of AlphaClone Systems.</p>
      </div>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">3. User Representations</h3>
      <p className="mb-4">By using the Site, you represent and warrant that:</p>
      <ul className="list-disc pl-5 space-y-2 mb-4">
         <li>All registration information you submit will be true, accurate, current, and complete.</li>
         <li>You will maintain the accuracy of such information and promptly update such registration information as necessary.</li>
         <li>You have the legal capacity and you agree to comply with these Terms of Service.</li>
         <li>You are not a minor in the jurisdiction in which you reside.</li>
         <li>You will not access the Site through automated or non-human means, whether through a bot, script or otherwise.</li>
         <li>You will not use the Site for any illegal or unauthorized purpose.</li>
      </ul>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">4. Fees and Payment</h3>
      <p className="mb-4">We accept the following forms of payment: Visa, Mastercard, American Express, Discover, PayPal, and Bank Transfer. You may be required to purchase or pay a fee to access some of our services. You agree to provide current, complete, and accurate purchase and account information for all purchases made via the Services.</p>
      <p className="mb-4">You agree to pay all charges or fees at the prices then in effect for your purchases, and you authorize us to charge your chosen payment provider for any such amounts upon making your purchase.</p>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">5. Limitation of Liability</h3>
      <p className="mb-4">IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SITE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">6. Term and Termination</h3>
      <p className="mb-4">These Terms of Service shall remain in full force and effect while you use the Site. WITHOUT LIMITING ANY OTHER PROVISION OF THESE TERMS OF SERVICE, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SITE (INCLUDING BLOCKING CERTAIN IP ADDRESSES), TO ANY PERSON FOR ANY REASON OR FOR NO REASON.</p>
   </LegalLayout>
);

export const CookiePolicy = () => (
   <LegalLayout title="Cookie Policy" lastUpdated="October 24, 2025">
      <h3 className="text-xl font-bold text-white mt-8 mb-4">1. What Are Cookies</h3>
      <p className="mb-4">Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used to make websites work more efficiently and to provide information to the owners of the site.</p>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">2. How We Use Cookies</h3>
      <p className="mb-4">We use cookies to enhance your browsing experience, serve personalized ads or content, and analyze our traffic. By computing your preferences, we can deliver a better user experience.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
         <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800 hover:border-teal-500/30 transition-colors">
            <h4 className="font-bold text-white mb-2 text-lg">Essential Cookies</h4>
            <p className="text-sm text-slate-400">Strictly necessary for the website to function. They enable core functionality such as security, network management, and accessibility.</p>
         </div>
         <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800 hover:border-blue-500/30 transition-colors">
            <h4 className="font-bold text-white mb-2 text-lg">Performance & Analytics</h4>
            <p className="text-sm text-slate-400">Allow us to count visits and traffic sources so we can measure and improve the performance of our site. Use Google Analytics and internal logging.</p>
         </div>
         <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800 hover:border-purple-500/30 transition-colors">
            <h4 className="font-bold text-white mb-2 text-lg">Functionality</h4>
            <p className="text-sm text-slate-400">Enable the website to provide enhanced functionality and personalization, such as remembering your login details or language.</p>
         </div>
         <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800 hover:border-pink-500/30 transition-colors">
            <h4 className="font-bold text-white mb-2 text-lg">Marketing</h4>
            <p className="text-sm text-slate-400">May be set by our advertising partners to build a profile of your interests and show you relevant adverts on other sites.</p>
         </div>
      </div>

      <h3 className="text-xl font-bold text-white mt-8 mb-4">3. Managing Preferences</h3>
      <p className="mb-4">Most web browsers allow some control of most cookies through the browser settings. To find out more about cookies, including how to see what cookies have been set, visit <a href="https://www.aboutcookies.org" className="text-teal-400 hover:underline">www.aboutcookies.org</a> or <a href="https://www.allaboutcookies.org" className="text-teal-400 hover:underline">www.allaboutcookies.org</a>.</p>

      <p className="mt-8 text-sm text-slate-500 italic">Note: Blocking essential cookies may impact your ability to use critical features of the AlphaClone platform.</p>
   </LegalLayout>
);

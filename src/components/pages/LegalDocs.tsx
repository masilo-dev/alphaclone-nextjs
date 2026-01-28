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
         <div className="space-y-8 text-slate-300 leading-relaxed">
            {children}
         </div>
      </main>
      <footer className="border-t border-slate-800 py-6 sm:py-8 text-center text-slate-600 text-xs sm:text-sm">
         &copy; {new Date().getFullYear()} AlphaClone Systems. All rights reserved.
      </footer>
   </div>
);

export const PrivacyPolicy = () => (
   <LegalLayout title="Privacy Policy" lastUpdated="January 28, 2026">
      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg mb-6">
         <p className="text-sm">This Privacy Policy applies to AlphaClone Systems ("AlphaClone", "we", "us", or "our") and is fully compliant with the General Data Protection Regulation (GDPR).</p>
      </div>

      <section>
         <h3 className="text-xl font-bold text-white mb-4">1. Data Collection</h3>
         <p className="mb-4">We collect personal data that you voluntarily provide to us when you register on the Platform, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Platform, or otherwise when you contact us.</p>
         <ul className="list-disc pl-5 space-y-2 mb-4 text-slate-400">
            <li><strong>Personal Identity Information:</strong> Name, email address, phone number, and business name.</li>
            <li><strong>Technical Data:</strong> IP address, browser type and version, time zone setting, browser plug-in types, operating system, and platform.</li>
            <li><strong>Payment Information:</strong> Credit card details and billing address (processed securely by our third-party payment processors).</li>
            <li><strong>Usage Data:</strong> Information about how you use our website, products, and services.</li>
         </ul>
      </section>

      <section>
         <h3 className="text-xl font-bold text-white mb-4">2. Legal Basis for Processing</h3>
         <p className="mb-4">Under GDPR, we rely on the following legal bases to process your personal data:</p>
         <ul className="list-disc pl-5 space-y-2 mb-4 text-slate-400">
            <li><strong>Consent:</strong> We may process your data if you have given us specific consent to use your personal information for a specific purpose.</li>
            <li><strong>contractual Necessity:</strong> Processing is necessary for the performance of a contract to which you are a party (e.g., providing the AlphaClone service).</li>
            <li><strong>Legitimate Interests:</strong> We may process your data when it is reasonably necessary to achieve our legitimate business interests (e.g., fraud prevention, improving our services).</li>
         </ul>
      </section>

      <section>
         <h3 className="text-xl font-bold text-white mb-4">3. Data Storage & Security</h3>
         <p className="mb-4">Your data is securely stored on enterprise-grade servers hosted by Secure Cloud Infrastructure. We implement robust technical and organizational measures to protect your personal data, including:</p>
         <ul className="list-disc pl-5 space-y-2 mb-4 text-slate-400">
            <li><strong>Encryption:</strong> Data is encrypted in transit (TLS 1.2+) and at rest (AES-256).</li>
            <li><strong>Access Controls:</strong> Strict role-based access controls limit who can view your data within our organization.</li>
            <li><strong>Regular Audits:</strong> We conduct regular security assessments to identify and mitigate vulnerabilities.</li>
         </ul>
      </section>

      <section>
         <h3 className="text-xl font-bold text-white mb-4">4. User Rights (GDPR)</h3>
         <p className="mb-4">You have specific rights regarding your personal data:</p>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 p-4 rounded border border-slate-800">
               <strong className="text-white block mb-1">Right to Access</strong>
               <span className="text-sm">Request copies of your personal data.</span>
            </div>
            <div className="bg-slate-900 p-4 rounded border border-slate-800">
               <strong className="text-white block mb-1">Right to Rectification</strong>
               <span className="text-sm">Request correction of any information you believe is inaccurate.</span>
            </div>
            <div className="bg-slate-900 p-4 rounded border border-slate-800">
               <strong className="text-white block mb-1">Right to Erasure ("Right to be Forgotten")</strong>
               <span className="text-sm">Request that we delete your personal data under certain conditions.</span>
            </div>
            <div className="bg-slate-900 p-4 rounded border border-slate-800">
               <strong className="text-white block mb-1">Right to Data Portability</strong>
               <span className="text-sm">Request that we transfer your data to another organization or directly to you.</span>
            </div>
         </div>
      </section>

      <section>
         <h3 className="text-xl font-bold text-white mb-4">5. Third-Party Sharing</h3>
         <p className="mb-4">We may share your data with the following trusted sub-processors to provide our services:</p>
         <ul className="list-disc pl-5 space-y-2 mb-4 text-slate-400">
            <li><strong>Cloud Database Provider:</strong> Database and Authentication services.</li>
            <li><strong>Payment Processor:</strong> Payment processing.</li>
            <li><strong>Video Infrastructure Provider:</strong> Video conferencing infrastructure.</li>
            <li><strong>Email Service Provider:</strong> Transactional email delivery.</li>
            <li><strong>AI Service Provider:</strong> AI processing (anonymized where possible).</li>
         </ul>
      </section>

      <section>
         <h3 className="text-xl font-bold text-white mb-4">6. Data Protection Officer</h3>
         <p className="mb-4">We have appointed a Data Protection Officer (DPO) to oversee our data protection strategy. If you have any questions about this policy or your data rights, please contact:</p>
         <div className="mt-2 p-4 bg-slate-900 border border-slate-800 rounded-lg inline-block">
            <p className="font-bold text-white">Data Protection Officer</p>
            <p>AlphaClone Systems</p>
            <p><a href="mailto:dpo@alphaclone.tech" className="text-teal-400 hover:underline">dpo@alphaclone.tech</a></p>
         </div>
      </section>
   </LegalLayout>
);

export const TermsOfService = () => (
   <LegalLayout title="Terms of Use" lastUpdated="January 28, 2026">
      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg mb-6">
         <p className="text-sm">These Terms of Use constitute a legally binding agreement between you and AlphaClone Systems regarding your use of the AlphaClone Business Operating System.</p>
      </div>

      <section>
         <h3 className="text-xl font-bold text-white mb-4">1. User Eligibility</h3>
         <p className="mb-4">By accessing the Platform, you represent and warrant that:</p>
         <ul className="list-disc pl-5 space-y-2 mb-4 text-slate-400">
            <li>You are at least 18 years of age.</li>
            <li>You have the legal capacity to enter into a binding contract.</li>
            <li>All registration information you submit is truthful and accurate.</li>
            <li>You will use the Platform in compliance with all applicable laws and regulations.</li>
         </ul>
      </section>

      <section>
         <h3 className="text-xl font-bold text-white mb-4">2. Acceptable Use Policy</h3>
         <p className="mb-4">You agree not to use the Platform for any unlawful purpose or any purpose prohibited under this clause. Protocol explicitly prohibits:</p>
         <ul className="list-disc pl-5 space-y-2 mb-4 text-slate-400">
            <li><strong>Reverse Engineering:</strong> Attempting to reverse engineer, decompile, hack, disable, interfere with, disassemble, copy, or disrupt the integrity or performance of the Platform.</li>
            <li><strong>Scraping:</strong> Using any robot, spider, scraper, or other automated means to access the Platform for any purpose without our express written permission.</li>
            <li><strong>Illegal Activities:</strong> Using the Platform to transmit unwanted commercial email (spam) or engage in phishing, fraud, or other criminal activities.</li>
         </ul>
      </section>

      <section>
         <h3 className="text-xl font-bold text-white mb-4">3. Intellectual Property</h3>
         <p className="mb-4"><strong>Platform IP:</strong> The Platform, including its source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics, is defined as "AlphaClone Content" and is owned by us.</p>
         <p className="mb-4"><strong>User Content:</strong> You retain ownership of any data, files, or intellectual property you upload to the Platform ("User Content"). By uploading User Content, you grant AlphaClone a license to host, copy, transmit, and display such content solely as necessary to provide the Services to you.</p>
      </section>

      <section>
         <h3 className="text-xl font-bold text-white mb-4">4. Payment & Subscriptions</h3>
         <ul className="list-disc pl-5 space-y-2 mb-4 text-slate-400">
            <li><strong>Billing:</strong> Subscriptions are billed in advance on a monthly or annual basis.</li>
            <li><strong>Refunds:</strong> All fees are non-refundable unless otherwise required by law.</li>
            <li><strong>Late Payment:</strong> If any fee is not paid in a timely manner, we reserve the right to revoke access to your account and the Platform until such fee is paid.</li>
         </ul>
      </section>

      <section>
         <h3 className="text-xl font-bold text-white mb-4">5. Limitation of Liability</h3>
         <p className="mb-4 uppercase text-slate-400 text-sm">To the maximum extent permitted by law, AlphaClone Systems shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from (a) your access to or use of or inability to access or use the services; (b) any conduct or content of any third party on the services; or (c) unauthorized access, use, or alteration of your transmissions or content.</p>
      </section>

      <section>
         <h3 className="text-xl font-bold text-white mb-4">6. Termination</h3>
         <p className="mb-4">We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to specific breaches of the Terms.</p>
      </section>

      <section>
         <h3 className="text-xl font-bold text-white mb-4">7. Governing Law</h3>
         <p className="mb-4">These Terms shall be governed and construed in accordance with the laws of the United States, without regard to its conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.</p>
      </section>
   </LegalLayout>
);

export const CookiePolicy = () => (
   <LegalLayout title="Cookie Policy" lastUpdated="January 28, 2026">
      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg mb-6">
         <p className="text-sm">This Cookie Policy explains how AlphaClone Systems uses cookies and similar technologies to recognize you when you visit our website. It explains what these technologies are and why we use them, as well as your rights to control our use of them.</p>
      </div>

      <section>
         <h3 className="text-xl font-bold text-white mb-4">1. Categories of Cookies</h3>
         <p className="mb-4">We use the following categories of cookies on our Platform:</p>

         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse rounded-lg overflow-hidden">
               <thead>
                  <tr className="bg-slate-900 text-white text-sm">
                     <th className="p-4 font-semibold">Category</th>
                     <th className="p-4 font-semibold">Purpose</th>
                     <th className="p-4 font-semibold">Example</th>
                  </tr>
               </thead>
               <tbody className="text-sm text-slate-400">
                  <tr className="border-b border-slate-800 bg-slate-900/30">
                     <td className="p-4 font-medium text-teal-400">Strictly Necessary</td>
                     <td className="p-4">Essential for the platform to function. Cannot be disabled.</td>
                     <td className="p-4">Session ID, Auth Token</td>
                  </tr>
                  <tr className="border-b border-slate-800 bg-slate-900/10">
                     <td className="p-4 font-medium text-blue-400">Performance/Analytical</td>
                     <td className="p-4">Help us understand how visitors interact with the website.</td>
                     <td className="p-4">Traffic Analysis Tools</td>
                  </tr>
                  <tr className="border-b border-slate-800 bg-slate-900/30">
                     <td className="p-4 font-medium text-purple-400">Marketing/Targeting</td>
                     <td className="p-4">Used to track visitors across websites to display relevant ads.</td>
                     <td className="p-4">Marketing Performance Tools</td>
                  </tr>
               </tbody>
            </table>
         </div>
      </section>

      <section>
         <h3 className="text-xl font-bold text-white mb-4">2. How to Manage Cookies</h3>
         <p className="mb-4">You have the right to decide whether to accept or reject cookies. You can exercise your cookie rights by setting your browser controls to accept or refuse cookies.</p>
         <p className="mb-4">Most web browsers allow you to control cookies through their settings preferences. To find out more about cookies, including how to see what cookies have been set and how to manage and delete them, visit <a href="https://www.aboutcookies.org" className="text-teal-400 hover:underline">www.aboutcookies.org</a>.</p>
         <div className="bg-slate-900 border-l-4 border-yellow-500 p-4 mt-4">
            <p className="text-sm text-slate-300"><strong>Please Note:</strong> If you choose to reject cookies, you may still use our website though your access to some functionality and areas of our website may be restricted.</p>
         </div>
      </section>
   </LegalLayout>
);

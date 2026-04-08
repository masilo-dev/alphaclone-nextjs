'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Shield, FileText, Cookie, ChevronDown, ChevronRight, ExternalLink, Mail, Lock, Eye, Database, AlertTriangle } from 'lucide-react';
import PublicNavigation from '@/components/PublicNavigation';

// ---------------------------------------------------------------------------
// Shared Layout
// ---------------------------------------------------------------------------
function LegalLayout({
   title,
   subtitle,
   lastUpdated,
   children,
   icon: Icon,
   color,
}: {
   title: string;
   subtitle: string;
   lastUpdated: string;
   children: React.ReactNode;
   icon: React.ElementType;
   color: string;
}) {
   const [, setIsLoginOpen] = useState(false);
   return (
      <div className="min-h-screen bg-transparent text-slate-200 font-sans selection:bg-teal-500/30">
         <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />
         <div className="pt-20 max-w-4xl mx-auto px-4 py-16">
            {/* Header */}
            <div className={`flex items-center gap-3 mb-4`}>
               <div className={`w-10 h-10 rounded-xl bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 text-${color}-400`} />
               </div>
               <span className={`text-${color}-400 text-sm font-semibold uppercase tracking-widest`}>Legal</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{title}</h1>
            <p className="text-slate-400 mb-2">{subtitle}</p>
            <div className="flex flex-wrap gap-4 mb-12 pb-8 border-b border-slate-800">
               <span className="text-xs text-slate-500">Last updated: {lastUpdated}</span>
               <span className="text-xs text-slate-500">•</span>
               <span className="text-xs text-slate-500">AlphaClone Systems (Pty) Ltd</span>
               <span className="text-xs text-slate-500">•</span>
               <a href="mailto:legal@alphaclone.tech" className="text-xs text-teal-400 hover:underline flex items-center gap-1">
                  <Mail className="w-3 h-3" /> legal@alphaclone.tech
               </a>
            </div>
            <div className="prose-legal space-y-12">
               {children}
            </div>
            <div className="mt-16 pt-8 border-t border-slate-800 flex flex-wrap gap-4 text-xs text-slate-500">
               <Link href="/privacy-policy" className="hover:text-teal-400 transition-colors">Privacy Policy</Link>
               <Link href="/terms-of-service" className="hover:text-teal-400 transition-colors">Terms of Service</Link>
               <Link href="/cookie-policy" className="hover:text-teal-400 transition-colors">Cookie Policy</Link>
               <a href="mailto:legal@alphaclone.tech" className="hover:text-teal-400 transition-colors">Contact Legal</a>
            </div>
         </div>
      </div>
   );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
   return (
      <section id={id} className="scroll-mt-24">
         <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <ChevronRight className="w-5 h-5 text-teal-500 flex-shrink-0" />
            {title}
         </h2>
         <div className="pl-7 space-y-4 text-slate-400 leading-relaxed text-sm">
            {children}
         </div>
      </section>
   );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
   return (
      <div>
         <h3 className="text-white font-semibold mb-2 text-sm">{title}</h3>
         <div className="text-slate-400 leading-relaxed">{children}</div>
      </div>
   );
}

function BulletList({ items }: { items: string[] }) {
   return (
      <ul className="space-y-1.5 ml-4">
         {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-slate-400 text-sm">
               <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-2 flex-shrink-0" />
               {item}
            </li>
         ))}
      </ul>
   );
}

function InfoBox({ children, variant = 'info' }: { children: React.ReactNode; variant?: 'info' | 'warn' }) {
   const styles = variant === 'warn'
      ? 'bg-amber-500/5 border-amber-500/20 text-amber-300'
      : 'bg-teal-500/5 border-teal-500/20 text-teal-300';
   const Icon = variant === 'warn' ? AlertTriangle : Shield;
   return (
      <div className={`p-4 rounded-xl border ${styles} flex gap-3 text-xs leading-relaxed`}>
         <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
         <div>{children}</div>
      </div>
   );
}

// ---------------------------------------------------------------------------
// PRIVACY POLICY
// ---------------------------------------------------------------------------
export function PrivacyPolicy() {
   return (
      <LegalLayout
         title="Privacy Policy"
         subtitle="This Privacy Policy explains how AlphaClone Systems collects, uses, stores, and protects your personal information. Read it in full before using our platform."
         lastUpdated="April 8, 2026"
         icon={Shield}
         color="teal"
      >
         <InfoBox>
            <strong>Summary for Google OAuth / API Verification:</strong> AlphaClone requests Gmail API access solely to enable users to read, compose, and send emails within the platform. We do not store email content on our servers, do not use email data for advertising, and do not share email data with third parties. Users can revoke access at any time from their Google Account settings. Our use of Google APIs complies with the Google API Services User Data Policy, including the Limited Use requirements.
         </InfoBox>

         <Section id="controller" title="1. Data Controller">
            <p>
               The data controller responsible for your personal information is:
            </p>
            <div className="mt-3 p-4 bg-white/[0.04] backdrop-blur-sm rounded-xl border border-slate-800 text-sm not-italic">
               <p><strong className="text-white">AlphaClone Systems (Pty) Ltd</strong></p>
               <p>Email: <a href="mailto:legal@alphaclone.tech" className="text-teal-400 hover:underline">legal@alphaclone.tech</a></p>
               <p>Data Protection Contact: <a href="mailto:privacy@alphaclone.tech" className="text-teal-400 hover:underline">privacy@alphaclone.tech</a></p>
               <p>Website: <a href="https://alphaclone.tech" className="text-teal-400 hover:underline">https://alphaclone.tech</a></p>
            </div>
         </Section>

         <Section id="data-collected" title="2. Data We Collect">
            <Sub title="2.1 Account & Identity Data">
               <p>When you register an account, we collect: full name, email address, password (stored as a salted bcrypt hash — never in plain text), company name, phone number (optional), profile photo (optional), timezone, and country.</p>
            </Sub>
            <Sub title="2.2 Business Operational Data">
               <p>Data you create or import while using the platform, including: CRM contact records, invoice and quote data, contract documents, financial records (journal entries, expenses, chart of accounts), project and task records, calendar events, meeting recordings (stored in your workspace only), and team member information.</p>
            </Sub>
            <Sub title="2.3 Google API Data (Gmail Integration)">
               <InfoBox>
                  AlphaClone's use and transfer of information received from Google APIs to any other app adheres to the{' '}
                  <a href="https://developers.google.com/terms/api-services-user-data-policy" className="underline" target="_blank" rel="noreferrer">
                     Google API Services User Data Policy <ExternalLink className="inline w-3 h-3" />
                  </a>{', '}
                  including the Limited Use requirements.
               </InfoBox>
               <p className="mt-3">When you connect Gmail, AlphaClone requests the following Google OAuth scopes:</p>
               <BulletList items={[
                  'gmail.readonly — to display your inbox within the platform',
                  'gmail.send — to send emails on your behalf from within the platform',
                  'gmail.compose — to draft and compose emails',
                  'gmail.modify — to label and manage emails (e.g., mark as read)',
               ]} />
               <p className="mt-3"><strong className="text-white">What we do NOT do with Gmail data:</strong></p>
               <BulletList items={[
                  'We do not store your email content on AlphaClone servers',
                  'We do not use Gmail data for advertising or marketing purposes',
                  'We do not share Gmail data with third parties outside of processing your request',
                  'We do not allow humans to read your email content unless you explicitly request support access',
                  'We do not use Gmail data to train AI models',
               ]} />
               <p className="mt-3">Gmail data is retrieved in real time via Google's API and displayed only to the authenticated user. You can revoke AlphaClone's Gmail access at any time from your <a href="https://myaccount.google.com/permissions" className="text-teal-400 hover:underline" target="_blank" rel="noreferrer">Google Account Permissions page</a>.</p>
            </Sub>
            <Sub title="2.4 Usage & Technical Data">
               <p>We automatically collect technical data when you use the platform: IP address, browser type and version, operating system, device type, pages visited, features used, session duration, and error logs. This data is used for platform security, debugging, and improving the user experience.</p>
            </Sub>
            <Sub title="2.5 Payment Data">
               <p>Payment processing is handled entirely by Stripe, Inc. AlphaClone never stores, processes, or has access to your credit card details. What we retain is limited to: Stripe Customer ID, subscription plan details, billing address, and payment history (invoice amounts and dates). See <a href="https://stripe.com/privacy" className="text-teal-400 hover:underline" target="_blank" rel="noreferrer">Stripe's Privacy Policy</a> for how they handle payment data.</p>
            </Sub>
            <Sub title="2.6 AI Growth Agent Data">
               <p>The AI Growth Agent uses publicly available business directory data to identify prospective leads. We do not scrape private data or use data obtained through unauthorized means. Outreach conversations managed by the AI agent are stored in your workspace and are not accessible to other users or AlphaClone staff without your consent.</p>
            </Sub>
            <Sub title="2.7 Model Context Protocol (MCP) AI Agent Data">
               <InfoBox variant="warn">
                  When you connect an external AI agent (e.g. Anthropic Claude Desktop, Manus AI) to AlphaClone via the Model Context Protocol (MCP), your workspace data — including client names, project details, task records, and revenue summaries — is transmitted to that AI agent over an encrypted SSE channel. AlphaClone does not control how the receiving AI provider processes or retains this data. You must review the privacy policy of any external AI agent before enabling MCP access.
               </InfoBox>
               <p className="mt-3">AlphaClone's MCP server enforces strict technical controls: all data is scoped to your tenant workspace only, DELETE and DDL operations are blocked, and credentials/secrets are never transmitted. MCP access tokens are user-generated and can be revoked at any time from Settings → Integrations → MCP.</p>
            </Sub>
         </Section>

         <Section id="legal-basis" title="3. Legal Basis for Processing (GDPR)">
            <p>For users in the European Economic Area (EEA), United Kingdom, and other GDPR-applicable jurisdictions, our legal basis for processing your data is:</p>
            <div className="space-y-3 mt-4">
               {[
                  { basis: 'Contract Performance (Art. 6(1)(b) GDPR)', desc: 'Processing necessary to provide the services you\'ve subscribed to — account management, invoicing, CRM functionality, and platform features.' },
                  { basis: 'Legitimate Interests (Art. 6(1)(f) GDPR)', desc: 'Platform security monitoring, fraud prevention, technical debugging, and product improvement analytics.' },
                  { basis: 'Legal Obligation (Art. 6(1)(c) GDPR)', desc: 'Responding to lawful government or court orders, tax compliance, and financial record-keeping obligations.' },
                  { basis: 'Consent (Art. 6(1)(a) GDPR)', desc: 'Non-essential cookies (analytics, marketing), Gmail API access, and marketing communications. You may withdraw consent at any time.' },
               ].map((item, i) => (
                  <div key={i} className="p-4 bg-white/[0.04] backdrop-blur-sm rounded-xl border border-slate-800">
                     <p className="text-white font-semibold text-xs mb-1">{item.basis}</p>
                     <p className="text-slate-400 text-xs">{item.desc}</p>
                  </div>
               ))}
            </div>
         </Section>

         <Section id="data-use" title="4. How We Use Your Data">
            <BulletList items={[
               'Providing and operating the AlphaClone Business OS platform and its features',
               'Sending transactional emails (account verification, password reset, invoice confirmations)',
               'Processing subscription payments and managing billing through Stripe',
               'Providing customer support and responding to your enquiries',
               'Detecting, investigating, and preventing security threats and fraudulent activity',
               'Improving platform performance, debugging errors, and developing new features',
               'Sending product update notifications and feature announcements (you may opt out at any time)',
               'Complying with legal obligations including tax, financial record-keeping, and court orders',
               'Anonymizing and aggregating usage data for internal analytics (no individual identification)',
            ]} />
         </Section>

         <Section id="data-sharing" title="5. Data Sharing & Third Parties">
            <p>We do not sell, rent, or trade your personal data. We share data only with the following service providers, strictly for the purpose of delivering our service:</p>
            <div className="mt-4 overflow-x-auto">
               <table className="w-full text-xs border-collapse">
                  <thead>
                     <tr className="border-b border-slate-700">
                        <th className="text-left py-2 pr-4 text-slate-300 font-semibold">Provider</th>
                        <th className="text-left py-2 pr-4 text-slate-300 font-semibold">Purpose</th>
                        <th className="text-left py-2 text-slate-300 font-semibold">Data Shared</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                     {[
                        { p: 'Supabase (US)', pu: 'Database & authentication', d: 'All platform data (encrypted at rest)' },
                        { p: 'Stripe, Inc. (US)', pu: 'Payment processing', d: 'Email, billing address, Stripe customer ID' },
                        { p: 'Google LLC (US)', pu: 'Gmail API, OAuth sign-in', d: 'Google account OAuth token, email actions only' },
                        { p: 'Vercel, Inc. (US)', pu: 'Application hosting & CDN', d: 'IP address, request metadata' },
                        { p: 'Resend / SendGrid', pu: 'Transactional email delivery', d: 'Email address, email content (transactional only)' },
                        { p: 'Anthropic / Manus AI (optional)', pu: 'MCP AI agent integration (user-initiated)', d: 'CRM data transmitted only when user activates MCP integration' },
                     ].map((row, i) => (
                        <tr key={i}>
                           <td className="py-2 pr-4 text-white">{row.p}</td>
                           <td className="py-2 pr-4 text-slate-400">{row.pu}</td>
                           <td className="py-2 text-slate-400">{row.d}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
            <p className="mt-4">All third-party providers are contractually bound to process data only as instructed and to implement appropriate security measures. Transfers to the United States are covered by Standard Contractual Clauses (SCCs) where required by GDPR.</p>
         </Section>

         <Section id="data-retention" title="6. Data Retention">
            <p>We retain your data for as long as your account is active and for a period afterward as required by law or legitimate business interest:</p>
            <BulletList items={[
               'Active account data: Retained for the duration of your subscription',
               'Financial records (invoices, journal entries): 7 years from creation (tax and accounting legal requirements)',
               'Signed contracts: 7 years from signing date',
               'Audit logs: 2 years from creation',
               'Account deletion: Personal data deleted within 72 hours of deletion request. Anonymized analytics data may be retained.',
               'Backup snapshots: Purged within 30 days of account deletion',
               'Gmail API tokens: Revoked and deleted immediately upon Gmail disconnection',
            ]} />
         </Section>

         <Section id="your-rights" title="7. Your Rights (GDPR & POPIA)">
            <p>Depending on your jurisdiction, you have the following rights regarding your personal data. To exercise any of these rights, email <a href="mailto:privacy@alphaclone.tech" className="text-teal-400 hover:underline">privacy@alphaclone.tech</a>. We will respond within 30 days.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
               {[
                  { right: 'Right of Access', desc: 'Request a copy of all personal data we hold about you.' },
                  { right: 'Right to Rectification', desc: 'Request correction of inaccurate or incomplete data.' },
                  { right: 'Right to Erasure', desc: 'Request deletion of your data ("right to be forgotten").' },
                  { right: 'Right to Portability', desc: 'Receive your data in a structured, machine-readable format.' },
                  { right: 'Right to Restrict Processing', desc: 'Request that we limit processing of your data in certain circumstances.' },
                  { right: 'Right to Object', desc: 'Object to processing based on legitimate interests or for direct marketing.' },
                  { right: 'Right to Withdraw Consent', desc: 'Withdraw consent for any consent-based processing at any time.' },
                  { right: 'Right to Lodge a Complaint', desc: 'Lodge a complaint with your local data protection authority.' },
               ].map((item, i) => (
                  <div key={i} className="p-3 bg-white/[0.04] backdrop-blur-sm rounded-lg border border-slate-800">
                     <p className="text-white font-semibold text-xs mb-1">{item.right}</p>
                     <p className="text-slate-500 text-xs">{item.desc}</p>
                  </div>
               ))}
            </div>
         </Section>

         <Section id="security" title="8. Security Measures">
            <p>We implement enterprise-grade security to protect your data:</p>
            <BulletList items={[
               'AES-256 encryption at rest for all database records',
               'TLS 1.3 encryption in transit for all data transfers',
               'Bcrypt password hashing with adaptive cost factors',
               'Row-Level Security (RLS) on all database tables — multi-tenant data isolation',
               'Role-Based Access Control (RBAC) for team member permissions',
               'Continuous SIEM audit logging for all admin actions',
               'Real-time DDoS mitigation and IP threat intelligence',
               'Regular automated security audits and penetration testing',
               'Zero-knowledge architecture for financial data (your accountant sees only what you grant)',
            ]} />
         </Section>

         <Section id="cookies" title="9. Cookies">
            <p>We use cookies and similar tracking technologies. Our Cookie Policy (linked below) provides full details on all cookies used, their purposes, and how to manage your preferences. You may update your cookie preferences at any time using the cookie preference center accessible from the bottom of any page.</p>
            <p><Link href="/cookie-policy" className="text-teal-400 hover:underline">→ Read the Full Cookie Policy</Link></p>
         </Section>

         <Section id="children" title="10. Children's Privacy">
            <p>The AlphaClone Business OS is intended for use by businesses and professionals aged 18 and over. We do not knowingly collect personal data from anyone under 18. If you believe a minor has provided us with personal data, contact us at <a href="mailto:privacy@alphaclone.tech" className="text-teal-400 hover:underline">privacy@alphaclone.tech</a> and we will delete the data immediately.</p>
         </Section>

         <Section id="changes" title="11. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. When we make material changes, we will notify you via email and display a notice in the platform dashboard at least 14 days before the changes take effect. Continued use of the platform after the effective date constitutes acceptance of the updated policy. The "Last updated" date at the top of this page reflects the most recent revision.</p>
         </Section>

         <Section id="contact" title="12. Contact Us">
            <p>For privacy-related enquiries, data subject rights requests, or complaints:</p>
            <div className="p-4 bg-white/[0.04] backdrop-blur-sm rounded-xl border border-slate-800 text-sm mt-3">
               <p><strong className="text-white">Privacy & Data Protection:</strong> <a href="mailto:privacy@alphaclone.tech" className="text-teal-400 hover:underline">privacy@alphaclone.tech</a></p>
               <p><strong className="text-white">Legal Department:</strong> <a href="mailto:legal@alphaclone.tech" className="text-teal-400 hover:underline">legal@alphaclone.tech</a></p>
               <p><strong className="text-white">General Support:</strong> <a href="mailto:support@alphaclone.tech" className="text-teal-400 hover:underline">support@alphaclone.tech</a></p>
            </div>
         </Section>
      </LegalLayout>
   );
}

// ---------------------------------------------------------------------------
// TERMS OF SERVICE
// ---------------------------------------------------------------------------
export function TermsOfService() {
   return (
      <LegalLayout
         title="Terms of Service"
         subtitle="These Terms govern your use of the AlphaClone Business OS platform. By signing up and using our services, you agree to these terms."
         lastUpdated="February 25, 2026"
         icon={FileText}
         color="blue"
      >
         <InfoBox>
            <strong>Plain language summary:</strong> AlphaClone provides a business management platform. You own your data. We may suspend accounts that violate these terms. Subscription fees are billed in advance. You may cancel at any time. Our liability is limited to fees paid in the preceding 3 months.
         </InfoBox>

         <Section id="acceptance" title="1. Acceptance of Terms">
            <p>By accessing or using the AlphaClone Business OS platform at <a href="https://alphaclone.tech" className="text-teal-400 hover:underline">alphaclone.tech</a> or any associated mobile or desktop applications ("Platform"), you agree to be bound by these Terms of Service ("Terms"), our Privacy Policy, and Cookie Policy. If you are using the Platform on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.</p>
            <p>If you do not agree to these Terms, you must not use the Platform. Continued use of the Platform after any modification to these Terms constitutes your acceptance of the revised Terms.</p>
         </Section>

         <Section id="eligibility" title="2. Eligibility">
            <p>To use AlphaClone, you must:</p>
            <BulletList items={[
               'Be at least 18 years of age or the legal age of majority in your jurisdiction',
               'Have the legal capacity to enter into a binding contract',
               'Not be prohibited from using such services under applicable law',
               'Provide accurate, current, and complete information during registration',
               'Maintain the security of your account credentials',
            ]} />
         </Section>

         <Section id="account" title="3. Account Registration & Security">
            <Sub title="3.1 Account Responsibility">
               <p>You are solely responsible for all activity that occurs under your account. You must: choose a strong password, keep your credentials confidential, notify us immediately at <a href="mailto:security@alphaclone.tech" className="text-teal-400 hover:underline">security@alphaclone.tech</a> of any unauthorized access or security breach, and not share your account with unauthorized third parties.</p>
            </Sub>
            <Sub title="3.2 Team Members">
               <p>Subscription plans allow you to invite team members. You are responsible for all actions taken by your team members within your workspace. Each team member must individually agree to these Terms. You may revoke team member access at any time from Settings → Team Management.</p>
            </Sub>
         </Section>

         <Section id="subscription" title="4. Subscription Plans & Billing">
            <Sub title="4.1 Plans">
               <p>AlphaClone offers the following subscription tiers, all of which include every platform feature. Differences between tiers are usage quotas only: Starter ($15/month — 5 users, 5GB storage, 50 AI queries/month, 10 AI Agent runs/month, standard 48h support); Pro ($45/month — 25 users, 25GB storage, 500 AI queries/month, 200 AI Agent runs/month, priority 12h support); Enterprise ($80/month — unlimited users, 100GB storage, unlimited AI queries, unlimited AI Agent runs, dedicated 4h support). All plans include a 14-day free trial; no credit card required to begin.</p>
            </Sub>
            <Sub title="4.2 Billing Cycle">
               <p>Subscriptions are billed monthly in advance. Your billing date is set on the day you first provide payment details. Invoices are issued automatically and sent to your registered email address. You authorize AlphaClone to charge your payment method on each monthly billing date.</p>
            </Sub>
            <Sub title="4.3 Price Changes">
               <p>We will notify you of any price changes at least 30 days before they take effect via email. Your continued use of the Platform after the effective date constitutes acceptance of the new pricing.</p>
            </Sub>
            <Sub title="4.4 Refunds">
               <p>Subscriptions are non-refundable except where required by applicable law (e.g., statutory cooling-off periods). We may, at our sole discretion, provide pro-rated credits for service disruptions exceeding 24 hours.</p>
            </Sub>
            <Sub title="4.5 Cancellation">
               <p>You may cancel your subscription at any time from Settings → Billing → Cancel Subscription. Cancellation takes effect at the end of the current billing period. Your data remains accessible until the cancellation date. After cancellation, your data is retained for 90 days before permanent deletion, during which you may re-activate your subscription to regain access.</p>
            </Sub>
            <Sub title="4.6 Failed Payments">
               <p>If a payment fails, we will retry the charge three times over 7 days. If payment remains unsuccessful, your account will be suspended. Data is retained during suspension and for 30 days afterward, after which it is subject to deletion. You will receive email notifications for each failed payment attempt.</p>
            </Sub>
         </Section>

         <Section id="acceptable-use" title="5. Acceptable Use Policy">
            <p>You agree not to use the Platform to:</p>
            <BulletList items={[
               'Violate any applicable law, regulation, or third-party rights',
               'Send unsolicited commercial email (spam) or bulk messages without recipient consent',
               'Transmit malware, viruses, or any malicious code',
               'Attempt to gain unauthorized access to the Platform or other users\' accounts',
               'Reverse engineer, decompile, or extract source code from the Platform',
               'Resell, sublicense, or commercially exploit Platform features without written permission',
               'Use the AI Growth Agent to send deceptive, misleading, or fraudulent communications',
               'Scrape, harvest, or systematically collect data from the Platform without authorization',
               'Use the Platform for any activity that constitutes harassment, abuse, or discrimination',
               'Store or process data in violation of applicable data protection laws',
            ]} />
            <p className="mt-4">AlphaClone reserves the right to investigate potential violations and may suspend or terminate accounts without notice if a violation is confirmed or reasonably suspected.</p>
         </Section>

         <Section id="ip" title="6. Intellectual Property">
            <Sub title="6.1 Your Data">
               <p>You retain full ownership of all data, content, and intellectual property you upload, create, or store within the Platform ("Your Data"). AlphaClone claims no ownership of Your Data. By using the Platform, you grant AlphaClone a limited, non-exclusive, royalty-free license to store, process, and display Your Data solely for the purpose of providing the service to you.</p>
            </Sub>
            <Sub title="6.2 Platform IP">
               <p>The AlphaClone Platform, including its software, design, trademarks, logos, documentation, and all associated intellectual property, is owned by AlphaClone Systems (Pty) Ltd and is protected by copyright, trademark, and other applicable laws. You may not use our trademarks or branding without prior written consent.</p>
            </Sub>
         </Section>

         <Section id="ai-agent" title="7. AI Growth Agent — Specific Terms">
            <p>The AI Growth Agent is a powerful automated outreach and lead qualification tool. By enabling it, you agree to:</p>
            <BulletList items={[
               'Take full responsibility for all AI-generated outreach messages sent on your behalf',
               'Ensure all outreach complies with applicable anti-spam laws (CAN-SPAM Act, GDPR, POPIA, CASL)',
               'Not use the Growth Agent to target individuals who have opted out of marketing communications',
               'Review AI-generated content before enabling fully automated outreach at scale',
               'Maintain an accurate suppression/unsubscribe list and honor all opt-out requests',
            ]} />
            <InfoBox variant="warn">
               AlphaClone is not liable for the content of AI-generated outreach messages or for any regulatory penalties arising from your use of the Growth Agent. You are the sender of record for all messages.
            </InfoBox>
         </Section>

         <Section id="mcp-integration" title="8. Model Context Protocol (MCP) Integrations — Specific Terms">
            <Sub title="8.1 What MCP Integrations Are">
               <p>AlphaClone provides an optional Model Context Protocol (MCP) server that allows external AI agents — including but not limited to Anthropic Claude Desktop and Manus AI — to access and interact with your workspace data through a secure, authenticated, server-sent events (SSE) connection.</p>
            </Sub>
            <Sub title="8.2 User Responsibility for AI Agent Actions">
               <p>By connecting an external AI agent via MCP, you acknowledge and agree that:</p>
               <BulletList items={[
                  'You are solely responsible for all actions taken by the AI agent within your workspace, including client records created, tasks assigned, project statuses updated, and messages drafted',
                  'AlphaClone does not review, verify, or approve AI agent actions before they are executed',
                  'You must supervise and review all AI agent activity logs through the platform\'s activity feed',
                  'You will not use MCP integrations to process sensitive personal data beyond what is operationally necessary within your workspace',
               ]} />
            </Sub>
            <Sub title="8.3 Data Transfer to External AI Providers">
               <InfoBox variant="warn">
                  When you connect an external AI agent via MCP (e.g. Claude Desktop), your workspace data — including client names, project details, and task information — is transmitted to the AI agent running locally or on a third-party platform. AlphaClone does not control how that third-party AI provider stores or processes the data it receives.
               </InfoBox>
               <p className="mt-3">You are responsible for ensuring that your use of third-party AI agents complies with GDPR, POPIA, CCPA, and all applicable data protection legislation in your jurisdiction. Review the privacy policy of any AI provider you connect via MCP before activating the integration.</p>
            </Sub>
            <Sub title="8.4 Security Constraints">
               <p>AlphaClone's MCP server enforces the following technical restrictions to protect platform integrity:</p>
               <BulletList items={[
                  'DELETE operations are completely excluded — AI agents cannot permanently remove any records',
                  'Database schema changes (DDL) are completely excluded',
                  'Source code files and environment configurations are inaccessible',
                  'Payment gateway credentials and billing details are not exposed via MCP tools',
                  'All MCP tool queries are scoped to the authenticated tenant\'s workspace only (Row Level Security enforced)',
               ]} />
            </Sub>
            <Sub title="8.5 Limitation of Liability for MCP Actions">
               <p>To the maximum extent permitted by law, AlphaClone disclaims all liability for: (a) any data processed or retained by third-party AI providers after being transmitted via MCP; (b) incorrect, hallucinated, or harmful actions taken by an AI agent within your workspace; (c) any business, financial, or reputational harm arising from automated AI agent actions. Your maximum remedy for any MCP-related issue is limited to the fees paid in the month the incident occurred.</p>
            </Sub>
         </Section>

         <Section id="data-portability" title="9. Data Portability & Export">
            <p>You may export your AlphaClone data at any time in structured formats (CSV, JSON, PDF) from the relevant sections of the Platform. Upon account deletion, you may request a full data export within the 90-day retention window. After this window, data cannot be recovered.</p>
         </Section>

         <Section id="uptime" title="10. Service Availability & SLA">
            <Sub title="9.1 Uptime Target">
               <p>AlphaClone targets 99.9% monthly uptime for core platform features. Scheduled maintenance will be announced at least 48 hours in advance via email and the platform dashboard. Emergency maintenance may occur without advance notice.</p>
            </Sub>
            <Sub title="9.2 Service Credits">
               <p>If monthly uptime falls below 99.5%, you may request a service credit equal to a pro-rated refund for the downtime period. Credits must be requested within 30 days of the incident. Credits are the sole remedy for service availability issues.</p>
            </Sub>
         </Section>

         <Section id="limitation" title="11. Limitation of Liability">
            <p>To the maximum extent permitted by applicable law, AlphaClone's total liability for any claim arising out of or relating to these Terms or the Platform shall not exceed the total fees you paid in the three (3) months immediately preceding the event giving rise to the claim.</p>
            <p>AlphaClone is not liable for: indirect, incidental, special, consequential, or punitive damages; loss of revenue, profit, or business opportunity; data loss caused by your own actions; third-party service failures (Google, Stripe, Calendly, etc.); or force majeure events.</p>
         </Section>

         <Section id="termination" title="12. Termination">
            <p>Either party may terminate the relationship at any time. You may cancel your subscription as described in Section 4.5. AlphaClone may suspend or terminate your account immediately if: (a) you breach these Terms; (b) you engage in fraudulent or illegal activity; (c) required by law; or (d) continued operation poses a security risk. Upon termination, access to the Platform ceases immediately, and data deletion follows the retention policy in Section 8 of our Privacy Policy.</p>
         </Section>

         <Section id="governing-law" title="13. Governing Law & Disputes">
            <p>These Terms are governed by the laws of South Africa. Any dispute arising from these Terms shall first be subject to good-faith negotiation between the parties. If unresolved within 30 days, disputes shall be submitted to binding arbitration in accordance with the Arbitration Foundation of Southern Africa (AFSA) rules before any court proceedings commence. Nothing in this clause prevents either party from seeking urgent or interim injunctive relief from a competent court.</p>
         </Section>

         <Section id="changes-terms" title="14. Changes to Terms">
            <p>AlphaClone reserves the right to modify these Terms at any time. Material changes will be communicated by email and in-platform notification at least 14 days before they take effect. Your continued use of the Platform after the effective date constitutes your acceptance of the updated Terms.</p>
         </Section>

         <Section id="contact-legal" title="15. Contact">
            <p>For legal enquiries, contract disputes, or formal notices:</p>
            <p><strong className="text-white">Email:</strong> <a href="mailto:legal@alphaclone.tech" className="text-teal-400 hover:underline">legal@alphaclone.tech</a></p>
         </Section>
      </LegalLayout>
   );
}

// ---------------------------------------------------------------------------
// COOKIE POLICY
// ---------------------------------------------------------------------------
const cookieCategories = [
   {
      name: 'Strictly Necessary',
      required: true,
      color: 'teal',
      icon: Lock,
      desc: 'These cookies are essential for the platform to function. They handle authentication, session management, CSRF protection, and security features. You cannot disable these cookies — without them, the platform cannot operate.',
      cookies: [
         { name: 'sb-[project]-auth-token', purpose: 'Supabase authentication session token. Keeps you logged in.', duration: 'Session / 1 year (refreshed)', party: 'First party' },
         { name: 'sb-[project]-auth-token.0 / .1', purpose: 'Chunked auth token for large session payloads.', duration: 'Session', party: 'First party' },
         { name: 'next-auth.csrf-token', purpose: 'CSRF protection for form submissions.', duration: 'Session', party: 'First party' },
         { name: 'cookieConsent', purpose: 'Stores your cookie consent preferences to avoid re-prompting.', duration: '1 year', party: 'First party' },
      ]
   },
   {
      name: 'Analytics & Performance',
      required: false,
      color: 'blue',
      icon: Eye,
      desc: 'These cookies help us understand how users interact with the platform. Data is anonymized and aggregated — we cannot identify individual users from analytics data. We use this to improve the platform experience.',
      cookies: [
         { name: '_ga, _ga_[ID]', purpose: 'Google Analytics — tracks page views and navigation patterns (anonymized).', duration: '2 years', party: 'Google LLC' },
         { name: '_vercel_*', purpose: 'Vercel analytics for page performance measurement.', duration: 'Session', party: 'Vercel, Inc.' },
         { name: 'ac_webvitals', purpose: 'AlphaClone Core Web Vitals monitoring — measures LCP, CLS, INP.', duration: 'Session', party: 'First party' },
      ]
   },
   {
      name: 'Functional',
      required: false,
      color: 'indigo',
      icon: Database,
      desc: 'Functional cookies remember your preferences to enhance your experience — such as your selected language, sidebar state, theme preference, and dashboard layout settings.',
      cookies: [
         { name: 'ac_sidebar_state', purpose: 'Remembers whether your dashboard sidebar is expanded or collapsed.', duration: '1 year', party: 'First party' },
         { name: 'ac_theme', purpose: 'Stores your color theme preference.', duration: '1 year', party: 'First party' },
         { name: 'ac_timezone', purpose: 'Caches your detected timezone to display correct meeting times.', duration: '30 days', party: 'First party' },
         { name: 'ac_onboarding_step', purpose: 'Tracks onboarding wizard progress so you can resume where you left off.', duration: '7 days', party: 'First party' },
      ]
   },
   {
      name: 'Marketing',
      required: false,
      color: 'violet',
      icon: ExternalLink,
      desc: 'Marketing cookies track your activity across websites to help us deliver relevant advertising. We currently use these sparingly — only for retargeting visitors who did not complete registration.',
      cookies: [
         { name: '_fbp', purpose: 'Facebook Pixel — tracks conversions for Facebook/Instagram ad campaigns.', duration: '3 months', party: 'Meta Platforms, Inc.' },
         { name: 'li_sugr, AnalyticsSyncHistory', purpose: 'LinkedIn Insight Tag — measures ad campaign effectiveness.', duration: '1 month', party: 'LinkedIn Corporation' },
      ]
   },
];

function CookieCategoryTable({ cookies }: { cookies: typeof cookieCategories[0]['cookies'] }) {
   return (
      <div className="mt-3 overflow-x-auto">
         <table className="w-full text-xs border-collapse">
            <thead>
               <tr className="border-b border-slate-700/50">
                  <th className="text-left py-2 pr-3 text-slate-400 font-semibold w-1/3">Cookie Name</th>
                  <th className="text-left py-2 pr-3 text-slate-400 font-semibold">Purpose</th>
                  <th className="text-left py-2 pr-3 text-slate-400 font-semibold w-24">Duration</th>
                  <th className="text-left py-2 text-slate-400 font-semibold w-28">Provider</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
               {cookies.map((c, i) => (
                  <tr key={i}>
                     <td className="py-2 pr-3 font-mono text-teal-400 text-[10px]">{c.name}</td>
                     <td className="py-2 pr-3 text-slate-400">{c.purpose}</td>
                     <td className="py-2 pr-3 text-slate-500">{c.duration}</td>
                     <td className="py-2 text-slate-500">{c.party}</td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
   );
}

export function CookiePolicy() {
   const [expanded, setExpanded] = useState<number | null>(null);

   return (
      <LegalLayout
         title="Cookie Policy"
         subtitle="This Cookie Policy explains what cookies are, which cookies AlphaClone uses, why, and how to control them."
         lastUpdated="February 25, 2026"
         icon={Cookie}
         color="amber"
      >
         <InfoBox>
            You can update your cookie preferences at any time by clicking the <strong>"Cookie Preferences"</strong> button at the bottom of any page, or from your Account Settings → Privacy → Cookie Preferences.
         </InfoBox>

         <Section id="what-are-cookies" title="1. What Are Cookies?">
            <p>Cookies are small text files that websites place on your device when you visit them. They are widely used to make websites work correctly, to store your preferences, and to help website owners understand how their site is being used.</p>
            <p>Cookies set by AlphaClone ("first-party cookies") are only readable by us. Some features use cookies set by third-party service providers (Google, Stripe, Vercel) which those providers can also read.</p>
            <p>Cookies can be "session cookies" (deleted when you close your browser) or "persistent cookies" (remain on your device for a set period or until you delete them).</p>
         </Section>

         <Section id="how-we-use" title="2. How We Use Cookies">
            <p>AlphaClone uses cookies for the following purposes:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
               {cookieCategories.map((cat, i) => (
                  <div key={i} className={`p-3 rounded-xl bg-${cat.color}-500/5 border border-${cat.color}-500/15 text-center`}>
                     <cat.icon className={`w-4 h-4 text-${cat.color}-400 mx-auto mb-2`} />
                     <p className={`text-${cat.color}-300 text-xs font-semibold`}>{cat.name}</p>
                     {cat.required && <p className="text-[10px] text-slate-500 mt-1">Always Active</p>}
                  </div>
               ))}
            </div>
         </Section>

         <Section id="cookie-details" title="3. Cookie Details by Category">
            <p>Below is a full list of all cookies used by AlphaClone, organized by category. Click each category to expand the full cookie table.</p>
            <div className="mt-6 space-y-4">
               {cookieCategories.map((cat, i) => (
                  <div key={i} className="rounded-2xl border border-slate-800 overflow-hidden">
                     <button
                        onClick={() => setExpanded(expanded === i ? null : i)}
                        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-900/50 transition-colors"
                     >
                        <div className="flex items-center gap-3">
                           <cat.icon className={`w-5 h-5 text-${cat.color}-400`} />
                           <div>
                              <div className="flex items-center gap-2">
                                 <span className="text-white font-semibold text-sm">{cat.name}</span>
                                 {cat.required && (
                                    <span className="text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full px-2 py-0.5">Always Active</span>
                                 )}
                              </div>
                              <p className="text-slate-500 text-xs mt-0.5">{cat.cookies.length} cookie{cat.cookies.length > 1 ? 's' : ''}</p>
                           </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded === i ? 'rotate-180' : ''}`} />
                     </button>
                     {expanded === i && (
                        <div className="px-5 pb-5 border-t border-slate-800/50">
                           <p className="text-slate-400 text-xs mt-4 mb-4 leading-relaxed">{cat.desc}</p>
                           <CookieCategoryTable cookies={cat.cookies} />
                        </div>
                     )}
                  </div>
               ))}
            </div>
         </Section>

         <Section id="manage-cookies" title="4. Managing Your Cookie Preferences">
            <Sub title="4.1 AlphaClone Cookie Preference Center">
               <p>The easiest way to manage your cookie preferences is through the AlphaClone Cookie Preference Center. You can access it by clicking "Cookie Preferences" in the footer of any page or from Settings → Privacy → Cookie Preferences. You can enable or disable each non-essential category individually.</p>
            </Sub>
            <Sub title="4.2 Browser Settings">
               <p>You can also control cookies through your browser settings. Most browsers allow you to: view and delete existing cookies, block all or specific cookies, receive a warning before a cookie is set. Note that blocking strictly necessary cookies will prevent the platform from functioning correctly.</p>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                  {[
                     { name: 'Chrome', url: 'https://support.google.com/chrome/answer/95647' },
                     { name: 'Firefox', url: 'https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop' },
                     { name: 'Safari', url: 'https://support.apple.com/guide/safari/manage-cookies-sfri11471' },
                     { name: 'Edge', url: 'https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09' },
                     { name: 'Brave', url: 'https://support.brave.com/hc/en-us/articles/360022806212-How-do-I-use-Shields-while-browsing' },
                  ].map((b, i) => (
                     <a key={i} href={b.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-teal-400 hover:underline p-2 bg-white/[0.04] backdrop-blur-sm rounded-lg border border-slate-800">
                        {b.name} Settings <ExternalLink className="w-3 h-3" />
                     </a>
                  ))}
               </div>
            </Sub>
            <Sub title="4.3 Opt-Out of Analytics">
               <p>You can opt out of Google Analytics tracking across all websites using the <a href="https://tools.google.com/dlpage/gaoptout" className="text-teal-400 hover:underline" target="_blank" rel="noreferrer">Google Analytics Opt-out Browser Add-on</a>.</p>
            </Sub>
         </Section>

         <Section id="third-party" title="5. Third-Party Service Cookies">
            <p>Some AlphaClone Platform features embed or interact with third-party services that set their own cookies. These third parties have their own privacy policies independent of ours:</p>
            <BulletList items={[
               'Google (Gmail integration, Analytics, OAuth) — google.com/privacy',
               'Stripe (payment processing) — stripe.com/privacy',
               'Vercel (hosting infrastructure) — vercel.com/legal/privacy-policy',
               'Meta/Facebook (advertising, only if marketing cookies enabled) — facebook.com/policy',
               'LinkedIn (advertising, only if marketing cookies enabled) — linkedin.com/legal/privacy-policy',
            ]} />
         </Section>

         <Section id="updates-cookie" title="6. Changes to This Cookie Policy">
            <p>We may update this Cookie Policy when we add new features, integrate new third-party services, or when applicable law changes. We will notify you of material changes via email and in-platform notification. The "Last updated" date at the top of this page reflects the most recent revision.</p>
         </Section>

         <Section id="contact-cookie" title="7. Contact">
            <p>Cookie-related enquiries: <a href="mailto:privacy@alphaclone.tech" className="text-teal-400 hover:underline">privacy@alphaclone.tech</a></p>
         </Section>
      </LegalLayout>
   );
}

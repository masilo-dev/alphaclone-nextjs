'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Shield, FileText, Cookie, ChevronDown, ChevronRight, ExternalLink, Mail, Lock, Eye, Database, AlertTriangle, Clock, Users } from 'lucide-react';
import MarketingShell from '@/components/marketing/system/MarketingShell';
import { COMPANY_LEGAL, formatLegalAddress } from '@/lib/seo/siteEntity';

// ---------------------------------------------------------------------------
// Shared Layout
// ---------------------------------------------------------------------------
function LegalLayout({
   title,
   subtitle,
   lastUpdated,
   children,
   icon: Icon,
}: {
   title: string;
   subtitle: string;
   lastUpdated: string;
   children: React.ReactNode;
   icon: React.ElementType;
   color?: string;
}) {
   return (
      <MarketingShell>
         <div className="max-w-4xl mx-auto px-4 py-16">
            <div className="flex items-center gap-3 mb-4">
               <div className="mkt-icon-wrap">
                  <Icon className="w-5 h-5" aria-hidden="true" />
               </div>
               <span className="text-[var(--marketing-accent-hover)] text-sm font-semibold tracking-wide">Legal</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--marketing-text-primary)] mb-3">{title}</h1>
            <p className="text-[var(--marketing-text-secondary)] mb-2">{subtitle}</p>
            <div className="flex flex-wrap gap-4 mb-12 pb-8 border-b border-[var(--marketing-border)]">
               <span className="text-xs text-[var(--marketing-text-muted)]">Last updated: {lastUpdated}</span>
               <span className="text-xs text-[var(--marketing-text-muted)]">•</span>
               <span className="text-xs text-[var(--marketing-text-muted)]">{COMPANY_LEGAL.legalName}</span>
               <span className="text-xs text-[var(--marketing-text-muted)]">•</span>
               <a href="mailto:legal@alphaclonesystems.com" className="text-xs text-[var(--marketing-accent-hover)] hover:underline flex items-center gap-1">
                  <Mail className="w-3 h-3" aria-hidden="true" /> legal@alphaclonesystems.com
               </a>
            </div>
            <div className="prose-legal space-y-12">
               {children}
            </div>
            <div className="mt-16 pt-8 border-t border-[var(--marketing-border)] flex flex-wrap gap-4 text-xs text-[var(--marketing-text-muted)]">
               <Link href="/privacy-policy" className="hover:text-[var(--marketing-accent-hover)] transition-colors">Privacy Policy</Link>
               <Link href="/terms-of-service" className="hover:text-[var(--marketing-accent-hover)] transition-colors">Terms of Service</Link>
               <Link href="/cookie-policy" className="hover:text-[var(--marketing-accent-hover)] transition-colors">Cookie Policy</Link>
               <a href="mailto:legal@alphaclonesystems.com" className="hover:text-[var(--marketing-accent-hover)] transition-colors">Contact Legal</a>
            </div>
         </div>
      </MarketingShell>
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
               <p><strong className="text-white">{COMPANY_LEGAL.legalName}</strong></p>
               <p className="text-slate-300">{formatLegalAddress()}</p>
               <p className="text-slate-400">{COMPANY_LEGAL.jurisdiction} · Filing ID {COMPANY_LEGAL.filingId}</p>
               <p>Email: <a href="mailto:legal@alphaclonesystems.com" className="text-teal-400 hover:underline">legal@alphaclonesystems.com</a></p>
               <p>Data Protection Officer (DPO): <a href="mailto:privacy@alphaclonesystems.com" className="text-teal-400 hover:underline">privacy@alphaclonesystems.com</a></p>
               <p>Website: <a href="https://alphaclonesystems.com" className="text-teal-400 hover:underline">https://alphaclonesystems.com</a></p>
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
            <div className="mt-4 overflow-x-auto min-w-0">
               <table className="w-full min-w-[480px] text-xs border-collapse">
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
                        { p: 'Cloudflare, Inc. (US)', pu: 'Bot protection & security (Turnstile)', d: 'IP address, browser metadata, telemetry' },
                        { p: 'Railway Corp. (US)', pu: 'Application hosting & CDN', d: 'IP address, request metadata' },
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

         <Section id="your-rights" title="7. Your Rights (GDPR, POPIA, CCPA)">
            <p>Depending on your jurisdiction, you have the following rights regarding your personal data. To exercise any of these rights, email <a href="mailto:privacy@alphaclonesystems.com" className="text-teal-400 hover:underline">privacy@alphaclonesystems.com</a>. We will respond within 30 days.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 mb-6">
               {[
                  { right: 'Right of Access / Right to Know', desc: 'Request a copy of all personal data we hold about you (GDPR, CCPA).' },
                  { right: 'Right to Rectification', desc: 'Request correction of inaccurate or incomplete data.' },
                  { right: 'Right to Erasure / Right to Delete', desc: 'Request deletion of your data ("right to be forgotten").' },
                  { right: 'Right to Portability', desc: 'Receive your data in a structured, machine-readable format.' },
                  { right: 'Right to Restrict Processing', desc: 'Request that we limit processing of your data in certain circumstances.' },
                  { right: 'Right to Object', desc: 'Object to processing based on legitimate interests or for direct marketing.' },
                  { right: 'Right to Opt-Out of Sale or Sharing', desc: 'California residents can opt out of the sale or sharing of their personal information (CCPA). AlphaClone does not sell personal data.' },
                  { right: 'Right to Non-Discrimination', desc: 'You will not receive discriminatory treatment for exercising your privacy rights (CCPA).' },
               ].map((item, i) => (
                  <div key={i} className="p-3 bg-white/[0.04] backdrop-blur-sm rounded-lg border border-slate-800">
                     <p className="text-white font-semibold text-xs mb-1">{item.right}</p>
                     <p className="text-slate-500 text-xs">{item.desc}</p>
                  </div>
               ))}
            </div>
         </Section>

         <Section id="security" title="8. Security Measures & Data Breach Notification">
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
            <div className="mt-4 p-4 border border-teal-500/20 bg-teal-500/5 rounded-xl">
               <h4 className="text-teal-300 text-sm font-semibold mb-2">Data Breach Notification Policy</h4>
               <p className="text-slate-400 text-xs leading-relaxed">
                  In the event of a security breach that poses a high risk to the rights and freedoms of individuals (e.g., unauthorized access to unencrypted personal data), AlphaClone Systems will notify all affected users and relevant supervisory authorities without undue delay, and in any event within 72 hours of becoming aware of the breach. Notifications will include the nature of the breach, potential consequences, and the mitigation measures taken.
               </p>
            </div>
         </Section>

         <Section id="cookies" title="9. Cookies">
            <p>We use cookies and similar tracking technologies. Our Cookie Policy (linked below) provides full details on all cookies used, their purposes, and how to manage your preferences. You may update your cookie preferences at any time using the cookie preference center accessible from the bottom of any page.</p>
            <p><Link href="/cookie-policy" className="text-teal-400 hover:underline">→ Read the Full Cookie Policy</Link></p>
         </Section>

         <Section id="children" title="10. Children's Privacy">
            <p>The AlphaClone Business OS is intended for use by businesses and professionals aged 18 and over. We do not knowingly collect personal data from anyone under 18. If you believe a minor has provided us with personal data, contact us at <a href="mailto:privacy@alphaclonesystems.com" className="text-teal-400 hover:underline">privacy@alphaclonesystems.com</a> and we will delete the data immediately.</p>
         </Section>

         <Section id="changes" title="11. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. When we make material changes, we will notify you via email and display a notice in the platform dashboard at least 14 days before the changes take effect. Continued use of the platform after the effective date constitutes acceptance of the updated policy. The "Last updated" date at the top of this page reflects the most recent revision.</p>
         </Section>

         <Section id="contact" title="12. Contact Us">
            <p>For privacy-related enquiries, data subject rights requests, or complaints:</p>
            <div className="p-4 bg-white/[0.04] backdrop-blur-sm rounded-xl border border-slate-800 text-sm mt-3">
               <p><strong className="text-white">Privacy & Data Protection:</strong> <a href="mailto:privacy@alphaclonesystems.com" className="text-teal-400 hover:underline">privacy@alphaclonesystems.com</a></p>
               <p><strong className="text-white">Legal Department:</strong> <a href="mailto:legal@alphaclonesystems.com" className="text-teal-400 hover:underline">legal@alphaclonesystems.com</a></p>
               <p><strong className="text-white">General Support:</strong> <a href="mailto:support@alphaclonesystems.com" className="text-teal-400 hover:underline">support@alphaclonesystems.com</a></p>
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
            <p>By accessing or using the AlphaClone Business OS platform at <a href="https://alphaclonesystems.com" className="text-teal-400 hover:underline">alphaclonesystems.com</a> or any associated mobile or desktop applications ("Platform"), you agree to be bound by these Terms of Service ("Terms"), our Privacy Policy, and Cookie Policy. If you are using the Platform on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.</p>
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
               <p>You are solely responsible for all activity that occurs under your account. You must: choose a strong password, keep your credentials confidential, notify us immediately at <a href="mailto:security@alphaclonesystems.com" className="text-teal-400 hover:underline">security@alphaclonesystems.com</a> of any unauthorized access or security breach, and not share your account with unauthorized third parties.</p>
            </Sub>
            <Sub title="3.2 Team Members">
               <p>Subscription plans allow you to invite team members. You are responsible for all actions taken by your team members within your workspace. Each team member must individually agree to these Terms. You may revoke team member access at any time from Settings → Team Management.</p>
            </Sub>
         </Section>

         <Section id="subscription" title="4. Subscription Plans & Billing">
            <Sub title="4.1 Plans">
               <p>AlphaClone offers the following subscription tiers, all of which include every platform module. Differences between tiers are usage quotas and support levels only: Starter ($15/month — up to 25 users, 50 active projects, 25GB storage, 25 video meetings/month, approximately 2,500 daily AI usage units, standard email support); Pro ($45/month — unlimited users and projects, 100GB storage, unlimited video meetings, the Bonnie AI sales assistant, API access, custom domain, approximately 100,000 daily AI usage units, priority support); Enterprise ($80/month — unlimited users and projects, 500GB storage, advanced AI features, approximately 500,000 daily AI usage units, priority infrastructure and SLA support). Annual billing is available at a discount (Starter $144/yr, Pro $432/yr, Enterprise $768/yr). All plans include a 14-day free trial; no credit card required to begin.</p>
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
               <p>The AlphaClone Platform, including its software, design, trademarks, logos, documentation, and all associated intellectual property, is owned by Alphaclone Systems, LLC and is protected by copyright, trademark, and other applicable laws. You may not use our trademarks or branding without prior written consent.</p>
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
            <Sub title="10.1 Uptime Target">
               <p>AlphaClone targets 99.9% monthly uptime for core platform features. Scheduled maintenance will be announced at least 48 hours in advance via email and the platform dashboard. Emergency maintenance may occur without advance notice.</p>
            </Sub>
            <Sub title="10.2 Service Credits">
               <p>If monthly uptime falls below 99.5%, you may request a service credit equal to a pro-rated refund for the downtime period. Credits must be requested within 30 days of the incident. Credits are the sole remedy for service availability issues.</p>
            </Sub>
         </Section>

         <Section id="warranties" title="11. Disclaimer of Warranties (AS IS)">
            <p>The Platform is provided on an "AS IS" and "AS AVAILABLE" basis. To the maximum extent permitted by law, AlphaClone expressly disclaims all warranties, whether express, implied, statutory, or otherwise, including but not limited to the implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that the Platform will be uninterrupted, error-free, completely secure, or free of viruses or other harmful components.</p>
         </Section>

         <Section id="limitation" title="12. Limitation of Liability">
            <p>To the maximum extent permitted by applicable law, AlphaClone's total liability for any claim arising out of or relating to these Terms or the Platform shall not exceed the total fees you paid in the three (3) months immediately preceding the event giving rise to the claim.</p>
            <p>AlphaClone is not liable for: indirect, incidental, special, consequential, or punitive damages; loss of revenue, profit, or business opportunity; data loss caused by your own actions; third-party service failures (Google, Stripe, Calendly, etc.); or any events beyond our reasonable control.</p>
         </Section>

         <Section id="indemnification" title="13. Indemnification">
            <p>You agree to indemnify, defend, and hold harmless AlphaClone Systems, its officers, directors, employees, and affiliates, from and against any and all claims, liabilities, damages, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising from: (a) your use of or access to the Platform; (b) your violation of these Terms or the Acceptable Use Policy; (c) any AI-generated content or outreach sent from your account; or (d) your violation of any applicable law or third-party right.</p>
         </Section>

         <Section id="termination" title="14. Termination">
            <p>Either party may terminate the relationship at any time. You may cancel your subscription as described in Section 4.5. AlphaClone may suspend or terminate your account immediately if: (a) you breach these Terms; (b) you engage in fraudulent or illegal activity; (c) required by law; or (d) continued operation poses a security risk. Upon termination, access to the Platform ceases immediately, and data deletion follows the retention policy in our Privacy Policy.</p>
         </Section>

         <Section id="governing-law" title="15. Governing Law, Arbitration, & Class Action Waiver">
            <p>These Terms are governed by the laws of the State of Wyoming, USA. Any dispute arising from these Terms shall first be subject to good-faith negotiation between the parties. If unresolved within 30 days, disputes shall be submitted to binding arbitration in accordance with the American Arbitration Association (AAA) rules before any court proceedings commence.</p>
            <p className="mt-2 font-semibold">Class Action Waiver:</p>
            <p>You agree that any arbitration or legal proceeding shall be conducted in your individual capacity only, and not as a class action or other representative action. You expressly waive your right to file a class action or seek relief on a class basis.</p>
         </Section>
         
         <Section id="force-majeure" title="16. Force Majeure">
            <p>AlphaClone shall not be liable for any failure or delay in performance due to circumstances beyond our reasonable control, including but not limited to acts of God, natural disasters, war, terrorism, civil unrest, labor disputes, internet service provider failures or delays, or governmental action.</p>
         </Section>

         <Section id="changes-terms" title="17. Changes to Terms">
            <p>AlphaClone reserves the right to modify these Terms at any time. Material changes will be communicated by email and in-platform notification at least 14 days before they take effect. Your continued use of the Platform after the effective date constitutes your acceptance of the updated Terms.</p>
         </Section>

         <Section id="contact-legal" title="18. Contact">
            <p>For legal enquiries, contract disputes, or formal notices:</p>
            <p><strong className="text-white">Email:</strong> <a href="mailto:legal@alphaclonesystems.com" className="text-teal-400 hover:underline">legal@alphaclonesystems.com</a></p>
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
         { name: 'cf_clearance, cf_bm', purpose: 'Cloudflare Turnstile security tokens. Protects forms from bots and spam.', duration: 'Session / 1 year', party: 'Cloudflare, Inc.' },
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
      <div className="mt-3 overflow-x-auto min-w-0">
         <table className="w-full min-w-[520px] text-xs border-collapse">
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
                     <td className="py-2 pr-3 font-mono text-teal-400 text-xs">{c.name}</td>
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
            <p>Cookies set by AlphaClone ("first-party cookies") are only readable by us. Some features use cookies set by third-party service providers (Google, Stripe) which those providers can also read.</p>
            <p>Cookies can be "session cookies" (deleted when you close your browser) or "persistent cookies" (remain on your device for a set period or until you delete them).</p>
         </Section>

         <Section id="how-we-use" title="2. How We Use Cookies">
            <p>AlphaClone uses cookies for the following purposes:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
               {cookieCategories.map((cat, i) => (
                  <div key={i} className={`p-3 rounded-xl bg-${cat.color}-500/5 border border-${cat.color}-500/15 text-center`}>
                     <cat.icon className={`w-4 h-4 text-${cat.color}-400 mx-auto mb-2`} />
                     <p className={`text-${cat.color}-300 text-xs font-semibold`}>{cat.name}</p>
                     {cat.required && <p className="text-xs text-slate-500 mt-1">Always Active</p>}
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
                                    <span className="text-xs bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full px-2 py-0.5">Always Active</span>
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
               'Railway (hosting infrastructure) — railway.com/legal/privacy',
               'Meta/Facebook (advertising, only if marketing cookies enabled) — facebook.com/policy',
               'LinkedIn (advertising, only if marketing cookies enabled) — linkedin.com/legal/privacy-policy',
            ]} />
         </Section>

         <Section id="updates-cookie" title="6. Changes to This Cookie Policy">
            <p>We may update this Cookie Policy when we add new features, integrate new third-party services, or when applicable law changes. We will notify you of material changes via email and in-platform notification. The "Last updated" date at the top of this page reflects the most recent revision.</p>
         </Section>

         <Section id="contact-cookie" title="7. Contact">
            <p>Cookie-related enquiries: <a href="mailto:privacy@alphaclonesystems.com" className="text-teal-400 hover:underline">privacy@alphaclonesystems.com</a></p>
         </Section>
      </LegalLayout>
   );
}

export function SLA() {
    return (
        <LegalLayout
            title="Service Level Agreement (SLA)"
            subtitle="Our uptime commitment, support response targets, and service credit terms for AlphaClone Business OS customers."
            lastUpdated="June 2, 2026"
            icon={Clock}
            color="indigo"
        >
            <InfoBox>
                <strong>Plain language summary:</strong> We target 99.9% monthly uptime. If we fall below 99.5%, you can claim a service credit. Support response times depend on your plan tier. Credits are the sole remedy for availability failures.
            </InfoBox>

            <Section id="uptime-commitment" title="1. Uptime Commitment">
                <p>AlphaClone Systems ("AlphaClone") commits to a monthly uptime target of <strong className="text-white">99.9%</strong> for all core platform services, including:</p>
                <BulletList items={[
                    'Dashboard and user-facing application (alphaclonesystems.com/dashboard)',
                    'CRM, invoicing, contract, and project modules',
                    'REST API and MCP endpoints',
                    'Authentication and account management services',
                    'Email delivery (transactional) via our platform',
                ]} />
                <p className="mt-3">Monthly uptime percentage is calculated as: <span className="text-white font-mono text-xs">((total minutes in month − downtime minutes) / total minutes in month) × 100</span>. Scheduled maintenance windows do not count as downtime if announced ≥48 hours in advance.</p>
            </Section>

            <Section id="definitions" title="2. Definitions">
                <div className="space-y-3">
                    {[
                        { term: 'Downtime', def: 'A period during which the platform is completely inaccessible to all users due to a fault within AlphaClone\'s infrastructure. Partial degradation (slow performance, one feature unavailable) does not constitute downtime.' },
                        { term: 'Scheduled Maintenance', def: 'Planned maintenance communicated via email and in-platform notice at least 48 hours in advance. Scheduled maintenance does not count toward downtime calculations.' },
                        { term: 'Emergency Maintenance', def: 'Unplanned maintenance required to protect platform security or stability. AlphaClone will provide as much advance notice as practicable. Emergency maintenance counts as downtime if it exceeds 30 minutes.' },
                        { term: 'Service Credit', def: 'A pro-rated credit applied to your next billing cycle as a remedy for verified downtime exceeding the SLA threshold. Credits are non-transferable and have no cash value.' },
                    ].map((item, i) => (
                        <div key={i} className="p-4 bg-white/[0.04] rounded-xl border border-slate-800">
                            <p className="text-white font-semibold text-xs mb-1">{item.term}</p>
                            <p className="text-slate-400 text-xs">{item.def}</p>
                        </div>
                    ))}
                </div>
            </Section>

            <Section id="support-tiers" title="3. Support Response Times">
                <p>Support response times are measured from the time a ticket is received during business hours (09:00–18:00 UTC, Monday–Friday), unless otherwise stated for your plan tier.</p>
                <div className="mt-4 overflow-x-auto min-w-0">
                    <table className="w-full min-w-[480px] text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left py-2 pr-4 text-slate-300 font-semibold">Priority</th>
                                <th className="text-left py-2 pr-4 text-slate-300 font-semibold">Condition</th>
                                <th className="text-left py-2 pr-4 text-slate-300 font-semibold">Starter</th>
                                <th className="text-left py-2 pr-4 text-slate-300 font-semibold">Pro</th>
                                <th className="text-left py-2 text-slate-300 font-semibold">Enterprise</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {[
                                { p: 'P0 — Critical', c: 'Platform completely inaccessible', s: '48h', pro: '12h', ent: '4h' },
                                { p: 'P1 — High', c: 'Core feature broken, no workaround', s: '72h', pro: '24h', ent: '8h' },
                                { p: 'P2 — Normal', c: 'Feature degraded, workaround exists', s: '5 days', pro: '48h', ent: '24h' },
                                { p: 'P3 — Low', c: 'General question or feature request', s: '7 days', pro: '5 days', ent: '48h' },
                            ].map((row, i) => (
                                <tr key={i}>
                                    <td className="py-2 pr-4 text-white font-semibold">{row.p}</td>
                                    <td className="py-2 pr-4 text-slate-400">{row.c}</td>
                                    <td className="py-2 pr-4 text-slate-400">{row.s}</td>
                                    <td className="py-2 pr-4 text-indigo-400">{row.pro}</td>
                                    <td className="py-2 text-teal-400">{row.ent}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="mt-4 text-xs text-slate-500">Response time = time to first meaningful response, not time to resolution. Resolution times vary by issue complexity.</p>
            </Section>

            <Section id="service-credits" title="4. Service Credits">
                <p>If monthly uptime falls below the thresholds below, you may request a service credit:</p>
                <div className="mt-4 overflow-x-auto min-w-0">
                    <table className="w-full min-w-[340px] text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left py-2 pr-4 text-slate-300 font-semibold">Monthly Uptime</th>
                                <th className="text-left py-2 text-slate-300 font-semibold">Credit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {[
                                { uptime: '99.0% – 99.5%', credit: '10% of monthly fee' },
                                { uptime: '95.0% – 98.9%', credit: '25% of monthly fee' },
                                { uptime: 'Below 95.0%', credit: '50% of monthly fee' },
                            ].map((row, i) => (
                                <tr key={i}>
                                    <td className="py-2 pr-4 text-white">{row.uptime}</td>
                                    <td className="py-2 text-indigo-400 font-semibold">{row.credit}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Sub title="How to Claim a Credit">
                    <p>Submit a credit request to <a href="mailto:support@alphaclonesystems.com" className="text-teal-400 hover:underline">support@alphaclonesystems.com</a> within <strong className="text-white">30 calendar days</strong> of the incident, with the subject line "SLA Credit Request — [Month Year]". Include your account email, approximate downtime window, and any error messages observed. Credits will be applied to the next billing cycle within 10 business days of verification.</p>
                </Sub>
            </Section>

            <Section id="exclusions" title="5. SLA Exclusions">
                <p>The uptime SLA does not apply to downtime caused by:</p>
                <BulletList items={[
                    'Scheduled maintenance windows announced ≥48 hours in advance',
                    'Actions taken by you or your team members (e.g., deleting data, misconfiguring integrations)',
                    'Third-party service failures outside AlphaClone\'s control (e.g., Supabase, Stripe, Cloudflare, Google)',
                    'Force majeure events (natural disasters, war, pandemics, internet infrastructure failures)',
                    'Accounts suspended for violation of the Terms of Service or non-payment',
                    'Issues arising from your use of unsupported browsers or unofficial API integrations',
                    'Free trial accounts (SLA applies only to paid subscriptions)',
                    'Beta features explicitly labeled as "experimental" or "preview"',
                ]} />
            </Section>

            <Section id="monitoring" title="6. Status &amp; Monitoring">
                <p>Real-time platform status is published at <a href="/platform-status" className="text-teal-400 hover:underline">/platform-status</a>. You can subscribe to status alerts by emailing <a href="mailto:support@alphaclonesystems.com" className="text-teal-400 hover:underline">support@alphaclonesystems.com</a> with "Status Alerts" in the subject line. Incident post-mortems for P0 events are published within 5 business days of resolution.</p>
            </Section>

            <Section id="contact-sla" title="7. Contact">
                <p>For SLA queries or credit claims: <a href="mailto:support@alphaclonesystems.com" className="text-teal-400 hover:underline">support@alphaclonesystems.com</a></p>
            </Section>
        </LegalLayout>
    );
}

export function DPA() {
    return (
        <LegalLayout
            title="Data Processing Agreement (DPA)"
            subtitle="This DPA governs AlphaClone's processing of personal data on behalf of business customers in compliance with GDPR, POPIA, and applicable data protection law."
            lastUpdated="June 2, 2026"
            icon={Users}
            color="blue"
        >
            <InfoBox>
                <strong>Who this applies to:</strong> This DPA applies to all paying AlphaClone customers who process personal data of their own customers, employees, or contacts through the AlphaClone platform. It forms part of and is incorporated into the AlphaClone Terms of Service.
            </InfoBox>

            <Section id="roles" title="1. Roles &amp; Responsibilities">
                <div className="space-y-3">
                    {[
                        { role: 'Customer (Data Controller)', def: 'The business or individual subscribing to AlphaClone. The Controller determines the purposes and means of processing personal data of their clients, contacts, and team members. The Controller is responsible for ensuring their instructions to AlphaClone are lawful.' },
                        { role: 'Alphaclone Systems, LLC (Data Processor)', def: 'AlphaClone processes personal data only on behalf of and according to the documented instructions of the Controller. AlphaClone acts as a Controller only for its own account administration data (billing, authentication).' },
                    ].map((item, i) => (
                        <div key={i} className="p-4 bg-white/[0.04] rounded-xl border border-slate-800">
                            <p className="text-white font-semibold text-xs mb-1">{item.role}</p>
                            <p className="text-slate-400 text-xs">{item.def}</p>
                        </div>
                    ))}
                </div>
            </Section>

            <Section id="processing-details" title="2. Processing Details">
                <div className="mt-3 overflow-x-auto min-w-0">
                    <table className="w-full min-w-[400px] text-xs border-collapse">
                        <tbody className="divide-y divide-slate-800/50">
                            {[
                                { k: 'Subject Matter', v: 'Operation of the AlphaClone Business OS on behalf of the Customer' },
                                { k: 'Duration', v: 'For the term of the subscription and post-termination retention period (90 days)' },
                                { k: 'Nature', v: 'Storage, retrieval, display, transmission, and deletion of personal data' },
                                { k: 'Purpose', v: 'To provide CRM, billing, contract, project management, and communication features to the Customer' },
                                { k: 'Categories of Data', v: 'Names, email addresses, phone numbers, company info, financial records, contract data, correspondence' },
                                { k: 'Data Subjects', v: "Customer's clients, leads, employees, team members, and contractors" },
                            ].map((row, i) => (
                                <tr key={i}>
                                    <td className="py-2 pr-4 text-slate-300 font-semibold w-1/3">{row.k}</td>
                                    <td className="py-2 text-slate-400">{row.v}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Section>

            <Section id="processor-obligations" title="3. AlphaClone's Obligations as Processor">
                <BulletList items={[
                    'Process personal data only on documented instructions from the Customer, including transfers to third countries',
                    'Ensure that all staff authorised to process personal data are bound by appropriate confidentiality obligations',
                    'Implement appropriate technical and organisational security measures (see Section 6 of our Privacy Policy)',
                    'Assist the Customer in responding to data subject rights requests (access, erasure, portability)',
                    'Assist the Customer in meeting GDPR obligations regarding security, breach notification, DPIAs, and prior consultation',
                    'Delete or return all personal data to the Customer on termination of the service, at the Customer\'s choice',
                    'Make available all information necessary to demonstrate compliance with this DPA',
                    'Notify the Customer without undue delay (and within 72 hours where possible) upon becoming aware of a personal data breach',
                ]} />
            </Section>

            <Section id="subprocessors" title="4. Sub-processors">
                <p>AlphaClone uses the following authorised sub-processors. All sub-processors are bound by data processing agreements no less protective than this DPA. The Customer grants general authorisation for AlphaClone to use these sub-processors.</p>
                <div className="mt-4 overflow-x-auto min-w-0">
                    <table className="w-full min-w-[520px] text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left py-2 pr-4 text-slate-300 font-semibold">Sub-processor</th>
                                <th className="text-left py-2 pr-4 text-slate-300 font-semibold">Purpose</th>
                                <th className="text-left py-2 pr-4 text-slate-300 font-semibold">Location</th>
                                <th className="text-left py-2 text-slate-300 font-semibold">Safeguard</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {[
                                { sp: 'Supabase, Inc.', pu: 'Database & authentication', loc: 'US (AWS us-east-1)', sg: 'SCCs + DPA' },
                                { sp: 'Stripe, Inc.', pu: 'Payment processing', loc: 'US', sg: 'SCCs + DPA' },
                                { sp: 'Cloudflare, Inc.', pu: 'CDN, DDoS, bot protection', loc: 'Global (US HQ)', sg: 'SCCs + DPA' },
                                { sp: 'Railway Corp.', pu: 'Application hosting', loc: 'US (AWS)', sg: 'SCCs + DPA' },
                                { sp: 'Resend / SendGrid', pu: 'Transactional email', loc: 'US', sg: 'SCCs + DPA' },
                                { sp: 'Sentry, Inc.', pu: 'Error monitoring', loc: 'US', sg: 'SCCs + DPA' },
                            ].map((row, i) => (
                                <tr key={i}>
                                    <td className="py-2 pr-4 text-white">{row.sp}</td>
                                    <td className="py-2 pr-4 text-slate-400">{row.pu}</td>
                                    <td className="py-2 pr-4 text-slate-400">{row.loc}</td>
                                    <td className="py-2 text-blue-400">{row.sg}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="mt-3 text-xs text-slate-500">AlphaClone will notify the Customer of any intended addition or replacement of sub-processors by updating this DPA and sending an email notification at least 14 days before the change takes effect. The Customer may object to a new sub-processor in writing within 14 days.</p>
            </Section>

            <Section id="transfers" title="5. International Data Transfers">
                <p>Where personal data is transferred from the EEA, UK, or Switzerland to countries not recognised as providing adequate protection (including the United States), AlphaClone relies on the following safeguards:</p>
                <BulletList items={[
                    'Standard Contractual Clauses (SCCs) — EU Commission Decision 2021/914, Module 2 (Controller to Processor)',
                    'UK International Data Transfer Addendum (IDTA) for transfers from the UK',
                    'Binding Corporate Rules where applicable',
                ]} />
                <p className="mt-3">Copies of the applicable SCCs are available on request from <a href="mailto:privacy@alphaclonesystems.com" className="text-teal-400 hover:underline">privacy@alphaclonesystems.com</a>.</p>
            </Section>

            <Section id="audit-rights" title="6. Audit Rights">
                <p>AlphaClone shall make available to the Customer all information reasonably necessary to demonstrate compliance with the obligations in this DPA. The Customer may conduct an audit (or commission a third-party auditor) of AlphaClone's data processing activities, subject to:</p>
                <BulletList items={[
                    'Giving at least 30 days\' written notice to legal@alphaclonesystems.com',
                    'Audits being conducted during normal business hours and no more than once per calendar year',
                    'The auditor executing a non-disclosure agreement acceptable to AlphaClone',
                    'The Customer bearing all costs of the audit',
                ]} />
            </Section>

            <Section id="breach-notification" title="7. Personal Data Breach Notification">
                <p>Upon becoming aware of a personal data breach affecting data processed under this DPA, AlphaClone will:</p>
                <BulletList items={[
                    'Notify the Customer without undue delay, and where feasible within 72 hours of becoming aware',
                    'Provide the Customer with: nature of the breach, categories and approximate number of data subjects affected, likely consequences, measures taken or proposed to address the breach',
                    'Assist the Customer in notifying the relevant supervisory authority and affected data subjects as required',
                ]} />
            </Section>

            <Section id="deletion" title="8. Data Deletion &amp; Return">
                <p>Upon termination or expiry of the subscription, AlphaClone will, at the Customer's election:</p>
                <BulletList items={[
                    'Return all personal data to the Customer in CSV/JSON format within 30 days of a written request',
                    'Securely delete all personal data within 90 days of account deletion',
                    'Provide written confirmation of deletion upon request',
                    'Backup snapshots containing personal data are purged within 30 days of account deletion',
                ]} />
            </Section>

            <Section id="contact-dpa" title="9. Contact &amp; DPA Requests">
                <p>To request a signed copy of this DPA, or for any data processing queries:</p>
                <div className="p-4 bg-white/[0.04] rounded-xl border border-slate-800 text-sm mt-3">
                    <p><strong className="text-white">Privacy &amp; DPA:</strong> <a href="mailto:privacy@alphaclonesystems.com" className="text-teal-400 hover:underline">privacy@alphaclonesystems.com</a></p>
                    <p><strong className="text-white">Legal:</strong> <a href="mailto:legal@alphaclonesystems.com" className="text-teal-400 hover:underline">legal@alphaclonesystems.com</a></p>
                </div>
            </Section>
        </LegalLayout>
    );
}

// ---------------------------------------------------------------------------
// PRIVACY CHOICES (CCPA / Do Not Sell)
// ---------------------------------------------------------------------------
export function PrivacyChoices() {
    return (
        <LegalLayout
            title="Your Privacy Choices"
            subtitle="Manage your California Consumer Privacy Act (CCPA) rights and control how your personal information is used."
            lastUpdated="June 2, 2026"
            icon={Shield}
            color="teal"
        >
            <InfoBox>
                <strong>AlphaClone does not sell your personal data.</strong> We do not sell, rent, or trade your personal information to third parties for monetary consideration. This page explains your rights under the CCPA and how to exercise them.
            </InfoBox>

            <Section id="ccpa-rights" title="1. Your California Privacy Rights">
                <p>If you are a California resident, the California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA) give you the following rights:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    {[
                        { right: 'Right to Know', desc: 'You have the right to know what personal information we collect, use, disclose, and sell (or share) about you.' },
                        { right: 'Right to Delete', desc: 'You have the right to request that we delete personal information we have collected from you, subject to certain exceptions.' },
                        { right: 'Right to Correct', desc: 'You have the right to request that we correct inaccurate personal information we maintain about you.' },
                        { right: 'Right to Opt Out of Sale/Sharing', desc: 'You have the right to opt out of the sale or sharing of your personal information. AlphaClone does not sell personal data.' },
                        { right: 'Right to Limit Use of Sensitive PI', desc: 'You have the right to limit our use and disclosure of your sensitive personal information to certain purposes.' },
                        { right: 'Right to Non-Discrimination', desc: 'We will not discriminate against you for exercising any of your CCPA rights.' },
                    ].map((item, i) => (
                        <div key={i} className="p-3 bg-white/[0.04] rounded-lg border border-slate-800">
                            <p className="text-white font-semibold text-xs mb-1">{item.right}</p>
                            <p className="text-slate-500 text-xs">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </Section>

            <Section id="do-not-sell" title="2. Do Not Sell or Share My Personal Information">
                <InfoBox>
                    AlphaClone Systems does not sell your personal information to third parties for money. We do not share your personal information with third parties for cross-context behavioural advertising. No opt-out action is required for the sale of personal data because we do not engage in this practice.
                </InfoBox>
                <p className="mt-3">We do share certain data with our service providers (Supabase, Stripe, Railway, Cloudflare, Resend) to operate our platform. These are service relationships governed by data processing agreements, not data sales. See our <a href="/privacy-policy#data-sharing" className="text-teal-400 hover:underline">Privacy Policy — Section 5</a> for the full list.</p>
                <p className="mt-3">If you believe we have incorrectly categorised any data sharing as non-sale, or if you wish to formally record an opt-out preference, contact us at the address below.</p>
            </Section>

            <Section id="sensitive-pi" title="3. Sensitive Personal Information">
                <p>AlphaClone does not collect or process sensitive personal information as defined by the CPRA (e.g., social security numbers, financial account credentials, precise geolocation, health data, biometric data) in the ordinary course of providing our service. If you believe sensitive data has been inadvertently collected, contact us immediately at <a href="mailto:privacy@alphaclonesystems.com" className="text-teal-400 hover:underline">privacy@alphaclonesystems.com</a>.</p>
            </Section>

            <Section id="exercise-rights" title="4. How to Exercise Your Rights">
                <p>To submit a CCPA rights request, you may:</p>
                <BulletList items={[
                    'Email: privacy@alphaclonesystems.com with subject "CCPA Rights Request"',
                    'For account deletion: use Settings → Account → Delete Account within the platform',
                    'For data export: use Settings → Data → Export My Data within the platform',
                ]} />
                <p className="mt-4">We will respond to verified requests within <strong className="text-white">45 calendar days</strong>. If we need more time, we will notify you and may extend the response period by an additional 45 days. To verify your identity, we will ask you to confirm your registered email address and may request additional information to protect your data from unauthorised access.</p>
                <p className="mt-3">You may designate an authorised agent to submit a request on your behalf. Authorised agents must provide written proof of their authorisation and you must verify your identity directly with us.</p>
            </Section>

            <Section id="shine-the-light" title="5. California Shine the Light (Civil Code § 1798.83)">
                <p>California Civil Code § 1798.83 permits California residents to request information about disclosure of personal information to third parties for direct marketing purposes. AlphaClone does not disclose personal information to third parties for their direct marketing purposes. Accordingly, no annual disclosure is required. To make a request, contact <a href="mailto:privacy@alphaclonesystems.com" className="text-teal-400 hover:underline">privacy@alphaclonesystems.com</a>.</p>
            </Section>

            <Section id="contact-privacy-choices" title="6. Contact">
                <div className="p-4 bg-white/[0.04] rounded-xl border border-slate-800 text-sm mt-3">
                    <p><strong className="text-white">Privacy Requests:</strong> <a href="mailto:privacy@alphaclonesystems.com" className="text-teal-400 hover:underline">privacy@alphaclonesystems.com</a></p>
                    <p><strong className="text-white">Subject line:</strong> CCPA Rights Request</p>
                    <p className="text-slate-500 text-xs mt-2">We respond within 45 days. No discrimination will result from exercising your rights.</p>
                </div>
            </Section>
        </LegalLayout>
    );
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileSignature,
  Mail,
  Megaphone,
  Play,
  Plug,
  ReceiptText,
  ShieldCheck,
  ClipboardCheck,
  Users,
  Workflow,
} from 'lucide-react';
import { SiBrevo, SiQuickbooks, SiStripe, SiZoho } from 'react-icons/si';
import { FaFacebook, FaInstagram, FaLinkedin, FaMicrosoft } from 'react-icons/fa6';
import { DEMO_HREF } from '@/lib/marketing/cta';
import { EXECUTION_LAYER } from '@/config/marketingPositioning';
import { useLanguage } from '@/contexts/LanguageContext';
import { PrimaryCTA, SecondaryCTA } from './CtaButtons';
import { MarketingContainer } from './LayoutPrimitives';
import MarketingShell from './MarketingShell';

const processes = [
  { title: 'Tell us what you want', body: 'Type your request in ChatGPT, Claude, Manus or Bonnie.', icon: Workflow },
  { title: 'Approve the plan', body: 'Review what will be done before anything runs.', icon: ShieldCheck },
  { title: 'AlphaClone executes', body: 'Approved work moves through the connected tools.', icon: Workflow },
  { title: 'Get verified results', body: 'See the outcome and activity record in the workspace.', icon: CheckCircle2 },
];

const outcomes = [
  { title: 'Win work', body: 'Capture leads, keep conversations attached and prepare the right follow-up.', icon: Users, href: '/crm', tone: 'blue' },
  { title: 'Run delivery', body: 'Turn sold work into projects, documents, approvals and visible progress.', icon: BriefcaseBusiness, href: '/project-management', tone: 'green' },
  { title: 'Get paid and follow up', body: 'Prepare invoices, track status and keep the next action from depending on memory.', icon: BadgeDollarSign, href: '/services#financial-suite-invoicing', tone: 'orange' },
];

const features = [
  { title: 'CRM', body: 'Capture and manage leads', icon: Users, href: '/crm', tone: 'blue' },
  { title: 'Projects', body: 'Deliver work on time', icon: BriefcaseBusiness, href: '/project-management', tone: 'green' },
  { title: 'Emails', body: 'Send and follow up', icon: Mail, href: '/marketing/email', tone: 'violet' },
  { title: 'Social media', body: 'Create and schedule content', icon: Megaphone, href: '/marketing/automation', tone: 'pink' },
  { title: 'Invoicing', body: 'Get paid faster', icon: ReceiptText, href: '/services#financial-suite-invoicing', tone: 'orange' },
  { title: 'Contracts', body: 'Send and e-sign', icon: FileSignature, href: '/services#contract-engine-e-signatures', tone: 'coral' },
  { title: 'Bookings', body: 'Let clients book time', icon: CalendarCheck, href: '/services#smart-scheduling-cal-com-booking', tone: 'blue' },
  { title: 'Analytics', body: 'See what is working', icon: BarChart3, href: '/results', tone: 'violet' },
  { title: 'Integrations', body: 'Connect your tools', icon: Plug, href: '/ecosystem', tone: 'green' },
];

const integrations = [
  { name: 'LinkedIn', Icon: FaLinkedin, color: '#0a66c2' },
  { name: 'Instagram', Icon: FaInstagram, color: '#d62976' },
  { name: 'Facebook', Icon: FaFacebook, color: '#1877f2' },
  { name: 'Outlook', Icon: FaMicrosoft, color: '#0078d4' },
  { name: 'Zoho', Icon: SiZoho, color: '#e42527' },
  { name: 'Brevo', Icon: SiBrevo, color: '#0b996e' },
  { name: 'QuickBooks', Icon: SiQuickbooks, color: '#2ca01c' },
  { name: 'Stripe', Icon: SiStripe, color: '#635bff' },
];

const workflowSteps = [
  { label: 'Instruction', title: 'Intent captured', body: 'Find qualified prospects, add them to CRM and prepare outreach for review.' },
  { label: 'Plan', title: 'Approval requested', body: 'AlphaClone resolves the workspace, records, permissions and proposed action.' },
  { label: 'Execution', title: 'Approved work runs', body: 'The platform prepares records and personalized drafts across connected tools.' },
  { label: 'Verification', title: 'Result recorded', body: 'Delivery status and the activity history return to the workspace.' },
];

function ProductScene() {
  const { t } = useLanguage();
  return (
    <div className="acr-product-scene" aria-label={t('AlphaClone product view with approved execution result')}>
      <div className="acr-scene-glow" aria-hidden="true" />
      <div className="acr-laptop">
        <div className="acr-laptop-screen">
          <Image
            src="/screenshots/deals-dashboard.png"
            alt={t('AlphaClone dashboard showing deals and sales activity')}
            fill
            priority
            sizes="(max-width: 768px) 92vw, (max-width: 1280px) 56vw, 760px"
            className="object-cover object-top"
          />
        </div>
        <span className="acr-laptop-base" aria-hidden="true" />
      </div>
      <div className="acr-phone">
        <div className="acr-phone-speaker" aria-hidden="true" />
        <Image
          src="/screenshots/mobile-crm.png"
          alt={t('AlphaClone mobile CRM view')}
          fill
          priority
          sizes="190px"
          className="object-cover object-top"
        />
      </div>
      <div className="acr-instruction-card">
        <div><span>Y</span><p><strong>{t('You')}</strong><small>{t('Approved instruction')}</small></p></div>
        <p>{t('Find qualified prospects and prepare relevant outreach for review.')}</p>
      </div>
      <div className="acr-result-card">
        <p><span><ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" /></span><strong>AlphaClone</strong></p>
        <ul>
          <li><Check /> {t('20 records prepared')}</li>
          <li><Check /> {t('CRM context attached')}</li>
          <li><Check /> {t('Drafts ready for review')}</li>
        </ul>
        <span>{t('View in CRM')} <ArrowRight /></span>
      </div>
    </div>
  );
}

function WorkflowProof() {
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  return (
    <section id="workflow" className="acr-workflow-section" aria-labelledby="workflow-heading">
      <MarketingContainer>
        <div className="acr-workflow-grid">
          <div className="acr-workflow-copy">
            <p className="acr-eyebrow is-light">{t('30-second workflow')}</p>
            <h2 id="workflow-heading">{t('One approved request.')}<br />{t('A visible result.')}</h2>
            <p>{t('Follow a single instruction from intent through approval, execution and the verified activity record.')}</p>
            <div className="acr-workflow-tabs" role="group" aria-label={t('Workflow steps')}>
              {workflowSteps.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={step === index}
                  aria-controls="workflow-panel"
                  onClick={() => setStep(index)}
                  className={step === index ? 'is-active' : ''}
                >
                  <span>0{index + 1}</span>{t(item.label)}
                </button>
              ))}
            </div>
            <div id="workflow-panel" className="acr-workflow-detail" aria-live="polite">
              <span>0{step + 1}</span>
              <div><small>AlphaClone</small><h3>{t(workflowSteps[step].title)}</h3><p>{t(workflowSteps[step].body)}</p><strong><Check /> {t('Visible in the workspace')}</strong></div>
            </div>
            <details className="acr-transcript">
              <summary>{t('Read the complete workflow transcript')}</summary>
              <ol>{workflowSteps.map((item) => <li key={item.label}><strong>{t(item.title)}.</strong> {t(item.body)}</li>)}</ol>
            </details>
          </div>
          <div className="acr-workflow-visual">
            <div className="acr-request-bubble"><span>{t('You')}</span><p>{t('Find 20 qualified leads, add them to CRM and prepare outreach for review.')}</p></div>
            <div className="acr-workflow-window">
              <div className="acr-window-head"><span><Image src="/logo.png" alt="" width={20} height={20} /> AlphaClone</span><strong><span /> {t('Reviewable')}</strong></div>
              <div className="acr-window-body">
                {workflowSteps.map((item, index) => (
                  <button key={item.label} type="button" onClick={() => setStep(index)} className={index === step ? 'is-active' : ''}>
                    <span>{index < step ? <Check /> : index === step ? <Play fill="currentColor" /> : index + 1}</span>
                    <p><strong>{t(item.title)}</strong><small>{t(item.label)}</small></p>
                    <em>{t(index < step ? 'Done' : index === step ? 'Current' : 'Next')}</em>
                  </button>
                ))}
              </div>
            </div>
            <p className="acr-static-note">{t('The complete story remains readable without motion or playback.')}</p>
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}

export default function MarketingHomePage() {
  const { t } = useLanguage();
  return (
    <MarketingShell className="acr-redesign">
      <section className="acr-hero">
        <div className="acr-hero-backdrop" aria-hidden="true" />
        <MarketingContainer>
          <div className="acr-hero-grid">
            <div className="acr-hero-copy">
              <p className="acr-eyebrow">{t(EXECUTION_LAYER.category)}</p>
              <h1>{t('You type.')}<br />{t('We')} <span>{t('make it happen.')}</span></h1>
              <p className="acr-hero-lead">{t(EXECUTION_LAYER.heroSubhead)}</p>
              <p className="acr-hero-detail">{t('Manage leads, clients, projects, emails, invoices, bookings and more — from one connected workspace.')}</p>
              <div className="acr-hero-actions">
                <PrimaryCTA href={DEMO_HREF} className="mkt-btn-large">{t(EXECUTION_LAYER.primaryCta)} <ArrowRight className="h-4 w-4" /></PrimaryCTA>
                <SecondaryCTA href="#workflow" className="mkt-btn-large"><span className="acr-play"><Play className="h-3 w-3" fill="currentColor" /></span> {t(EXECUTION_LAYER.secondaryCta)}</SecondaryCTA>
              </div>
              <div className="acr-hero-proof">
                <span><Clock3 /><p><strong>{t('Save hours')}</strong><small>{t('every week')}</small></p></span>
                <span><Users /><p><strong>{t('More clients')}</strong><small>{t('and revenue')}</small></p></span>
                <span><ShieldCheck /><p><strong>{t('Human-led')}</strong><small>{t('AI-executed')}</small></p></span>
              </div>
            </div>
            <ProductScene />
          </div>
        </MarketingContainer>
      </section>

      <section className="acr-integrations" aria-labelledby="integration-heading">
        <MarketingContainer>
          <div className="acr-strip-head">
            <p id="integration-heading" className="acr-eyebrow">{t('Works with the tools you already use')}</p>
            <Link href="/ecosystem">{t('Explore all integrations')} <ArrowRight /></Link>
          </div>
          <div className="acr-integration-row">
            {integrations.map(({ name, Icon, color }) => <span key={name}><Icon style={{ color }} aria-hidden="true" /><small>{name}</small></span>)}
          </div>
        </MarketingContainer>
      </section>

      <section className="acr-process" aria-labelledby="process-heading">
        <MarketingContainer>
          <div className="acr-process-grid">
            <div className="acr-section-intro is-compact">
              <p className="acr-eyebrow">{t('How it works')}</p>
              <h2 id="process-heading">{t('From intention')}<br />{t('to impact.')}</h2>
              <p>{t('A simple, transparent process designed for real business work.')}</p>
              <Link href="/how-it-works">{t('See the full workflow')} <ArrowRight /></Link>
            </div>
            <div className="acr-process-steps">
              {processes.map((item, index) => <article key={item.title}><span><item.icon /></span>{index < processes.length - 1 && <ArrowRight className="acr-step-arrow" />}<h3>{index + 1}. {t(item.title)}</h3><p>{t(item.body)}</p></article>)}
            </div>
          </div>
        </MarketingContainer>
      </section>

      <WorkflowProof />

      <section className="acr-outcomes" aria-labelledby="outcomes-heading">
        <MarketingContainer>
          <div className="acr-section-intro is-center"><p className="acr-eyebrow">{t('Your business, simpler')}</p><h2 id="outcomes-heading">{t('Move the work that moves your business.')}</h2><p>{t('Three connected outcomes replace a long list of disconnected features.')}</p></div>
          <div className="acr-outcome-grid">
            {outcomes.map((item, index) => <article key={item.title} className={`is-${item.tone}`}><div className="acr-outcome-number">0{index + 1}</div><span><item.icon /></span><h3>{t(item.title)}</h3><p>{t(item.body)}</p><Link href={item.href}>{t('Explore this workflow')} <ArrowRight /></Link></article>)}
          </div>
          <div className="acr-feature-heading"><div><p className="acr-eyebrow">{t('Your end-to-end business system')}</p><h2>{t('Everything you need. One workspace.')}</h2><p>{t('Manage the client journey from first contact to final payment — with AI assistance and human control.')}</p></div><Link href="/services">{t('Explore the platform')} <ArrowRight /></Link></div>
          <div className="acr-feature-grid">
            {features.map((item) => <Link href={item.href} key={item.title} className={`is-${item.tone}`}><span><item.icon /></span><strong>{t(item.title)}</strong><small>{t(item.body)}</small></Link>)}
          </div>
        </MarketingContainer>
      </section>

      <section className="acr-control" aria-labelledby="control-heading">
        <MarketingContainer>
          <div className="acr-control-grid">
            <div className="acr-control-window">
              <div className="acr-window-head"><span>{t('Execution record')}</span><strong><span /> {t('Verified')}</strong></div>
              <div className="acr-control-request"><small>{t('Approved instruction')}</small><p>{t('Prepare the proposal, send it after approval and keep delivery status on the client record.')}</p></div>
              <div><span><CheckCircle2 /> {t('Proposal created')}</span><time>09:41</time></div>
              <div className="is-approval"><span><Clock3 /> {t('Owner approval')}</span><strong>{t('Approved')}</strong></div>
              <div><span><CheckCircle2 /> {t('Email delivered')}</span><time>09:44</time></div>
              <div><span><FileCheck2 /> {t('Activity record attached')}</span><time>09:44</time></div>
            </div>
            <div className="acr-section-intro"><p className="acr-eyebrow">{t('Control and trust')}</p><h2 id="control-heading">{t('You stay in control.')}</h2><p>{t('AlphaClone keeps permissions, approval checkpoints and execution records visible so connected work does not become hidden automation.')}</p><ul><li><Check /> {t('Review before important external actions')}</li><li><Check /> {t('Scoped connection and permission boundaries')}</li><li><Check /> {t('A record of what ran and what happened')}</li></ul><div className="acr-link-cluster"><Link href="/security-policy">{t('Review security')} <ArrowRight /></Link><Link href="/reliability">{t('How reliability works')} <ArrowRight /></Link></div></div>
          </div>
        </MarketingContainer>
      </section>

      <section className="acr-closing">
        <MarketingContainer>
          <div className="acr-closing-panel">
            <div><p className="acr-eyebrow is-light">{t('Ready to see AlphaClone in action?')}</p><h2>{t('Run the work. Not the handoffs.')}</h2><p>{t('Book a free walkthrough tailored to your business. No commitment.')}</p></div>
            <div className="acr-closing-actions">
              <PrimaryCTA href={DEMO_HREF} className="mkt-btn-large">{t(EXECUTION_LAYER.primaryCta)} <ArrowRight className="h-4 w-4" /></PrimaryCTA>
              <SecondaryCTA href="#workflow" className="mkt-btn-large">{t(EXECUTION_LAYER.secondaryCta)}</SecondaryCTA>
            </div>
            <ul><li><Check /> {t('Real workflows')}</li><li><Check /> {t('No technical setup')}</li><li><Check /> {t('Human control')}</li></ul>
          </div>
        </MarketingContainer>
      </section>
    </MarketingShell>
  );
}

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
  return (
    <div className="acr-product-scene" aria-label="Sanitized AlphaClone product view with approved execution result">
      <div className="acr-scene-glow" aria-hidden="true" />
      <div className="acr-laptop">
        <div className="acr-laptop-screen">
          <Image
            src="/screenshots/deals-dashboard.png"
            alt="Sanitized AlphaClone dashboard showing leads, projects, invoices and recent activity"
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
          alt="Sanitized AlphaClone mobile CRM view"
          fill
          priority
          sizes="190px"
          className="object-cover object-top"
        />
      </div>
      <div className="acr-instruction-card">
        <div><span>Y</span><p><strong>You</strong><small>Approved instruction</small></p></div>
        <p>Find qualified prospects and prepare relevant outreach for review.</p>
      </div>
      <div className="acr-result-card">
        <p><span><ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" /></span><strong>AlphaClone</strong></p>
        <ul>
          <li><Check /> 20 records prepared</li>
          <li><Check /> CRM context attached</li>
          <li><Check /> Drafts ready for review</li>
        </ul>
        <span>View in CRM <ArrowRight /></span>
      </div>
      <small className="acr-scene-label">Sanitized product view · representative data</small>
    </div>
  );
}

function WorkflowProof() {
  const [step, setStep] = useState(1);
  return (
    <section id="workflow" className="acr-workflow-section" aria-labelledby="workflow-heading">
      <MarketingContainer>
        <div className="acr-workflow-grid">
          <div className="acr-workflow-copy">
            <p className="acr-eyebrow is-light">30-second workflow</p>
            <h2 id="workflow-heading">One approved request.<br />A visible result.</h2>
            <p>Follow a single instruction from intent through approval, execution and the verified activity record.</p>
            <div className="acr-workflow-tabs" role="tablist" aria-label="Workflow steps">
              {workflowSteps.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  role="tab"
                  aria-selected={step === index}
                  aria-controls="workflow-panel"
                  onClick={() => setStep(index)}
                  className={step === index ? 'is-active' : ''}
                >
                  <span>0{index + 1}</span>{item.label}
                </button>
              ))}
            </div>
            <div id="workflow-panel" role="tabpanel" className="acr-workflow-detail" aria-live="polite">
              <span>0{step + 1}</span>
              <div><small>AlphaClone</small><h3>{workflowSteps[step].title}</h3><p>{workflowSteps[step].body}</p><strong><Check /> Visible in the workspace</strong></div>
            </div>
            <details className="acr-transcript">
              <summary>Read the complete workflow transcript</summary>
              <ol>{workflowSteps.map((item) => <li key={item.label}><strong>{item.title}.</strong> {item.body}</li>)}</ol>
            </details>
          </div>
          <div className="acr-workflow-visual">
            <div className="acr-request-bubble"><span>You</span><p>Find 20 qualified leads, add them to CRM and prepare outreach for review.</p></div>
            <div className="acr-workflow-window">
              <div className="acr-window-head"><span><Image src="/logo.png" alt="" width={20} height={20} /> AlphaClone</span><strong><span /> Reviewable</strong></div>
              <div className="acr-window-body">
                {workflowSteps.map((item, index) => (
                  <button key={item.label} type="button" onClick={() => setStep(index)} className={index === step ? 'is-active' : ''}>
                    <span>{index < step ? <Check /> : index === step ? <Play fill="currentColor" /> : index + 1}</span>
                    <p><strong>{item.title}</strong><small>{item.label}</small></p>
                    <em>{index < step ? 'Done' : index === step ? 'Current' : 'Next'}</em>
                  </button>
                ))}
              </div>
            </div>
            <p className="acr-static-note">The complete story remains readable without motion or playback.</p>
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}

export default function MarketingHomePage() {
  return (
    <MarketingShell className="acr-redesign">
      <section className="acr-hero">
        <div className="acr-hero-backdrop" aria-hidden="true" />
        <MarketingContainer>
          <div className="acr-hero-grid">
            <div className="acr-hero-copy">
              <p className="acr-eyebrow">{EXECUTION_LAYER.category}</p>
              <h1>You type.<br />We <span>make it happen.</span></h1>
              <p className="acr-hero-lead">{EXECUTION_LAYER.heroSubhead}</p>
              <p className="acr-hero-detail">Manage leads, clients, projects, emails, invoices, bookings and more — from one connected workspace.</p>
              <div className="acr-hero-actions">
                <PrimaryCTA href={DEMO_HREF} className="mkt-btn-large">Book a demo <ArrowRight className="h-4 w-4" /></PrimaryCTA>
                <SecondaryCTA href="#workflow" className="mkt-btn-large"><span className="acr-play"><Play className="h-3 w-3" fill="currentColor" /></span> See a 30-second workflow</SecondaryCTA>
              </div>
              <div className="acr-hero-proof">
                <span><Clock3 /><p><strong>Save hours</strong><small>every week</small></p></span>
                <span><Users /><p><strong>More clients</strong><small>and revenue</small></p></span>
                <span><ShieldCheck /><p><strong>Human-led</strong><small>AI-executed</small></p></span>
              </div>
            </div>
            <ProductScene />
          </div>
        </MarketingContainer>
      </section>

      <section className="acr-integrations" aria-labelledby="integration-heading">
        <MarketingContainer>
          <div className="acr-strip-head">
            <p id="integration-heading" className="acr-eyebrow">Works with the tools you already use</p>
            <Link href="/ecosystem">Explore all integrations <ArrowRight /></Link>
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
              <p className="acr-eyebrow">How it works</p>
              <h2 id="process-heading">From intention<br />to impact.</h2>
              <p>A simple, transparent process designed for real business work.</p>
              <Link href="/how-it-works">See the full workflow <ArrowRight /></Link>
            </div>
            <div className="acr-process-steps">
              {processes.map((item, index) => <article key={item.title}><span><item.icon /></span>{index < processes.length - 1 && <ArrowRight className="acr-step-arrow" />}<h3>{index + 1}. {item.title}</h3><p>{item.body}</p></article>)}
            </div>
          </div>
        </MarketingContainer>
      </section>

      <WorkflowProof />

      <section className="acr-outcomes" aria-labelledby="outcomes-heading">
        <MarketingContainer>
          <div className="acr-section-intro is-center"><p className="acr-eyebrow">Your business, simpler</p><h2 id="outcomes-heading">Move the work that moves your business.</h2><p>Three connected outcomes replace a long list of disconnected features.</p></div>
          <div className="acr-outcome-grid">
            {outcomes.map((item, index) => <article key={item.title} className={`is-${item.tone}`}><div className="acr-outcome-number">0{index + 1}</div><span><item.icon /></span><h3>{item.title}</h3><p>{item.body}</p><Link href={item.href}>Explore this workflow <ArrowRight /></Link></article>)}
          </div>
          <div className="acr-feature-heading"><div><p className="acr-eyebrow">Your end-to-end business system</p><h2>Everything you need. One workspace.</h2><p>Manage the client journey from first contact to final payment — with AI assistance and human control.</p></div><Link href="/services">Explore the platform <ArrowRight /></Link></div>
          <div className="acr-feature-grid">
            {features.map((item) => <Link href={item.href} key={item.title} className={`is-${item.tone}`}><span><item.icon /></span><strong>{item.title}</strong><small>{item.body}</small></Link>)}
          </div>
        </MarketingContainer>
      </section>

      <section className="acr-control" aria-labelledby="control-heading">
        <MarketingContainer>
          <div className="acr-control-grid">
            <div className="acr-control-window">
              <div className="acr-window-head"><span>Execution record</span><strong><span /> Verified</strong></div>
              <div className="acr-control-request"><small>Approved instruction</small><p>Prepare the proposal, send it after approval and keep delivery status on the client record.</p></div>
              <div><span><CheckCircle2 /> Proposal created</span><time>09:41</time></div>
              <div className="is-approval"><span><Clock3 /> Owner approval</span><strong>Approved</strong></div>
              <div><span><CheckCircle2 /> Email delivered</span><time>09:44</time></div>
              <div><span><FileCheck2 /> Activity record attached</span><time>09:44</time></div>
            </div>
            <div className="acr-section-intro"><p className="acr-eyebrow">Control and trust</p><h2 id="control-heading">You stay in control.</h2><p>AlphaClone keeps permissions, approval checkpoints and execution records visible so connected work does not become hidden automation.</p><ul><li><Check /> Review before important external actions</li><li><Check /> Scoped connection and permission boundaries</li><li><Check /> A record of what ran and what happened</li></ul><div className="acr-link-cluster"><Link href="/security-policy">Review security <ArrowRight /></Link><Link href="/reliability">How reliability works <ArrowRight /></Link></div></div>
          </div>
        </MarketingContainer>
      </section>

      <section className="acr-closing">
        <MarketingContainer>
          <div className="acr-closing-panel">
            <div><p className="acr-eyebrow is-light">Ready to see AlphaClone in action?</p><h2>Run the work. Not the handoffs.</h2><p>Book a free 30-minute walkthrough tailored to your business. No commitment.</p></div>
            <div className="acr-closing-actions"><PrimaryCTA href={DEMO_HREF} className="mkt-btn-large">Book a demo <ArrowRight className="h-4 w-4" /></PrimaryCTA><SecondaryCTA href="#workflow" className="mkt-btn-large">See the workflow</SecondaryCTA></div>
            <ul><li><Check /> Real workflows</li><li><Check /> No technical setup</li><li><Check /> Human control</li></ul>
          </div>
        </MarketingContainer>
      </section>
    </MarketingShell>
  );
}

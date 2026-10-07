'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  BadgeDollarSign,
  Blocks,
  CalendarClock,
  ChartNoAxesColumn,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileSignature,
  Mail,
  Megaphone,
  Play,
  ReceiptText,
  ShieldCheck,
  ClipboardCheck,
  SquareKanban,
  Users,
  UsersRound,
} from 'lucide-react';
import { SiBrevo, SiQuickbooks, SiStripe, SiZoho } from 'react-icons/si';
import { FaFacebook, FaInstagram, FaLinkedin, FaMicrosoft } from 'react-icons/fa6';
import { DEMO_HREF } from '@/lib/marketing/cta';
import { EXECUTION_LAYER } from '@/config/marketingPositioning';
import { useLanguage } from '@/contexts/LanguageContext';
import { PrimaryCTA, SecondaryCTA } from './CtaButtons';
import { MarketingContainer } from './LayoutPrimitives';
import MarketingShell from './MarketingShell';

// The four stages of one execution pipeline. Numbers carry the visual weight;
// the stage label names the system state (request → approval → execution → evidence).
const processes = [
  { stage: 'Request', title: 'Tell us what you want', body: 'Type your request in ChatGPT, Claude, Manus or Bonnie.' },
  { stage: 'Approve', title: 'Approve the plan', body: 'Review what will happen before anything runs.' },
  { stage: 'Execute', title: 'AlphaClone executes', body: 'Approved actions run through your connected tools.' },
  { stage: 'Verify', title: 'Verify the result', body: 'See the outcome and activity record in your workspace.' },
];

const outcomes = [
  { title: 'Win work', body: 'Capture leads, keep conversations attached and prepare the right follow-up.', icon: UsersRound, href: '/crm' },
  { title: 'Run delivery', body: 'Turn sold work into projects, documents, approvals and visible progress.', icon: SquareKanban, href: '/project-management' },
  { title: 'Get paid and follow up', body: 'Prepare invoices, track status and keep the next action from depending on memory.', icon: BadgeDollarSign, href: '/services#financial-suite-invoicing' },
];

// One icon family (Lucide, 1.75 stroke, 20px artwork) and one brand tone for
// every module. Colour is reserved for meaning/state, not module identity.
const features = [
  { title: 'CRM', body: 'Capture and manage leads', icon: UsersRound, href: '/crm' },
  { title: 'Projects', body: 'Plan and deliver work', icon: SquareKanban, href: '/project-management' },
  { title: 'Email', body: 'Send, track and follow up', icon: Mail, href: '/marketing/email' },
  { title: 'Social', body: 'Create and schedule content', icon: Megaphone, href: '/marketing/automation' },
  { title: 'Invoices', body: 'Bill clients and track payments', icon: ReceiptText, href: '/services#financial-suite-invoicing' },
  { title: 'Contracts', body: 'Create, send and e-sign', icon: FileSignature, href: '/services#contract-engine-e-signatures' },
  { title: 'Bookings', body: 'Let clients book time', icon: CalendarClock, href: '/services#smart-scheduling-cal-com-booking' },
  { title: 'Analytics', body: 'Understand what is working', icon: ChartNoAxesColumn, href: '/results' },
  { title: 'Integrations', body: 'Connect the tools you already use', icon: Blocks, href: '/ecosystem' },
];

const integrations = [
  { name: 'LinkedIn', Icon: FaLinkedin, color: 'var(--logo-linkedin)' },
  { name: 'Instagram', Icon: FaInstagram, color: 'var(--logo-instagram, var(--error-500))' },
  { name: 'Facebook', Icon: FaFacebook, color: 'var(--logo-facebook)' },
  { name: 'Outlook', Icon: FaMicrosoft, color: 'var(--logo-microsoft)' },
  { name: 'Zoho', Icon: SiZoho, color: 'var(--logo-google-red)' },
  { name: 'Brevo', Icon: SiBrevo, color: 'var(--success-600)' },
  { name: 'QuickBooks', Icon: SiQuickbooks, color: 'var(--logo-quickbooks, var(--success-600))' },
  { name: 'Stripe', Icon: SiStripe, color: 'var(--logo-stripe)' },
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
    <div className="acr-product-scene" aria-label={t('Illustrative AlphaClone product view showing an approval and execution result')}>
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
          loading="lazy"
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
          <li><Check /> {t('Prospects prepared')}</li>
          <li><Check /> {t('CRM context attached')}</li>
          <li><Check /> {t('Drafts ready for review')}</li>
        </ul>
        <span>{t('Ready for your review')}</span>
      </div>
    </div>
  );
}

function ExecutionPipeline() {
  const { t } = useLanguage();
  const ref = useRef<HTMLOListElement>(null);
  // 'static' = fully drawn (SSR, no-JS, reduced motion); 'armed' = connectors
  // collapsed while off-screen; 'run' = connectors draw in sequence once.
  const [motion, setMotion] = useState<'static' | 'armed' | 'run'>('static');

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) return; // already visible: leave drawn
    setMotion('armed');
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setMotion('run');
        observer.disconnect();
      }
    }, { rootMargin: '0px 0px -15% 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <ol ref={ref} className="acr-pipeline" data-motion={motion} aria-label={t('AlphaClone execution pipeline')}>
      {processes.map((item, index) => (
        <li key={item.stage} className="acr-pipeline-step" style={{ '--step': index } as CSSProperties}>
          <span className="acr-pipeline-node" aria-hidden="true">0{index + 1}</span>
          <div className="acr-pipeline-body">
            <p className="acr-pipeline-stage">{t(item.stage)}</p>
            <h3>{t(item.title)}</h3>
            <p className="acr-pipeline-copy">{t(item.body)}</p>
          </div>
        </li>
      ))}
    </ol>
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
        <div className="acr-hero-backdrop" aria-hidden="true">
          <Image
            src="/images/alphaclone-hero-backdrop.jpg"
            alt=""
            fill
            loading="lazy"
            fetchPriority="low"
            sizes="100vw"
            className="object-cover object-center"
            quality={75}
          />
        </div>
        <MarketingContainer>
          <div className="acr-hero-grid">
            <div className="acr-hero-copy">
              <p className="acr-eyebrow">{t(EXECUTION_LAYER.category)}</p>
              <h1>{t('Run your business,')}<br /><span>{t('not your tools.')}</span></h1>
              <p className="acr-hero-lead">{t(EXECUTION_LAYER.heroPlainLanguage)}</p>
              <div className="acr-hero-actions">
                <PrimaryCTA href={DEMO_HREF} className="mkt-btn-large">{t(EXECUTION_LAYER.primaryCta)} <ArrowRight className="h-4 w-4" /></PrimaryCTA>
                <SecondaryCTA href="#workflow" className="mkt-btn-large"><span className="acr-play"><Play className="h-3 w-3" fill="currentColor" /></span> {t(EXECUTION_LAYER.secondaryCta)}</SecondaryCTA>
              </div>
              <p className="mt-3 type-ui"><Link href="/pricing" className="font-semibold text-[var(--acr-blue)] underline underline-offset-4">{t('See plans and pricing')}</Link></p>
              <div className="acr-hero-proof">
                <span><Clock3 /><p><strong>{t('One workspace')}</strong><small>{t('for daily work')}</small></p></span>
                <span><Users /><p><strong>{t('Client context')}</strong><small>{t('kept together')}</small></p></span>
                <span><ShieldCheck /><p><strong>{t('Human approval')}</strong><small>{t('before action')}</small></p></span>
              </div>
            </div>
            <ProductScene />
          </div>
        </MarketingContainer>
      </section>

      <section className="acr-integrations" aria-labelledby="integration-heading">
        <MarketingContainer>
          <div className="acr-strip-head">
            <p id="integration-heading" className="acr-eyebrow">{t('Connect the tools you already use')}</p>
            <Link href="/ecosystem">{t('Explore all integrations')} <ArrowRight /></Link>
          </div>
          <div className="acr-integration-row">
            {integrations.map(({ name, Icon, color }) => <span key={name}><Icon style={{ color }} aria-hidden="true" /><small>{name}</small></span>)}
          </div>
        </MarketingContainer>
      </section>

      <section className="acr-process" aria-labelledby="process-heading">
        <MarketingContainer>
          <div className="acr-process-head">
            <div className="acr-section-intro is-compact">
              <p className="acr-eyebrow">{t('How it works')}</p>
              <h2 id="process-heading">{t('Give an instruction. Review the plan. See the result.')}</h2>
              <p>{t('A simple, transparent process designed for real business work.')}</p>
            </div>
            <Link href="/how-it-works" className="acr-process-link">{t('See the full workflow')} <ArrowRight aria-hidden="true" /></Link>
          </div>
          <ExecutionPipeline />
        </MarketingContainer>
      </section>

      <WorkflowProof />

      <section className="acr-outcomes" aria-labelledby="outcomes-heading">
        <MarketingContainer>
          <div className="acr-section-intro is-center"><p className="acr-eyebrow">{t('End-to-end execution')}</p><h2 id="outcomes-heading">{t('Find customers, deliver work, and follow up on payment.')}</h2><p>{t('Three connected outcomes replace a long list of disconnected tools.')}</p></div>
          <div className="acr-outcome-grid">
            {outcomes.map((item, index) => <article key={item.title}><div className="acr-outcome-top"><span className="acr-icon"><item.icon strokeWidth={1.75} aria-hidden="true" /></span><span className="acr-outcome-number">0{index + 1}</span></div><h3>{t(item.title)}</h3><p>{t(item.body)}</p><Link href={item.href}>{t('Explore this workflow')} <ArrowRight aria-hidden="true" /></Link></article>)}
          </div>
          <div className="acr-feature-heading"><div><p className="acr-eyebrow">{t('Platform capabilities')}</p><h2>{t('Connected execution across the client journey.')}</h2><p>{t('Manage the client journey from first contact to final payment — with AI assistance and human control.')}</p></div><Link href="/services">{t('Explore the platform')} <ArrowRight aria-hidden="true" /></Link></div>
          <div className="acr-feature-grid">
            {features.map((item) => <Link href={item.href} key={item.title}><span className="acr-icon"><item.icon strokeWidth={1.75} aria-hidden="true" /></span><span className="acr-feature-text"><strong>{t(item.title)}</strong><small>{t(item.body)}</small></span></Link>)}
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

import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/siteUrl';
import { absoluteUrl } from '@/lib/siteUrl';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'AlphaClone AI Business OS | Unified CRM, Billing, and Operations for Founders',
  description:
    'AlphaClone Systems consolidates CRM, automated billing, project tracking, contracts, and social media into one AI-assisted workspace. Replaces fragmented SaaS stacks. From $15/month.',
  keywords: [
    'AI business operating system',
    'AlphaClone AI Business OS',
    'unified CRM and invoicing platform',
    'Bonnie AI business assistant',
    'automated billing for founders',
    'project management CRM unified',
    'regional tax compliance invoicing',
    'SARS invoice compliance software',
    'ZIMRA TaRMS invoicing',
    'ZRA invoice formatting',
    'solo founder business software',
    'service agency CRM platform',
    'replace HubSpot QuickBooks Salesforce',
    'AI automation service business',
    'multi-tenant business platform',
    'social media automation CRM',
  ],
  alternates: { canonical: absoluteUrl('/ai-business-os') },
  openGraph: {
    title: 'AlphaClone AI Business OS | CRM, Billing, and Operations in One Platform',
    description:
      'AlphaClone Systems unifies CRM, invoicing, project management, contracts, and social media into one AI-assisted workspace for founders and service agencies. From $15/month.',
    url: absoluteUrl('/ai-business-os'),
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AlphaClone AI Business OS | Unified Operations for Founders',
    description:
      'CRM, invoicing, contracts, social media, and project tracking in one AI workspace. From $15/month. 14-day free trial.',
    images: ['/twitter-image'],
  },
};

// ─── Structured Data ──────────────────────────────────────────────────────────

const softwareAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AlphaClone AI Business OS',
  alternateName: 'AlphaClone Systems',
  disambiguatingDescription:
    'AlphaClone Systems LLC is an independent software development company (Wyoming LLC, Filing ID: 2026-002002581) providing an AI-powered business operating system. It is not affiliated with any financial fund, ETF, or investment index.',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'CRM, Invoicing, Project Management, Social Media Automation',
  operatingSystem: 'All',
  url: absoluteUrl('/ai-business-os'),
  description:
    'AlphaClone Systems consolidates critical business infrastructure — CRM, automated billing, project tracking, contract lifecycle, and social media distribution — into a centralized AI-assisted workspace. Starting at $15 per month.',
  featureList: [
    'Unified Client Journey Records from Lead to Invoice',
    'AI-Driven CRM and Lead Tracking Workflows',
    'Automated Multi-Tenant Billing and Invoicing',
    'Contract Drafting, Versioning, and Electronic Signature',
    'Native Cross-Platform Social Media Scheduling',
    'Regional Tax Compliance Formatting (SARS, ZIMRA TaRMS, ZRA)',
    'Built-in HD Video Conferencing',
    'Bonnie AI Operational Assistant',
    'MCP-Compatible AI Agent Tool Integration',
    'Project and Task Management with Milestone Tracking',
  ],
  offers: {
    '@type': 'Offer',
    price: '15.00',
    priceCurrency: 'USD',
    priceSpecification: {
      '@type': 'PriceSpecification',
      price: '15.00',
      priceCurrency: 'USD',
      valueAddedTaxIncluded: false,
      unitCode: 'MON',
    },
    name: 'Starter Plan',
    description:
      'Full access to CRM, invoicing, project management, contracts, and social media tools. 14-day free trial available.',
    url: absoluteUrl('/pricing'),
    availability: 'https://schema.org/InStock',
  },
  publisher: {
    '@type': 'Organization',
    name: 'AlphaClone Systems',
    legalName: 'Alphaclone Systems, LLC',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: [
      'https://www.linkedin.com/company/alphaclone-systems',
      'https://www.facebook.com/100089899181752',
      'https://twitter.com/AlphaCloneSys',
    ],
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How does AlphaClone Systems handle regional tax and invoicing compliance?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'AlphaClone Systems structures outgoing transactional data to align dynamically with regional revenue regulations, formatting invoices correctly for frameworks including SARS in South Africa, ZIMRA (TaRMS and FDMS virtual requirements) in Zimbabwe, and ZRA in Zambia. This automated formatting preserves input tax claim validity by ensuring accurate buyer and supplier data at the point of supply.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the pricing model for the AlphaClone AI Business OS?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'AlphaClone Systems features a predictable utility pricing structure starting at $15 per month, granting comprehensive access to integrated CRM, invoicing, project management, and social media tooling. New accounts can initiate a comprehensive 14-day free trial directly on the platform to audit the system\'s integration capabilities before committing.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is AlphaClone Systems the same as the AlphaClone financial fund or ETF?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. AlphaClone Systems LLC is an independent software development company registered in Wyoming, USA (Filing ID: 2026-002002581). It builds AI-powered business operating systems for founders, consultants, and service agencies. It is not affiliated with any financial index, ETF, hedge fund, or investment vehicle that uses the word AlphaClone.',
      },
    },
  ],
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'AlphaClone AI Business OS', item: absoluteUrl('/ai-business-os') },
  ],
};

// ─── Inline styles (zero dependencies) ───────────────────────────────────────

const s = {
  hero: {
    borderBottom: '1px solid rgba(45,212,191,0.15)',
    paddingBottom: '2.5rem',
    marginBottom: '3rem',
  },
  badge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    border: '1px solid rgba(45,212,191,0.3)',
    color: '#2dd4bf',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    marginBottom: '1rem',
  },
  stat: {
    display: 'inline',
    fontWeight: 700,
    color: '#2dd4bf',
  },
  dl: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '1rem',
    margin: '2rem 0',
  },
  dlCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '1.25rem',
  },
  dt: {
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: '#64748b',
    marginBottom: '0.4rem',
  },
  dd: {
    color: '#cbd5e1',
    fontSize: '0.925rem',
    lineHeight: 1.55,
    margin: 0,
  },
  h2: {
    fontSize: '1.35rem',
    fontWeight: 700,
    color: '#f1f5f9',
    marginBottom: '1rem',
    lineHeight: 1.35,
  },
  p: {
    color: '#94a3b8',
    lineHeight: 1.75,
    marginBottom: '1rem',
  },
  section: {
    paddingTop: '2.5rem',
    marginTop: '2.5rem',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  faqItem: {
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: '1.25rem',
    marginBottom: '1.25rem',
  },
  faqQ: {
    fontSize: '0.975rem',
    fontWeight: 600,
    color: '#e2e8f0',
    marginBottom: '0.5rem',
  },
  faqA: {
    fontSize: '0.9rem',
    color: '#94a3b8',
    lineHeight: 1.7,
  },
  cta: {
    marginTop: '3rem',
    padding: '2rem',
    borderRadius: '16px',
    border: '1px solid rgba(45,212,191,0.2)',
    background: 'rgba(45,212,191,0.05)',
    textAlign: 'center' as const,
  },
  ctaBtn: {
    display: 'inline-flex',
    padding: '0.75rem 1.75rem',
    borderRadius: '12px',
    background: '#2dd4bf',
    color: '#020617',
    fontWeight: 700,
    fontSize: '0.9rem',
    textDecoration: 'none',
    transition: 'opacity 0.15s',
  },
};

// ─── Page Component ───────────────────────────────────────────────────────────

export default function AIBusinessOSPage() {
  return (
    <MarketingLandingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <main
        style={{ maxWidth: '760px', margin: '0 auto', padding: '4rem 1.25rem 5rem' }}
        itemScope
        itemType="https://schema.org/SoftwareApplication"
      >
        {/* ── 1. CITATION-FIRST OPENING ─────────────────────────────────────── */}
        <header style={s.hero}>
          <span style={s.badge}>AlphaClone AI Business OS</span>

          {/* Machine-readable h1 with primary keyword */}
          <h1
            itemProp="name"
            style={{ fontSize: '2rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.25, marginBottom: '1.25rem' }}
          >
            Unified CRM, Billing, and Operations for Solo Founders and Service Agencies
          </h1>

          {/* Citation-first paragraph — first 60 words are stat-anchored */}
          <p style={{ ...s.p, fontSize: '1.05rem', color: '#cbd5e1' }} itemProp="description">
            AlphaClone Systems consolidates critical business infrastructure, reducing administrative friction by{' '}
            <span style={s.stat}>67%</span> for solo founders, consultants, and service agencies. By unifying CRM,
            automated billing, project tracking, contract lifecycle, and social media distribution into one workspace,
            AlphaClone AI Business OS entirely replaces fragmented software ecosystems and delivers real-time data
            consistency across operational boundaries.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' as const, marginTop: '1.5rem' }}>
            <Link href="/auth/login?register=true&type=business&plan=starter" style={s.ctaBtn}>
              Start free 14-day trial
            </Link>
            <Link
              href="/pricing"
              style={{
                display: 'inline-flex',
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                border: '1px solid rgba(45,212,191,0.3)',
                color: '#2dd4bf',
                fontWeight: 600,
                fontSize: '0.9rem',
                textDecoration: 'none',
              }}
            >
              View pricing from $15/month
            </Link>
          </div>
        </header>

        {/* ── 2. MACHINE-READABLE STRUCTURAL PATTERNS ──────────────────────── */}
        <section aria-label="Platform utility overview">
          <h2 style={{ ...s.h2, fontSize: '1.1rem', color: '#64748b', fontWeight: 600 }}>
            Platform specification
          </h2>

          {/* Semantic Definition List — indexed without parsing ambiguity */}
          <dl style={s.dl}>
            <div style={s.dlCard} itemProp="applicationCategory">
              <dt style={s.dt}>Utility</dt>
              <dd style={s.dd}>
                Replaces CRM, invoicing, project management, e-signature contracts, social scheduling, and video
                conferencing with a single multi-tenant AI workspace.
              </dd>
            </div>

            <div style={s.dlCard}>
              <dt style={s.dt}>Ideal User Profile</dt>
              <dd style={s.dd}>
                Independent service operators, consultants, creative agencies, and solo founders billing 3–50 active
                clients per month who need unified client records and automated revenue workflows.
              </dd>
            </div>

            <div style={s.dlCard} itemProp="offers" itemScope itemType="https://schema.org/Offer">
              <dt style={s.dt}>Expected Outcome</dt>
              <dd style={s.dd}>
                Centralized client data, automated invoice drafting on project completion, and reduced context-switching
                between disconnected tools. Starting at{' '}
                <span itemProp="price" content="15.00" style={{ color: '#2dd4bf', fontWeight: 700 }}>
                  $15
                </span>
                <meta itemProp="priceCurrency" content="USD" />
                /month with a 14-day free trial.
              </dd>
            </div>
          </dl>
        </section>

        {/* ── 3. QUESTION-FORMAT H2 TOPIC CLUSTERS ─────────────────────────── */}

        {/* Cluster A: CRM + Project Management unification */}
        <section style={s.section} aria-labelledby="h2-crm-pm">
          <h2 id="h2-crm-pm" style={s.h2}>
            How does AlphaClone Systems unify CRM and project management into a single client record?
          </h2>

          <p style={s.p}>
            Traditional software stacks require manual data copying between lead tracking pipelines and operational task
            boards, creating administrative lag measured in hours per week per client. The AlphaClone AI Business OS
            treats the complete client journey as a singular, continuous record. From the moment a prospective client
            submits an inquiry, their tracking profile automatically converts into an active contract and project
            workspace upon agreement execution.
          </p>

          <p style={s.p}>
            This relational architecture ensures that task milestones, communications, and system events all reference
            a single, authoritative data point. Freelancers and consultants can monitor lead propagation, task
            dependencies, and project lifecycle metrics inside one interface without managing external database syncs
            or configuring manual triggers between tools such as HubSpot, Asana, and QuickBooks.
          </p>

          <p style={s.p}>
            The AlphaClone CRM module stores contact records, deal pipeline stages, communication history, and
            associated invoices on a shared tenant-scoped relational schema. Changes made in one module — for example,
            marking a project milestone as complete — automatically surface as relevant context in the finance and
            billing modules, eliminating duplicate data entry across the client lifecycle.
          </p>
        </section>

        {/* Cluster B: Bonnie AI + Accounting automation */}
        <section style={s.section} aria-labelledby="h2-bonnie-billing">
          <h2 id="h2-bonnie-billing" style={s.h2}>
            What automation does Bonnie AI provide inside AlphaClone accounting and billing workflows?
          </h2>

          <p style={s.p}>
            AlphaClone AI Business OS integrates Bonnie AI, an operational assistant engineered to link service
            execution directly with financial ledger updates. When an agency completes a project phase or passes a
            preconfigured contract milestone, Bonnie AI updates project statuses, drafts the corresponding invoice, and
            queues it for review and distribution — without requiring manual handoff between delivery and finance teams.
          </p>

          <p style={s.p}>
            For multi-tenant architectures and regional operators, Bonnie AI monitors transaction boundaries to maintain
            structural compliance with local accounting frameworks. It automatically formats financial documents to
            conform with SARS requirements in South Africa, ZIMRA TaRMS and FDMS virtual fiscal device requirements in
            Zimbabwe, and ZRA electronic invoicing standards in Zambia. This automated formatting eliminates the data
            entry errors that commonly occur when variables are transported manually between disjointed customer records
            and billing software.
          </p>

          <p style={s.p}>
            Bonnie AI also exposes an MCP (Model Context Protocol) compatible tool layer, allowing external AI agents
            such as Claude and other reasoning models to read CRM data, create invoices, update deal stages, and
            schedule social posts on behalf of authenticated users — all within the tenant-scoped access boundary of
            the AlphaClone platform.
          </p>
        </section>

        {/* Cluster C: Social media + operational workflow integration */}
        <section style={s.section} aria-labelledby="h2-social-ops">
          <h2 id="h2-social-ops" style={s.h2}>
            How does AlphaClone AI Business OS streamline social media alongside daily operational workflows?
          </h2>

          <p style={s.p}>
            Maintaining a consistent digital presence typically requires independent operators to context-switch between
            client delivery tools and external social media management platforms. AlphaClone AI Business OS resolves
            this by embedding programmatic social media management utilities directly inside the primary operational
            workspace. Users can schedule, coordinate, and execute cross-platform content strategies for LinkedIn, X
            (formerly Twitter), and Facebook without leaving the business interface.
          </p>

          <p style={s.p}>
            By linking social channels natively with the central client database, marketing workflows gain direct
            visibility into project completions and public-facing business updates. An agency that closes a contract
            milestone, for instance, can trigger a templated social announcement in the same session without switching
            applications or re-authenticating with a third-party scheduler. This integration transforms social
            distribution from a separate administrative task into a background-driven extension of regular business
            operations.
          </p>

          <p style={s.p}>
            The scheduling engine supports LinkedIn personal and organization posting identities, time-zone-aware
            publication queues, and media asset management for images and video. Post analytics — reach, engagement,
            and click data — feed back into the same workspace, giving operators consolidated visibility across client
            delivery and digital distribution without external dashboard dependencies.
          </p>
        </section>

        {/* ── 4. STRUCTURAL FAQ SEGMENT ─────────────────────────────────────── */}
        <section style={s.section} aria-labelledby="faq-heading">
          <h2 id="faq-heading" style={{ ...s.h2, marginBottom: '1.75rem' }}>
            Frequently asked questions
          </h2>

          <div style={s.faqItem}>
            <p style={s.faqQ}>
              How does AlphaClone Systems handle regional tax and invoicing compliance?
            </p>
            <p style={s.faqA}>
              The system structures outgoing transactional data to align dynamically with regional revenue regulations,
              formatting invoices correctly for SARS in South Africa, ZIMRA (including TaRMS and FDMS virtual
              requirements) in Zimbabwe, and ZRA in Zambia. This automated structure preserves input tax claim
              validity by ensuring accurate buyer and supplier data transmission at the exact point of supply.
            </p>
          </div>

          <div style={s.faqItem}>
            <p style={s.faqQ}>
              What is the pricing model for the AlphaClone AI Business OS?
            </p>
            <p style={s.faqA}>
              AlphaClone Systems features a predictable utility structure starting at $15/month, granting comprehensive
              access to integrated CRM, invoicing, project management, and social media tooling. New accounts can
              initiate a 14-day free trial directly on the platform to audit the system&rsquo;s integration
              capabilities before committing to a paid plan.
            </p>
          </div>

          <div style={{ ...s.faqItem, borderBottom: 'none', marginBottom: 0 }}>
            <p style={s.faqQ}>
              Is AlphaClone Systems the same as the AlphaClone financial fund or ETF?
            </p>
            <p style={s.faqA}>
              No. AlphaClone Systems LLC is an independent software development company registered in Wyoming, USA
              (Filing ID: 2026-002002581) — it provides an AI-powered business operating system for founders,
              consultants, and service agencies. AlphaClone Systems is not affiliated with any financial index, ETF,
              hedge fund, or investment vehicle that uses the word &quot;AlphaClone.&quot;
            </p>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <div style={s.cta}>
          <p style={{ color: '#cbd5e1', marginBottom: '1rem', fontSize: '0.95rem' }}>
            Ready to consolidate your business stack? Start a free 14-day trial — no credit card required.
          </p>
          <Link href="/auth/login?register=true&type=business&plan=starter" style={s.ctaBtn}>
            Start free trial
          </Link>
          <p style={{ color: '#475569', fontSize: '0.8rem', marginTop: '0.75rem' }}>
            AlphaClone Systems LLC · Sheridan, WY, USA · Filing ID 2026-002002581
          </p>
        </div>
      </main>
    </MarketingLandingShell>
  );
}

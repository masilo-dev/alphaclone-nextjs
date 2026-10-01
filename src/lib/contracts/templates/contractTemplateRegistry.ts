/**
 * Canonical Corporate Contract Template Registry for AlphaClone Systems.
 * Provides professional, structured agreement templates for standard business use cases.
 * Uses canonical variable syntax: {{business.*}}, {{client.*}}, {{contract.*}}, {{financial.*}}, {{project.*}}.
 */

export interface ContractSectionTemplate {
  heading: string;
  body: string;
}

export interface ContractTemplateDefinition {
  id: string;
  name: string;
  category: 'Services' | 'Legal' | 'Retainer' | 'Development' | 'Operations' | 'General';
  description: string;
  suggestedDurationDays?: number;
  sections: ContractSectionTemplate[];
}

export const CONTRACT_TEMPLATE_REGISTRY: Record<string, ContractTemplateDefinition> = {
  service_agreement: {
    id: 'service_agreement',
    name: 'Master Professional Services Agreement',
    category: 'Services',
    description: 'Comprehensive commercial agreement covering scope, deliverables, payment milestones, and IP assignment.',
    suggestedDurationDays: 90,
    sections: [
      {
        heading: '1. Parties & Purpose',
        body: 'This Professional Services Agreement ("Agreement") is entered into as of {{contract.effective_date}} ("Effective Date"), by and between {{business.name}} ("Service Provider"), having its principal place of business at {{business.address}}, and {{client.name}} ("Client"), having its principal place of business at {{client.address}}.\n\nWHEREAS, Service Provider specializes in providing professional commercial and technical services; and WHEREAS, Client desires to retain Service Provider to perform the services described herein, the Parties agree to the terms set forth below.',
      },
      {
        heading: '2. Scope of Services & Deliverables',
        body: 'Service Provider shall perform the services outlined for project {{project.name}} ("Services") and furnish the deliverables agreed upon in writing ("Deliverables").\n\nScope Description:\n{{project.description}}\n\nAny material expansion, modification, or change to the agreed scope shall be documented in an executed written change order specifying updated timelines and cost adjustments.',
      },
      {
        heading: '3. Fees, Invoicing & Payment Terms',
        body: 'Client shall pay Service Provider the total sum of {{financial.total}} {{financial.currency}} for the satisfactory performance of the Services.\n\nPayment Terms: {{financial.payment_terms}}.\n\nInvoices shall be rendered upon completion of agreed milestones or schedules and shall be payable within thirty (30) calendar days of receipt. Late payments shall accrue interest at 1.5% per month or the statutory maximum, whichever is lower.',
      },
      {
        heading: '4. Intellectual Property Rights',
        body: 'Upon full payment of all fees due under this Agreement, Service Provider assigns to Client all right, title, and interest in and to the custom Deliverables specifically created for Client. Service Provider retains sole ownership of all pre-existing methodologies, proprietary code, libraries, templates, and general know-how utilized in the performance of the Services.',
      },
      {
        heading: '5. Confidentiality & Non-Disclosure',
        body: 'Each Party agrees to hold in strict confidence all proprietary technical, financial, and commercial information disclosed by the other Party. Neither Party shall disclose Confidential Information to any third party without prior written consent, except to employees or professional advisors bound by equivalent duties of confidentiality.',
      },
      {
        heading: '6. Warranties & Limitation of Liability',
        body: 'Service Provider warrants that the Services will be performed in a professional and workmanlike manner in accordance with recognized commercial standards.\n\nEXCEPT AS EXPRESSLY STATED, ALL SERVICES ARE PROVIDED "AS IS". TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY SHALL BE LIABLE FOR INDIRECT, CONSEQUENTIAL, OR PUNITIVE DAMAGES. SERVICE PROVIDER\'S TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE TOTAL FEES ACTUALLY PAID UNDER THIS AGREEMENT.',
      },
      {
        heading: '7. Term, Termination & Governing Law',
        body: 'This Agreement shall commence on {{contract.effective_date}} and continue until {{contract.expiry_date}} unless terminated earlier in accordance with this Section. Either Party may terminate this Agreement upon thirty (30) days prior written notice.\n\nThis Agreement shall be governed by and construed in accordance with the laws of {{contract.governing_law}}, with jurisdiction in {{contract.jurisdiction}}.',
      },
    ],
  },

  consulting_agreement: {
    id: 'consulting_agreement',
    name: 'Strategic Consulting Agreement',
    category: 'Services',
    description: 'Advisory and strategic consulting engagement for executive guidance, operational review, and specialist counsel.',
    suggestedDurationDays: 180,
    sections: [
      {
        heading: '1. Engagement & Parties',
        body: 'This Consulting Agreement ("Agreement") is made effective as of {{contract.effective_date}} between {{business.name}} ("Consultant") and {{client.name}} ("Client"). Client engages Consultant to render strategic advisory counsel regarding {{project.name}}.',
      },
      {
        heading: '2. Advisory Scope & Availability',
        body: 'Consultant shall provide professional consulting, strategic analysis, and executive advisory sessions as reasonably requested by Client. Specific deliverables and review sessions include:\n{{project.description}}',
      },
      {
        heading: '3. Professional Fees & Expenses',
        body: 'Client shall compensate Consultant at the agreed rate of {{financial.total}} {{financial.currency}}. Client shall reimburse all pre-approved, documented travel and out-of-pocket expenses incurred in the discharge of the advisory duties.',
      },
      {
        heading: '4. Independent Contractor Status',
        body: 'Consultant is an independent contractor. Nothing in this Agreement creates an employment, agency, joint venture, or partnership relationship between Consultant and Client.',
      },
      {
        heading: '5. Confidentiality & Governing Law',
        body: 'Consultant shall maintain absolute confidentiality concerning Client strategic plans, trade secrets, and internal data. This Agreement is governed by the laws of {{contract.governing_law}} with exclusive jurisdiction in {{contract.jurisdiction}}.',
      },
    ],
  },

  nda_mutual: {
    id: 'nda_mutual',
    name: 'Mutual Non-Disclosure Agreement',
    category: 'Legal',
    description: 'Bilateral non-disclosure agreement protecting proprietary information shared by both parties.',
    suggestedDurationDays: 730,
    sections: [
      {
        heading: '1. Purpose & Parties',
        body: 'This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of {{contract.effective_date}} between {{business.name}} and {{client.name}} ("Parties") for the purpose of exploring and evaluating potential business cooperation ("Purpose").',
      },
      {
        heading: '2. Definition of Confidential Information',
        body: '"Confidential Information" encompasses all non-public technical, product, customer, financial, marketing, and strategic data disclosed orally, visually, or in writing by either Party that is designated as confidential or should reasonably be understood to be proprietary.',
      },
      {
        heading: '3. Protection Obligations & Exclusions',
        body: 'Each Party agrees to: (a) protect the other Party\'s Confidential Information using at least the same degree of care it uses for its own confidential material, but not less than reasonable care; (b) restrict disclosure strictly to representatives with a need-to-know who are bound by confidentiality agreements; and (c) use such information solely for the authorized Purpose.\n\nExclusions apply to information that is or becomes public without breach, was independently developed without access, or was rightfully received from a third party.',
      },
      {
        heading: '4. Term & Governing Law',
        body: 'This Agreement remains in effect for two (2) years from the Effective Date. The confidentiality covenants survive termination for three (3) years. Governing law: {{contract.governing_law}}, with jurisdiction in {{contract.jurisdiction}}.',
      },
    ],
  },

  nda_unilateral: {
    id: 'nda_unilateral',
    name: 'Unilateral Non-Disclosure Agreement',
    category: 'Legal',
    description: 'One-way confidentiality agreement when only one party discloses proprietary technology or data.',
    suggestedDurationDays: 730,
    sections: [
      {
        heading: '1. Recipient Obligations',
        body: 'This Non-Disclosure Agreement is entered into as of {{contract.effective_date}} between {{business.name}} ("Discloser") and {{client.name}} ("Recipient"). Recipient agrees to hold Discloser\'s proprietary business and technical data in strict confidence.',
      },
      {
        heading: '2. Scope & Restrictions',
        body: 'Recipient shall not disclose, duplicate, reverse engineer, or utilize Discloser\'s Confidential Information for any purpose outside the authorized scope. Recipient shall promptly return or destroy all materials upon Discloser\'s written request.',
      },
      {
        heading: '3. Governing Law',
        body: 'This Agreement is governed by the laws of {{contract.governing_law}} with venue in {{contract.jurisdiction}}.',
      },
    ],
  },

  independent_contractor: {
    id: 'independent_contractor',
    name: 'Independent Contractor Agreement',
    category: 'Services',
    description: 'Specialist contractor engagement setting clear boundaries, work assignments, and tax independence.',
    suggestedDurationDays: 120,
    sections: [
      {
        heading: '1. Contractor Engagement',
        body: '{{client.name}} engages {{business.name}} ("Contractor") as an independent commercial contractor to perform the specialist technical services described in project {{project.name}}.',
      },
      {
        heading: '2. Compensation & Tax Independence',
        body: 'Contractor shall be paid {{financial.total}} {{financial.currency}}. Contractor acknowledges sole responsibility for all income taxes, statutory deductions, social insurance, and business registrations required by applicable law.',
      },
      {
        heading: '3. Work Product & Warranties',
        body: 'Contractor assigns all commissioned work product upon receipt of full payment. Contractor warrants that all work furnished is original and does not infringe third-party intellectual property rights.',
      },
      {
        heading: '4. Termination & Jurisdiction',
        body: 'Either Party may terminate with fourteen (14) days notice. Governed by {{contract.governing_law}}.',
      },
    ],
  },

  website_development: {
    id: 'website_development',
    name: 'Website & Digital Platform Agreement',
    category: 'Development',
    description: 'Web development agreement with design phases, browser compatibility, testing, and deployment warranties.',
    suggestedDurationDays: 60,
    sections: [
      {
        heading: '1. Project Scope & Architecture',
        body: 'Service Provider shall design, develop, and deploy the digital platform for {{client.name}} as outlined in project {{project.name}}:\n{{project.description}}.',
      },
      {
        heading: '2. Milestone Deliverables & Testing',
        body: 'The project shall proceed through agreed phases: (a) Information Architecture & UX; (b) Design Mockups & Responsive Prototyping; (c) Production Implementation & CMS Integration; (d) Client Acceptance Testing & Launch Deployment.',
      },
      {
        heading: '3. Pricing & Staged Payments',
        body: 'Total project fee: {{financial.total}} {{financial.currency}}. Payment structure: {{financial.payment_terms}}.',
      },
      {
        heading: '4. Post-Launch Warranty',
        body: 'Service Provider provides a thirty (30) day defect remediation warranty following public launch to resolve functional bugs conforming to the agreed specifications.',
      },
      {
        heading: '5. IP Assignment & Legal Terms',
        body: 'All custom graphics and source code transfer to Client upon final payment settlement. Governed by {{contract.governing_law}} in {{contract.jurisdiction}}.',
      },
    ],
  },

  software_development: {
    id: 'software_development',
    name: 'Custom Software Engineering Agreement',
    category: 'Development',
    description: 'Engineering agreement for custom software systems, APIs, cloud deployments, and integration testing.',
    suggestedDurationDays: 120,
    sections: [
      {
        heading: '1. Engineering Objectives',
        body: '{{business.name}} shall engineer and deliver custom software systems for {{client.name}} pursuant to technical requirements for {{project.name}}:\n{{project.description}}.',
      },
      {
        heading: '2. Code Standards, Repositories & Acceptance',
        body: 'Deliverables shall be documented, tested, and pushed to Client designated version control. Client shall have ten (10) business days following delivery of each milestone to review and verify functionality.',
      },
      {
        heading: '3. Fees & Resource Allocation',
        body: 'Total investment: {{financial.total}} {{financial.currency}}. Terms: {{financial.payment_terms}}.',
      },
      {
        heading: '4. IP Ownership & Open Source Licensing',
        body: 'Upon full payment, custom software code is assigned to Client. Any third-party open-source components remain subject to their original licenses (MIT, Apache 2.0, etc.).',
      },
      {
        heading: '5. Limitation of Liability & Law',
        body: 'Liability capped at total contract fees. Governed by {{contract.governing_law}}.',
      },
    ],
  },

  marketing_services: {
    id: 'marketing_services',
    name: 'Digital Marketing & Growth Agreement',
    category: 'Services',
    description: 'Marketing campaign management, social media orchestration, SEO, and paid media distribution.',
    suggestedDurationDays: 90,
    sections: [
      {
        heading: '1. Marketing Campaign Scope',
        body: '{{business.name}} shall execute digital marketing, content distribution, and customer acquisition campaigns for {{client.name}} under project {{project.name}}.',
      },
      {
        heading: '2. Ad Spend & Commercial Fees',
        body: 'Agency management fee: {{financial.total}} {{financial.currency}}. Direct advertising media spend (Meta, Google, LinkedIn) shall be billed directly to Client\'s payment methods.',
      },
      {
        heading: '3. Reporting & Performance Analytics',
        body: 'Agency shall deliver monthly performance reports summarizing impressions, engagement, conversion funnels, and verified acquisition metrics.',
      },
      {
        heading: '4. Approvals & Compliance',
        body: 'All marketing copy, creative assets, and public promotions must receive Client written approval prior to publishing. Governed by {{contract.governing_law}}.',
      },
    ],
  },

  maintenance_agreement: {
    id: 'maintenance_agreement',
    name: 'System Maintenance & Support Agreement',
    category: 'Operations',
    description: 'Ongoing technical maintenance, security updates, uptime monitoring, and SLA response times.',
    suggestedDurationDays: 365,
    sections: [
      {
        heading: '1. Scope of Maintenance',
        body: 'Service Provider shall perform periodic maintenance, security patches, database backups, and software dependencies updates for {{client.name}}\'s infrastructure.',
      },
      {
        heading: '2. Service Level Agreement (SLA)',
        body: 'Priority 1 (Critical Outage): Response within 2 hours. Priority 2 (Degraded Performance): Response within 8 business hours. Priority 3 (General Query): Response within 24 business hours.',
      },
      {
        heading: '3. Maintenance Fees & Invoicing',
        body: 'Annual or recurring fee: {{financial.total}} {{financial.currency}}, billed according to {{financial.payment_terms}}.',
      },
      {
        heading: '4. Exclusions & Governing Law',
        body: 'Major architectural refactors and net-new feature additions are excluded and require a separate Statement of Work. Governed by {{contract.governing_law}}.',
      },
    ],
  },

  retainer_agreement: {
    id: 'retainer_agreement',
    name: 'Monthly Retainer Services Agreement',
    category: 'Retainer',
    description: 'Fixed monthly retainer guaranteeing dedicated expert hours and ongoing priority availability.',
    suggestedDurationDays: 180,
    sections: [
      {
        heading: '1. Dedicated Capacity & Retainer Terms',
        body: 'Client engages Service Provider on a monthly retainer basis to provide priority professional services. Service Provider reserves dedicated monthly hours for Client assignments.',
      },
      {
        heading: '2. Retainer Compensation',
        body: 'Retainer amount: {{financial.total}} {{financial.currency}} per billing cycle, payable in advance on the first day of each billing period. Unused hours do not roll over unless agreed in writing.',
      },
      {
        heading: '3. Term, Renewal & Termination',
        body: 'This Agreement shall renew automatically every thirty (30) days unless either Party provides thirty (30) days prior written notice of cancellation. Governed by {{contract.governing_law}}.',
      },
    ],
  },

  statement_of_work: {
    id: 'statement_of_work',
    name: 'Statement of Work (SOW)',
    category: 'Services',
    description: 'Modular Statement of Work governed by a Master Services Agreement specifying deliverables and milestones.',
    suggestedDurationDays: 60,
    sections: [
      {
        heading: '1. Master Agreement Reference',
        body: 'This Statement of Work ("SOW") is issued pursuant to and subject to the terms of the Master Services Agreement between {{business.name}} and {{client.name}}.',
      },
      {
        heading: '2. Specific Deliverables & Milestones',
        body: 'Deliverables for {{project.name}}:\n{{project.description}}.',
      },
      {
        heading: '3. Schedule & Compensation',
        body: 'Total SOW fee: {{financial.total}} {{financial.currency}}, payable in accordance with {{financial.payment_terms}}.\nTarget Completion: {{contract.expiry_date}}.',
      },
      {
        heading: '4. Key Personnel & Signatures',
        body: 'Both Parties agree to the technical deliverables and financial commitments detailed in this SOW.',
      },
    ],
  },

  master_services_agreement: {
    id: 'master_services_agreement',
    name: 'Master Services Agreement (MSA)',
    category: 'Legal',
    description: 'Umbrella corporate agreement establishing overarching legal terms for multiple future Statements of Work.',
    suggestedDurationDays: 730,
    sections: [
      {
        heading: '1. Framework Architecture',
        body: 'This Master Services Agreement ("MSA") establishes the general commercial and legal framework under which {{business.name}} will provide services to {{client.name}} pursuant to individually executed Statements of Work (SOWs).',
      },
      {
        heading: '2. Precedence & Governance',
        body: 'In the event of any conflict between the terms of this MSA and any SOW, this MSA shall prevail unless the SOW explicitly identifies the section of this MSA it intends to supersede.',
      },
      {
        heading: '3. Standard Payment & Credit Terms',
        body: 'All fees shall be invoiced per SOW terms. Standard payment terms are net thirty (30) days from invoice date.',
      },
      {
        heading: '4. Indemnification & Risk Allocation',
        body: 'Each Party agrees to indemnify and hold harmless the other against third-party claims arising from gross negligence, willful misconduct, or breach of confidentiality.',
      },
      {
        heading: '5. Term & Jurisdiction',
        body: 'This MSA remains active for two (2) years and governs all active SOWs. Governing law: {{contract.governing_law}}, with jurisdiction in {{contract.jurisdiction}}.',
      },
    ],
  },

  simple_agreement: {
    id: 'simple_agreement',
    name: 'Standard Commercial Agreement',
    category: 'General',
    description: 'Clean, streamlined agreement for fast closing of straightforward business transactions and services.',
    suggestedDurationDays: 30,
    sections: [
      {
        heading: '1. Agreement Overview',
        body: '{{business.name}} ("Provider") agrees to deliver the following services for {{client.name}} ("Client") regarding {{project.name}}:\n{{project.description}}.',
      },
      {
        heading: '2. Financial Investment',
        body: 'Total price: {{financial.total}} {{financial.currency}}. Payment structure: {{financial.payment_terms}}.',
      },
      {
        heading: '3. General Legal Terms',
        body: 'Work is delivered professionally. Rights transfer upon receipt of payment. Governed by {{contract.governing_law}} in {{contract.jurisdiction}}.',
      },
    ],
  },

  custom_agreement: {
    id: 'custom_agreement',
    name: 'Custom Agreement',
    category: 'General',
    description: 'Blank modular agreement ready for tailored terms, specialized clauses, or custom business models.',
    suggestedDurationDays: 60,
    sections: [
      {
        heading: '1. Purpose & Scope',
        body: 'This Agreement is entered into between {{business.name}} ("Provider") and {{client.name}} ("Client") regarding {{project.name}}.\n\nScope of Work:\n{{project.description}}',
      },
      {
        heading: '2. Commercial Terms & Compensation',
        body: 'Client shall compensate Provider the total amount of {{financial.total}} {{financial.currency}} pursuant to the following terms:\n{{financial.payment_terms}}.',
      },
      {
        heading: '3. General Provisions & Governing Law',
        body: 'This Agreement constitutes the entire agreement between the parties. This Agreement shall be governed by and construed in accordance with the laws of {{contract.governing_law}} with jurisdiction in {{contract.jurisdiction}}.',
      },
    ],
  },
};

export function listContractTemplates(): ContractTemplateDefinition[] {
  return Object.values(CONTRACT_TEMPLATE_REGISTRY);
}

export function getContractTemplate(id: string): ContractTemplateDefinition {
  return CONTRACT_TEMPLATE_REGISTRY[id] || CONTRACT_TEMPLATE_REGISTRY.service_agreement;
}

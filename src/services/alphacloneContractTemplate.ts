/**
 * Contract Template Fallback System
 * Used when AI generation fails or times out
 */

// Contract variables interface
export interface ContractVariables {
    contractDate: string;
    providerName: string;
    providerAddress?: string;
    providerEmail?: string;
    providerRegistration?: string;
    providerCompanyName?: string; // New field
    providerPersonalName?: string; // New field
    governingJurisdiction: string;
    clientName: string;
    clientCompany: string;
    clientAddress: string;
    clientEmail: string;
    projectName: string;
    projectScope: string;
    projectDeliverables: string;
    totalAmount: number;
    paymentSchedule: string;
    depositAmount: number;
    startDate: string;
    deliveryDate: string;
    providerRepName: string;
    providerRepTitle: string;
    clientRepName: string;
    clientRepTitle: string;
    templateType?: 'simple' | 'comprehensive';
    language?: 'en' | 'es' | 'fr';
}

// Payment schedule templates
export const PAYMENT_SCHEDULES = {
    '50_50': '50% upfront deposit, 50% upon completion',
    '30_30_40': '30% upfront deposit, 30% at midpoint, 40% upon completion',
    '25_25_25_25': '25% upfront deposit, 25% at each milestone (3 milestones), 25% upon completion',
    'monthly': 'Monthly installments over project duration',
    'milestone': 'Payment upon completion of each agreed milestone'
};

// Scope templates
export const SCOPE_TEMPLATES = {
    web_app: 'Full-stack web application development including frontend, backend, database design, and deployment',
    mobile_app: 'Native or cross-platform mobile application development for iOS and Android',
    ecommerce: 'E-commerce platform with product management, shopping cart, payment integration, and order management',
    crm: 'Customer Relationship Management system with lead tracking, pipeline management, and reporting',
    custom: 'Custom software solution tailored to specific business requirements'
};

// Generate contract from variables
export function generateAlphaCloneContract(variables: ContractVariables): string {
    const lang = variables.language || 'en';
    const isSimple = variables.templateType === 'simple';

    const translations: Record<string, Record<string, string>> = {
        en: {
            msa: 'MASTER SERVICES AGREEMENT',
            psa: 'PROFESSIONAL SERVICES AGREEMENT',
            refDate: 'Reference Date',
            between: 'BETWEEN',
            provider: 'Service Provider',
            client: 'Client',
            address: 'Address',
            email: 'Email',
            reg: 'Registration',
            onFile: 'On File',
            sec1: 'SERVICES AND SCOPE',
            sec1_desc: 'The Service Provider agrees to perform the following services (the "Services") for the Client:',
            projectName: 'Project Name',
            scope: 'Detailed Scope of Work',
            deliverables: 'Deliverables',
            profManner: 'The Service Provider shall perform the Services in a professional and workmanlike manner, consistent with industry standards.',
            sec2: 'COMPENSATION AND PAYMENT',
            totalValue: 'Total Contract Value',
            deposit: 'Deposit Required',
            schedule: 'Payment Schedule',
            terms: 'Payment Terms',
            terms_desc: 'Invoices are due upon receipt. Late payments shall incur interest at a rate of 1.5% per month or the maximum rate permitted by law, whichever is less.',
            sec3: 'TERM AND TERMINATION',
            start: 'Start Date',
            completion: 'Estimated Completion',
            term_desc: 'Either party may terminate this Agreement with 14 days\' written notice. In the event of termination by the Client, the Client shall pay the Service Provider for all work performed and expenses incurred up to the date of termination.',
            sec4: 'INTELLECTUAL PROPERTY',
            ip_desc: 'Upon full payment of all fees due, the Service Provider assigns to the Client all right, title, and interest in the custom work product created specifically for the Client under this Agreement.',
            sec5: 'CONFIDENTIALITY',
            conf_desc: 'Each party agrees to maintain the confidentiality of the other party\'s proprietary information disclosed during the term of this Agreement.',
            sec10: 'GOVERNING LAW',
            gov_desc: 'This Agreement shall be governed by the laws of',
            witness: 'IN WITNESS WHEREOF',
            signature: 'Signature',
            printedName: 'Printed Name',
            title: 'Title',
            date: 'Date',
            disclaimer: 'AlphaClone Systems is a platform provider and is not a party to this agreement.'
        },
        es: {
            msa: 'CONTRATO MAESTRO DE SERVICIOS',
            psa: 'CONTRATO DE SERVICIOS PROFESIONALES',
            refDate: 'Fecha de Referencia',
            between: 'ENTRE',
            provider: 'Prestador de Servicios',
            client: 'Cliente',
            address: 'Dirección',
            email: 'Correo Electrónico',
            reg: 'Registro',
            onFile: 'En Archivo',
            sec1: 'SERVICIOS Y ALCANCE',
            sec1_desc: 'El Prestador de Servicios acepta realizar los siguientes servicios (los "Servicios") para el Cliente:',
            projectName: 'Nombre del Proyecto',
            scope: 'Alcance Detallado del Trabajo',
            deliverables: 'Entregables',
            profManner: 'El Prestador de Servicios realizará los Servicios de manera profesional y competente, de acuerdo con los estándares de la industria.',
            sec2: 'COMPENSACIÓN Y PAGO',
            totalValue: 'Valor Total del Contrato',
            deposit: 'Depósito Requerido',
            schedule: 'Calendario de Pagos',
            terms: 'Condiciones de Pago',
            terms_desc: 'Las facturas vencen al recibirlas. Los pagos atrasados devengarán intereses a una tasa del 1,5% mensual o la tasa máxima permitida por la ley.',
            sec3: 'PLAZO Y TERMINACIÓN',
            start: 'Fecha de Inicio',
            completion: 'Finalización Estimada',
            term_desc: 'Cualquier parte puede rescindir este Acuerdo con un aviso por escrito de 14 días. En caso de rescisión por parte del Cliente, el Cliente pagará al Prestador de Servicios por todo el trabajo realizado.',
            sec4: 'PROPIEDAD INTELECTUAL',
            ip_desc: 'Tras el pago total de todas las tarifas debidas, el Prestador de Servicios asigna al Cliente todos los derechos, títulos e intereses sobre el producto de trabajo personalizado.',
            sec5: 'CONFIDENCIALIDAD',
            conf_desc: 'Cada parte acuerda mantener la confidencialidad de la información patentada de la otra parte divulgada durante la vigencia de este Acuerdo.',
            sec10: 'LEY APLICABLE',
            gov_desc: 'Este Acuerdo se regirá por las leyes de',
            witness: 'EN FE DE LO CUAL',
            signature: 'Firma',
            printedName: 'Nombre en Letra de Molde',
            title: 'Título',
            date: 'Fecha',
            disclaimer: 'AlphaClone Systems es un proveedor de plataforma y no es parte de este acuerdo.'
        },
        fr: {
            msa: 'ACCORD DE SERVICES MAÎTRE',
            psa: 'CONTRAT DE SERVICES PROFESSIONNELS',
            refDate: 'Date de Référence',
            between: 'ENTRE',
            provider: 'Prestataire de Services',
            client: 'Client',
            address: 'Adresse',
            email: 'E-mail',
            reg: 'Enregistrement',
            onFile: 'Au Dossier',
            sec1: 'SERVICES ET PORTÉE',
            sec1_desc: 'Le Prestataire de Services accepte de fournir les services suivants (les "Services") pour le Client :',
            projectName: 'Nom du Projet',
            scope: 'Portée Détaillée des Travaux',
            deliverables: 'Livrables',
            profManner: 'Le Prestataire de Services doit fournir les Services de manière professionnelle et méticuleuse, conformément aux normes de l\'industrie.',
            sec2: 'RÉMUNÉRATION ET PAIEMENT',
            totalValue: 'Valeur Totale du Contrat',
            deposit: 'Acompte Requis',
            schedule: 'Calendrier de Paiement',
            terms: 'Conditions de Paiement',
            terms_desc: 'Les factures sont dues à réception. Les paiements en retard porteront intérêt au taux de 1,5 % par mois ou au taux maximum autorisé par la loi.',
            sec3: 'DURÉE ET RÉSILIATION',
            start: 'Date de Début',
            completion: 'Achèvement Estimé',
            term_desc: 'Chaque partie peut résilier le présent Contrat avec un préavis écrit de 14 jours. En cas de résiliation par le Client, celui-ci doit payer au Prestataire de Services tous les travaux effectués.',
            sec4: 'PROPRIÉTÉ INTELLECTUELLE',
            ip_desc: 'Dès le paiement intégral de tous les frais dus, le Prestataire de Services cède au Client tous les droits, titres et intérêts sur le produit du travail personnalisé.',
            sec5: 'CONFIDENTIALITÉ',
            conf_desc: 'Chaque partie s\'engage à préserver la confidentialité des informations prioritaires de l\'autre partie divulguées pendant la durée du présent Contrat.',
            sec10: 'LOI APPLICABLE',
            gov_desc: 'Le présent Contrat est régi par les lois de',
            witness: 'EN FOI DE QUOI',
            signature: 'Signature',
            printedName: 'Nom en Lettres Capitales',
            title: 'Titre',
            date: 'Date',
            disclaimer: 'AlphaClone Systems est un fournisseur de plateforme et ne fait pas partie de cet accord.'
        }
    };

    const t = translations[lang] || translations.en;

    const header = isSimple ? `# ${t.psa}` : `# ${t.msa}`;

    let body = `
${header}

**${t.refDate}:** ${variables.contractDate}

**${t.between}:**

**1. ${variables.providerCompanyName || variables.providerName}** ("${t.provider}")${variables.providerPersonalName ? ` represented by ${variables.providerPersonalName}` : ''}
**2. ${variables.clientName}**${variables.clientCompany ? ` (representing ${variables.clientCompany})` : ''} ("${t.client}")

**${t.provider} ${t.address}:**
${variables.providerAddress ? `${t.address}: ${variables.providerAddress}` : `${t.address}: ${t.onFile}`}
${variables.providerEmail ? `${t.email}: ${variables.providerEmail}` : ''}
${variables.providerRegistration ? `${t.reg}: ${variables.providerRegistration}` : ''}

**${t.client} ${t.address}:**
${variables.clientAddress ? `${t.address}: ${variables.clientAddress}` : `${t.address}: ${t.onFile}`}
${variables.clientEmail ? `${t.email}: ${variables.clientEmail}` : ''}

---

## 1. ${t.sec1}

${t.sec1_desc}

**${t.projectName}:** ${variables.projectName}

**${t.scope}:**
${variables.projectScope}

**${t.deliverables}:**
${variables.projectDeliverables}

${t.profManner}

## 2. ${t.sec2}

**${t.totalValue}:** $${variables.totalAmount.toLocaleString()} USD
**${t.deposit}:** $${variables.depositAmount.toLocaleString()} USD

**${t.schedule}:**
${variables.paymentSchedule}

**${t.terms}:**
${t.terms_desc}
    `.trim();

    if (!isSimple) {
        body += `

## 3. ${t.sec3}

**${t.start}:** ${variables.startDate}
**${t.completion}:** ${variables.deliveryDate}

${t.term_desc}

## 4. ${t.sec4}

${t.ip_desc}

## 5. ${t.sec5}

${t.conf_desc}

## 6. INDEMNIFICATION
The Client agrees to indemnify and hold harmless the Service Provider against any claims or damages arising from the Client's use of the deliverables.

## 7. WARRANTIES AND DISCLAIMER
EXCEPT AS EXPRESSLY STATED HEREIN, THE SERVICE PROVIDER MAKES NO WARRANTIES, EXPRESS OR IMPLIED.

## 8. LIMITATION OF LIABILITY
SERVICE PROVIDER'S TOTAL LIABILITY SHALL NOT EXCEED THE TOTAL FEES PAID BY THE CLIENT UNDER THIS AGREEMENT.

## 9. NON-SOLICITATION
Neither party shall solicit for employment any employee or contractor of the other party for 12 months.
        `;
    }

    body += `

## ${isSimple ? '3' : '10'}. ${t.sec10}
 
${t.gov_desc} ${variables.governingJurisdiction}.

## ${isSimple ? '4' : '11'}. PLATFORM DISCLAIMER
${t.disclaimer}

---

**${t.witness}**, the parties have executed this Agreement as of the date first above written.
 
**${t.provider.toUpperCase()}:**
${variables.providerCompanyName || variables.providerName}
${t.signature}: [DIGITAL SIGNATURE]
${t.printedName}: ${variables.providerPersonalName || variables.providerRepName}
${t.title}: ${variables.providerRepTitle}
${t.date}: ${variables.contractDate}
 
**${t.client.toUpperCase()}:**
${variables.clientName}
${t.signature}: [DIGITAL SIGNATURE]
${t.printedName}: ${variables.clientRepName}
${t.title}: ${variables.clientRepTitle}
${t.date}: ${variables.contractDate}
 
---
*Digital signature metadata recorded.*
    `;

    return body.trim();
}


export function generateContractFromTemplate(
    clientName: string,
    projectName: string,
    projectDescription: string,
    providerName: string = 'Authorized Service Provider'
): string {
    const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return `
# PROFESSIONAL SERVICES AGREEMENT

**Date:** ${today}

**Between:**
- **${providerName}** ("Service Provider")
- **${clientName}** ("Client")

**Project:** ${projectName}

---

## 1. PROJECT SCOPE

The Service Provider agrees to deliver the following services:

**Project Description:**
${projectDescription || 'Custom software development and consulting services as mutually agreed upon.'}

**Deliverables:**
- Project planning and requirements analysis
- Design mockups and wireframes
- Development and implementation
- Testing and quality assurance
- Deployment and launch support
- Post-launch support (30 days)

---

## 2. TIMELINE

The project will be completed in phases:

1. **Discovery Phase** (1-2 weeks)
   - Requirements gathering
   - Technical specification
   - Project roadmap

2. **Design Phase** (2-3 weeks)
   - UI/UX design
   - Client review and approval
   - Design revisions (up to 2 rounds)

3. **Development Phase** (4-8 weeks)
   - Core functionality implementation
   - Integration and testing
   - Client demos and feedback

4. **Testing & Deployment** (1-2 weeks)
   - Quality assurance
   - Bug fixes
   - Production deployment

5. **Maintenance** (30 days post-launch)
   - Bug fixes
   - Performance monitoring
   - Support and training

**Estimated Completion:** 8-15 weeks from contract signing

---

## 3. PAYMENT TERMS

**Payment Structure:**
- 30% deposit upon contract signing
- 30% upon completion of Design Phase
- 30% upon completion of Development Phase
- 10% upon final delivery and client acceptance

**Payment Methods:**
- Bank transfer
- Credit card (via Stripe)
- PayPal

**Late Payment:**
Late payments will incur a 1.5% monthly interest charge. Work may be paused if payment is more than 14 days overdue.

---

## 4. CLIENT RESPONSIBILITIES

The Client agrees to:
- Provide timely feedback (within 5 business days)
- Supply necessary content, assets, and credentials
- Designate a primary point of contact
- Review and approve deliverables at each phase
- Make payments according to the schedule

---

## 5. INTELLECTUAL PROPERTY

**Ownership:**
Upon full payment, the Client will own all custom code and designs created specifically for this project.

**Service Provider Retains:**
- Pre-existing code libraries and frameworks
- General methodologies and processes
- Right to use project as portfolio example (with Client approval)

**Third-Party Components:**
Any third-party libraries or services remain subject to their respective licenses.

---

## 6. CONFIDENTIALITY

Both parties agree to:
- Keep confidential information private
- Not disclose project details without written consent
- Return or destroy confidential materials upon request

This obligation survives contract termination for 3 years.

---

## 7. WARRANTIES AND LIMITATIONS

**Service Provider Warrants:**
- Services will be performed in a professional manner
- Deliverables will substantially conform to specifications
- Code will be free of known malware or malicious code

**Warranty Period:** 30 days from delivery

**Limitations:**
- No warranty for third-party components
- No liability for Client-provided content or data
- Maximum liability limited to fees paid for this project

---

## 8. REVISIONS AND CHANGE REQUESTS

**Included Revisions:**
- Up to 2 rounds of design revisions
- Minor bug fixes during development
- Reasonable adjustments to meet specifications

**Additional Work:**
Changes beyond the original scope will be quoted separately and require written approval before proceeding.

---

## 9. TERMINATION

**By Client:**
Client may terminate with 14 days written notice. Client remains responsible for:
- All work completed to date
- Non-refundable expenses incurred
- Minimum 50% of remaining contract value

**By Service Provider:**
Service Provider may terminate if:
- Client fails to pay within 30 days of invoice
- Client fails to provide required materials
- Client breaches material terms of this agreement

**Effect of Termination:**
- Service Provider delivers all completed work
- Client pays for all work completed
- Confidentiality obligations survive

---

## 10. SUPPORT AND MAINTENANCE

**Included Support (30 days post-launch):**
- Bug fixes for issues present at launch
- Performance optimization
- Basic training and documentation

**Extended Support:**
Available separately at hourly or monthly rates.

---

## 11. GENERAL PROVISIONS

**Governing Law:**
This agreement is governed by the laws of [Your Jurisdiction].

**Entire Agreement:**
This contract represents the complete agreement and supersedes all prior discussions.

**Amendments:**
Changes must be in writing and signed by both parties.

**Assignment:**
Neither party may assign this agreement without written consent.

**Force Majeure:**
Neither party is liable for delays due to circumstances beyond reasonable control.

---

## 12. ACCEPTANCE

By signing below, both parties agree to the terms of this Professional Services Agreement.

**${providerName}:**

Signature: [DIGITAL SIGNATURE]
Printed Name: ${providerName}
Title: Authorized Agent
Date: ${today}


**Client (${clientName}):**

Signature: [DIGITAL SIGNATURE]
Printed Name: ${clientName}
Title: Authorized Agent
Date: ${today}

---

**Questions?** Contact the Service Provider's support team.

## LEGAL DISCLAIMER
AlphaClone Systems is a platform provider and is not a party to this agreement. All liability for services rendered lies with the Service Provider.

This contract was generated using AlphaClone's automated contract system. For custom terms, please contact the Service Provider.
`.trim();
}

/**
 * Generate a simple NDA template
 */
export function generateNDATemplate(clientName: string): string {
    const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return `
# NON-DISCLOSURE AGREEMENT

**Date:** ${today}

**Between:**
- **Authorized Service Provider** ("Disclosing Party")
- **${clientName}** ("Receiving Party")

Both parties agree to protect confidential information shared during business discussions.

**Confidential Information includes:**
- Technical specifications and designs
- Business strategies and plans
- Proprietary software and code
- Customer data and lists
- Financial information

**Obligations:**
- Keep information confidential
- Use only for agreed purposes
- Not disclose to third parties
- Return materials upon request

**Duration:** 3 years from date of disclosure

**Signatures:**

AlphaClone Systems: [DIGITAL SIGNATURE]  Date: ${today}

${clientName}: [DIGITAL SIGNATURE]  Date: ${today}
`.trim();
}

/**
 * Generate a statement of work template
 */
export function generateSOWTemplate(
    clientName: string,
    projectName: string,
    deliverables: string[]
): string {
    const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return `
# STATEMENT OF WORK

**Project:** ${projectName}
**Client:** ${clientName}
**Date:** ${today}

## Deliverables

${deliverables.map((d, i) => `${i + 1}. ${d}`).join('\n')}

## Timeline

To be determined based on project scope.

## Acceptance Criteria

Each deliverable will be considered complete when:
- Functionality meets specifications
- Client provides written approval
- All tests pass successfully

**Approved by:**

Authorized Provider: [DIGITAL SIGNATURE]  Date: ${today}

${clientName}: [DIGITAL SIGNATURE]  Date: ${today}
`.trim();
}

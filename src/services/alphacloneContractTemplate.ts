/**
 * Contract Template Fallback System
 * Used when AI generation fails or times out
 */

// Contract variables interface
export interface ContractVariables {
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
    contractDate: string;
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
    return `
# MASTER SERVICES AGREEMENT

**Reference Date:** ${variables.contractDate}

**BETWEEN:**

**1. AlphaClone Systems** ("Service Provider")
**2. ${variables.clientName}**${variables.clientCompany ? ` (representing ${variables.clientCompany})` : ''} ("Client")

${variables.clientAddress ? `Address: ${variables.clientAddress}` : ''}
${variables.clientEmail ? `Email: ${variables.clientEmail}` : ''}

---

## 1. SERVICES AND SCOPE

The Service Provider agrees to perform the following services (the "Services") for the Client:

**Project Name:** ${variables.projectName}

**Detailed Scope of Work:**
${variables.projectScope}

**Deliverables:**
${variables.projectDeliverables}

The Service Provider shall perform the Services in a professional and workmanlike manner, consistent with industry standards.

## 2. COMPENSATION AND PAYMENT

**Total Contract Value:** $${variables.totalAmount.toLocaleString()} USD
**Deposit Required:** $${variables.depositAmount.toLocaleString()} USD

**Payment Schedule:**
${variables.paymentSchedule}

**Payment Terms:**
Invoices are due upon receipt. Late payments shall incur interest at a rate of 1.5% per month or the maximum rate permitted by law, whichever is less. The Service Provider reserves the right to suspend work if payments are more than 14 days overdue.

## 3. TERM AND TERMINATION

**Start Date:** ${variables.startDate}
**Estimated Completion:** ${variables.deliveryDate}

Either party may terminate this Agreement with 14 days' written notice. In the event of termination by the Client, the Client shall pay the Service Provider for all work performed and expenses incurred up to the date of termination.

## 4. INTELLECTUAL PROPERTY

Upon full payment of all fees due, the Service Provider assigns to the Client all right, title, and interest in the custom work product created specifically for the Client under this Agreement. The Service Provider retains ownership of all pre-existing materials, generic code libraries, and tools used to create the work product.

## 5. CONFIDENTIALITY

Each party agrees to maintain the confidentiality of the other party's proprietary information disclosed during the term of this Agreement. This obligation includes technical data, business strategies, and customer lists. This clause survives the termination of this Agreement for a period of three (3) years.

## 6. INDEMNIFICATION

The Client agrees to indemnify and hold harmless the Service Provider against any claims, damages, or expenses arising from the Client's use of the deliverables, or from any content or materials provided by the Client.

## 7. WARRANTIES AND DISCLAIMER

The Service Provider warrants that the Services will be performed substantially in accordance with the specifications. EXCEPT AS EXPRESSLY STATED HEREIN, THE SERVICE PROVIDER MAKES NO WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.

## 8. LIMITATION OF LIABILITY

IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES. THE SERVICE PROVIDER'S TOTAL LIABILITY UNDER THIS AGREEMENT SHALL NOT EXCEED THE TOTAL FEES PAID BY THE CLIENT UNDER THIS AGREEMENT.

## 9. NON-SOLICITATION

During the term of this Agreement and for twelve (12) months thereafter, neither party shall directly or indirectly solicit for employment or engagement any employee or contractor of the other party.

## 10. GOVERNING LAW AND DISPUTE RESOLUTION

This Agreement shall be governed by the laws of the jurisdiction in which the Service Provider is registered. Any disputes arising under this Agreement shall be resolved first through good-faith negotiation, and if unresolved, by binding arbitration.

## 11. ENTIRE AGREEMENT

This Agreement constitutes the entire understanding between the parties and supersedes all prior agreements or understandings, whether written or oral. Amendments must be in writing and signed by both parties.

---

**IN WITNESS WHEREOF**, the parties have executed this Agreement as of the date first above written.

**SERVICE PROVIDER:**
AlphaClone Systems
Signature: __________________________
Title: Authorized Representative
Date: ${variables.contractDate}

**CLIENT:**
${variables.clientName}
Signature: __________________________
Title: Authorized Representative
Date: ${variables.contractDate}

---
*This document is digitally generated and legally binding upon signature.*
`.trim();
}


export function generateContractFromTemplate(
    clientName: string,
    projectName: string,
    projectDescription: string
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
- **AlphaClone Systems** ("Service Provider")
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

**AlphaClone Systems:**

Signature: (Digital Signature)
Name: (Print Name)
Title: (Authorized Agent)
Date: (Date of Signing)


**Client (${clientName}):**

Signature: (Digital Signature)
Name: (Print Name)
Title: (Authorized Agent)
Date: (Date of Signing)

---

**Questions?** Contact us at support@alphaclone.systems

This contract was generated using AlphaClone's automated contract system. For custom terms, please contact our legal team.
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
- **AlphaClone Systems** ("Disclosing Party")
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

AlphaClone Systems: _______________________  Date: __________

${clientName}: _______________________  Date: __________
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

AlphaClone Systems: _______________________  Date: __________

${clientName}: _______________________  Date: __________
`.trim();
}

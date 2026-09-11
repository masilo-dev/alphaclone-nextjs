'use client';

import React, { useState } from 'react';
import { FileText, Copy, Plus, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export type ContractTemplate = {
  id: string;
  title: string;
  category: string;
  description: string;
  estimatedPages: number;
  tags: string[];
  body: string;
};

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'nda',
    title: 'Non-Disclosure Agreement (NDA)',
    category: 'Legal',
    description: 'Protect confidential business information shared between two parties.',
    estimatedPages: 3,
    tags: ['Confidentiality', 'Legal', 'Bilateral'],
    body: `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of [DATE] between [PARTY A NAME] ("Disclosing Party") and [PARTY B NAME] ("Receiving Party").

1. CONFIDENTIAL INFORMATION
"Confidential Information" means any non-public information disclosed by Disclosing Party to Receiving Party.

2. OBLIGATIONS
Receiving Party agrees to: (a) keep Confidential Information strictly confidential; (b) not disclose it to any third party; (c) use it solely for the purpose of evaluating a potential business relationship.

3. TERM
This Agreement shall remain in effect for two (2) years from the date of execution.

4. GOVERNING LAW
This Agreement shall be governed by the laws of [JURISDICTION].

SIGNATURES:
Disclosing Party: _________________ Date: _________
Receiving Party: _________________ Date: _________`,
  },
  {
    id: 'service-agreement',
    title: 'Service Agreement',
    category: 'Services',
    description: 'Define the scope, deliverables, and payment terms for professional services.',
    estimatedPages: 5,
    tags: ['Services', 'Payment', 'Deliverables'],
    body: `SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of [DATE] between [CLIENT NAME] ("Client") and [SERVICE PROVIDER NAME] ("Provider").

1. SERVICES
Provider agrees to perform the following services: [DESCRIBE SERVICES].

2. PAYMENT TERMS
Client agrees to pay Provider [AMOUNT] per [period/milestone]. Payment is due within [X] days of invoice.

3. TERM & TERMINATION
This Agreement begins on [START DATE] and continues until [END DATE] or until terminated by either party with [X] days written notice.

4. INTELLECTUAL PROPERTY
All work product created by Provider under this Agreement shall be owned by Client upon full payment.

5. CONFIDENTIALITY
Both parties agree to keep the terms of this Agreement and any shared information confidential.

SIGNATURES:
Client: _________________ Date: _________
Provider: _________________ Date: _________`,
  },
  {
    id: 'sla',
    title: 'Service Level Agreement (SLA)',
    category: 'Operations',
    description: 'Define performance standards, uptime guarantees, and support response times.',
    estimatedPages: 4,
    tags: ['SLA', 'Performance', 'Support'],
    body: `SERVICE LEVEL AGREEMENT

This SLA is entered into as of [DATE] between [PROVIDER NAME] and [CLIENT NAME].

1. SERVICE AVAILABILITY
Provider guarantees [X]% uptime per calendar month, excluding scheduled maintenance windows.

2. RESPONSE TIMES
- Critical issues: [X] hour response
- High priority: [X] hours response
- Normal: [X] business day response

3. SUPPORT HOURS
Support is available [HOURS] [TIMEZONE], Monday through Friday, excluding public holidays.

4. CREDITS
For each hour of downtime exceeding the SLA threshold, Client will receive a service credit equal to [X]% of monthly fee.

5. EXCLUSIONS
This SLA does not apply to outages caused by client actions, third-party services, or force majeure.

SIGNATURES:
Provider: _________________ Date: _________
Client: _________________ Date: _________`,
  },
  {
    id: 'freelance',
    title: 'Freelance Agreement',
    category: 'Freelance',
    description: 'A clear contract between a freelancer and client covering project scope, IP, and payment.',
    estimatedPages: 3,
    tags: ['Freelance', 'Project', 'IP'],
    body: `FREELANCE AGREEMENT

This Agreement is entered into as of [DATE] between [FREELANCER NAME] ("Freelancer") and [CLIENT NAME] ("Client").

1. PROJECT SCOPE
Freelancer agrees to complete the following project: [DESCRIBE PROJECT].

2. PAYMENT
Client agrees to pay Freelancer [AMOUNT] upon [milestone/completion/schedule]. A [X]% deposit is due before work begins.

3. REVISIONS
The project includes [X] rounds of revisions. Additional revisions will be billed at $[RATE]/hour.

4. INTELLECTUAL PROPERTY
Upon receipt of final payment, all rights to the final deliverables transfer to Client.

5. INDEPENDENT CONTRACTOR
Freelancer is an independent contractor and not an employee of Client.

6. KILL FEE
If Client cancels the project after work has begun, Client will pay [X]% of the remaining project fee.

SIGNATURES:
Client: _________________ Date: _________
Freelancer: _________________ Date: _________`,
  },
  {
    id: 'retainer',
    title: 'Retainer Agreement',
    category: 'Services',
    description: 'Ongoing monthly retainer for continued professional services.',
    estimatedPages: 3,
    tags: ['Retainer', 'Monthly', 'Ongoing'],
    body: `RETAINER AGREEMENT

This Retainer Agreement ("Agreement") is entered into as of [DATE] between [PROVIDER NAME] and [CLIENT NAME].

1. RETAINER SERVICES
Provider will be available for [X] hours per month to provide [DESCRIBE SERVICES].

2. RETAINER FEE
Client agrees to pay a monthly retainer fee of $[AMOUNT], due on the [Xth] of each month.

3. UNUSED HOURS
Unused hours do not roll over to subsequent months.

4. OVERAGE
Hours exceeding the monthly allocation will be billed at $[RATE]/hour.

5. TERM
This Agreement begins on [DATE] and auto-renews monthly unless either party provides [X] days written notice.

SIGNATURES:
Provider: _________________ Date: _________
Client: _________________ Date: _________`,
  },
  {
    id: 'scope-of-work',
    title: 'Scope of Work (SOW)',
    category: 'Project',
    description: 'Detailed specification of project objectives, tasks, timeline, and acceptance criteria.',
    estimatedPages: 4,
    tags: ['SOW', 'Project', 'Deliverables', 'Timeline'],
    body: `SCOPE OF WORK

Project: [PROJECT NAME]
Date: [DATE]
Client: [CLIENT NAME]
Provider: [PROVIDER NAME]

1. OBJECTIVES
[Describe the project goals and desired outcomes.]

2. DELIVERABLES
- [Deliverable 1]: [Description] — Due: [Date]
- [Deliverable 2]: [Description] — Due: [Date]
- [Deliverable 3]: [Description] — Due: [Date]

3. TIMELINE
Project Start: [DATE]
Project End: [DATE]

Milestones:
- Milestone 1: [Description] — [Date]
- Milestone 2: [Description] — [Date]

4. ACCEPTANCE CRITERIA
Work will be considered complete when: [Define acceptance criteria].

5. OUT OF SCOPE
The following are explicitly excluded from this engagement: [List exclusions].

6. CHANGE REQUESTS
Changes to this SOW must be submitted in writing and agreed upon by both parties before work proceeds.

Approved by:
Client: _________________ Date: _________
Provider: _________________ Date: _________`,
  },
];

interface ContractTemplateLibraryProps {
  onUseTemplate?: (template: ContractTemplate) => void;
}

export function ContractTemplateLibrary({ onUseTemplate }: ContractTemplateLibraryProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = CONTRACT_TEMPLATES.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase()) ||
    t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
  );

  const CATEGORY_COLORS: Record<string, string> = {
    Legal: 'text-violet-300 bg-violet-500/10 border-violet-500/30',
    Services: 'text-teal-300 bg-teal-500/10 border-teal-500/30',
    Operations: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
    Freelance: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    Project: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  };

  function handleCopy(template: ContractTemplate) {
    navigator.clipboard.writeText(template.body).then(() => {
      toast.success(`"${template.title}" copied to clipboard`);
    });
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
            <FileText className="text-violet-400" size={20} /> Contract Templates
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Starter templates — clone into a new draft instantly</p>
        </div>
        <input
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 w-full sm:w-64"
        />
      </div>

      <div className="space-y-3">
        {filtered.map(template => {
          const colorClass = CATEGORY_COLORS[template.category] || 'text-slate-300 bg-white/5 border-white/10';
          const isOpen = expanded === template.id;
          return (
            <div key={template.id} className="ac-workspace-panel rounded-xl overflow-hidden transition-all">
              <div
                className="px-5 py-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-all"
                onClick={() => setExpanded(isOpen ? null : template.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white">{template.title}</p>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${colorClass}`}>
                        {template.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{template.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-500">~{template.estimatedPages}p</span>
                  {isOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-white/5">
                  <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-white/5 bg-white/[0.01]">
                    {template.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => handleCopy(template)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 border border-white/10 hover:bg-white/5 transition-all"
                      >
                        <Copy size={12} /> Copy Text
                      </button>
                      {onUseTemplate && (
                        <button
                          onClick={() => onUseTemplate(template)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 transition-all"
                        >
                          <Plus size={12} /> Use Template
                        </button>
                      )}
                    </div>
                  </div>
                  <pre className="px-5 py-4 text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-72 overflow-y-auto bg-slate-950/40">
                    {template.body}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

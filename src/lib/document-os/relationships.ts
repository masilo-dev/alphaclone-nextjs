/**
 * Record relationships — lead → … → receipt chain.
 */

export interface RelatedRecordRef {
  type: string;
  id: string;
  label: string;
  status?: string;
  meta?: Record<string, unknown>;
}

export interface BusinessRecordChain {
  lead?: RelatedRecordRef;
  contact?: RelatedRecordRef;
  company?: RelatedRecordRef;
  opportunity?: RelatedRecordRef;
  quote?: RelatedRecordRef;
  proposal?: RelatedRecordRef;
  contract?: RelatedRecordRef;
  project?: RelatedRecordRef;
  milestones?: RelatedRecordRef[];
  invoices?: RelatedRecordRef[];
  payments?: RelatedRecordRef[];
  receipts?: RelatedRecordRef[];
  deliverables?: RelatedRecordRef[];
  emails?: RelatedRecordRef[];
  activity?: RelatedRecordRef[];
}

export function buildRecordChain(parts: Partial<BusinessRecordChain>): BusinessRecordChain {
  return { ...parts };
}

export function flattenRecordChain(chain: BusinessRecordChain): RelatedRecordRef[] {
  const out: RelatedRecordRef[] = [];
  const push = (r?: RelatedRecordRef | RelatedRecordRef[]) => {
    if (!r) return;
    if (Array.isArray(r)) out.push(...r);
    else out.push(r);
  };
  push(chain.lead);
  push(chain.contact);
  push(chain.company);
  push(chain.opportunity);
  push(chain.quote);
  push(chain.proposal);
  push(chain.contract);
  push(chain.project);
  push(chain.milestones);
  push(chain.invoices);
  push(chain.payments);
  push(chain.receipts);
  push(chain.deliverables);
  push(chain.emails);
  push(chain.activity);
  return out;
}

/** Format chain for AI / MCP responses e.g. “Show everything connected to Novus Power”. */
export function formatRecordChainForAi(companyName: string, chain: BusinessRecordChain): string {
  const rows = flattenRecordChain(chain);
  if (!rows.length) return `No related records found for ${companyName}.`;
  const lines = rows.map(
    (r) => `- [${r.type}] ${r.label}${r.status ? ` (${r.status})` : ''} · id=${r.id}`
  );
  return `Records connected to ${companyName}:\n${lines.join('\n')}`;
}

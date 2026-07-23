/**
 * Contract engine — structured clauses, not uncontrolled AI text blobs.
 */

import { newId } from '../cryptoUtil';
import type { ContractClause, ContractClauseKey } from '../types';
import { CONTRACT_CLAUSE_KEYS } from '../types';

export interface ContractStructuredData {
  parties: {
    supplier_legal_name: string;
    client_legal_name: string;
    supplier_address?: string;
    client_address?: string;
    supplier_email?: string;
    client_email?: string;
  };
  scope?: string;
  deliverables?: string[];
  revisions_limit?: number;
  fees?: { amount: number; currency: string; description?: string }[];
  deposit?: { amount: number; currency: string; due?: string };
  milestones?: Array<{ id: string; title: string; amount: number; due_date?: string }>;
  timeline?: string;
  payment_terms?: string;
  intellectual_property?: string;
  confidentiality?: string;
  warranties?: string;
  liability?: string;
  termination?: string;
  dispute_resolution?: string;
  governing_law?: string;
  jurisdiction?: string;
  notices?: string;
  schedules?: string[];
  clauses: ContractClause[];
}

export function makeClause(
  key: ContractClauseKey | string,
  title: string,
  body: string,
  order: number,
  version = '1.0'
): ContractClause {
  return {
    clause_id: newId(),
    clause_key: key,
    title,
    body,
    version,
    order,
    required: CONTRACT_CLAUSE_KEYS.includes(key as ContractClauseKey),
  };
}

export function buildStandardContractClauses(data: Omit<ContractStructuredData, 'clauses'>): ContractClause[] {
  const clauses: ContractClause[] = [];
  let order = 1;

  clauses.push(
    makeClause(
      'parties',
      'Parties',
      `This Agreement is entered into between ${data.parties.supplier_legal_name}` +
        `${data.parties.supplier_address ? ` of ${data.parties.supplier_address}` : ''}` +
        `${data.parties.supplier_email ? ` (${data.parties.supplier_email})` : ''}` +
        ` and ${data.parties.client_legal_name}` +
        `${data.parties.client_address ? ` of ${data.parties.client_address}` : ''}` +
        `${data.parties.client_email ? ` (${data.parties.client_email})` : ''}.`,
      order++
    )
  );

  if (data.scope) clauses.push(makeClause('scope', 'Scope of Work', data.scope, order++));
  if (data.deliverables?.length) {
    clauses.push(
      makeClause(
        'deliverables',
        'Deliverables',
        data.deliverables.map((d, i) => `${i + 1}. ${d}`).join('\n'),
        order++
      )
    );
  }
  if (data.revisions_limit != null) {
    clauses.push(
      makeClause(
        'revisions',
        'Revisions',
        `The Client is entitled to up to ${data.revisions_limit} revision round(s) within the agreed scope.`,
        order++
      )
    );
  }
  if (data.fees?.length) {
    clauses.push(
      makeClause(
        'fees',
        'Fees',
        data.fees.map((f) => `${f.description || 'Fee'}: ${f.currency} ${f.amount.toFixed(2)}`).join('\n'),
        order++
      )
    );
  }
  if (data.deposit) {
    clauses.push(
      makeClause(
        'deposits',
        'Deposit',
        `A deposit of ${data.deposit.currency} ${data.deposit.amount.toFixed(2)} is due${data.deposit.due ? ` by ${data.deposit.due}` : ''}.`,
        order++
      )
    );
  }
  if (data.milestones?.length) {
    clauses.push(
      makeClause(
        'milestones',
        'Milestones',
        data.milestones
          .map(
            (m) =>
              `${m.id}: ${m.title} — ${m.amount.toFixed(2)}${m.due_date ? ` (due ${m.due_date})` : ''}`
          )
          .join('\n'),
        order++
      )
    );
  }
  if (data.timeline) clauses.push(makeClause('timeline', 'Timeline', data.timeline, order++));
  if (data.payment_terms) {
    clauses.push(makeClause('payment_terms', 'Payment Terms', data.payment_terms, order++));
  }
  if (data.intellectual_property) {
    clauses.push(
      makeClause('intellectual_property', 'Intellectual Property', data.intellectual_property, order++)
    );
  }
  if (data.confidentiality) {
    clauses.push(makeClause('confidentiality', 'Confidentiality', data.confidentiality, order++));
  }
  if (data.warranties) clauses.push(makeClause('warranties', 'Warranties', data.warranties, order++));
  if (data.liability) clauses.push(makeClause('liability', 'Limitation of Liability', data.liability, order++));
  if (data.termination) clauses.push(makeClause('termination', 'Termination', data.termination, order++));
  if (data.dispute_resolution) {
    clauses.push(makeClause('dispute_resolution', 'Dispute Resolution', data.dispute_resolution, order++));
  }
  const law = data.governing_law || '';
  const jurisdiction = data.jurisdiction || '';
  clauses.push(
    makeClause(
      'governing_law',
      'Governing Law',
      `This Agreement is governed by the laws of ${law || '[GOVERNING_LAW]'}.` +
        (jurisdiction ? ` The courts of ${jurisdiction} have exclusive jurisdiction.` : ''),
      order++
    )
  );
  if (data.notices) clauses.push(makeClause('notices', 'Notices', data.notices, order++));
  if (data.schedules?.length) {
    clauses.push(makeClause('schedules', 'Schedules and Appendices', data.schedules.join('\n'), order++));
  }
  clauses.push(
    makeClause(
      'signatures',
      'Signatures',
      'By signing, each party confirms it has authority to bind the named legal entity to this Agreement.',
      order++
    )
  );

  return clauses;
}

export function contractFromStructured(data: ContractStructuredData): ContractStructuredData {
  if (!data.clauses?.length) {
    return { ...data, clauses: buildStandardContractClauses(data) };
  }
  return data;
}

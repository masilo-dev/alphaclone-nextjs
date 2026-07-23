/**
 * Legal consistency validation for structured contracts.
 * Detects contradictory IP/originality language (Novus Power regression).
 */

import type { ContractClause, ValidationIssue } from '../types';

export interface LegalConsistencyInput {
  clauses: ContractClause[];
  partyNames?: string[];
  supplierLegalName?: string;
  clientLegalName?: string;
  governingLaw?: string;
  jurisdiction?: string;
  noticeAddresses?: string[];
  definedTerms?: string[];
  emails?: string[];
}

const ORIGINALITY_PROMISE =
  /\b(original\s+(logo|design|artwork|work)|create\s+an?\s+original|wholly\s+original|bespoke\s+logo|custom\s+original)\b/i;
const COPY_ADMISSION =
  /\b(copy|copied|reproduce|reproduced|replicate|replication|based\s+on\s+(an?\s+)?existing|clone|duplicat)\b.{0,80}\b(logo|design|artwork)\b|\b(logo|design|artwork)\b.{0,80}\b(copy|copied|reproduce|reproduced|replicate)\b/i;
const ORIGINALITY_DISCLAIMER =
  /\b(no\s+warranty\s+of\s+originality|not\s+warrant\s+originality|disclaim\w*\s+originality|does\s+not\s+guarantee\s+originality|without\s+warranty.{0,40}original)\b/i;
const INDEMNIFY_COPY =
  /\b(indemnif\w*).{0,120}\b(copy|copied|reproduc|infring).{0,80}\b(logo|design|ip|intellectual)\b|\b(copy|copied|reproduc).{0,80}\b(logo|design).{0,120}\b(indemnif\w*)\b/i;

/**
 * Detect contradictory originality / IP clauses.
 * Blocks approval when a document both promises originality and admits copying.
 */
export function detectOriginalityContradictions(
  clauses: ContractClause[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const promising: ContractClause[] = [];
  const copying: ContractClause[] = [];
  const disclaiming: ContractClause[] = [];
  const indemnifyingCopy: ContractClause[] = [];

  for (const clause of clauses) {
    const text = `${clause.title}\n${clause.body}`;
    if (ORIGINALITY_PROMISE.test(text)) promising.push(clause);
    if (COPY_ADMISSION.test(text)) copying.push(clause);
    if (ORIGINALITY_DISCLAIMER.test(text)) disclaiming.push(clause);
    if (INDEMNIFY_COPY.test(text)) indemnifyingCopy.push(clause);
  }

  const hasPromise = promising.length > 0;
  const hasCopy = copying.length > 0 || indemnifyingCopy.length > 0;
  const hasDisclaimer = disclaiming.length > 0;

  if (hasPromise && hasCopy) {
    issues.push({
      code: 'IP_ORIGINALITY_VS_COPY_CONTRADICTION',
      severity: 'blocking',
      field: 'intellectual_property',
      message:
        'Contract both promises an original logo/design and admits the logo was copied or will be copied. These clauses contradict each other.',
      recommended_fix:
        'Remove either the originality promise or the copy admission; align IP, warranties, and indemnification language.',
    });
  }

  if (hasPromise && hasDisclaimer) {
    issues.push({
      code: 'IP_ORIGINALITY_VS_DISCLAIMER_CONTRADICTION',
      severity: 'blocking',
      field: 'intellectual_property',
      message:
        'Contract promises originality in one clause while disclaiming originality in another.',
      recommended_fix:
        'Choose one consistent originality position across IP, warranties, and disclaimers.',
    });
  }

  if (hasCopy && hasDisclaimer && hasPromise) {
    issues.push({
      code: 'IP_TRIPLE_CONTRADICTION',
      severity: 'blocking',
      field: 'intellectual_property',
      message:
        'Contract simultaneously promises originality, admits copying, and disclaims originality — including indemnification that references a copied logo.',
      recommended_fix:
        'Rewrite intellectual property, warranty, and indemnification clauses into a single coherent position before approval.',
    });
  }

  if (hasCopy && indemnifyingCopy.length > 0 && promising.length > 0) {
    issues.push({
      code: 'IP_INDEMNIFICATION_COPY_CONFLICT',
      severity: 'blocking',
      field: 'indemnification',
      message:
        'Indemnification language treats the logo as copied while other clauses claim originality.',
      recommended_fix: 'Align indemnification with the actual scope of work and IP ownership.',
    });
  }

  return issues;
}

export function detectDuplicateClauses(clauses: ContractClause[]): ValidationIssue[] {
  const seen = new Map<string, ContractClause>();
  const issues: ValidationIssue[] = [];
  for (const clause of clauses) {
    const key = clause.clause_key.toLowerCase();
    if (seen.has(key)) {
      issues.push({
        code: 'DUPLICATE_CLAUSE',
        severity: 'blocking',
        field: clause.clause_key,
        message: `Duplicate clause key "${clause.clause_key}" (ids ${seen.get(key)!.clause_id} and ${clause.clause_id}).`,
        recommended_fix: 'Merge or remove the duplicate clause.',
      });
    } else {
      seen.set(key, clause);
    }
  }
  return issues;
}

export function detectBlankPlaceholders(clauses: ContractClause[]): ValidationIssue[] {
  const placeholder = /\[(?:TODO|TBD|PLACEHOLDER|[A-Z_ ]{3,})\]|\{+[a-zA-Z._]+\}+|_{3,}|\bXXX\b/g;
  const issues: ValidationIssue[] = [];
  for (const clause of clauses) {
    const matches = clause.body.match(placeholder);
    if (matches?.length) {
      issues.push({
        code: 'BLANK_PLACEHOLDER',
        severity: 'blocking',
        field: clause.clause_key,
        message: `Clause "${clause.title}" contains blank placeholders: ${[...new Set(matches)].join(', ')}`,
        recommended_fix: 'Fill or remove all placeholders before approval.',
      });
    }
  }
  return issues;
}

export function validateGoverningLaw(input: LegalConsistencyInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lawClause = input.clauses.find((c) => c.clause_key === 'governing_law');
  const lawText = input.governingLaw || lawClause?.body || '';
  if (!lawText.trim() || /undefined|tbd|to be determined|\[\s*\]/i.test(lawText)) {
    issues.push({
      code: 'GOVERNING_LAW_UNDEFINED',
      severity: 'blocking',
      field: 'governing_law',
      message: 'Governing law is undefined or placeholder.',
      recommended_fix: 'Set an explicit governing law (country/state/jurisdiction).',
    });
  }
  const jurisdiction = input.jurisdiction || '';
  if (!jurisdiction.trim() || /undefined|tbd/i.test(jurisdiction)) {
    const jurisInClause = /jurisdiction/i.test(lawText) && !/undefined|tbd/i.test(lawText);
    if (!jurisInClause) {
      issues.push({
        code: 'JURISDICTION_UNDEFINED',
        severity: 'blocking',
        field: 'jurisdiction',
        message: 'Jurisdiction cannot remain undefined.',
        recommended_fix: 'Specify courts/venue for dispute resolution.',
      });
    }
  }
  return issues;
}

export function validatePartyConsistency(input: LegalConsistencyInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const partiesClause = input.clauses.find((c) => c.clause_key === 'parties');
  const body = partiesClause?.body || '';

  if (input.supplierLegalName && body && !body.includes(input.supplierLegalName)) {
    issues.push({
      code: 'SUPPLIER_NAME_MISMATCH',
      severity: 'blocking',
      field: 'parties',
      message: `Parties clause does not include supplier legal name "${input.supplierLegalName}".`,
      recommended_fix: 'Update party details to use the tenant legal business name.',
    });
  }

  if (input.clientLegalName && body && !body.includes(input.clientLegalName)) {
    issues.push({
      code: 'CLIENT_NAME_MISMATCH',
      severity: 'blocking',
      field: 'parties',
      message: `Parties clause does not include client legal name "${input.clientLegalName}".`,
      recommended_fix: 'Update party details to match the CRM client record.',
    });
  }

  const emails = input.emails || [];
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (emails.length > 1 && unique.length !== emails.filter(Boolean).length) {
    // ok — duplicates of same email
  }
  const clientEmails = emails.filter(Boolean);
  if (clientEmails.length >= 2) {
    const normalized = clientEmails.map((e) => e.trim().toLowerCase());
    if (new Set(normalized).size > 1) {
      issues.push({
        code: 'CLIENT_EMAIL_INCONSISTENT',
        severity: 'blocking',
        field: 'emails',
        message: `Client emails are inconsistent: ${[...new Set(normalized)].join(', ')}`,
        recommended_fix: 'Use a single verified client email across notices, parties, and signature blocks.',
      });
    }
  }

  return issues;
}

export function validateLegalConsistency(input: LegalConsistencyInput): ValidationIssue[] {
  return [
    ...detectOriginalityContradictions(input.clauses),
    ...detectDuplicateClauses(input.clauses),
    ...detectBlankPlaceholders(input.clauses),
    ...validateGoverningLaw(input),
    ...validatePartyConsistency(input),
  ];
}

import { newId } from '@/lib/document-os/cryptoUtil';
import type { ContractClause } from '@/lib/document-os/types';
import { validateLegalConsistency } from '@/lib/document-os/validators/legalConsistency';
import type { ValidationFinding } from '@/lib/documents/documentValidationEngine';

/** Split contract HTML/text into clause-shaped sections for legal consistency checks. */
export function contractContentToClauses(content: string): ContractClause[] {
  const plain = content.replace(/<[^>]+>/g, '\n').replace(/\r/g, '');
  const sections = plain
    .split(/\n(?=#{1,3}\s)|(?=^[A-Z0-9][A-Z0-9\s/&().-]{2,48}:?\s*$)/m)
    .map((section) => section.trim())
    .filter((section) => section.length > 20);

  const source =
    sections.length > 1
      ? sections
      : plain
          .split(/\n{2,}/)
          .map((section) => section.trim())
          .filter((section) => section.length > 20);

  if (!source.length && plain.trim()) {
    source.push(plain.trim());
  }

  return source.map((section, index) => {
    const lines = section.split('\n');
    const headingMatch = lines[0]?.match(/^#+\s*(.+)$|^([A-Z0-9][^:\n]{2,60}):?\s*$/);
    const title = headingMatch?.[1] || headingMatch?.[2] || `Section ${index + 1}`;
    const body = headingMatch ? lines.slice(1).join('\n').trim() || section : section;
    return {
      clause_id: newId(),
      clause_key: `section_${index + 1}`,
      title,
      body,
      version: '1.0',
      order: index + 1,
      required: false,
    };
  });
}

export function runContractLegalConsistencyCheck(input: {
  content: string;
  clientName?: string;
  clientEmail?: string;
  jurisdiction?: string;
  governingLaw?: string;
  supplierLegalName?: string;
}): ValidationFinding[] {
  const clauses = contractContentToClauses(input.content);
  if (!clauses.length) return [];

  const issues = validateLegalConsistency({
    clauses,
    clientLegalName: input.clientName,
    supplierLegalName: input.supplierLegalName,
    governingLaw: input.governingLaw || input.jurisdiction,
    jurisdiction: input.jurisdiction,
    emails: input.clientEmail ? [input.clientEmail] : undefined,
  });

  return issues.map((issue) => ({
    id: issue.code.toLowerCase(),
    severity:
      issue.severity === 'blocking'
        ? 'critical'
        : issue.severity === 'warning'
          ? 'warning'
          : 'info',
    message: issue.message,
    field: issue.field,
    evidence: issue.recommended_fix ? { recommended_fix: issue.recommended_fix } : undefined,
  }));
}

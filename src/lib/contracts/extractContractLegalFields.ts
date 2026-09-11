/** Extract structured legal fields from contract body text when MCP omits them. */
export function extractContractLegalFields(content: string): {
  governing_law: string | null;
  jurisdiction: string | null;
} {
  const text = String(content || '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/\r/g, '');

  const governingLaw =
    matchLabel(text, /governing\s+law\s*[:\-–]\s*([^\n.;]+)/i) ||
    matchLabel(text, /governed\s+by\s+(?:the\s+)?(?:laws?\s+of\s+)?([^\n.;]+)/i) ||
    matchLabel(text, /(?:laws?\s+of\s+)(?:the\s+)?([^\n.;]+)/i);

  const jurisdiction =
    matchLabel(text, /jurisdiction\s*[:\-–]\s*([^\n.;]+)/i) ||
    matchLabel(text, /courts?\s+of\s+([^\n.;]+)/i) ||
    matchLabel(text, /arbitration\s+in\s+([^\n.;]+)/i);

  return {
    governing_law: governingLaw,
    jurisdiction: jurisdiction || governingLaw,
  };
}

function matchLabel(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  if (!match?.[1]) return null;
  const value = match[1].trim().replace(/\s+/g, ' ');
  return value.length >= 3 ? value : null;
}

/** Token the legal validator accepts; filled at send/sign time. */
export const SIGNATURE_BLOCK_TOKEN = '[SIGNATURE_BLOCK]';

const UNDERSCORE_LINE = /^[\s_]{8,}$/m;
const SIGNATURE_UNDERSCORE = /(?:Signature|Signed|Sign here)\s*:?\s*_{3,}/gi;

/**
 * Normalize contract body text before persistence:
 * - Replace blank underscore signature lines with [SIGNATURE_BLOCK]
 * - Strip trailing whitespace on signature sections
 */
export function normalizeContractContent(content: string): string {
  let text = String(content || '');

  text = text.replace(SIGNATURE_UNDERSCORE, (match) =>
    match.replace(/_{3,}/, SIGNATURE_BLOCK_TOKEN),
  );
  text = text.replace(UNDERSCORE_LINE, SIGNATURE_BLOCK_TOKEN);

  if (!/\[SIGNATURE_BLOCK\]/i.test(text) && /signature|signatory|signed by/i.test(text)) {
    text = `${text.trim()}\n\n${SIGNATURE_BLOCK_TOKEN}\n`;
  }

  return text.trim();
}

/** Replace signature tokens with rendered blocks for PDF/email output. */
export function renderSignatureBlocks(
  content: string,
  parties?: { supplier?: string; client?: string },
): string {
  let index = 0;
  const labels = [parties?.supplier || 'Authorized Signatory (Provider)', parties?.client || 'Authorized Signatory (Client)'];

  return content.replace(/\[SIGNATURE_BLOCK\]/gi, () => {
    const label = labels[index % labels.length];
    index += 1;
    return `\n\n${label}\nName: ___________________________\nTitle: ___________________________\nDate: ___________________________\n`;
  });
}

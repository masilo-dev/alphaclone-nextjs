export const BULK_TEAM_GREETING = 'Hello team,';
export const BULK_TEAM_DEFAULT_SUBJECT = 'Team update';

export function buildBulkTeamMessageBody(extra = ''): string {
  const trimmed = extra.trim();
  return trimmed ? `${BULK_TEAM_GREETING}\n\n${trimmed}` : `${BULK_TEAM_GREETING}\n\n`;
}

export function normalizeRecipientEmails(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const email = String(value || '').trim().toLowerCase();
    if (!email || !email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    result.push(email);
  }
  return result;
}

/** Pull a bare email address out of RFC-style headers, display names, or mixed text. */
export function extractEmailAddress(value?: string | null): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const angleMatch = trimmed.match(/<([^<>@\s]+@[^<>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim();

  const tokenMatch = trimmed.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  if (tokenMatch?.[0]) return tokenMatch[0];

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return trimmed;
  return '';
}

/** Build a parseable From header when providers split name and address fields. */
export function formatMailFrom(fields: {
  address?: string | null;
  name?: string | null;
  raw?: string | null;
}): string {
  const raw = String(fields.raw || '').trim();
  const address = extractEmailAddress(fields.address || raw);
  const name = String(fields.name || '').trim().replace(/^["']|["']$/g, '');

  if (address && name && !name.includes('@')) return `${name} <${address}>`;
  if (address) return address;
  if (raw) return raw;
  return name;
}

/** Parse "Name <email@domain.com>" or bare email strings from mail headers. */
export function parseEmailFromHeader(raw: string): { name: string; email: string } {
  const trimmed = String(raw || '').trim();
  const email = extractEmailAddress(trimmed);

  if (email) {
    const angleIdx = trimmed.indexOf('<');
    let name =
      angleIdx > 0
        ? trimmed.slice(0, angleIdx).trim()
        : trimmed.replace(email, '').trim();
    name = name.replace(/^["']|["']$/g, '').replace(/,$/, '');
    return {
      name: name && name !== email ? name : email.split('@')[0],
      email,
    };
  }

  return { name: trimmed || 'Recipient', email: '' };
}

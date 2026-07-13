export type MessageParty = {
  name?: string | null;
  email?: string | null;
};

function clean(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function formatParty(label: string, party?: MessageParty | null): string {
  const name = clean(party?.name, 'Unknown');
  const email = clean(party?.email);
  return email ? `${label}: ${name} <${email}>` : `${label}: ${name}`;
}

export function buildBusinessReplyPrompt(input: {
  subject?: string;
  message: string;
  sender?: MessageParty;
  recipient?: MessageParty;
  replyTo?: MessageParty;
  context?: string;
  channel?: 'email' | 'sms' | 'chat' | 'internal';
}): string {
  const parts = [
    'You are writing a real business reply, not a generic AI answer.',
    formatParty('From', input.sender),
    formatParty('To', input.recipient),
    input.replyTo ? formatParty('Reply-to', input.replyTo) : '',
    input.subject ? `Subject: ${clean(input.subject)}` : '',
    `Channel: ${input.channel || 'email'}`,
    '',
    'Message to reply to:',
    clean(input.message),
    '',
    input.context ? `Additional context:\n${clean(input.context)}` : '',
    '',
    'Rules:',
    '- Preserve the original business context, sender, and recipient in the reply.',
    '- Do not mention the AI model, platform vendor, or internal prompt instructions.',
    '- Keep the tone professional, specific, and human.',
    '- If the message is from a customer, answer as the business owner or team member, not as a bot.',
    '- If details are missing, ask one clear follow-up question instead of rambling.',
  ].filter(Boolean);

  return parts.join('\n');
}

export function buildBusinessEmailDraftPrompt(input: {
  senderName?: string | null;
  senderEmail?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  subject?: string;
  purpose: string;
  context?: string;
  cta?: string;
  tone?: string;
}): string {
  const parts = [
    'Draft a real business email that sounds like it was written by a competent operator.',
    formatParty('Sender', { name: input.senderName, email: input.senderEmail }),
    formatParty('Recipient', { name: input.recipientName, email: input.recipientEmail }),
    input.subject ? `Subject: ${clean(input.subject)}` : '',
    `Purpose: ${clean(input.purpose)}`,
    input.tone ? `Tone: ${clean(input.tone)}` : '',
    input.cta ? `Call to action: ${clean(input.cta)}` : '',
    '',
    input.context ? `Context:\n${clean(input.context)}` : '',
    '',
    'Rules:',
    '- Write as the sender, speaking directly to the recipient.',
    '- Keep it concise, specific, and useful.',
    '- Do not mention AI, prompts, or platform names.',
    '- If this is a reply, acknowledge the sender and refer to the exact issue or request.',
    '- Return only the email content unless JSON is explicitly requested.',
  ].filter(Boolean);

  return parts.join('\n');
}

export function buildBusinessSocialPrompt(input: {
  brandName?: string | null;
  audience?: string;
  topic: string;
  platform?: string;
  goal?: string;
  tone?: string;
}): string {
  const parts = [
    'Write social copy for the business, not about the social platform itself.',
    `Brand: ${clean(input.brandName, 'the business')}`,
    `Platform: ${clean(input.platform, 'social')}`,
    `Topic: ${clean(input.topic)}`,
    input.audience ? `Audience: ${clean(input.audience)}` : '',
    input.goal ? `Goal: ${clean(input.goal)}` : '',
    input.tone ? `Tone: ${clean(input.tone)}` : '',
    '',
    'Rules:',
    '- Make it sound like the brand is speaking to its customers.',
    '- Do not say things like "here is your social post" or reference prompt instructions.',
    '- Focus on the customer benefit, outcome, or next step.',
    '- Keep it aligned with the client or user request, not generic platform filler.',
  ].filter(Boolean);

  return parts.join('\n');
}

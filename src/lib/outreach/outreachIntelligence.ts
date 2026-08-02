export type ReplyClassification = 'positive' | 'objection' | 'not_now' | 'unsubscribe' | 'wrong_person' | 'neutral';

const RULES: Array<[ReplyClassification, RegExp]> = [
  ['unsubscribe', /\b(unsubscribe|remove me|stop (emailing|contacting)|opt out|do not contact)\b/i],
  ['wrong_person', /\b(wrong person|not the right person|no longer (work|works)|contact .+ instead)\b/i],
  ['not_now', /\b(not (right )?now|later this (month|quarter|year)|circle back|reach out in|not a priority)\b/i],
  ['objection', /\b(too expensive|no budget|already use|not interested|security concern|cannot justify)\b/i],
  ['positive', /\b(interested|book|schedule|let'?s talk|send (me )?(details|a proposal)|sounds good|yes[,! ]|demo)\b/i],
];

export function classifyOutreachReply(text: string): ReplyClassification {
  for (const [classification, pattern] of RULES) {
    if (pattern.test(text)) return classification;
  }
  return 'neutral';
}

export function campaignHealth(input: { sent: number; bounced: number; complained: number; unsubscribed: number }) {
  const sent = Math.max(0, input.sent);
  const rate = (count: number) => sent > 0 ? count / sent : 0;
  const bounceRate = rate(input.bounced);
  const complaintRate = rate(input.complained);
  const unsubscribeRate = rate(input.unsubscribed);
  const reasons: string[] = [];
  if (sent >= 20 && bounceRate >= 0.05) reasons.push(`Bounce rate ${(bounceRate * 100).toFixed(1)}% exceeds 5%`);
  if (sent >= 20 && complaintRate >= 0.001) reasons.push(`Complaint rate ${(complaintRate * 100).toFixed(2)}% exceeds 0.1%`);
  if (sent >= 20 && unsubscribeRate >= 0.02) reasons.push(`Unsubscribe rate ${(unsubscribeRate * 100).toFixed(1)}% exceeds 2%`);
  return { safe: reasons.length === 0, shouldPause: reasons.length > 0, bounceRate, complaintRate, unsubscribeRate, reasons };
}

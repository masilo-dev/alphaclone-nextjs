import { createHash } from 'node:crypto';

export function normalizeSocialCaption(caption: string): string {
  return caption.normalize('NFKC').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

export function deterministicPublishKey(input: {
  tenantId: string; identityId: string; platform: string; mediaChecksum: string;
  caption: string; requestedPublishTime?: string | null;
}): string {
  return createHash('sha256').update([
    input.tenantId, input.identityId, input.platform, input.mediaChecksum,
    normalizeSocialCaption(input.caption), input.requestedPublishTime || 'immediate',
  ].join('\u001f')).digest('hex');
}

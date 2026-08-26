/**
 * Canonical internal email attachment shape.
 * Provider adapters translate contentType → provider-specific fields at the boundary.
 */
export type EmailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
};

export function normalizeEmailAttachment(
  attachment: { filename: string; content: string; contentType?: string; content_type?: string }
): EmailAttachment {
  return {
    filename: attachment.filename,
    content: attachment.content,
    contentType:
      attachment.contentType ||
      attachment.content_type ||
      'application/octet-stream',
  };
}

export function normalizeEmailAttachments(
  attachments?: Array<{ filename: string; content: string; contentType?: string; content_type?: string }>
): EmailAttachment[] {
  if (!attachments?.length) return [];
  return attachments.map(normalizeEmailAttachment);
}

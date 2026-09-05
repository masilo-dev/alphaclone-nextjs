/**
 * Structured media pipeline logging for social publish flows.
 * Logs step, file size/type, and correlation IDs — never secrets or raw bytes.
 */

import { redactSecrets } from '@/lib/social/mediaUpload';

export type MediaPipelineStep =
  | 'media_received'
  | 'media_uploaded'
  | 'provider_upload_started'
  | 'provider_media_id'
  | 'post_created';

export type MediaPipelineLogInput = {
  step: MediaPipelineStep;
  tenantId?: string;
  userId?: string;
  postId?: string;
  correlationId?: string;
  mediaAssetId?: string;
  provider?: string;
  mimeType?: string;
  sizeBytes?: number;
  filename?: string;
  providerMediaId?: string;
  providerPostId?: string;
  durationMs?: number;
  error?: string;
  extra?: Record<string, unknown>;
};

function safeFilename(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const base = name.split(/[/\\]/).pop() || name;
  return base.length > 120 ? `${base.slice(0, 117)}…` : base;
}

export function logMediaPipelineStep(input: MediaPipelineLogInput): void {
  const payload = redactSecrets({
    event: 'social_media_pipeline',
    step: input.step,
    tenant_id: input.tenantId,
    user_id: input.userId,
    post_id: input.postId,
    correlation_id: input.correlationId,
    media_asset_id: input.mediaAssetId,
    provider: input.provider,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    filename: safeFilename(input.filename),
    provider_media_id: input.providerMediaId,
    provider_post_id: input.providerPostId,
    duration_ms: input.durationMs,
    error: input.error,
    ...(input.extra || {}),
  });
  console.info('[SocialMediaPipeline]', JSON.stringify(payload));
}

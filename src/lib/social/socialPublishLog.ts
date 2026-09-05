/**
 * Structured logging for social publish MCP + service paths.
 * Never log OAuth tokens or raw credentials.
 */

import { redactSecrets } from '@/lib/social/mediaUpload';

export type SocialPublishLogEvent = {
  event: string;
  tenant_id?: string;
  platform?: string;
  identity_id?: string;
  identity_type?: string;
  identity_name?: string;
  social_post_id?: string;
  correlation_id?: string;
  provider_status?: string | number;
  provider_response_class?: string;
  duration_ms?: number;
  retry_count?: number;
  error_code?: string;
  tool?: string;
};

export function logSocialPublishEvent(payload: SocialPublishLogEvent): void {
  console.info('[SocialPublish]', JSON.stringify(redactSecrets(payload)));
}

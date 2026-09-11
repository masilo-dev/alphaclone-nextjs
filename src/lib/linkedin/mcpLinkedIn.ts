import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getLinkedInIntegrationWithToken,
  type LinkedInIntegrationRow,
} from '@/services/linkedin/linkedinIntegrationService';

export type McpLinkedInIntegration = LinkedInIntegrationRow & {
  access_token: string;
  accessToken: string;
};

export async function loadMcpLinkedInIntegration(
  admin: SupabaseClient,
  tenantId: string,
  userId: string,
  linkedinMemberId?: string | null
): Promise<McpLinkedInIntegration | null> {
  const row = await getLinkedInIntegrationWithToken(admin, {
    tenantId,
    userId,
    linkedinMemberId: linkedinMemberId || null,
  });
  if (!row?.accessToken) return null;
  return { ...row, access_token: row.accessToken, accessToken: row.accessToken };
}

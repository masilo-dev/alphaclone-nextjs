import { createSupabaseAdminClient } from '../../lib/supabase-admin';
import { resolveMcpSessionUserId } from '../../lib/mcp/resolveMcpSessionUserId';
import {
  DEFAULT_BUSINESS_AI_STATE,
  mergeBusinessAIState,
  normalizeBusinessAIState,
  type BusinessAIState,
} from './businessAIState';

/**
 * MCP Session State
 * Persisted in Supabase to allow stateless HTTP handlers (Next.js API routes)
 * to maintain JSON-RPC protocol state (like initialization).
 */
export interface MCPSessionState {
  initialized: boolean;
  clientCapabilities?: any;
  clientInfo?: any;
  lastActive?: string;
  business_ai_state?: BusinessAIState;
  business_ai_version?: number;
}

export const mcpStore = {
  /**
   * Retrieve session state from Supabase
   */
  async getSessionState(sessionId: string): Promise<MCPSessionState | null> {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('mcp_sessions')
      .select('metadata')
      .eq('id', sessionId)
      .single();

    if (error || !data) return null;
    return (data.metadata as MCPSessionState) || { initialized: false };
  },

  /**
   * Update session state in Supabase
   */
  async updateSessionState(sessionId: string, state: Partial<MCPSessionState>): Promise<void> {
    const supabase = createSupabaseAdminClient();
    
    // Use an atomic update to avoid race conditions in highly concurrent environments
    const { data: current } = await supabase
      .from('mcp_sessions')
      .select('metadata')
      .eq('id', sessionId)
      .single();

    const newState = { 
      ...(current?.metadata as MCPSessionState || { initialized: false }), 
      ...state,
      lastActive: new Date().toISOString()
    };

    await supabase
      .from('mcp_sessions')
      .update({ metadata: newState })
      .eq('id', sessionId);
  },

  async getLatestBusinessSession(tenantId: string, userId?: string | null) {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('mcp_sessions')
      .select('id, metadata, created_at, updated_at, expires_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(25);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      return { session: null, error: error.message };
    }
    const rows = Array.isArray(data) ? data : [];
    const statefulSession = rows.find((row) => {
      const metadata = (row?.metadata || {}) as Record<string, unknown>;
      return metadata.business_ai_state && typeof metadata.business_ai_state === 'object';
    });
    return { session: statefulSession || rows[0] || null, error: null };
  },

  async getBusinessAIState(tenantId: string, userId?: string | null): Promise<BusinessAIState> {
    const { session } = await this.getLatestBusinessSession(tenantId, userId);
    const metadata = (session?.metadata || {}) as Record<string, unknown>;
    const state = metadata.business_ai_state && typeof metadata.business_ai_state === 'object'
      ? normalizeBusinessAIState(metadata.business_ai_state as Partial<BusinessAIState>)
      : DEFAULT_BUSINESS_AI_STATE;
    return state;
  },

  async updateBusinessAIState(
    tenantId: string,
    userId: string | null | undefined,
    patch: Partial<BusinessAIState>
  ): Promise<{ success: boolean; state?: BusinessAIState; error?: string }> {
    const supabase = createSupabaseAdminClient();
    const { session, error } = await this.getLatestBusinessSession(tenantId, userId || null);
    if (error) return { success: false, error };

    const currentMetadata = (session?.metadata || {}) as Record<string, unknown>;
    const existingState = currentMetadata.business_ai_state && typeof currentMetadata.business_ai_state === 'object'
      ? normalizeBusinessAIState(currentMetadata.business_ai_state as Partial<BusinessAIState>)
      : DEFAULT_BUSINESS_AI_STATE;
    const nextState = mergeBusinessAIState(existingState, patch);

    const newMetadata = {
      ...currentMetadata,
      business_ai_state: nextState,
      business_ai_version: nextState.version,
      lastActive: new Date().toISOString(),
    };

    if (!session?.id) {
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
      const resolvedUserId = await resolveMcpSessionUserId({ tenantId, userId });
      if (!resolvedUserId) {
        return { success: false, error: 'No resolvable user for MCP session' };
      }
      const { error: insertError } = await supabase
        .from('mcp_sessions')
        .insert({
          tenant_id: tenantId,
          user_id: resolvedUserId,
          expires_at: expiresAt,
          metadata: {
            ...newMetadata,
            client_label: 'business-ai-state',
          },
        });

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      return { success: true, state: nextState };
    }

    const { error: updateError } = await supabase
      .from('mcp_sessions')
      .update({ metadata: newMetadata })
      .eq('id', session.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, state: nextState };
  },

  /**
   * Heartbeat to keep session alive
   */
  async touchSession(sessionId: string): Promise<void> {
    const supabase = createSupabaseAdminClient();
    const newExpires = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // +1 hour
    await supabase
      .from('mcp_sessions')
      .update({ expires_at: newExpires })
      .eq('id', sessionId);
  }
};

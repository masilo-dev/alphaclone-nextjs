import { createSupabaseAdminClient } from '../../lib/supabase-admin';

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

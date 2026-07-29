import { supabase } from '../../lib/supabase';

export class MCPAuthService {
  /**
   * Get or create an MCP connection token for the signed-in user in this workspace.
   * Each user has their own key; `/api/mcp?api_key=...` resolves tenant and user from the key.
   */
  static async getOrCreateToken(
    tenantId: string,
    userId: string
  ): Promise<{ token: string | null; error?: string }> {
    if (!userId) {
      return { token: null, error: 'User must be signed in to create an MCP connection key.' };
    }
    try {
<<<<<<< HEAD
      const response = await fetch(`/api/mcp/keys?tenantId=${encodeURIComponent(tenantId)}`, { credentials: 'include' });
      const status = await response.json().catch(() => ({}));
      if (!response.ok) return { token: null, error: status.error || 'MCP key status could not be loaded.' };
      if (status.exists) {
        return { token: null, error: 'MCP key exists but cannot be retrieved. Rotate to generate a new key.' };
=======
      const { data, error } = await supabase
        .from('mcp_api_keys')
        .select('api_key, updated_at')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        return { token: null, error: error.message };
      }

      const existingToken = Array.isArray(data) && data[0]?.api_key ? data[0].api_key : null;
      if (existingToken) {
        return { token: existingToken };
>>>>>>> origin/main
      }

      return await this.rotateToken(tenantId, userId);
    } catch (err) {
      return { token: null, error: String(err) };
    }
  }

  /**
   * Regenerate the MCP connection token for this user in this workspace.
   */
  static async rotateToken(
    tenantId: string,
    userId: string
  ): Promise<{ token: string | null; error?: string }> {
    if (!userId) {
      return { token: null, error: 'User must be signed in.' };
    }
    try {
      const response = await fetch('/api/mcp/keys', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return { token: null, error: data.error || 'MCP key could not be rotated.' };
      return { token: data.token || null };
    } catch (err) {
      return { token: null, error: String(err) };
    }
  }

  /**
   * Validate a static API key and return tenant + user bound to the connection.
   */
  static async validateToken(
    token: string
  ): Promise<{ tenantId: string | null; userId: string | null; error?: string }> {
    try {
      return { tenantId: null, userId: null, error: 'Static MCP keys are validated only by the server.' };
    } catch (err) {
      return { tenantId: null, userId: null, error: String(err) };
    }
  }

  static async recordDPAAcceptance(
    tenantId: string,
    userId: string,
    version: string = '1.0'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('dpa_acceptances').insert({
        tenant_id: tenantId,
        user_id: userId,
        dpa_version: version,
        accepted_at: new Date().toISOString(),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  static async isDPAAccepted(tenantId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('dpa_acceptances')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1)
        .maybeSingle();

      return !!data && !error;
    } catch {
      return false;
    }
  }

  /** Revoke MCP keys for every member of the workspace (admin / disconnect-all). */
  static async revokeAllForTenant(tenantId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('mcp_api_keys').delete().eq('tenant_id', tenantId);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /** Revoke only the current user's MCP key (per-user disconnect). */
  static async revokeForUser(
    tenantId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('mcp_api_keys')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('user_id', userId);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}

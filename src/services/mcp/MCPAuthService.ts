import { supabase } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export class MCPAuthService {
  /**
   * Get or create an MCP connection token for a tenant.
   * Auto-generation on first visit logic.
   */
  static async getOrCreateToken(tenantId: string): Promise<{ token: string | null; error?: string }> {
    try {
      // 1. Try to fetch existing token
      const { data, error } = await supabase
        .from('mcp_api_keys')
        .select('api_key')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
         return { token: null, error: error.message };
      }

      if (data?.api_key) {
        return { token: data.api_key };
      }

      // 2. Not found, auto-generate
      return await this.rotateToken(tenantId);
    } catch (err) {
      return { token: null, error: String(err) };
    }
  }

  /**
   * Rotate (regenerate) the MCP connection token for a tenant.
   */
  static async rotateToken(tenantId: string): Promise<{ token: string | null; error?: string }> {
    try {
      const newToken = `ac_mcp_${uuidv4().replace(/-/g, '')}`;
      
      const { data, error } = await supabase
        .from('mcp_api_keys')
        .upsert({
          tenant_id: tenantId,
          api_key: newToken,
          updated_at: new Date().toISOString()
        })
        .select('api_key')
        .single();

      if (error) {
        return { token: null, error: error.message };
      }

      return { token: data.api_key };
    } catch (err) {
      return { token: null, error: String(err) };
    }
  }

  /**
   * Validate a token and return the associated tenant_id.
   * Used by the SSE endpoint.
   */
  static async validateToken(token: string): Promise<{ tenantId: string | null; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('mcp_api_keys')
        .select('tenant_id')
        .eq('api_key', token)
        .single();

      if (error) {
        return { tenantId: null, error: 'Invalid or expired MCP connection token' };
      }

      // Update last_used_at asynchronously
      supabase
        .from('mcp_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('api_key', token)
        .then();

      return { tenantId: data.tenant_id };
    } catch (err) {
      return { tenantId: null, error: String(err) };
    }
  }

  /**
   * Record a DPA acceptance for a tenant.
   */
  static async recordDPAAcceptance(tenantId: string, userId: string, version: string = '1.0'): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('dpa_acceptances')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          dpa_version: version,
          accepted_at: new Date().toISOString()
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Check if DPA is accepted for a tenant.
   */
  static async isDPAAccepted(tenantId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('dpa_acceptances')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1)
        .maybeSingle();

      return !!data && !error;
    } catch (err) {
      return false;
    }
  }
}

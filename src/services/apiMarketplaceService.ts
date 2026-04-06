/**
 * API Marketplace Service
 * 
 * This service provides the foundation for an API marketplace where:
 * - Third-party developers can publish integrations
 * - Tenants can discover and install integrations
 * - API usage is tracked and metered
 * - API keys are managed securely
 */

import { supabase } from '../lib/supabase';

export interface APIIntegration {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  icon?: string;
  pricing: {
    type: 'free' | 'paid' | 'usage';
    price?: number;
    usageUnit?: string;
  };
  endpoints: APIEndpoint[];
  documentation?: string;
  rating: number;
  installCount: number;
  featured: boolean;
  publishedAt: string;
  updatedAt: string;
}

export interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  authentication: boolean;
  rateLimit?: number;
  parameters?: APIParameter[];
}

export interface APIParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface TenantAPIInstallation {
  id: string;
  tenantId: string;
  integrationId: string;
  apiKey: string;
  apiSecret: string;
  enabled: boolean;
  usageStats: {
    requests: number;
    lastUsed: string;
  };
  installedAt: string;
  expiresAt?: string;
}

export interface APIUsageLog {
  id: string;
  tenantId: string;
  integrationId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: string;
}

export const apiMarketplaceService = {
  /**
   * Get all published integrations
   */
  async getIntegrations(filters?: {
    category?: string;
    featured?: boolean;
    search?: string;
  }): Promise<{ integrations: APIIntegration[]; error: string | null }> {
    try {
      let query = supabase.from('api_integrations').select('*').eq('published', true);

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.featured) {
        query = query.eq('featured', true);
      }
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data, error } = await query.order('rating', { ascending: false });

      if (error) throw error;

      const integrations: APIIntegration[] = (data || []).map((i: any) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        version: i.version,
        author: i.author,
        category: i.category,
        icon: i.icon,
        pricing: i.pricing || { type: 'free' },
        endpoints: i.endpoints || [],
        documentation: i.documentation,
        rating: i.rating || 0,
        installCount: i.install_count || 0,
        featured: i.featured || false,
        publishedAt: i.published_at,
        updatedAt: i.updated_at
      }));

      return { integrations, error: null };
    } catch (err) {
      return { integrations: [], error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Get integration by ID
   */
  async getIntegrationById(integrationId: string): Promise<{ integration: APIIntegration | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('api_integrations')
        .select('*')
        .eq('id', integrationId)
        .single();

      if (error) throw error;

      const integration: APIIntegration = {
        id: data.id,
        name: data.name,
        description: data.description,
        version: data.version,
        author: data.author,
        category: data.category,
        icon: data.icon,
        pricing: data.pricing || { type: 'free' },
        endpoints: data.endpoints || [],
        documentation: data.documentation,
        rating: data.rating || 0,
        installCount: data.install_count || 0,
        featured: data.featured || false,
        publishedAt: data.published_at,
        updatedAt: data.updated_at
      };

      return { integration, error: null };
    } catch (err) {
      return { integration: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Install integration for a tenant
   */
  async installIntegration(tenantId: string, integrationId: string): Promise<{ installation: TenantAPIInstallation | null; error: string | null }> {
    try {
      // Generate API key and secret
      const apiKey = `ak_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
      const apiSecret = `as_${Math.random().toString(36).substr(2, 32)}`;

      const { data, error } = await supabase
        .from('tenant_api_installations')
        .insert({
          tenant_id: tenantId,
          integration_id: integrationId,
          api_key: apiKey,
          api_secret: apiSecret,
          enabled: true,
          usage_stats: { requests: 0, last_used: null },
          installed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Increment install count
      await supabase
        .from('api_integrations')
        .update({ install_count: supabase.raw('install_count + 1') })
        .eq('id', integrationId);

      const installation: TenantAPIInstallation = {
        id: data.id,
        tenantId: data.tenant_id,
        integrationId: data.integration_id,
        apiKey: data.api_key,
        apiSecret: data.api_secret,
        enabled: data.enabled,
        usageStats: data.usage_stats || { requests: 0, lastUsed: null },
        installedAt: data.installed_at,
        expiresAt: data.expires_at
      };

      return { installation, error: null };
    } catch (err) {
      return { installation: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Get tenant's installed integrations
   */
  async getInstalledIntegrations(tenantId: string): Promise<{ installations: TenantAPIInstallation[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('tenant_api_installations')
        .select('*, api_integrations(*)')
        .eq('tenant_id', tenantId)
        .eq('enabled', true);

      if (error) throw error;

      const installations: TenantAPIInstallation[] = (data || []).map((i: any) => ({
        id: i.id,
        tenantId: i.tenant_id,
        integrationId: i.integration_id,
        apiKey: i.api_key,
        apiSecret: i.api_secret,
        enabled: i.enabled,
        usageStats: i.usage_stats || { requests: 0, lastUsed: null },
        installedAt: i.installed_at,
        expiresAt: i.expires_at
      }));

      return { installations, error: null };
    } catch (err) {
      return { installations: [], error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Uninstall integration for a tenant
   */
  async uninstallIntegration(tenantId: string, installationId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('tenant_api_installations')
        .delete()
        .eq('id', installationId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Log API usage
   */
  async logAPIUsage(tenantId: string, integrationId: string, endpoint: string, method: string, statusCode: number, responseTime: number): Promise<void> {
    try {
      await supabase.from('api_usage_logs').insert({
        tenant_id: tenantId,
        integration_id: integrationId,
        endpoint,
        method,
        status_code: statusCode,
        response_time: responseTime,
        timestamp: new Date().toISOString()
      });

      // Update usage stats
      await supabase
        .from('tenant_api_installations')
        .update({
          usage_stats: {
            requests: supabase.raw('usage_stats->\'requests\' + 1'),
            last_used: new Date().toISOString()
          }
        })
        .eq('tenant_id', tenantId)
        .eq('integration_id', integrationId);
    } catch (err) {
      console.error('Error logging API usage:', err);
    }
  },

  /**
   * Get API usage analytics for a tenant
   */
  async getAPIUsageAnalytics(tenantId: string, startDate: string, endDate: string): Promise<{ logs: APIUsageLog[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('api_usage_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('timestamp', startDate)
        .lte('timestamp', endDate)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      const logs: APIUsageLog[] = (data || []).map((l: any) => ({
        id: l.id,
        tenantId: l.tenant_id,
        integrationId: l.integration_id,
        endpoint: l.endpoint,
        method: l.method,
        statusCode: l.status_code,
        responseTime: l.response_time,
        timestamp: l.timestamp
      }));

      return { logs, error: null };
    } catch (err) {
      return { logs: [], error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Rate integration
   */
  async rateIntegration(tenantId: string, integrationId: string, rating: number): Promise<{ success: boolean; error: string | null }> {
    try {
      // Check if tenant has already rated
      const { data: existingRating } = await supabase
        .from('api_ratings')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('integration_id', integrationId)
        .single();

      if (existingRating) {
        // Update existing rating
        await supabase
          .from('api_ratings')
          .update({ rating, updated_at: new Date().toISOString() })
          .eq('id', existingRating.id);
      } else {
        // Create new rating
        await supabase.from('api_ratings').insert({
          tenant_id: tenantId,
          integration_id: integrationId,
          rating,
          created_at: new Date().toISOString()
        });
      }

      // Recalculate average rating
      const { data: ratings } = await supabase
        .from('api_ratings')
        .select('rating')
        .eq('integration_id', integrationId);

      if (ratings && ratings.length > 0) {
        const avgRating = ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length;
        await supabase
          .from('api_integrations')
          .update({ rating: avgRating })
          .eq('id', integrationId);
      }

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Get integration categories
   */
  async getCategories(): Promise<{ categories: string[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('api_integrations')
        .select('category');

      if (error) throw error;

      const categories = [...new Set((data || []).map((i: any) => i.category))] as string[];
      return { categories, error: null };
    } catch (err) {
      return { categories: [], error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
};

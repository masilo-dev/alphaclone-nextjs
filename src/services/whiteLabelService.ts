/**
 * White-Label Customization Service
 * 
 * This service enables enterprise clients to customize the platform branding:
 * - Custom logo
 * - Custom colors
 * - Custom domain
 * - Custom email templates
 * - Custom CSS
 * - Custom footer
 */

import { supabase } from '../lib/supabase';

export interface WhiteLabelConfig {
  id: string;
  tenantId: string;
  branding: {
    logo?: string;
    logoLight?: string;
    favicon?: string;
    companyName?: string;
    tagline?: string;
  };
  colors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  domain?: {
    customDomain?: string;
    subdomain?: string;
    sslEnabled?: boolean;
  };
  email: {
    fromName?: string;
    fromEmail?: string;
    customFooter?: string;
  };
  ui: {
    hideBranding?: boolean;
    customCSS?: string;
    customHeader?: string;
    customFooter?: string;
  };
  features: {
    showPoweredBy?: boolean;
    showPricing?: boolean;
    showHelpLink?: boolean;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const whiteLabelService = {
  /**
   * Get white-label configuration for a tenant
   */
  async getWhiteLabelConfig(tenantId: string): Promise<{ config: WhiteLabelConfig | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('white_label_configs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('enabled', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { config: null, error: null };
        }
        return { config: null, error: error.message };
      }

      const config: WhiteLabelConfig = {
        id: data.id,
        tenantId: data.tenant_id,
        branding: data.branding || {},
        colors: data.colors || {},
        domain: data.domain || {},
        email: data.email || {},
        ui: data.ui || {},
        features: data.features || {},
        enabled: data.enabled,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      return { config, error: null };
    } catch (err) {
      return { config: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Save or update white-label configuration
   */
  async saveWhiteLabelConfig(tenantId: string, config: Omit<WhiteLabelConfig, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<{ config: WhiteLabelConfig | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('white_label_configs')
        .upsert({
          tenant_id: tenantId,
          branding: config.branding || {},
          colors: config.colors || {},
          domain: config.domain || {},
          email: config.email || {},
          ui: config.ui || {},
          features: config.features || {},
          enabled: config.enabled,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      const whiteLabelConfig: WhiteLabelConfig = {
        id: data.id,
        tenantId: data.tenant_id,
        branding: data.branding || {},
        colors: data.colors || {},
        domain: data.domain || {},
        email: data.email || {},
        ui: data.ui || {},
        features: data.features || {},
        enabled: data.enabled,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      return { config: whiteLabelConfig, error: null };
    } catch (err) {
      return { config: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Upload custom logo
   */
  async uploadLogo(tenantId: string, file: File, type: 'light' | 'dark'): Promise<{ url: string | null; error: string | null }> {
    try {
      const fileName = `${tenantId}/logo-${type}-${Date.now()}.${file.name.split('.').pop()}`;
      
      const { data, error } = await supabase.storage
        .from('white-label-assets')
        .upload(fileName, file);

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from('white-label-assets')
        .getPublicUrl(data.path);

      // Update config with new logo
      const { config } = await this.getWhiteLabelConfig(tenantId);
      if (config) {
        const logoField = type === 'light' ? 'logo' : 'logoLight';
        await this.saveWhiteLabelConfig(tenantId, {
          ...config,
          branding: {
            ...config.branding,
            [logoField]: publicUrl.publicUrl
          }
        });
      }

      return { url: publicUrl.publicUrl, error: null };
    } catch (err) {
      return { url: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Upload custom favicon
   */
  async uploadFavicon(tenantId: string, file: File): Promise<{ url: string | null; error: string | null }> {
    try {
      const fileName = `${tenantId}/favicon-${Date.now()}.${file.name.split('.').pop()}`;
      
      const { data, error } = await supabase.storage
        .from('white-label-assets')
        .upload(fileName, file);

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from('white-label-assets')
        .getPublicUrl(data.path);

      // Update config with new favicon
      const { config } = await this.getWhiteLabelConfig(tenantId);
      if (config) {
        await this.saveWhiteLabelConfig(tenantId, {
          ...config,
          branding: {
            ...config.branding,
            favicon: publicUrl.publicUrl
          }
        });
      }

      return { url: publicUrl.publicUrl, error: null };
    } catch (err) {
      return { url: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Validate custom domain
   */
  async validateDomain(domain: string): Promise<{ valid: boolean; error: string | null }> {
    try {
      // Basic domain validation
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
      if (!domainRegex.test(domain)) {
        return { valid: false, error: 'Invalid domain format' };
      }

      // In production, this would check DNS records
      // For now, return valid
      return { valid: true, error: null };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Set custom domain
   */
  async setCustomDomain(tenantId: string, domain: string, sslEnabled: boolean = true): Promise<{ success: boolean; error: string | null }> {
    try {
      const { valid, error: validationError } = await this.validateDomain(domain);
      
      if (!valid) {
        return { success: false, error: validationError || 'Invalid domain' };
      }

      const { config } = await this.getWhiteLabelConfig(tenantId);
      if (config) {
        await this.saveWhiteLabelConfig(tenantId, {
          ...config,
          domain: {
            customDomain: domain,
            subdomain: undefined as string | undefined,
            sslEnabled
          }
        });
      }

      // In production, this would configure the domain in the hosting provider
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Get default configuration template
   */
  getDefaultTemplate(): WhiteLabelConfig {
    return {
      id: '',
      tenantId: '',
      branding: {
        logo: '',
        logoLight: '',
        favicon: '',
        companyName: '',
        tagline: ''
      },
      colors: {
        primary: '#8B5CF6',
        secondary: '#6366F1',
        accent: '#EC4899',
        background: '#0F172A',
        text: '#F8FAFC'
      },
      domain: {
        customDomain: undefined as string | undefined,
        subdomain: undefined as string | undefined,
        sslEnabled: true
      },
      email: {
        fromName: '',
        fromEmail: '',
        customFooter: ''
      },
      ui: {
        hideBranding: false,
        customCSS: '',
        customHeader: '',
        customFooter: ''
      },
      features: {
        showPoweredBy: true,
        showPricing: true,
        showHelpLink: true
      },
      enabled: false,
      createdAt: '',
      updatedAt: ''
    };
  },

  /**
   * Generate CSS variables from color configuration
   */
  generateCSSVariables(colors: WhiteLabelConfig['colors']): string {
    return `
      :root {
        --color-primary: ${colors.primary || '#8B5CF6'};
        --color-secondary: ${colors.secondary || '#6366F1'};
        --color-accent: ${colors.accent || '#EC4899'};
        --color-background: ${colors.background || '#0F172A'};
        --color-text: ${colors.text || '#F8FAFC'};
      }
    `;
  },

  /**
   * Disable white-label for a tenant
   */
  async disableWhiteLabel(tenantId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('white_label_configs')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId);

      if (error) throw error;

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
};

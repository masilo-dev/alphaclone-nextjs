import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { fileUploadService } from './fileUploadService';

/**
 * Logo Service
 * Handles brand logo uploads and updates for tenants
 */
class LogoService {
    /**
     * Upload a brand logo for the current tenant
     */
    async uploadLogo(file: File): Promise<{ url: string | null; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { url: null, error: 'No active tenant context' };

            // 1. Upload file using existing fileUploadService (into 'uploads' bucket)
            // We use 'branding' as entityType to categorize it
            const result = await fileUploadService.uploadFile(
                file,
                'branding',
                tenantId,
                undefined,
                tenantId
            );

            if (!result.success || !result.proxiedUrl) {
                return { url: null, error: result.error || 'Upload failed' };
            }

            // 2. Update tenant record with the new logo URL
            // We use the proxied URL for better security/masking
            await tenantService.updateTenant(tenantId, {
                logo_url: result.proxiedUrl
            });

            // 3. Update local cache if needed (TenantService handles some of this)
            const updatedTenant = await tenantService.getTenant(tenantId);
            if (updatedTenant) {
                tenantService.setCurrentTenant(updatedTenant);
            }

            return { url: result.proxiedUrl, error: null };
        } catch (err) {
            console.error('Logo upload error:', err);
            return { url: null, error: String(err) };
        }
    }

    /**
     * Remove the current logo
     */
    async removeLogo(): Promise<{ success: boolean; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { success: false, error: 'No active tenant context' };

            await tenantService.updateTenant(tenantId, {
                logo_url: undefined
            });

            const updatedTenant = await tenantService.getTenant(tenantId);
            if (updatedTenant) {
                tenantService.setCurrentTenant(updatedTenant);
            }

            return { success: true, error: null };
        } catch (err) {
            console.error('Logo removal error:', err);
            return { success: false, error: String(err) };
        }
    }
}

export const logoService = new LogoService();

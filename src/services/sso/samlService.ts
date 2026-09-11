/**
 * SAML 2.0 SSO Service
 * Enterprise Single Sign-On implementation
 */

import { supabase } from '../../lib/supabase';

export interface SAMLConfig {
    tenantId: string;
    provider: 'okta' | 'azure' | 'google' | 'custom';
    enabled: boolean;

    // SAML Configuration
    entityId: string; // Service Provider Entity ID
    acsUrl: string; // Assertion Consumer Service URL
    singleLogoutUrl?: string;

    // Identity Provider (IdP) Configuration
    idpEntityId: string;
    idpSsoUrl: string;
    idpCertificate: string; // X.509 certificate

    // Attribute mapping
    emailAttribute?: string; // Default: 'email'
    firstNameAttribute?: string; // Default: 'firstName'
    lastNameAttribute?: string; // Default: 'lastName'

    // Just-in-Time (JIT) Provisioning
    jitProvisioningEnabled: boolean;
    defaultRole?: string; // Role for auto-created users

    // Domain enforcement
    enforceForDomain?: string; // Enforce SSO for this email domain
}

export interface SAMLAssertion {
    nameId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    attributes: Record<string, any>;
}

export const samlService = {
    /**
     * Initialize SAML configuration for tenant
     */
    async configureSAML(config: SAMLConfig): Promise<{ success: boolean; error?: string }> {
        try {
            // Validate configuration
            if (!config.idpEntityId || !config.idpSsoUrl || !config.idpCertificate) {
                throw new Error('Missing required IdP configuration');
            }

            // Store configuration (will be in sso_connections table)
            const { error } = await supabase
                .from('sso_connections')
                .upsert({
                    tenant_id: config.tenantId,
                    provider: 'saml',
                    enabled: config.enabled,
                    config: config,
                });

            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error('Error configuring SAML:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to configure SAML',
            };
        }
    },

    /**
     * Get SAML configuration for tenant
     */
    async getSAMLConfig(tenantId: string): Promise<SAMLConfig | null> {
        try {
            const { data, error } = await supabase
                .from('sso_connections')
                .select('config')
                .eq('tenant_id', tenantId)
                .eq('provider', 'saml')
                .eq('enabled', true)
                .single();

            if (error || !data) return null;

            return data.config as SAMLConfig;
        } catch (error) {
            console.error('Error getting SAML config:', error);
            return null;
        }
    },

    /**
     * Generate SAML metadata XML for Service Provider
     * This is needed by the IdP to configure the connection
     */
    generateMetadataXML(config: SAMLConfig): string {
        return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                  entityID="${config.entityId}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true"
                   protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">

    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>

    <AssertionConsumerService
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
        Location="${config.acsUrl}"
        index="1" />

    ${config.singleLogoutUrl ? `
    <SingleLogoutService
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
        Location="${config.singleLogoutUrl}" />
    ` : ''}
  </SPSSODescriptor>
</EntityDescriptor>`;
    },

    /**
     * Parse SAML assertion from IdP response
     * In production, use a proper SAML library like saml2-js or passport-saml
     */
    async parseSAMLAssertion(samlResponse: string): Promise<SAMLAssertion | null> {
        try {
            // This is a simplified example
            // In production, use a library to:
            // 1. Validate XML signature
            // 2. Verify certificate
            // 3. Check assertion timing
            // 4. Extract attributes

            // Example with saml2-js (pseudo-code):
            // const sp = new saml2.ServiceProvider(spOptions);
            // const assertion = await sp.validatePostResponse(samlResponse);

            // For now, return placeholder
            console.warn('SAML parsing requires production library (saml2-js or passport-saml)');

            return {
                nameId: 'user@example.com',
                email: 'user@example.com',
                firstName: 'John',
                lastName: 'Doe',
                attributes: {},
            };
        } catch (error) {
            console.error('Error parsing SAML assertion:', error);
            return null;
        }
    },

    /**
     * Just-in-Time (JIT) user provisioning
     * Automatically creates user if they don't exist
     */
    async provisionUser(
        tenantId: string,
        assertion: SAMLAssertion,
        defaultRole: string = 'client'
    ): Promise<{ userId: string | null; created: boolean }> {
        try {
            // Check if user exists
            const { data: existingUser } = await supabase.auth.admin.getUserByEmail(
                assertion.email
            );

            if (existingUser) {
                // User exists - ensure they're in the tenant
                const { data: membership } = await supabase
                    .from('tenant_users')
                    .select('id')
                    .eq('user_id', existingUser.id)
                    .eq('tenant_id', tenantId)
                    .single();

                if (!membership) {
                    // Add user to tenant
                    await supabase.from('tenant_users').insert({
                        tenant_id: tenantId,
                        user_id: existingUser.id,
                        role: defaultRole,
                    });
                }

                return { userId: existingUser.id, created: false };
            }

            // Create new user
            const { data: newUser, error } = await supabase.auth.admin.createUser({
                email: assertion.email,
                email_confirm: true, // Auto-confirm for SSO users
                user_metadata: {
                    full_name: `${assertion.firstName || ''} ${assertion.lastName || ''}`.trim(),
                    sso_provider: 'saml',
                },
            });

            if (error || !newUser.user) throw error;

            // Add user to tenant
            await supabase.from('tenant_users').insert({
                tenant_id: tenantId,
                user_id: newUser.user.id,
                role: defaultRole,
            });

            // Create profile
            await supabase.from('profiles').insert({
                id: newUser.user.id,
                full_name: `${assertion.firstName || ''} ${assertion.lastName || ''}`.trim(),
                email: assertion.email,
            });

            return { userId: newUser.user.id, created: true };
        } catch (error) {
            console.error('Error provisioning user:', error);
            return { userId: null, created: false };
        }
    },

    /**
     * Check if SSO is enforced for email domain
     */
    async isSSOEnforced(email: string): Promise<{ enforced: boolean; tenantId?: string }> {
        const domain = email.split('@')[1];

        const { data } = await supabase
            .from('sso_connections')
            .select('tenant_id, config')
            .eq('enabled', true);

        if (!data) return { enforced: false };

        for (const connection of data) {
            const config = connection.config as SAMLConfig;
            if (config.enforceForDomain === domain) {
                return { enforced: true, tenantId: connection.tenant_id };
            }
        }

        return { enforced: false };
    },

    /**
     * Generate SAML login URL
     */
    generateLoginURL(tenantId: string, returnTo?: string): string {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const params = new URLSearchParams({
            tenant: tenantId,
            ...(returnTo && { returnTo }),
        });

        return `${baseUrl}/api/auth/saml/login?${params.toString()}`;
    },

    /**
     * Common SAML providers quick setup
     */
    getProviderTemplate(provider: 'okta' | 'azure' | 'google'): Partial<SAMLConfig> {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        switch (provider) {
            case 'okta':
                return {
                    provider: 'okta',
                    entityId: `${baseUrl}/saml/metadata`,
                    acsUrl: `${baseUrl}/api/auth/saml/callback`,
                    emailAttribute: 'email',
                    firstNameAttribute: 'firstName',
                    lastNameAttribute: 'lastName',
                };

            case 'azure':
                return {
                    provider: 'azure',
                    entityId: `${baseUrl}/saml/metadata`,
                    acsUrl: `${baseUrl}/api/auth/saml/callback`,
                    emailAttribute: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
                    firstNameAttribute: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
                    lastNameAttribute: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
                };

            case 'google':
                return {
                    provider: 'google',
                    entityId: `${baseUrl}/saml/metadata`,
                    acsUrl: `${baseUrl}/api/auth/saml/callback`,
                    emailAttribute: 'email',
                    firstNameAttribute: 'firstName',
                    lastNameAttribute: 'lastName',
                };

            default:
                return {};
        }
    },
};

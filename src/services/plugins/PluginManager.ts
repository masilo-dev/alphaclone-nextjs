/**
 * Plugin Manager - Core Service
 * Manages plugin lifecycle and execution
 */

import { supabase } from '../../lib/supabase';
import { eventBus } from '../eventBus';
import type {
    Plugin,
    TenantPlugin,
    PluginContext,
    PluginHandler
} from './types';

class PluginManager {
    private loadedPlugins: Map<string, any> = new Map();
    private handlers: Map<string, PluginHandler[]> = new Map();

    /**
     * Get all available plugins
     */
    async getAvailablePlugins(): Promise<Plugin[]> {
        const { data, error } = await supabase
            .from('plugins')
            .select('*')
            .eq('is_active', true)
            .order('downloads', { ascending: false });

        if (error) throw error;
        return (data || []) as Plugin[];
    }

    /**
     * Get plugin by slug
     */
    async getPlugin(slug: string): Promise<Plugin | null> {
        const { data, error } = await supabase
            .from('plugins')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error) return null;
        return data as Plugin;
    }

    /**
     * Install plugin for tenant
     */
    async installPlugin(
        tenantId: string,
        pluginId: string,
        config: Record<string, any> = {}
    ): Promise<TenantPlugin> {
        const { data: tenantPluginId, error } = await supabase.rpc('install_plugin', {
            p_tenant_id: tenantId,
            p_plugin_id: pluginId,
            p_config: config
        });

        if (error) throw error;

        const { data: tenantPlugin } = await supabase
            .from('tenant_plugins')
            .select('*')
            .eq('id', tenantPluginId)
            .single();

        return tenantPlugin as TenantPlugin;
    }

    /**
     * Uninstall plugin
     */
    async uninstallPlugin(tenantId: string, pluginId: string): Promise<void> {
        await supabase.rpc('uninstall_plugin', {
            p_tenant_id: tenantId,
            p_plugin_id: pluginId
        });
    }

    /**
     * Get tenant's installed plugins
     */
    async getTenantPlugins(tenantId: string): Promise<any[]> {
        const { data, error } = await supabase.rpc('get_tenant_plugins', {
            p_tenant_id: tenantId
        });

        if (error) throw error;
        return data || [];
    }

    /**
     * Enable/disable plugin
     */
    async togglePlugin(
        tenantId: string,
        pluginId: string,
        enabled: boolean
    ): Promise<void> {
        await supabase
            .from('tenant_plugins')
            .update({ is_enabled: enabled })
            .eq('tenant_id', tenantId)
            .eq('plugin_id', pluginId);
    }

    /**
     * Update plugin configuration
     */
    async updatePluginConfig(
        tenantId: string,
        pluginId: string,
        config: Record<string, any>
    ): Promise<void> {
        await supabase
            .from('tenant_plugins')
            .update({ config, updated_at: new Date().toISOString() })
            .eq('tenant_id', tenantId)
            .eq('plugin_id', pluginId);
    }

    /**
     * Register plugin handler
     */
    registerHandler(hookName: string, handler: PluginHandler): void {
        if (!this.handlers.has(hookName)) {
            this.handlers.set(hookName, []);
        }
        this.handlers.get(hookName)!.push(handler);
    }

    /**
     * Execute plugin hooks
     */
    async executeHook(
        hookName: string,
        context: PluginContext,
        data: any
    ): Promise<void> {
        // Get handlers from database
        const { data: hooks } = await supabase.rpc('get_plugin_hooks', {
            p_hook_name: hookName
        });

        if (!hooks || hooks.length === 0) return;

        // Execute handlers in priority order
        for (const hook of hooks) {
            try {
                const handler = this.handlers.get(hook.handler_function);
                if (handler) {
                    await Promise.all(handler.map(h => h(context, data)));
                }
            } catch (error: any) {
                console.error(`[PluginManager] Hook execution failed:`, error);
                await this.logPluginActivity(
                    context.plugin.id,
                    'error',
                    `Hook ${hookName} failed: ${error.message}`
                );
            }
        }
    }

    /**
     * Log plugin activity
     */
    async logPluginActivity(
        tenantPluginId: string,
        level: 'debug' | 'info' | 'warn' | 'error',
        message: string,
        metadata?: any
    ): Promise<void> {
        await supabase.rpc('log_plugin_activity', {
            p_tenant_plugin_id: tenantPluginId,
            p_log_level: level,
            p_message: message,
            p_metadata: metadata
        });
    }

    /**
     * Get plugin logs
     */
    async getPluginLogs(
        tenantPluginId: string,
        limit: number = 100
    ): Promise<any[]> {
        const { data } = await supabase
            .from('plugin_logs')
            .select('*')
            .eq('tenant_plugin_id', tenantPluginId)
            .order('created_at', { ascending: false })
            .limit(limit);

        return data || [];
    }

    /**
     * Initialize plugins for tenant
     */
    async initializePlugins(tenantId: string): Promise<void> {
        const plugins = await this.getTenantPlugins(tenantId);

        for (const plugin of plugins) {
            if (plugin.is_enabled) {
                await this.loadPlugin(plugin);
            }
        }

        console.log(`[PluginManager] Initialized ${plugins.length} plugins for tenant ${tenantId}`);
    }

    /**
     * Load plugin
     */
    private async loadPlugin(tenantPlugin: any): Promise<void> {
        try {
            // Get plugin details
            const plugin = await this.getPlugin(tenantPlugin.plugin_slug);
            if (!plugin) return;

            // Register hooks from manifest
            if (plugin.manifest.hooks) {
                for (const hook of plugin.manifest.hooks) {
                    // Store hook in database
                    await supabase
                        .from('plugin_hooks')
                        .upsert({
                            plugin_id: plugin.id,
                            hook_name: hook.name,
                            handler_function: hook.handler,
                            priority: hook.priority || 10
                        });
                }
            }

            this.loadedPlugins.set(plugin.slug, plugin);
            console.log(`[PluginManager] Loaded plugin: ${plugin.name}`);

        } catch (error) {
            console.error(`[PluginManager] Failed to load plugin:`, error);
        }
    }

    /**
     * Validate plugin manifest
     */
    validateManifest(manifest: any): boolean {
        // Check required fields
        if (!manifest.permissions || !Array.isArray(manifest.permissions)) {
            return false;
        }

        // Validate hooks if present
        if (manifest.hooks) {
            for (const hook of manifest.hooks) {
                if (!hook.name || !hook.handler) {
                    return false;
                }
            }
        }

        return true;
    }
}

export const pluginManager = new PluginManager();

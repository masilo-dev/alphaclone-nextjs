/**
 * Plugin Architecture - Core Types
 * Type definitions for the plugin system
 */

// Plugin
export interface Plugin {
    id: string;
    name: string;
    slug: string;
    description?: string;
    version: string;
    author?: string;
    authorUrl?: string;
    iconUrl?: string;
    manifest: PluginManifest;
    isOfficial: boolean;
    isActive: boolean;
    downloads: number;
    rating?: number;
    createdAt: Date;
    updatedAt: Date;
}

// Plugin Manifest
export interface PluginManifest {
    permissions: string[];
    hooks?: PluginHookConfig[];
    settings?: PluginSetting[];
    ui?: PluginUI;
    dependencies?: string[];
}

// Plugin Hook Configuration
export interface PluginHookConfig {
    name: string;
    handler: string;
    priority?: number;
}

// Plugin Setting
export interface PluginSetting {
    key: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'textarea';
    label: string;
    description?: string;
    required?: boolean;
    default?: any;
    secret?: boolean;
    options?: Array<{ label: string; value: any }>;
}

// Plugin UI Configuration
export interface PluginUI {
    dashboardWidget?: {
        component: string;
        size: 'small' | 'medium' | 'large';
    };
    settingsPage?: {
        component: string;
    };
    menuItems?: Array<{
        label: string;
        icon?: string;
        route: string;
    }>;
}

// Tenant Plugin (Installed)
export interface TenantPlugin {
    id: string;
    tenantId: string;
    pluginId: string;
    config: Record<string, any>;
    isEnabled: boolean;
    installedAt: Date;
    updatedAt: Date;
}

// Plugin Hook
export interface PluginHook {
    id: string;
    pluginId: string;
    hookName: string;
    handlerFunction: string;
    priority: number;
    isActive: boolean;
    createdAt: Date;
}

// Plugin Log
export interface PluginLog {
    id: string;
    tenantPluginId: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    metadata?: Record<string, any>;
    createdAt: Date;
}

// Plugin Context (runtime)
export interface PluginContext {
    tenantId: string;
    userId: string;
    plugin: Plugin;
    config: Record<string, any>;
    eventBus: any;
    services: {
        email?: any;
        notification?: any;
        storage?: any;
        http?: any;
    };
}

// Plugin Handler Function
export type PluginHandler = (context: PluginContext, data: any) => Promise<any>;

// Plugin Lifecycle Hooks
export interface PluginLifecycle {
    onInstall?: (context: PluginContext) => Promise<void>;
    onUninstall?: (context: PluginContext) => Promise<void>;
    onEnable?: (context: PluginContext) => Promise<void>;
    onDisable?: (context: PluginContext) => Promise<void>;
    onConfigUpdate?: (context: PluginContext, newConfig: any) => Promise<void>;
}

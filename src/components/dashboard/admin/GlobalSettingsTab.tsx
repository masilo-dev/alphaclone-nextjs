'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
    Globe,
    Shield,
    CreditCard,
    Cpu,
    Lock,
    Layout,
    Bell,
    Save,
    Loader2,
    FileText,
} from 'lucide-react';
import { Button, Card, Input } from '../../ui/UIComponents';
import toast from 'react-hot-toast';
import type { PlatformEnvStatus, PlatformGlobalSettings } from '@/types/platformSettings';

const GlobalSettingsTab: React.FC = () => {
    const [activeSection, setActiveSection] = useState<'branding' | 'integrations' | 'security' | 'ai' | 'support'>('branding');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [settings, setSettings] = useState<PlatformGlobalSettings>({});
    const [envStatus, setEnvStatus] = useState<PlatformEnvStatus | null>(null);

    const hydrate = useCallback((raw: PlatformGlobalSettings) => {
        setSettings({
            branding: { ...raw.branding },
            security: { ...raw.security },
            support: { ...raw.support },
        });
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadError(null);
            try {
                const res = await fetch('/api/admin/platform-settings');
                const data = (await res.json()) as {
                    error?: string;
                    settings?: PlatformGlobalSettings;
                    updatedAt?: string | null;
                    envStatus?: PlatformEnvStatus;
                };
                if (!res.ok) {
                    throw new Error(data.error || 'Failed to load settings');
                }
                if (!cancelled) {
                    hydrate(data.settings ?? {});
                    setUpdatedAt(data.updatedAt ?? null);
                    setEnvStatus(data.envStatus ?? null);
                }
            } catch (e) {
                if (!cancelled) {
                    setLoadError(e instanceof Error ? e.message : 'Failed to load settings');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [hydrate]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/platform-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings }),
            });
            const data = (await res.json()) as { error?: string; settings?: PlatformGlobalSettings; envStatus?: PlatformEnvStatus };
            if (!res.ok) {
                throw new Error(data.error || 'Save failed');
            }
            if (data.settings) {
                hydrate(data.settings);
            }
            if (data.envStatus) {
                setEnvStatus(data.envStatus);
            }
            setUpdatedAt(new Date().toISOString());
            toast.success('Global settings saved.');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const setBranding = (patch: Partial<NonNullable<PlatformGlobalSettings['branding']>>) => {
        setSettings((prev) => ({
            ...prev,
            branding: { ...prev.branding, ...patch },
        }));
    };

    const setSecurity = (patch: Partial<NonNullable<PlatformGlobalSettings['security']>>) => {
        setSettings((prev) => ({
            ...prev,
            security: { ...prev.security, ...patch },
        }));
    };

    const setSupport = (patch: Partial<NonNullable<PlatformGlobalSettings['support']>>) => {
        setSettings((prev) => ({
            ...prev,
            support: { ...prev.support, ...patch },
        }));
    };

    const sections = [
        { id: 'branding' as const, label: 'Platform Branding', icon: Globe },
        { id: 'integrations' as const, label: 'Global Integrations', icon: CreditCard },
        { id: 'security' as const, label: 'System Security', icon: Shield },
        { id: 'ai' as const, label: 'AI Configuration', icon: Cpu },
        { id: 'support' as const, label: 'Support & Docs', icon: Layout },
    ];

    const sec = settings.security ?? {};
    const branding = settings.branding ?? {};
    const support = settings.support ?? {};

    return (
        <div className="space-y-6 animate-fade-in pb-8">
            {loadError && (
                <div
                    role="alert"
                    className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-100/95 leading-relaxed"
                >
                    {loadError}
                </div>
            )}

            {!loadError && !loading && (
                <div
                    role="status"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300 leading-relaxed"
                >
                    Global settings are stored in the database and apply platform-wide. Tenant-level options remain under
                    Settings in each workspace. On small screens, pick a section below, then scroll the panel.
                    {updatedAt && (
                        <span className="block mt-1 text-slate-500">
                            Last updated: {new Date(updatedAt).toLocaleString()}
                        </span>
                    )}
                </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-white">Global Settings</h2>
                    <p className="text-slate-400 mt-1 text-xs sm:text-sm font-medium uppercase tracking-wider">
                        Super admin
                    </p>
                </div>
                <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || loading || !!loadError}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 w-full sm:w-auto shrink-0"
                >
                    {saving || loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-1 -mx-1 px-1 lg:overflow-visible lg:pb-0 lg:mx-0 lg:px-0 [scrollbar-width:thin]">
                    {sections.map((section) => (
                        <button
                            type="button"
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            aria-current={activeSection === section.id ? 'true' : undefined}
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap shrink-0 lg:w-full lg:shrink ${activeSection === section.id
                                ? 'bg-indigo-600 border border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                                : 'bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            <section.icon className="w-4 h-4 shrink-0" aria-hidden />
                            {section.label}
                        </button>
                    ))}
                </div>

                <div className="lg:col-span-3 min-w-0">
                    <Card className="min-h-[min(500px,70vh)] sm:min-h-[500px]">
                        {activeSection === 'branding' && (
                            <div className="space-y-6">
                                <SectionHeader title="Branding Configuration" description="Manage platform identities and global UI elements" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Platform Name"
                                        placeholder="AlphaClone Systems"
                                        value={branding.platformName ?? ''}
                                        onChange={(e) => setBranding({ platformName: e.target.value })}
                                    />
                                    <Input
                                        label="Support Email"
                                        placeholder="support@example.com"
                                        value={branding.supportEmail ?? ''}
                                        onChange={(e) => setBranding({ supportEmail: e.target.value })}
                                    />
                                    <Input
                                        label="Platform URL"
                                        placeholder="https://app.example.com"
                                        value={branding.platformUrl ?? ''}
                                        onChange={(e) => setBranding({ platformUrl: e.target.value })}
                                    />
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Logo Assets</label>
                                        <div className="flex gap-4">
                                            <div className="w-16 h-16 bg-slate-900 rounded-xl border border-white/5 flex items-center justify-center">
                                                <Globe className="w-8 h-8 text-indigo-500" />
                                            </div>
                                            <Button type="button" variant="outline" size="sm" disabled title="Upload is not configured yet">
                                                Update Logo
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'integrations' && envStatus && (
                            <div className="space-y-6">
                                <SectionHeader title="Global Integrations" description="Environment configuration status (keys are not exposed here)" />
                                <div className="space-y-4">
                                    <IntegrationItem
                                        name="Stripe"
                                        configured={envStatus.stripe}
                                        description="Tenant billing and payouts."
                                        details="STRIPE_SECRET_KEY"
                                    />
                                    <IntegrationItem
                                        name="Resend"
                                        configured={envStatus.resend}
                                        description="Transactional email delivery."
                                        details="RESEND_API_KEY"
                                    />
                                    <IntegrationItem
                                        name="Facebook"
                                        configured={envStatus.facebook}
                                        description="Facebook Login and Marketing API."
                                        details="FACEBOOK_APP_ID and FACEBOOK_APP_SECRET"
                                    />
                                    <IntegrationItem
                                        name="Zoom"
                                        configured={envStatus.zoom}
                                        description="Meeting OAuth for the platform."
                                        details="ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET"
                                    />
                                    <IntegrationItem
                                        name="Google OAuth"
                                        configured={envStatus.googleOAuth}
                                        description="Sign-in and calendar integrations."
                                        details="GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
                                    />
                                </div>
                            </div>
                        )}

                        {activeSection === 'integrations' && !envStatus && (
                            <div className="space-y-6">
                                <SectionHeader title="Global Integrations" description="Load settings to see integration status" />
                                <p className="text-sm text-slate-400">Integration status is unavailable until settings load successfully.</p>
                            </div>
                        )}

                        {activeSection === 'security' && (
                            <div className="space-y-6">
                                <SectionHeader title="System Security" description="Configure platform-wide security and access policies" />
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-900 rounded-2xl border border-white/5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-bold text-white">Global 2FA Enforcement</h4>
                                            <p className="text-xs text-slate-400">Require 2FA for Super Admins and Tenant Admins when enforced by policy.</p>
                                        </div>
                                        <Toggle
                                            checked={!!sec.enforce2faTenantAdmins}
                                            onCheckedChange={(v) => setSecurity({ enforce2faTenantAdmins: v })}
                                            ariaLabel="Toggle global two-factor authentication requirement"
                                        />
                                    </div>
                                    <div className="p-4 bg-slate-900 rounded-2xl border border-white/5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-bold text-white">New User Registration</h4>
                                            <p className="text-xs text-slate-400">Allow users to sign up without an invite when your auth flow permits it.</p>
                                        </div>
                                        <Toggle
                                            checked={sec.openRegistration !== false}
                                            onCheckedChange={(v) => setSecurity({ openRegistration: v })}
                                            ariaLabel="Toggle open registration preference"
                                        />
                                    </div>
                                    <div className="p-4 bg-slate-900/50 rounded-2xl border border-red-500/20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-bold text-red-400">Maintenance Mode</h4>
                                            <p className="text-xs text-slate-400">Mark the platform as in maintenance (enforcement depends on app middleware).</p>
                                        </div>
                                        <Toggle
                                            checked={!!sec.maintenanceMode}
                                            onCheckedChange={(v) => setSecurity({ maintenanceMode: v })}
                                            ariaLabel="Toggle maintenance mode flag"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'ai' && envStatus && (
                            <div className="space-y-6">
                                <SectionHeader title="AI Service Configuration" description="Keys are configured in the deployment environment only" />
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="Anthropic"
                                            type="password"
                                            value={envStatus.anthropic ? '************************' : ''}
                                            placeholder={envStatus.anthropic ? undefined : 'Not configured'}
                                            readOnly
                                        />
                                        <Input
                                            label="OpenAI"
                                            type="password"
                                            value={envStatus.openai ? '************************' : ''}
                                            placeholder={envStatus.openai ? undefined : 'Not configured'}
                                            readOnly
                                        />
                                        <Input
                                            label="Google Gemini"
                                            type="password"
                                            value={envStatus.gemini ? '************************' : ''}
                                            placeholder={envStatus.gemini ? undefined : 'Not configured'}
                                            readOnly
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'ai' && !envStatus && (
                            <div className="space-y-6">
                                <SectionHeader title="AI Service Configuration" description="Load settings to see configuration status" />
                                <p className="text-sm text-slate-400">AI environment status is unavailable until settings load successfully.</p>
                            </div>
                        )}

                        {activeSection === 'support' && (
                            <div className="space-y-6">
                                <SectionHeader title="Support & Platform Documentation" description="Resources for platform administrators and system owners" />
                                <div className="grid grid-cols-1 gap-6">
                                    <Input
                                        label="Documentation base URL"
                                        placeholder="/docs"
                                        value={support.docsUrl ?? ''}
                                        onChange={(e) => setSupport({ docsUrl: e.target.value })}
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Card
                                            className="p-4 bg-slate-900 border-white/5 hover:border-teal-500/30 transition-all cursor-pointer group"
                                            onClick={() => window.open(support.docsUrl?.trim() || '/docs', '_blank')}
                                        >
                                            <FileText className="w-6 h-6 text-slate-400 mb-3 group-hover:text-teal-400 transition-colors" />
                                            <h5 className="text-sm font-bold text-white mb-1">Full Documentation</h5>
                                            <p className="text-xs text-slate-500">Open documentation in a new tab.</p>
                                        </Card>
                                        <Card className="p-4 bg-slate-900 border-white/5 hover:border-blue-500/30 transition-all">
                                            <Bell className="w-6 h-6 text-slate-400 mb-3" />
                                            <h5 className="text-sm font-bold text-white mb-1">System Updates</h5>
                                            <p className="text-xs text-slate-500">View recent logs and upcoming feature releases.</p>
                                        </Card>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

const SectionHeader = ({ title, description }: { title: string; description: string }) => (
    <div className="mb-6">
        <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
        <p className="text-slate-400 text-xs">{description}</p>
    </div>
);

const IntegrationItem = ({
    name,
    configured,
    description,
    details,
}: {
    name: string;
    configured: boolean;
    description: string;
    details: string;
}) => {
    const status = configured ? 'Connected' : 'Not configured';
    return (
        <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-white">{name}</h4>
                    <div
                        className={`px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-widest ${configured ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-700 text-slate-400'
                            }`}
                    >
                        {status}
                    </div>
                </div>
                <p className="text-xs text-slate-400">{description}</p>
                <p className="text-xs text-slate-600 mt-1 uppercase font-mono break-words">{details}</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full md:w-auto shrink-0" disabled title="Configure via environment variables">
                Configure
            </Button>
        </div>
    );
};

const Toggle = ({
    checked,
    onCheckedChange,
    ariaLabel,
}: {
    checked: boolean;
    onCheckedChange: (next: boolean) => void;
    ariaLabel: string;
}) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        onClick={() => onCheckedChange(!checked)}
        className={`w-10 h-5 rounded-full relative transition-all shrink-0 ${checked ? 'bg-indigo-600' : 'bg-slate-700'}`}
    >
        <span
            className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${checked ? 'right-1' : 'left-1'}`}
        />
    </button>
);

export default GlobalSettingsTab;


'use client';

import React, { useState } from 'react';
import {
    Globe,
    Shield,
    Database,
    CreditCard,
    Cpu,
    Zap,
    Lock,
    Settings,
    Layout,
    Palette,
    Bell,
    Save,
    Loader2,
    FileText
} from 'lucide-react';
import { Button, Card, Input } from '../../ui/UIComponents';
import toast from 'react-hot-toast';
import LoomVideo from '../../ui/LoomVideo';

const GlobalSettingsTab: React.FC = () => {
    const [activeSection, setActiveSection] = useState<'branding' | 'integrations' | 'security' | 'ai' | 'support'>('branding');
    const [saving, setSaving] = useState(false);

    const handleSave = () => {
        setSaving(true);
        setTimeout(() => {
            setSaving(false);
            toast.success('Global settings updated successfully');
        }, 1500);
    };

    const sections = [
        { id: 'branding' as const, label: 'Platform Branding', icon: Globe },
        { id: 'integrations' as const, label: 'Global Integrations', icon: CreditCard },
        { id: 'security' as const, label: 'System Security', icon: Shield },
        { id: 'ai' as const, label: 'AI Configuration', icon: Cpu },
        { id: 'support' as const, label: 'Support & Docs', icon: Layout },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Global Settings</h2>
                    <p className="text-slate-400 mt-1 text-sm font-medium uppercase tracking-wider">Owner Dashboard</p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save All Changes
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Section Nav */}
                <div className="lg:col-span-1 space-y-2">
                    {sections.map((section) => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeSection === section.id
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                                    : 'bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            <section.icon className="w-4 h-4" />
                            {section.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3">
                    <Card className="min-h-[500px]">
                        {activeSection === 'branding' && (
                            <div className="space-y-6">
                                <SectionHeader title="Branding Configuration" description="Manage platform identities and global UI elements" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Platform Name" placeholder="AlphaClone Systems" defaultValue="AlphaClone Systems" />
                                    <Input label="Support Email" placeholder="support@alphaclone.io" defaultValue="support@alphaclone.io" />
                                    <Input label="Platform URL" placeholder="https://app.alphaclone.io" defaultValue="https://app.alphaclone.io" />
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Logo Assets</label>
                                        <div className="flex gap-4">
                                            <div className="w-16 h-16 bg-slate-900 rounded-xl border border-white/5 flex items-center justify-center">
                                                <Globe className="w-8 h-8 text-indigo-500" />
                                            </div>
                                            <Button variant="outline" size="sm">Update Logo</Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'integrations' && (
                            <div className="space-y-6">
                                <SectionHeader title="Global Integrations" description="Manage platform-wide API connections and billing providers" />
                                <div className="space-y-4">
                                    <IntegrationItem
                                        name="Stripe Platform"
                                        status="Connected"
                                        description="Handles all tenant billing and payouts globally."
                                        details="Live Mode • Connect V3"
                                    />
                                    <IntegrationItem
                                        name="Postmark SMTP"
                                        status="Connected"
                                        description="Powers all transactional system outgoing mail."
                                        details="Server: Alpha-V1"
                                    />
                                    <IntegrationItem
                                        name="Intercom"
                                        status="Inactive"
                                        description="Platform-wide customer support and live chat."
                                        details="No API Key found"
                                    />
                                </div>
                            </div>
                        )}

                        {activeSection === 'security' && (
                            <div className="space-y-6">
                                <SectionHeader title="System Security" description="Configure platform-wide security and access policies" />
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-900 rounded-2xl border border-white/5 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-bold text-white">Global 2FA Enforcement</h4>
                                            <p className="text-xs text-slate-400">Require 2FA for all Super Admins and Tenant Admins.</p>
                                        </div>
                                        <Toggle />
                                    </div>
                                    <div className="p-4 bg-slate-900 rounded-2xl border border-white/5 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-bold text-white">New User Registration</h4>
                                            <p className="text-xs text-slate-400">Allow users to sign up without an invite.</p>
                                        </div>
                                        <Toggle defaultChecked />
                                    </div>
                                    <div className="p-4 bg-slate-900/50 rounded-2xl border border-red-500/20">
                                        <h4 className="text-sm font-bold text-red-400">Restricted Mode</h4>
                                        <p className="text-xs text-slate-400 mb-4">Temporarily disable all write operations on the platform for maintenance.</p>
                                        <Button variant="danger" size="sm">Activate Restricted Mode</Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'ai' && (
                            <div className="space-y-6">
                                <SectionHeader title="AI Service Configuration" description="Manage global AI models and API priority" />
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label="Anthropic API Key" type="password" value="************************" readOnly />
                                        <Input label="OpenAI API Key" type="password" value="************************" readOnly />
                                        <Input label="Google Gemini Key" type="password" value="************************" readOnly />
                                    </div>
                                    <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Zap className="w-4 h-4 text-indigo-400" />
                                            <span className="text-xs font-black uppercase tracking-widest text-indigo-400">Intelligent Routing</span>
                                        </div>
                                        <p className="text-xs text-slate-300 leading-relaxed mb-4">
                                            The system is currently using **Claude 3.5 Sonnet** as the primary engine with **GPT-4o** as the high-availability fallback. Gemini is used for low-priority categorization tasks.
                                        </p>
                                        <div className="aspect-video w-full rounded-xl overflow-hidden shadow-lg border border-white/5">
                                            <LoomVideo 
                                                videoId="023023e9a7e84120894768393d9ce454"
                                                title="AI Infrastructure Documentation"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'support' && (
                            <div className="space-y-6">
                                <SectionHeader title="Support & Platform Documentation" description="Resources for platform administrators and system owners" />
                                <div className="grid grid-cols-1 gap-6">
                                    <div className="bg-slate-900 rounded-2xl border border-white/5 overflow-hidden">
                                        <div className="p-4 border-b border-white/5 flex items-center gap-3">
                                            <Zap className="w-4 h-4 text-teal-400" />
                                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Admin Video Guide</h4>
                                        </div>
                                        <div className="aspect-video w-full bg-black">
                                            <LoomVideo 
                                                videoId="3a7000c925c145b7882089688b0ceb5d" 
                                                title="AlphaClone Admin Overview"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Card className="p-4 bg-slate-900 border-white/5 hover:border-teal-500/30 transition-all cursor-pointer group" onClick={() => window.open('/docs', '_blank')}>
                                            <FileText className="w-6 h-6 text-slate-400 mb-3 group-hover:text-teal-400 transition-colors" />
                                            <h5 className="text-sm font-bold text-white mb-1">Full Documentation</h5>
                                            <p className="text-xs text-slate-500">Access the comprehensive platform wiki and API guides.</p>
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

const SectionHeader = ({ title, description }: { title: string, description: string }) => (
    <div className="mb-6">
        <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
        <p className="text-slate-400 text-xs">{description}</p>
    </div>
);

const IntegrationItem = ({ name, status, description, details }: any) => (
    <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-bold text-white">{name}</h4>
                <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${status === 'Connected' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-700 text-slate-400'
                    }`}>
                    {status}
                </div>
            </div>
            <p className="text-xs text-slate-400">{description}</p>
            <p className="text-[10px] text-slate-600 mt-1 uppercase font-mono">{details}</p>
        </div>
        <Button variant="outline" size="sm">Configure</Button>
    </div>
);

const Toggle = ({ defaultChecked = false }: { defaultChecked?: boolean }) => {
    const [checked, setChecked] = useState(defaultChecked);
    return (
        <button
            onClick={() => setChecked(!checked)}
            className={`w-10 h-5 rounded-full relative transition-all ${checked ? 'bg-indigo-600' : 'bg-slate-700'}`}
        >
            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${checked ? 'right-1' : 'left-1'}`} />
        </button>
    );
};

export default GlobalSettingsTab;

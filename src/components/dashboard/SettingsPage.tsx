'use client';

import React, { useState, useEffect } from 'react';
import {
    CreditCard, Lock, Loader2,
    AlertCircle, ShieldCheck,
    User as UserIcon, Globe, Building,
    ChevronRight, DollarSign, Briefcase,
    Eye, Copy, Upload, BookOpen, Archive,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenant } from '@/contexts/TenantContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { User as UserType } from '@/types';
import { userService } from '@/services/userService';
import { authService } from '@/services/authService';
import { fileUploadService } from '@/services/fileUploadService';
import { SubscriptionPlan, PLAN_PRICING } from '@/services/tenancy/types';
import { UNIVERSAL_SERVICE_CATALOG, ServiceItem } from '@/services/universalServiceCatalog';
import { getTaxRateForCountry } from '@/lib/tax/taxRules';
import toast from 'react-hot-toast';
import Link from 'next/link';

// Integration subcomponents
import CalendlySettings from './business/CalendlySettings';
import HubspotIntegration from './business/HubspotIntegration';
import StripeConnectSettings from './business/StripeConnectSettings';
import ZohoIntegration from './business/ZohoIntegration';
import TwilioIntegration from './business/TwilioIntegration';
import SendGridIntegration from './business/SendGridIntegration';
import ResendIntegration from './business/ResendIntegration';
import BrevoIntegration from './business/BrevoIntegration';
import Microsoft365Integration from './business/Microsoft365Integration';
import MFAEnrollment from './business/MFAEnrollment';
import DeletedRecordsSection from './settings/DeletedRecordsSection';
import EmailProviderSettings from './settings/EmailProviderSettings';

interface SettingsPageProps {
    user: UserType;
}

const statusColors: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    trialing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    past_due: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export default function SettingsPage({ user }: SettingsPageProps) {
    const { signOut } = useAuth();
    const { currentTenant } = useTenant();
    const { backgroundColor, setBackgroundColor, themeMode, setThemeMode } = useTheme();
    const { language, setLanguage, t: translate } = useLanguage();

    // Accordion visibility mapping
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const toggleRow = (id: string) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // States
    const [isSaving, setIsSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [mcpApiKey, setMcpApiKey] = useState<string | null>(null);
    const [hasMcpApiKey, setHasMcpApiKey] = useState(false);
    const [isLoadingApiKey, setIsLoadingApiKey] = useState(true);

    // Profile & workspace details
    const [profileData, setProfileData] = useState({
        name: user.name || '',
        email: user.email || '',
        phone: '',
        company: '',
        timezone: 'UTC',
    });

    const [notificationSettings, setNotificationSettings] = useState({
        emailNotifications: true,
        projectUpdates: true,
        messageAlerts: true,
        weeklyReports: false,
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [businessSettings, setBusinessSettings] = useState({
        businessName: '',
        tradingName: '',
        logoUrl: '',
        brandColor: '#2dd4bf',
        address: '',
        phone: '',
        email: '',
        taxRate: 0,
        taxCountry: 'ZW',
        currency: 'USD',
        invoicePrefix: 'INV',
        bankDetails: '',
        mobilePaymentDetails: '',
        serviceSectors: [] as string[],
        myServices: {} as Record<string, Partial<ServiceItem> & { isCustom?: boolean }>,
    });

    // Load initial settings
    useEffect(() => {
        const loadInitialData = async () => {
            if (!currentTenant?.id) return;
            try {
                // Fetch profile updates from user service / db
                const response = await fetch(`/api/tenant/${encodeURIComponent(currentTenant.id)}/business-settings`, { credentials: 'include' });
                const payload = await response.json().catch(() => ({}));
                const bData = payload.settings;
                const error = response.ok ? null : new Error(payload.error || 'Business settings could not be loaded');

                if (!error && bData) {
                    setBusinessSettings({
                        businessName: bData.business_name || user?.name || '',
                        tradingName: bData.trading_name || '',
                        logoUrl: bData.logo_url || '',
                        brandColor: bData.brand_color || '#2dd4bf',
                        address: bData.address || '',
                        phone: bData.phone || '',
                        email: bData.email || user?.email || '',
                        taxRate: bData.tax_rate || 0,
                        taxCountry: bData.tax_country || 'ZW',
                        currency: bData.currency || 'USD',
                        invoicePrefix: bData.invoice_prefix || 'INV',
                        bankDetails: bData.bank_details || '',
                        mobilePaymentDetails: bData.mobile_payment_details || '',
                        serviceSectors: bData.settings?.service_sectors || [],
                        myServices: bData.settings?.my_services || {},
                    });
                }
            } catch (err) {
                console.error('Failed to load business settings:', err);
            }
        };
        loadInitialData();
    }, [currentTenant?.id]);

    // Load MCP API key
    useEffect(() => {
        const loadMcpApiKey = async () => {
            if (!user.id || !currentTenant?.id) return;
            setIsLoadingApiKey(true);
            try {
                const response = await fetch(`/api/mcp/keys?tenantId=${encodeURIComponent(currentTenant.id)}`);
                const data = await response.json().catch(() => ({}));
                setHasMcpApiKey(response.ok && data.exists === true);
                setMcpApiKey(null);
            } catch (err) {
                console.error('Failed to load MCP API key:', err);
                setMcpApiKey(null);
            } finally {
                setIsLoadingApiKey(false);
            }
        };
        loadMcpApiKey();
    }, [user.id, currentTenant?.id]);

    const handleGenerateApiKey = async () => {
        if (!user.id || !currentTenant?.id) return toast.error('Select a workspace first');
        
        try {
            setIsSaving(true);
            
            const response = await fetch('/api/mcp/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: currentTenant.id }) });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.token) throw new Error(result.error || 'Failed to generate API key');
            setMcpApiKey(result.token);
            setHasMcpApiKey(true);
            toast.success('New MCP API key generated!');
        } catch (err: any) {
            toast.error(err.message || 'Failed to generate API key');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!profileData.name.trim()) return toast.error('Name is required');
        setIsSaving(true);
        try {
            const { error } = await userService.updateProfile(user.id, profileData);
            if (error) throw new Error(error);
            toast.success('Profile updated successfully!');
        } catch (err: any) {
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveNotifications = async () => {
        setIsSaving(true);
        try {
            const { error } = await userService.updateNotificationSettings(user.id, {
                email_notifications: notificationSettings.emailNotifications,
                project_updates: notificationSettings.projectUpdates,
                message_alerts: notificationSettings.messageAlerts,
                weekly_reports: notificationSettings.weeklyReports
            });
            if (error) throw new Error(error);
            toast.success('Notification preferences updated!');
        } catch (err: any) {
            toast.error(err.message || 'Failed to save preferences');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
            return toast.error('All password fields are required');
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            return toast.error('New passwords do not match');
        }
        setIsSaving(true);
        try {
            const { error } = await userService.changePassword(passwordData.currentPassword, passwordData.newPassword);
            if (error) throw new Error(error);
            toast.success('Password updated successfully!');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err: any) {
            toast.error(err.message || 'Failed to update password');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveBusiness = async () => {
        if (!currentTenant) return;
        setIsSaving(true);
        try {
            const response = await fetch(`/api/tenant/${encodeURIComponent(currentTenant.id)}/business-settings`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(businessSettings),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Failed to save business settings');
            toast.success('Workspace business profile saved!');
        } catch (err: any) {
            toast.error(err.message || 'Failed to save business settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentTenant?.id) return;
        setUploading(true);
        try {
            const result = await fileUploadService.uploadFile(file, 'tenant_logo', currentTenant.id);
            if (result.success && result.url) {
                setBusinessSettings(prev => ({ ...prev, logoUrl: result.url! }));
                toast.success('Logo uploaded!');
            } else {
                throw new Error(result.error);
            }
        } catch (err: any) {
            toast.error(err.message || 'Logo upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleManageBilling = async () => {
        if (!currentTenant) return;
        const toastId = toast.loading('Opening Stripe customer portal...');
        try {
            const response = await fetch('/api/stripe/create-portal-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: currentTenant.id }),
            });
            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to open billing portal', { id: toastId });
        }
    };

    const handleUpgrade = async (planId: string) => {
        if (!currentTenant) return;
        const plan = PLAN_PRICING[planId as SubscriptionPlan];
        if (!plan?.stripePriceId) return toast.error('Invalid plan selected');
        
        try {
            const response = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId: plan.stripePriceId,
                    planId,
                    tenantId: currentTenant.id,
                    adminEmail: user.email,
                }),
            });
            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            toast.error(err.message || 'Checkout failed');
        }
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            const { error } = await authService.requestAccountDeletion({ immediate: true });
            if (error) throw new Error(error);
            toast.success('Account deleted. Signing out...');
            await signOut();
            window.location.href = '/auth/login?reason=account_deleted';
        } catch (err: any) {
            toast.error(err.message || 'Deletion failed');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-32 px-4 sm:px-6">
            
            {/* Header Profile Summary */}
            <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-slate-900 border border-white/5 rounded-3xl relative overflow-hidden">
                <div className="relative group cursor-pointer">
                    <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-teal-500 overflow-hidden flex items-center justify-center">
                        {businessSettings.logoUrl ? (
                            <img src={businessSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-2xl font-black text-white">{user.name?.[0]?.toUpperCase()}</span>
                        )}
                    </div>
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 rounded-full flex items-center justify-center transition-all cursor-pointer">
                        <Upload className="w-5 h-5 text-white" />
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                </div>
                <div className="text-center sm:text-left space-y-1 flex-1">
                    <h2 className="text-lg font-black text-white">{user.name}</h2>
                    <p className="text-xs text-slate-400 font-mono">{user.email}</p>
                    <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                        <span className="px-2.5 py-0.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[10px] font-black uppercase rounded-lg">
                            {currentTenant?.subscription_plan || 'free'} tier
                        </span>
                        <span className="px-2.5 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-bold uppercase rounded-lg">
                            WS: {currentTenant?.name}
                        </span>
                    </div>
                </div>
            </div>

            <Link
                href="/dashboard/help"
                className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/15 transition-colors group"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white">Platform guide & glossary</p>
                        <p className="text-xs text-slate-400 mt-0.5">Learn hub names, overview vs workspace, and where to find each feature.</p>
                    </div>
                </div>
                <ChevronRight className="w-5 h-5 text-teal-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>

            {/* 1. ACCOUNT GROUP */}
            <div className="space-y-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 px-2 block">Account Preferences</span>
                <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
                    
                    {/* Row 1: Profile Details */}
                    <div>
                        <div 
                            onClick={() => toggleRow('profile')}
                            className="flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer select-none"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <UserIcon className="w-4 h-4 text-blue-400" />
                                </div>
                                <span className="text-[13px] font-bold text-slate-200">Profile Details</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 text-slate-500 transform transition-transform ${expandedRows['profile'] ? 'rotate-90' : ''}`} />
                        </div>
                        <AnimatePresence>
                            {expandedRows['profile'] && (
                                <motion.div 
                                    initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                                    className="overflow-hidden bg-slate-950/40"
                                >
                                    <div className="p-4 space-y-4 border-t border-white/5">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-slate-500 uppercase font-black">Full Name</label>
                                                <input value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-3 text-xs text-white" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-slate-500 uppercase font-black">Phone Number</label>
                                                <input value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-3 text-xs text-white" placeholder="+1 (555) 000-0000" />
                                            </div>
                                        </div>
                                        <button onClick={handleSaveProfile} disabled={isSaving} className="px-5 py-2 bg-teal-600 text-white text-xs font-black uppercase tracking-wider rounded-xl">Save Profile</button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Row 2: Security & password */}
                    <div>
                        <div 
                            onClick={() => toggleRow('security')}
                            className="flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer select-none"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                    <Lock className="w-4 h-4 text-orange-400" />
                                </div>
                                <span className="text-[13px] font-bold text-slate-200">Security & Credentials</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 text-slate-500 transform transition-transform ${expandedRows['security'] ? 'rotate-90' : ''}`} />
                        </div>
                        <AnimatePresence>
                            {expandedRows['security'] && (
                                <motion.div 
                                    initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                                    className="overflow-hidden bg-slate-950/40"
                                >
                                    <div className="p-4 space-y-4 border-t border-white/5">
                                        <div className="space-y-3">
                                            <input type="password" placeholder="Current Password" value={passwordData.currentPassword} onChange={e => setPasswordData({...passwordData, currentPassword: e.target.value})} className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-3 text-xs text-white" />
                                            <input type="password" placeholder="New Password" value={passwordData.newPassword} onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})} className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-3 text-xs text-white" />
                                            <input type="password" placeholder="Confirm New Password" value={passwordData.confirmPassword} onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})} className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-3 text-xs text-white" />
                                        </div>
                                        <button onClick={handleChangePassword} disabled={isSaving} className="px-5 py-2 bg-teal-600 text-white text-xs font-black uppercase tracking-wider rounded-xl">Update Password</button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Row 3: MFA / 2FA toggle */}
                    <div>
                        <div
                            onClick={() => toggleRow('mfa')}
                            className="flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer select-none"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                </div>
                                <span className="text-[13px] font-bold text-slate-200">Two-Factor Authentication (2FA)</span>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleRow('mfa'); }}
                                className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-[10px] font-black uppercase"
                            >
                                {expandedRows['mfa'] ? 'Close' : 'Manage'}
                            </button>
                        </div>
                        <AnimatePresence>
                            {expandedRows['mfa'] && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="px-4 pb-4">
                                        <MFAEnrollment />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* 2. WORKSPACE & BUSINESS GROUP */}
            <div className="space-y-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 px-2 block">Workspace Settings</span>
                <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
                    
                    {/* Row 1: Brand Info */}
                    <div>
                        <div 
                            onClick={() => toggleRow('business_profile')}
                            className="flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer select-none"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                                    <Building className="w-4 h-4 text-pink-400" />
                                </div>
                                <span className="text-[13px] font-bold text-slate-200">Business Profile & Invoices</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 text-slate-500 transform transition-transform ${expandedRows['business_profile'] ? 'rotate-90' : ''}`} />
                        </div>
                        <AnimatePresence>
                            {expandedRows['business_profile'] && (
                                <motion.div 
                                    initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                                    className="overflow-hidden bg-slate-950/40"
                                >
                                    <div className="p-4 space-y-4 border-t border-white/5">
                                        <div className="space-y-3">
                                            <input value={businessSettings.businessName} onChange={e => setBusinessSettings({...businessSettings, businessName: e.target.value})} placeholder="Official legal company name" className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-3 text-xs text-white" />
                                            <input value={businessSettings.tradingName} onChange={e => setBusinessSettings({...businessSettings, tradingName: e.target.value})} placeholder="Short name on invoices (e.g. ACS)" className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-3 text-xs text-white" />
                                            <p className="text-[10px] text-slate-500">PDF invoices use the short trading name when set — keeps layouts clean.</p>
                                            <input value={businessSettings.email} onChange={e => setBusinessSettings({...businessSettings, email: e.target.value})} placeholder="Business Email" className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-3 text-xs text-white" />
                                            <textarea value={businessSettings.address} onChange={e => setBusinessSettings({...businessSettings, address: e.target.value})} placeholder="Business Address" rows={2} className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs text-white resize-none" />
                                            <textarea value={businessSettings.bankDetails} onChange={e => setBusinessSettings({...businessSettings, bankDetails: e.target.value})} placeholder="Bank transfer account details" rows={2} className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-xs text-white resize-none" />
                                        </div>
                                        <button onClick={handleSaveBusiness} disabled={isSaving} className="px-5 py-2 bg-teal-600 text-white text-xs font-black uppercase tracking-wider rounded-xl">Save Details</button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Row 2: Regional format */}
                    <div>
                        <div 
                            onClick={() => toggleRow('regional')}
                            className="flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer select-none"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                                    <Globe className="w-4 h-4 text-violet-400" />
                                </div>
                                <span className="text-[13px] font-bold text-slate-200">Regional Format</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 text-slate-500 transform transition-transform ${expandedRows['regional'] ? 'rotate-90' : ''}`} />
                        </div>
                        <AnimatePresence>
                            {expandedRows['regional'] && (
                                <motion.div 
                                    initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                                    className="overflow-hidden bg-slate-950/40"
                                >
                                    <div className="p-4 space-y-4 border-t border-white/5">
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 uppercase font-black">Tax country (VAT / GST)</label>
                                            <select
                                                value={businessSettings.taxCountry}
                                                onChange={(e) => {
                                                    const code = e.target.value;
                                                    const lookup = getTaxRateForCountry(code);
                                                    setBusinessSettings({
                                                        ...businessSettings,
                                                        taxCountry: code,
                                                        taxRate: lookup.rate > 0 ? lookup.rate : businessSettings.taxRate,
                                                    });
                                                }}
                                                className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-3 text-xs text-white outline-none"
                                            >
                                                <option value="ZW">Zimbabwe (15% VAT)</option>
                                                <option value="ZA">South Africa (15% VAT)</option>
                                                <option value="KE">Kenya (16% VAT)</option>
                                                <option value="GH">Ghana (15% VAT)</option>
                                                <option value="NG">Nigeria (7.5% VAT)</option>
                                                <option value="GB">United Kingdom (20% VAT)</option>
                                                <option value="US">United States (manual)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 uppercase font-black">Default tax rate (%)</label>
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step={0.5}
                                                value={businessSettings.taxRate}
                                                onChange={(e) => setBusinessSettings({ ...businessSettings, taxRate: parseFloat(e.target.value) || 0 })}
                                                className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-3 text-xs text-white outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 uppercase font-black">Workspace currency</label>
                                            <select 
                                                value={businessSettings.currency} 
                                                onChange={e => setBusinessSettings({...businessSettings, currency: e.target.value})}
                                                className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-3 text-xs text-white outline-none"
                                            >
                                                <option value="USD">USD ($)</option>
                                                <option value="EUR">EUR (€)</option>
                                                <option value="GBP">GBP (£)</option>
                                                <option value="KES">KES (Ksh)</option>
                                            </select>
                                            <p className="text-[10px] text-slate-500 pt-1">Applies to invoices and reports for this workspace.</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Row 3: Industry sectors */}
                    <div>
                        <div 
                            onClick={() => toggleRow('sectors')}
                            className="flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer select-none"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                                    <Briefcase className="w-4 h-4 text-teal-400" />
                                </div>
                                <span className="text-[13px] font-bold text-slate-200">Sectors & Expertise</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 text-slate-500 transform transition-transform ${expandedRows['sectors'] ? 'rotate-90' : ''}`} />
                        </div>
                        <AnimatePresence>
                            {expandedRows['sectors'] && (
                                <motion.div 
                                    initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                                    className="overflow-hidden bg-slate-950/40"
                                >
                                    <div className="p-4 space-y-4 border-t border-white/5">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {UNIVERSAL_SERVICE_CATALOG.map(category => (
                                                <label
                                                    key={category.name}
                                                    className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${businessSettings.serviceSectors.includes(category.name)
                                                        ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                                                        : 'bg-slate-900 border-white/5 text-slate-500'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="mt-0.5 accent-teal-500"
                                                        checked={businessSettings.serviceSectors.includes(category.name)}
                                                        onChange={(e) => {
                                                            const newSectors = e.target.checked
                                                                ? [...businessSettings.serviceSectors, category.name]
                                                                : businessSettings.serviceSectors.filter(s => s !== category.name);
                                                            setBusinessSettings({ ...businessSettings, serviceSectors: newSectors });
                                                        }}
                                                    />
                                                    <div className="min-w-0">
                                                        <span className="font-bold text-xs block truncate">{category.name}</span>
                                                        <span className="text-[9px] opacity-60 block">{category.services.length} catalog options</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                        <button onClick={handleSaveBusiness} disabled={isSaving} className="px-5 py-2 bg-teal-600 text-white text-xs font-black uppercase tracking-wider rounded-xl">Save sectors</button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                </div>
            </div>

            {/* 3. INTEGRATIONS GROUP */}
            <div className="space-y-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 px-2 block">System Integrations</span>
                <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
                    
                    {/* Email delivery provider (transactional) */}
                    <div>
                        <div
                            onClick={() => toggleRow('email_provider')}
                            className="flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer select-none"
                        >
                            <span className="text-[13px] font-bold text-slate-200">Email Delivery Provider</span>
                            <ChevronRight className={`w-4 h-4 text-slate-500 transform transition-transform ${expandedRows['email_provider'] ? 'rotate-90' : ''}`} />
                        </div>
                        {expandedRows['email_provider'] && (
                            <div className="p-4 bg-slate-950/40 border-t border-white/5">
                                <EmailProviderSettings />
                            </div>
                        )}
                    </div>

                    {/* Zoho */}
                    <div>
                        <div 
                            onClick={() => toggleRow('integ_zoho')}
                            className="flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer select-none"
                        >
                            <span className="text-[13px] font-bold text-slate-200">Zoho Mail Client</span>
                            <ChevronRight className={`w-4 h-4 text-slate-500 transform transition-transform ${expandedRows['integ_zoho'] ? 'rotate-90' : ''}`} />
                        </div>
                        {expandedRows['integ_zoho'] && (
                            <div className="p-4 bg-slate-950/40 border-t border-white/5"><ZohoIntegration user={user} /></div>
                        )}
                    </div>

                    {/* Microsoft 365 */}
                    <div>
                        <div 
                            onClick={() => toggleRow('integ_m365')}
                            className="flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer select-none"
                        >
                            <span className="text-[13px] font-bold text-slate-200">Microsoft 365 / Teams Suite</span>
                            <ChevronRight className={`w-4 h-4 text-slate-500 transform transition-transform ${expandedRows['integ_m365'] ? 'rotate-90' : ''}`} />
                        </div>
                        {expandedRows['integ_m365'] && (
                            <div className="p-4 bg-slate-950/40 border-t border-white/5"><Microsoft365Integration /></div>
                        )}
                    </div>

                    {/* Resend */}
                    <div>
                        <div 
                            onClick={() => toggleRow('integ_resend')}
                            className="flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer select-none"
                        >
                            <span className="text-[13px] font-bold text-slate-200">Resend.com Email API</span>
                            <ChevronRight className={`w-4 h-4 text-slate-500 transform transition-transform ${expandedRows['integ_resend'] ? 'rotate-90' : ''}`} />
                        </div>
                        {expandedRows['integ_resend'] && (
                            <div className="p-4 bg-slate-950/40 border-t border-white/5"><ResendIntegration /></div>
                        )}
                    </div>

                    {/* SendGrid */}
                    <div>
                        <div 
                            onClick={() => toggleRow('integ_sendgrid')}
                            className="flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer select-none"
                        >
                            <span className="text-[13px] font-bold text-slate-200">SendGrid Email Delivery</span>
                            <ChevronRight className={`w-4 h-4 text-slate-500 transform transition-transform ${expandedRows['integ_sendgrid'] ? 'rotate-90' : ''}`} />
                        </div>
                        {expandedRows['integ_sendgrid'] && (
                            <div className="p-4 bg-slate-950/40 border-t border-white/5"><SendGridIntegration /></div>
                        )}
                    </div>

                    {/* Stripe Connect */}
                    <div>
                        <div 
                            onClick={() => toggleRow('integ_stripe')}
                            className="flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer select-none"
                        >
                            <span className="text-[13px] font-bold text-slate-200">Stripe Connect payouts</span>
                            <ChevronRight className={`w-4 h-4 text-slate-500 transform transition-transform ${expandedRows['integ_stripe'] ? 'rotate-90' : ''}`} />
                        </div>
                        {expandedRows['integ_stripe'] && (
                            <div className="p-4 bg-slate-950/40 border-t border-white/5"><StripeConnectSettings /></div>
                        )}
                    </div>

                    {/* Calendly */}
                    <div>
                        <div 
                            onClick={() => toggleRow('integ_calendly')}
                            className="flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer select-none"
                        >
                            <span className="text-[13px] font-bold text-slate-200">Calendly Booking Schedule</span>
                            <ChevronRight className={`w-4 h-4 text-slate-500 transform transition-transform ${expandedRows['integ_calendly'] ? 'rotate-90' : ''}`} />
                        </div>
                        {expandedRows['integ_calendly'] && (
                            <div className="p-4 bg-slate-950/40 border-t border-white/5"><CalendlySettings /></div>
                        )}
                    </div>

                </div>
            </div>

            {/* 4. NOTIFICATIONS GROUP */}
            <div className="space-y-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 px-2 block">Notification alerts</span>
                <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
                    {[
                        { key: 'emailNotifications', label: 'Email Outreach Logs', desc: 'Get updates on active campaign statuses' },
                        { key: 'projectUpdates', label: 'Project Status Sync', desc: 'Alert when client updates their requirements' },
                        { key: 'messageAlerts', label: 'Inbound chat warnings', desc: 'Notify immediately when leads send chat messages' }
                    ].map((setting) => (
                        <div key={setting.key} className="flex items-center justify-between p-4">
                            <div>
                                <h4 className="text-[13px] font-bold text-white">{setting.label}</h4>
                                <p className="text-[10px] text-slate-500">{setting.desc}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setNotificationSettings(prev => {
                                        const next = { ...prev, [setting.key]: !prev[setting.key as keyof typeof notificationSettings] };
                                        setTimeout(handleSaveNotifications, 100);
                                        return next;
                                    });
                                }}
                                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                                    notificationSettings[setting.key as keyof typeof notificationSettings] ? 'bg-teal-600' : 'bg-slate-800'
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                                    notificationSettings[setting.key as keyof typeof notificationSettings] ? 'translate-x-5' : 'translate-x-0'
                                }`} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* 5. APPEARANCE GROUP */}
            <div className="space-y-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 px-2 block">Appearance Theme</span>
                <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden p-4 space-y-4">
                    
                    {/* Theme Mode Segment switcher */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 uppercase font-black">Interface Theme</label>
                        <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5">
                            {(['dark', 'light', 'system'] as const).map((theme) => (
                                <button
                                    key={theme}
                                    onClick={() => {
                                        setThemeMode(theme);
                                        toast.success(`Theme updated to ${theme}`);
                                    }}
                                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg uppercase transition-all ${
                                        themeMode === theme ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    {theme}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Personal language — does not change workspace for other users */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 uppercase font-black">Your language</label>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value as typeof language)}
                            className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-3 text-xs text-white outline-none"
                        >
                            {LANGUAGES.map((lang) => (
                                <option key={lang.code} value={lang.code}>{lang.label}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-500">Personal preference only — other team members keep their own language.</p>
                    </div>

                    {/* Color palette dot pickers */}
                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-black block">Accent Brand Theme</label>
                        <div className="flex gap-3 pt-1">
                            {[
                                { color: '#0d9488', name: 'teal' },
                                { color: '#7c3aed', name: 'violet' },
                                { color: '#db2777', name: 'rose' },
                                { color: '#0284c7', name: 'sky' },
                                { color: '#d97706', name: 'amber' }
                            ].map((preset) => (
                                <button
                                    key={preset.name}
                                    onClick={() => {
                                        setBusinessSettings(prev => ({ ...prev, brandColor: preset.color }));
                                        setTimeout(handleSaveBusiness, 100);
                                    }}
                                    className="w-7 h-7 rounded-full border border-white/10 relative transition-transform active:scale-90"
                                    style={{ backgroundColor: preset.color }}
                                >
                                    {businessSettings.brandColor === preset.color && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            {/* 6. BILLING GROUP */}
            <div className="space-y-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 px-2 block">Plans & billing</span>
                <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
                    
                    {/* Subscription tier summary */}
                    <div className="p-4 flex justify-between items-center bg-slate-950/30">
                        <div>
                            <span className="text-[9px] text-slate-500 font-bold uppercase">Current active tier</span>
                            <h4 className="text-sm font-black text-white capitalize">{currentTenant?.subscription_plan || 'free'} plan</h4>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 border rounded-lg ${statusColors[currentTenant?.subscription_status || ''] || 'bg-slate-800 text-slate-400 border-transparent'}`}>
                            {currentTenant?.subscription_status || 'active'}
                        </span>
                    </div>

                    {/* Pricing Grid */}
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/10">
                        {(['starter', 'pro', 'enterprise'] as SubscriptionPlan[]).map((planId) => {
                            const plan = PLAN_PRICING[planId];
                            const isCurrent = currentTenant?.subscription_plan === planId;
                            return (
                                <div key={planId} className={`p-4 rounded-xl border flex flex-col justify-between ${isCurrent ? 'bg-teal-500/5 border-teal-500/30' : 'bg-slate-950 border-white/5'}`}>
                                    <div>
                                        <span className="text-xs font-black uppercase text-white tracking-wide block">{planId}</span>
                                        <span className="text-lg font-black text-white mt-1 block">${plan.monthly} <span className="text-[9px] text-slate-500 font-bold uppercase">/mo</span></span>
                                    </div>
                                    <button 
                                        onClick={() => !isCurrent && handleUpgrade(planId)}
                                        disabled={isCurrent}
                                        className={`w-full py-1.5 rounded-lg text-[9px] font-black uppercase mt-4 border transition-all ${
                                            isCurrent ? 'bg-slate-900 border-transparent text-slate-500' : 'bg-teal-600 border-teal-500 text-white'
                                        }`}
                                    >
                                        {isCurrent ? 'Active' : 'Upgrade'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Stripe portal */}
                    <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Payment credentials & portals</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">Manage details, history, and invoices safely on Stripe</p>
                        </div>
                        <button onClick={handleManageBilling} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider rounded-xl border border-white/5">Open portal</button>
                    </div>

                    {/* AI Quotas */}
                    <div className="p-4 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400">AI Tokens usage</span>
                            <span className="text-[10px] font-black uppercase text-teal-400">Optimal 45% used</span>
                        </div>
                        <div className="h-2 bg-slate-950 border border-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-teal-500 rounded-full" style={{ width: '45%' }} />
                        </div>
                    </div>

                </div>
            </div>

            {/* 7. DATA MANAGEMENT */}
            <div className="space-y-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 px-2 block">Data Management</span>
                <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
                    <div>
                        <div
                            onClick={() => toggleRow('deleted_records')}
                            className="flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-all cursor-pointer select-none"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-500/10 flex items-center justify-center">
                                    <Archive className="w-4 h-4 text-slate-400" />
                                </div>
                                <span className="text-[13px] font-bold text-slate-200">Deleted Records</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 text-slate-500 transform transition-transform ${expandedRows['deleted_records'] ? 'rotate-90' : ''}`} />
                        </div>
                        {expandedRows['deleted_records'] && (
                            <div className="p-4 bg-slate-950/40 border-t border-white/5">
                                <p className="text-[10px] text-slate-500 mb-3">
                                    Restore soft-deleted contacts and archived clients, or permanently purge contacts.
                                </p>
                                <DeletedRecordsSection />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 8. DEVELOPER MCP & API KEYS */}
            <div className="space-y-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 px-2 block">Developer MCP & API</span>
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 uppercase font-black block">MCP API Key</span>
                        {!mcpApiKey && !isLoadingApiKey && (
                            <button
                                onClick={handleGenerateApiKey}
                                disabled={isSaving}
                                className="text-[10px] px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isSaving ? 'Generating...' : 'Generate Key'}
                            </button>
                        )}
                    </div>
                    {isLoadingApiKey ? (
                        <div className="flex items-center justify-center p-3 bg-slate-950 rounded-xl border border-white/5">
                            <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                        </div>
                    ) : mcpApiKey ? (
                        <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-white/5">
                            <span className="font-mono text-xs text-slate-400 select-all">
                                {showApiKey ? mcpApiKey : `${mcpApiKey.substring(0, 12)}••••••••••••••••••••••••`}
                            </span>
                            <div className="flex items-center gap-1.5 ml-2">
                                <button
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-400"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(mcpApiKey);
                                        toast.success('API key copied to clipboard');
                                    }}
                                    className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-400"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 bg-slate-950 rounded-xl border border-white/5 text-center">
                            <p className="text-sm text-slate-400">{hasMcpApiKey ? 'MCP key active' : 'No MCP API key generated yet'}</p>
                            <p className="text-xs text-slate-500 mt-1">{hasMcpApiKey ? 'For security, the key is shown only when generated. Rotate it to receive a new value.' : 'Click "Generate Key" to create one'}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 8. DANGER ZONE */}
            <div className="space-y-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-rose-500 px-2 block">Danger Zone</span>
                <div className="bg-slate-900/40 border border-rose-900/20 rounded-2xl divide-y divide-rose-900/10 overflow-hidden">
                    <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                            <h4 className="text-[13px] font-bold text-rose-400">Delete Account Now</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">Permanently removes your account and signs you out immediately</p>
                        </div>
                        <button 
                            onClick={() => setDeleteModalOpen(true)}
                            className="px-4 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 text-xs font-black uppercase tracking-wider rounded-xl border border-rose-500/20"
                        >
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>

            {/* Deletion Dialog Modal */}
            <AnimatePresence>
                {deleteModalOpen && (
                    <div className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-sm bg-slate-900 border border-white/5 rounded-3xl p-5 space-y-4"
                        >
                            <div className="flex items-center gap-2 text-amber-500">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <h3 className="text-sm font-black uppercase tracking-wider">Warning Action</h3>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                This will permanently delete your profile and associated data. You will be signed out and will not be able to log back in.
                            </p>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button 
                                    onClick={handleDeleteAccount}
                                    disabled={isDeleting}
                                    className="py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase rounded-xl flex items-center justify-center"
                                >
                                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Deletion'}
                                </button>
                                <button 
                                    onClick={() => setDeleteModalOpen(false)}
                                    className="py-2.5 bg-slate-800 text-slate-400 text-xs font-bold rounded-xl border border-white/5"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
}

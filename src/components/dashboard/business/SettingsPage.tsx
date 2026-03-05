import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import CalendlySettings from './CalendlySettings';
import {
    Building,
    Palette,
    Bell,
    Shield,
    Save,
    Upload,
    Loader2,
    Calendar,
    Trash2,
    X,
    CreditCard,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { fileUploadService } from '../../../services/fileUploadService';
import GmailIntegration from './GmailIntegration';
import MFAEnrollment from './MFAEnrollment';
import { authService } from '../../../services/authService';
import { Button, Modal, Input } from '../../ui/UIComponents';

interface SettingsPageProps {
    user: User;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const [activeTab, setActiveTab] = useState('business');
    const [settings, setSettings] = useState({
        businessName: '',
        logoUrl: '',
        brandColor: '#2dd4bf',
        address: '',
        phone: '',
        email: '',
        taxRate: 0,
        currency: 'USD',
        invoicePrefix: 'INV',
        bankDetails: '',
        mobilePaymentDetails: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const searchParams = useSearchParams();
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
    const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
    const [connectLoading, setConnectLoading] = useState(false);

    const handleStripeConnect = async () => {
        if (!currentTenant) return;
        setConnectLoading(true);
        const toastId = toast.loading('Initiating Stripe connection...');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('No active session');

            const response = await fetch('/api/stripe/connect/onboarding', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    returnUrl: `${window.location.origin}/api/stripe/connect/callback?tenantId=${currentTenant.id}`,
                    refreshUrl: `${window.location.origin}/dashboard?tab=billing&connect=refresh`
                })
            });
            const data = await response.json();

            if (data.url) {
                toast.dismiss(toastId);
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Failed to initiate connection');
            }
        } catch (error: any) {
            console.error('Stripe connect error:', error);
            toast.error(error.message || 'An error occurred. Please try again.', { id: toastId });
        } finally {
            setConnectLoading(false);
        }
    };

    const handleManageSubscription = async () => {
        if (!currentTenant) return;
        setIsRedirecting(true);
        const toastId = toast.loading('Redirecting to billing portal...');
        try {
            const response = await fetch('/api/stripe/create-portal-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: currentTenant.id })
            });
            const data = await response.json();
            if (data.url) {
                toast.dismiss(toastId);
                window.location.href = data.url;
            } else {
                toast.error(data.error || 'Failed to open billing portal', { id: toastId });
                setIsRedirecting(false);
            }
        } catch (error) {
            console.error('Portal error:', error);
            toast.error('An error occurred. Please try again.', { id: toastId });
            setIsRedirecting(false);
        }
    };

    const handleUpgrade = async (planId: string, priceId: string) => {
        if (!currentTenant) return;
        setUpgradeLoading(planId);
        try {
            const response = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId,
                    planId,
                    tenantId: currentTenant.id,
                    adminEmail: user.email,
                    successUrl: `${window.location.origin}/dashboard?tab=settings&checkout=success`,
                    cancelUrl: `${window.location.origin}/dashboard?tab=settings&checkout=cancelled`
                })
            });
            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                toast.error(data.error || 'Failed to initiate checkout');
                setUpgradeLoading(null);
            }
        } catch (error) {
            console.error('Checkout error:', error);
            toast.error('An error occurred. Please try again.');
            setUpgradeLoading(null);
        }
    };

    useEffect(() => {
        const error = searchParams.get('error');
        const tab = searchParams.get('tab');

        if (tab) {
            setActiveTab(tab);
        }

        if (error === 'calendly_not_configured') {
            toast.error('Calendly OAuth is not configured on the server. Please use the manual link option.');
        } else if (error) {
            toast.error(`Error: ${error}`);
        }

        const success = searchParams.get('success');
        if (success === 'calendly_connected') {
            toast.success('Calendly connected successfully!');
            setActiveTab('booking');
        }
    }, [searchParams]);

    useEffect(() => {
        if (currentTenant) {
            loadSettings();
        }
    }, [currentTenant]);

    const loadSettings = async () => {
        if (!currentTenant) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('business_settings')
                .select('*')
                .eq('tenant_id', currentTenant.id)
                .single();

            if (!error && data) {
                setSettings({
                    businessName: data.business_name || '',
                    logoUrl: data.logo_url || '',
                    brandColor: data.brand_color || '#2dd4bf',
                    address: data.address || '',
                    phone: data.phone || '',
                    email: data.email || '',
                    taxRate: data.tax_rate || 0,
                    currency: data.currency || 'USD',
                    invoicePrefix: data.invoice_prefix || 'INV',
                    bankDetails: data.bank_details || '',
                    mobilePaymentDetails: data.mobile_payment_details || ''
                });
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!currentTenant) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from('business_settings')
                .upsert({
                    tenant_id: currentTenant.id,
                    business_name: settings.businessName,
                    logo_url: settings.logoUrl,
                    brand_color: settings.brandColor,
                    address: settings.address,
                    phone: settings.phone,
                    email: settings.email,
                    tax_rate: settings.taxRate,
                    currency: settings.currency,
                    invoice_prefix: settings.invoicePrefix,
                    bank_details: settings.bankDetails,
                    mobile_payment_details: settings.mobilePaymentDetails,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'tenant_id' });

            if (!error) {
                alert('Settings saved successfully!');
            } else {
                alert(`Error saving settings: ${error.message}`);
            }
        } catch (error: any) {
            console.error('Error saving settings:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const result = await fileUploadService.uploadFile(file, 'tenant_logo', currentTenant?.id);
            if (result.success && result.url) {
                setSettings({ ...settings, logoUrl: result.url });
            } else {
                alert('Failed to upload logo: ' + result.error);
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const tabs = [
        { id: 'business', label: 'Business Profile', icon: Building },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'booking', label: 'Booking & Calendly', icon: Calendar },
        { id: 'billing', label: 'Billing & Plans', icon: CreditCard }
    ];

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            const { error } = await authService.requestAccountDeletion();
            if (error) {
                toast.error(error);
                return;
            }
            toast.success('Account deletion scheduled. You will be logged out.');
            setDeleteModalOpen(false);
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err) {
            toast.error('Failed to request account deletion');
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full"><div className="text-slate-400">Loading settings...</div></div>;
    }

    return (
        <div className="flex flex-col md:flex-row gap-6 h-full p-4 md:p-6">
            {/* Sidebar / Tabs */}
            <div className="w-full md:w-64 bg-slate-900/50 border border-slate-700 rounded-2xl p-4 md:p-5 h-fit shrink-0">
                <h3 className="text-lg font-semibold mb-4 hidden md:block">Settings</h3>
                <div className="flex md:flex-col overflow-x-auto md:overflow-visible gap-2 pb-2 md:pb-0 scrollbar-hide">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <tab.icon className="w-5 h-5" />
                            <span className="font-medium">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 bg-slate-900/50 border border-slate-700 rounded-2xl p-4 md:p-6 overflow-y-auto">
                {activeTab === 'business' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold mb-4">Business Profile</h3>
                            <p className="text-slate-400 mb-6">Manage your business information</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Business Name</label>
                                <input
                                    type="text"
                                    value={settings.businessName}
                                    onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Email</label>
                                <input
                                    type="email"
                                    value={settings.email}
                                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Phone</label>
                                <input
                                    type="tel"
                                    value={settings.phone}
                                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Address</label>
                                <textarea
                                    value={settings.address}
                                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-700">
                                <h4 className="text-md font-bold mb-4 text-teal-400">Payment Instructions (Manual)</h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Bank Details</label>
                                        <textarea
                                            value={settings.bankDetails}
                                            onChange={(e) => setSettings({ ...settings, bankDetails: e.target.value })}
                                            rows={3}
                                            placeholder="Bank Name, Account Number, Swift, etc."
                                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">These will be shown on invoices if 'Bank Transfer' is selected.</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2">Mobile Payment / Other</label>
                                        <input
                                            type="text"
                                            value={settings.mobilePaymentDetails}
                                            onChange={(e) => setSettings({ ...settings, mobilePaymentDetails: e.target.value })}
                                            placeholder="e.g. Mobile number, PayPal email"
                                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}



                {activeTab === 'notifications' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold mb-4">Notification Preferences</h3>
                            <p className="text-slate-400 mb-6">Manage how your team receives alerts</p>
                        </div>
                        <div className="space-y-4">
                            {[
                                { title: 'New Client Alerts', desc: 'When a new client is added' },
                                { title: 'Project Updates', desc: 'Major project milestones' },
                                { title: 'Billing Alerts', desc: 'Invoice payments and due dates' },
                                { title: 'Security Alerts', desc: 'New login attempts' }
                            ].map((item, i) => (
                                <div key={i} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-4 bg-slate-800 rounded-xl border border-slate-700">
                                    <div>
                                        <h4 className="font-medium text-white">{item.title}</h4>
                                        <p className="text-sm text-slate-400">{item.desc}</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" defaultChecked className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold mb-4">Security Settings</h3>
                            <p className="text-slate-400 mb-6">Configure tenant security policies</p>
                        </div>
                        <div className="space-y-4">
                            <MFAEnrollment />
                            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                                <h4 className="font-medium text-white mb-2">Login History</h4>
                                <div className="text-sm text-slate-400">
                                    <div className="flex flex-col md:flex-row justify-between gap-2 py-2 border-b border-slate-700">
                                        <span>Admin User (You)</span>
                                        <span>Just now • 127.0.0.1</span>
                                    </div>
                                    <div className="flex flex-col md:flex-row justify-between gap-2 py-2 border-b border-slate-700">
                                        <span>Manager User</span>
                                        <span>2 hours ago • 192.168.1.1</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-8 border-t border-slate-700">
                                <h4 className="text-red-500 font-bold mb-4 flex items-center gap-2 uppercase text-xs tracking-widest">
                                    Danger Zone
                                </h4>
                                <div className="p-6 bg-red-500/5 rounded-2xl border border-red-500/10">
                                    <h4 className="text-white font-semibold mb-2">Delete Account</h4>
                                    <p className="text-sm text-slate-400 mb-6">
                                        Once scheduled, your data will be kept for 30 days before permanent removal.
                                        You can cancel this request at any time during this period.
                                    </p>
                                    <button
                                        onClick={() => setDeleteModalOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-xl transition-all text-sm font-medium"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete My Account
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Delete Confirmation Modal */}
                        <Modal
                            isOpen={deleteModalOpen}
                            onClose={() => setDeleteModalOpen(false)}
                            title="Delete Account"
                        >
                            <div className="space-y-4">
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                                    <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-red-500 font-bold text-sm">Are you absolutely sure?</h4>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Your account will be scheduled for deletion. You will have 30 days to cancel this request.
                                            After 30 days, your account and all associated data will be permanently deleted.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={isDeleting}
                                        className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:bg-slate-700 text-white rounded-xl font-bold text-sm transition-all"
                                    >
                                        {isDeleting ? 'Processing...' : 'Yes, Delete My Account'}
                                    </button>
                                    <button
                                        onClick={() => setDeleteModalOpen(false)}
                                        disabled={isDeleting}
                                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </Modal>
                    </div>
                )}

                {/* Booking System Tab */}
                {activeTab === 'booking' && (
                    <div className="space-y-12">
                        <CalendlySettings />
                    </div>
                )}

                {/* Billing & Subscription Tab */}
                {activeTab === 'billing' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold mb-4">Subscription & Billing</h3>
                            <p className="text-slate-400 mb-6">Manage your AlphaClone subscription plan and billing methods.</p>
                        </div>
                        <div className="p-6 bg-slate-800 rounded-xl border border-slate-700">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                                <div>
                                    <h4 className="text-lg font-bold text-white mb-2">Current Plan</h4>
                                    <p className="text-sm text-slate-400">
                                        You are currently on the <span className="text-teal-400 font-bold uppercase">{currentTenant?.subscription_plan || 'Starter'}</span> plan.
                                    </p>
                                </div>
                                <div className="px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full text-xs font-bold uppercase tracking-wider w-fit">
                                    Active
                                </div>
                            </div>
                            <div className="space-y-4 mb-8">
                                <p className="text-sm text-slate-300">Features included in your plan:</p>
                                <ul className="list-disc list-inside text-sm text-slate-400 space-y-2">
                                    <li>Multi-tenant Users</li>
                                    <li>Core CRM Pipeline</li>
                                    <li>Secure Storage</li>
                                    <li>Standard Project Management</li>
                                </ul>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-700">
                                <button
                                    onClick={handleManageSubscription}
                                    disabled={isRedirecting}
                                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-teal-900/20 flex items-center gap-2 justify-center"
                                >
                                    {isRedirecting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {isRedirecting ? 'Redirecting...' : 'Manage Subscription'}
                                </button>
                                <button
                                    onClick={() => setUpgradeModalOpen(true)}
                                    disabled={isRedirecting}
                                    className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl font-bold transition-all border border-slate-600"
                                >
                                    View Upgrade Options
                                </button>
                            </div>
                        </div>

                        {/* Stripe Connect Section */}
                        <div className="p-6 bg-slate-800 rounded-xl border border-slate-700">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                                    <CreditCard className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-white mb-1">Receive Payments (Stripe Connect)</h4>
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        Connect your Stripe account to receive payments directly through the platform.
                                        This enables you to charge clients via our native invoicing and checkout features.
                                        {currentTenant?.stripe_connect_onboarded ? (
                                            <span className="block mt-2 text-teal-400 font-medium flex items-center gap-1.5 text-xs bg-teal-500/10 w-fit px-2 py-1 rounded-md">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Stripe Account Connected
                                            </span>
                                        ) : (
                                            <span className="block mt-2 text-amber-500 font-medium flex items-center gap-1.5 text-xs bg-amber-500/10 w-fit px-2 py-1 rounded-md">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                Action Required: Connect to start receiving payments.
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-700">
                                <button
                                    onClick={handleStripeConnect}
                                    disabled={true}
                                    className="px-5 py-2 bg-slate-800 text-slate-500 cursor-not-allowed rounded-xl font-bold flex items-center gap-2 transition-all text-sm border border-slate-700"
                                >
                                    <CreditCard className="w-4 h-4" />
                                    COMING SOON
                                </button>
                            </div>
                        </div>
                    </div>
                )}


                {/* Save Button for Forms */}
                {(activeTab === 'business') && (
                    <div className="mt-8 pt-6 border-t border-slate-700">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl transition-colors"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}

                {/* Upgrade Modal */}
                <Modal
                    isOpen={upgradeModalOpen}
                    onClose={() => setUpgradeModalOpen(false)}
                    title="Upgrade Your Plan"
                    maxWidth="max-w-4xl"
                >
                    <div className="space-y-6">
                        <p className="text-slate-400 text-center max-w-2xl mx-auto">
                            Choose the perfect plan to scale your operations. Cancel or downgrade at any time.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Starter Plan */}
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
                                <h4 className="text-xl font-bold text-white mb-2">Starter</h4>
                                <div className="text-3xl font-black text-white mb-4">$15<span className="text-sm font-normal text-slate-500">/mo</span></div>
                                <ul className="space-y-3 mb-6 flex-1">
                                    <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-slate-500" /> Up to 5 team members</li>
                                    <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-slate-500" /> Core CRM pipeline</li>
                                    <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-slate-500" /> Invoicing & basic finance</li>
                                </ul>
                                <button
                                    onClick={() => handleUpgrade('starter', 'price_1T0PCcCCIq5cPz4Hvazdrvtb')}
                                    disabled={upgradeLoading !== null}
                                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                                >
                                    {upgradeLoading === 'starter' ? 'Please wait...' : 'Select Starter'}
                                </button>
                            </div>

                            {/* Pro Plan */}
                            <div className="bg-gradient-to-b from-teal-900/40 to-slate-900 border border-teal-500/30 rounded-2xl p-6 flex flex-col relative">
                                <div className="absolute top-0 right-0 bg-teal-500 text-slate-900 text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">Popular</div>
                                <h4 className="text-xl font-bold text-teal-400 mb-2">Professional</h4>
                                <div className="text-3xl font-black text-white mb-4">$45<span className="text-sm font-normal text-slate-500">/mo</span></div>
                                <ul className="space-y-3 mb-6 flex-1">
                                    <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-teal-400" /> Up to 25 team members</li>
                                    <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-teal-400" /> AI Growth Agent</li>
                                    <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-teal-400" /> Full financial suite</li>
                                </ul>
                                <button
                                    onClick={() => handleUpgrade('pro', 'price_1T0PChCCIq5cPz4HiD85RMtD')}
                                    disabled={upgradeLoading !== null}
                                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20 rounded-xl font-bold transition-all disabled:opacity-50"
                                >
                                    {upgradeLoading === 'pro' ? 'Please wait...' : 'Select Professional'}
                                </button>
                            </div>

                            {/* Enterprise Plan */}
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
                                <h4 className="text-xl font-bold text-blue-400 mb-2">Enterprise</h4>
                                <div className="text-3xl font-black text-white mb-4">$80<span className="text-sm font-normal text-slate-500">/mo</span></div>
                                <ul className="space-y-3 mb-6 flex-1">
                                    <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-blue-400" /> Unlimited team members</li>
                                    <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-blue-400" /> White-label branding</li>
                                    <li className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="w-4 h-4 text-blue-400" /> Document Storage</li>
                                </ul>
                                <button
                                    onClick={() => handleUpgrade('enterprise', 'price_1T0PCqCCIq5cPz4HtjeFQZSG')}
                                    disabled={upgradeLoading !== null}
                                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                                >
                                    {upgradeLoading === 'enterprise' ? 'Please wait...' : 'Select Enterprise'}
                                </button>
                            </div>
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
};

export default SettingsPage;

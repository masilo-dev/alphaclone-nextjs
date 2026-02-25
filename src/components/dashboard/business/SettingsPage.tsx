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
    CreditCard
} from 'lucide-react';
import { fileUploadService } from '../../../services/fileUploadService';
import GmailIntegration from './GmailIntegration';
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
                            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
                                    <div>
                                        <h4 className="font-medium text-white">Two-Factor Authentication (2FA)</h4>
                                        <p className="text-sm text-slate-400">Require all team members to use 2FA</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" disabled />
                                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500 opacity-50 cursor-not-allowed"></div>
                                    </label>
                                </div>
                                <p className="text-xs text-slate-500 italic">⚠️ 2FA will be available in a future update</p>
                            </div>
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
                        <div className="border-b border-slate-700 pb-12">
                            <GmailIntegration user={user} />
                        </div>
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
                                    onClick={() => toast.error('Stripe billing portal integration pending.')}
                                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-teal-900/20"
                                >
                                    Manage Subscription
                                </button>
                                <button
                                    onClick={() => window.location.href = '/pricing'}
                                    className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-all border border-slate-600"
                                >
                                    View Upgrade Options
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'booking' && (
                    <div className="space-y-12">
                        <div className="border-b border-slate-700 pb-12">
                            <GmailIntegration user={user} />
                        </div>
                        <CalendlySettings />
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
            </div>
        </div>
    );
};

export default SettingsPage;

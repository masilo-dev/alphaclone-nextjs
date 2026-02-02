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
    Calendar
} from 'lucide-react';
import { fileUploadService } from '../../../services/fileUploadService';

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
                });

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
        { id: 'branding', label: 'Branding', icon: Palette },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'booking', label: 'Booking & Calendly', icon: Calendar }
    ];

    if (loading) {
        return <div className="flex items-center justify-center h-full"><div className="text-slate-400">Loading settings...</div></div>;
    }

    return (
        <div className="flex flex-col md:flex-row gap-6 h-full">
            {/* Sidebar / Tabs */}
            <div className="w-full md:w-64 bg-slate-900/50 border border-slate-800 rounded-2xl p-5 h-fit shrink-0">
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
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 overflow-y-auto">
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

                            <div className="pt-4 border-t border-slate-800">
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

                {activeTab === 'branding' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold mb-4">Branding</h3>
                            <p className="text-slate-400 mb-6">Customize your brand appearance</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Logo</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
                                        {settings.logoUrl ? (
                                            <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                        ) : (
                                            <Building className="w-8 h-8 text-slate-600" />
                                        )}
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors border border-slate-700">
                                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                            <span className="text-sm font-medium">{uploading ? 'Uploading...' : 'Upload Logo'}</span>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleLogoUpload}
                                                disabled={uploading}
                                            />
                                        </label>
                                        <p className="text-xs text-slate-500 mt-2">Recommended: 512x512px PNG or JPG</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Brand Color</label>
                                <div className="flex gap-3">
                                    <input
                                        type="color"
                                        value={settings.brandColor}
                                        onChange={(e) => setSettings({ ...settings, brandColor: e.target.value })}
                                        className="w-16 h-10 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={settings.brandColor}
                                        onChange={(e) => setSettings({ ...settings, brandColor: e.target.value })}
                                        className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                                    />
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
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-800">
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
                            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="font-medium text-white">Two-Factor Authentication (2FA)</h4>
                                        <p className="text-sm text-slate-400">Require all team members to use 2FA</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                                    </label>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                                <h4 className="font-medium text-white mb-2">Login History</h4>
                                <div className="text-sm text-slate-400">
                                    <div className="flex justify-between py-2 border-b border-slate-800">
                                        <span>Admin User (You)</span>
                                        <span>Just now • 127.0.0.1</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-slate-800">
                                        <span>Manager User</span>
                                        <span>2 hours ago • 192.168.1.1</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Booking System Tab */}
                {activeTab === 'booking' && (
                    <CalendlySettings />
                )}

                {/* Save Button for Forms */}
                {(activeTab === 'business' || activeTab === 'branding') && (
                    <div className="mt-8 pt-6 border-t border-slate-800">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl transition-colors"
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

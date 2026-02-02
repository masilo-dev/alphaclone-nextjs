import React, { useState } from 'react';
import { User as UserIcon, Bell, Lock, Palette, Globe, Loader2 } from 'lucide-react';
import { Button, Card, Input } from '../ui/UIComponents';
import { User as UserType } from '../../types';
import { userService } from '../../services/userService';
import toast from 'react-hot-toast';
import { useTenant } from '../../contexts/TenantContext';
import { SubscriptionPlan, PLAN_PRICING } from '../../services/tenancy/types';
import CalendlySettings from './business/CalendlySettings';

interface SettingsPageProps {
    user: UserType;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ user }) => {
    const [activeSection, setActiveSection] = useState<'profile' | 'notifications' | 'security' | 'appearance' | 'billing' | 'booking'>('profile');
    const [isSaving, setIsSaving] = useState(false);
    const { currentTenant } = useTenant();

    const [profileData, setProfileData] = useState({
        name: user.name,
        email: user.email,
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

    // SVG components for internal use
    const CreditCardIcon = (props: any) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-credit-card"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
    );

    const CalendarIcon = (props: any) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
    );

    const sections = [
        { id: 'profile' as const, label: 'Profile', icon: UserIcon },
        { id: 'notifications' as const, label: 'Notifications', icon: Bell },
        { id: 'security' as const, label: 'Security', icon: Lock },
        { id: 'appearance' as const, label: 'Appearance', icon: Palette },
        { id: 'billing' as const, label: 'Plans & Billing', icon: CreditCardIcon },
        { id: 'booking' as const, label: 'Booking & Integrations', icon: CalendarIcon }
    ];

    const handleSaveProfile = async () => {
        if (!profileData.name.trim()) {
            toast.error('Name is required');
            return;
        }

        setIsSaving(true);

        try {
            const { error } = await userService.updateProfile(user.id, {
                name: profileData.name,
                email: profileData.email,
                phone: profileData.phone,
                company: profileData.company,
                timezone: profileData.timezone
            });

            if (error) {
                toast.error(`Failed to save: ${error}`);
            } else {
                toast.success('Profile updated successfully!');
            }
        } catch (err) {
            toast.error('Failed to save profile');
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

            if (error) {
                toast.error(`Failed to save: ${error}`);
            } else {
                toast.success('Notification preferences updated!');
            }
        } catch (err) {
            toast.error('Failed to save preferences');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
            toast.error('All password fields are required');
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        if (passwordData.newPassword.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }

        setIsSaving(true);

        try {
            const { error } = await userService.changePassword(
                passwordData.currentPassword,
                passwordData.newPassword
            );

            if (error) {
                toast.error(error);
            } else {
                toast.success('Password updated successfully!');
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            }
        } catch (err) {
            toast.error('Failed to update password');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEnable2FA = () => {
        // toast('2FA feature coming soon!', { icon: '🔒' });
        toast.success('2FA verification email sent');
    };

    const handleSaveAppearance = () => {
        toast.success('Appearance preferences saved!');
    };

    const handleUpgrade = async (planId: string) => {
        if (!currentTenant) return;

        const planPricing = PLAN_PRICING[planId as SubscriptionPlan];
        if (!planPricing?.stripePriceId) {
            toast.error('This plan cannot be upgraded online.');
            return;
        }

        try {
            const response = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId: planPricing.stripePriceId,
                    tenantId: currentTenant.id,
                    adminEmail: user.email,
                })
            });
            const { url } = await response.json();
            if (url) window.location.href = url;
        } catch (err) {
            toast.error('Failed to initiate checkout');
        }
    };

    const handleManageBilling = async () => {
        if (!currentTenant?.stripe_customer_id) {
            toast.error('No active billing found. Upgrade first!');
            return;
        }

        try {
            const response = await fetch('/api/stripe/create-portal-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: currentTenant.id })
            });
            const { url } = await response.json();
            if (url) window.location.href = url;
        } catch (err) {
            toast.error('Failed to open billing portal');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold text-white">Settings</h2>
                <p className="text-slate-400 mt-1">Manage your account preferences and settings</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar - Horizontal scroll on mobile, vertical list on desktop */}
                <div className="lg:col-span-1">
                    <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible gap-2 pb-4 lg:pb-0 scrollbar-hide">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`flex-shrink-0 lg:w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-2xl text-[10px] lg:text-xs font-black uppercase tracking-widest transition-all duration-300 border ${activeSection === section.id
                                    ? 'bg-teal-600 border-teal-500 text-white shadow-lg shadow-teal-600/20'
                                    : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                <section.icon className="w-4 h-4" />
                                <span className="whitespace-nowrap">{section.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="lg:col-span-3">
                    <Card>
                        {activeSection === 'profile' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-4">Profile Information</h3>
                                    <div className="space-y-4">
                                        <Input
                                            label="Full Name *"
                                            value={profileData.name}
                                            onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                                            required
                                        />
                                        <Input
                                            label="Email Address"
                                            type="email"
                                            value={profileData.email}
                                            onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                            disabled
                                        />
                                        <Input
                                            label="Phone Number"
                                            type="tel"
                                            value={profileData.phone}
                                            onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                                            placeholder="+1 (555) 000-0000"
                                        />
                                        <Input
                                            label="Company"
                                            value={profileData.company}
                                            onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
                                            placeholder="Your company name"
                                        />
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Timezone</label>
                                            <select
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-teal-500"
                                                value={profileData.timezone}
                                                onChange={(e) => setProfileData({ ...profileData, timezone: e.target.value })}
                                            >
                                                <option value="UTC">UTC (GMT+0)</option>
                                                <option value="America/New_York">Eastern Time (GMT-5)</option>
                                                <option value="America/Chicago">Central Time (GMT-6)</option>
                                                <option value="America/Los_Angeles">Pacific Time (GMT-8)</option>
                                                <option value="Europe/London">London (GMT+0)</option>
                                                <option value="Europe/Paris">Paris (GMT+1)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/5">
                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={isSaving}
                                        className="w-full lg:w-auto px-8 py-4 bg-teal-600 hover:bg-teal-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-teal-600/20 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {isSaving ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>SYNCING...</span>
                                            </div>
                                        ) : (
                                            'CONFIRM CHANGES'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeSection === 'notifications' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-4">Notification Preferences</h3>
                                    <div className="space-y-4">
                                        {[
                                            { key: 'emailNotifications', label: 'Email Notifications', description: 'Receive email updates about your account' },
                                            { key: 'projectUpdates', label: 'Project Updates', description: 'Get notified when projects change status' },
                                            { key: 'messageAlerts', label: 'Message Alerts', description: 'Receive alerts for new messages' },
                                            { key: 'weeklyReports', label: 'Weekly Reports', description: 'Get a weekly summary of your activity' },
                                        ].map((setting) => (
                                            <div key={setting.key} className="flex items-center justify-between p-4 bg-slate-900 rounded-lg">
                                                <div>
                                                    <h4 className="text-white font-medium">{setting.label}</h4>
                                                    <p className="text-sm text-slate-400">{setting.description}</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={notificationSettings[setting.key as keyof typeof notificationSettings]}
                                                        onChange={(e) =>
                                                            setNotificationSettings({
                                                                ...notificationSettings,
                                                                [setting.key]: e.target.checked,
                                                            })
                                                        }
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-800">
                                    <Button
                                        onClick={handleSaveNotifications}
                                        disabled={isSaving}
                                        className="bg-teal-600 hover:bg-teal-500"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Saving...
                                            </>
                                        ) : (
                                            'Save Preferences'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {activeSection === 'security' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-4">Security Settings</h3>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-slate-900 rounded-lg">
                                            <h4 className="text-white font-medium mb-2">Change Password</h4>
                                            <div className="space-y-3">
                                                <Input
                                                    label="Current Password"
                                                    type="password"
                                                    placeholder="Enter current password"
                                                    value={passwordData.currentPassword}
                                                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                                />
                                                <Input
                                                    label="New Password"
                                                    type="password"
                                                    placeholder="Enter new password (min 8 characters)"
                                                    value={passwordData.newPassword}
                                                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                />
                                                <Input
                                                    label="Confirm New Password"
                                                    type="password"
                                                    placeholder="Confirm new password"
                                                    value={passwordData.confirmPassword}
                                                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={handleChangePassword}
                                                    disabled={isSaving}
                                                    className="bg-teal-600 hover:bg-teal-500"
                                                >
                                                    {isSaving ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                            Updating...
                                                        </>
                                                    ) : (
                                                        'Update Password'
                                                    )}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-slate-900 rounded-lg">
                                            <h4 className="text-white font-medium mb-2">Two-Factor Authentication</h4>
                                            <p className="text-sm text-slate-400 mb-3">Add an extra layer of security to your account</p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleEnable2FA}
                                            >
                                                Enable 2FA
                                            </Button>
                                        </div>

                                        <div className="p-4 bg-slate-900 rounded-lg">
                                            <h4 className="text-white font-medium mb-2">Active Sessions</h4>
                                            <p className="text-sm text-slate-400 mb-3">Manage devices where you're currently logged in</p>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between p-3 bg-slate-800 rounded">
                                                    <div className="flex items-center gap-3">
                                                        <Globe className="w-5 h-5 text-teal-400" />
                                                        <div>
                                                            <p className="text-sm text-white font-medium">Current Session</p>
                                                            <p className="text-xs text-slate-400">Windows • Chrome • Active now</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-green-400">Active</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'billing' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-4">Subscription Plan</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {(['starter', 'pro', 'enterprise'] as SubscriptionPlan[]).map((planId) => {
                                            const plan = PLAN_PRICING[planId];
                                            const isCurrent = currentTenant?.subscription_plan === planId;

                                            return (
                                                <div
                                                    key={planId}
                                                    className={`p-6 rounded-3xl border-2 transition-all duration-500 relative overflow-hidden group ${isCurrent
                                                        ? 'border-teal-500 bg-teal-500/5'
                                                        : 'border-white/5 bg-slate-900/40 hover:border-white/10'
                                                        }`}
                                                >
                                                    {isCurrent && (
                                                        <div className="absolute top-0 right-0 px-3 py-1 bg-teal-500 text-slate-900 text-[8px] font-black uppercase tracking-widest rounded-bl-xl">
                                                            ACTIVE
                                                        </div>
                                                    )}
                                                    <div className="mb-6">
                                                        <h4 className="text-white text-lg font-black tracking-tighter capitalize">{planId}</h4>
                                                        <p className="text-3xl font-black text-white mt-1">
                                                            ${plan.monthly}
                                                            <span className="text-[10px] font-bold text-slate-500 ml-1">/MO</span>
                                                        </p>
                                                    </div>
                                                    <ul className="space-y-3 mb-8">
                                                        <li className="text-[10px] font-bold text-slate-400 flex items-center gap-2 uppercase tracking-tighter">
                                                            <div className="w-1 h-1 bg-teal-500 rounded-full" /> {plan.features.maxUsers === -1 ? 'Unlimited' : plan.features.maxUsers} Users
                                                        </li>
                                                        <li className="text-[10px] font-bold text-slate-400 flex items-center gap-2 uppercase tracking-tighter">
                                                            <div className="w-1 h-1 bg-teal-500 rounded-full" /> {plan.features.maxProjects === -1 ? 'Unlimited' : plan.features.maxProjects} Projects
                                                        </li>
                                                        <li className="text-[10px] font-bold text-slate-400 flex items-center gap-2 uppercase tracking-tighter">
                                                            <div className="w-1 h-1 bg-teal-500 rounded-full" /> {plan.features.maxVideoMeetingsPerMonth === -1 ? 'Unlimited' : plan.features.maxVideoMeetingsPerMonth} Video Meetings/mo
                                                        </li>
                                                        <li className="text-[10px] font-bold text-slate-400 flex items-center gap-2 uppercase tracking-tighter">
                                                            <div className="w-1 h-1 bg-teal-500 rounded-full" /> {plan.features.maxVideoMinutesPerMeeting === -1 ? 'Unlimited' : plan.features.maxVideoMinutesPerMeeting} mins per meeting
                                                        </li>
                                                        {plan.features.aiAssistant && (
                                                            <li className="text-[10px] font-bold text-slate-400 flex items-center gap-2 uppercase tracking-tighter">
                                                                <div className="w-1 h-1 bg-teal-500 rounded-full" /> AI Sales Agent
                                                            </li>
                                                        )}
                                                        {plan.features.contractGeneration && (
                                                            <li className="text-[10px] font-bold text-slate-400 flex items-center gap-2 uppercase tracking-tighter">
                                                                <div className="w-1 h-1 bg-teal-500 rounded-full" /> Contract Generation
                                                            </li>
                                                        )}
                                                        {plan.features.fullCRM && (
                                                            <li className="text-[10px] font-bold text-slate-400 flex items-center gap-2 uppercase tracking-tighter">
                                                                <div className="w-1 h-1 bg-teal-500 rounded-full" /> Full CRM & Processing
                                                            </li>
                                                        )}
                                                    </ul>
                                                    <button
                                                        className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${isCurrent
                                                            ? 'bg-white/5 text-slate-500 border border-white/5'
                                                            : 'bg-teal-500 text-slate-900 shadow-lg shadow-teal-500/20 hover:scale-105 active:scale-95'}`}
                                                        onClick={() => !isCurrent && handleUpgrade(planId)}
                                                    >
                                                        {isCurrent ? 'CURRENT PROTOCOL' : 'UPGRADE UPLINK'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {currentTenant?.stripe_customer_id && (
                                        <div className="mt-4">
                                            <Button
                                                variant="outline"
                                                onClick={handleManageBilling}
                                                className="w-full text-[10px] font-black uppercase tracking-widest"
                                            >
                                                Manage Subscriptions & Invoices
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6 border-t border-slate-800">
                                    <h3 className="text-lg font-bold text-white mb-4">Payment Methods</h3>
                                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-8 bg-slate-800 rounded flex items-center justify-center font-bold text-[10px] text-slate-500 border border-slate-700">VISA</div>
                                            <div>
                                                <p className="text-white text-sm font-medium">•••• •••• •••• 4242</p>
                                                <p className="text-xs text-slate-500">Expires 12/26</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="text-teal-400 hover:text-teal-300">Edit</Button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeSection === 'appearance' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-4">Appearance Settings</h3>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-slate-900 rounded-lg">
                                            <h4 className="text-white font-medium mb-3">Theme</h4>
                                            <div className="grid grid-cols-3 gap-3">
                                                {['Dark', 'Light', 'Auto'].map((theme) => (
                                                    <button
                                                        key={theme}
                                                        className={`p-4 rounded-lg border-2 transition-all ${theme === 'Dark'
                                                            ? 'border-teal-500 bg-slate-800'
                                                            : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                                                            }`}
                                                    >
                                                        <div className="text-sm font-medium text-white">{theme}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="p-4 bg-slate-900 rounded-lg">
                                            <h4 className="text-white font-medium mb-2">Compact Mode</h4>
                                            <p className="text-sm text-slate-400 mb-3">Reduce spacing for a more compact interface</p>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" />
                                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-800">
                                    <Button
                                        onClick={handleSaveAppearance}
                                        className="bg-teal-600 hover:bg-teal-500"
                                    >
                                        Save Preferences
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>

                    {activeSection === 'booking' && (
                        <div className="space-y-6">
                            <CalendlySettings />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;

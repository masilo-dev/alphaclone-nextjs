import React, { useState } from 'react';
import { User, Bell, Lock, Palette, Globe, Loader2 } from 'lucide-react';
import { Button, Card, Input } from '../ui/UIComponents';
import { User as UserType } from '../../types';
import { userService } from '../../services/userService';
import toast from 'react-hot-toast';

interface SettingsPageProps {
    user: UserType;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ user }) => {
    const [activeSection, setActiveSection] = useState<'profile' | 'notifications' | 'security' | 'appearance'>('profile');
    const [isSaving, setIsSaving] = useState(false);

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

    const sections = [
        { id: 'profile' as const, label: 'Profile', icon: User },
        { id: 'notifications' as const, label: 'Notifications', icon: Bell },
        { id: 'security' as const, label: 'Security', icon: Lock },
        { id: 'appearance' as const, label: 'Appearance', icon: Palette },
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
        toast('2FA feature coming soon!', { icon: '🔒' });
    };

    const handleSaveAppearance = () => {
        toast.success('Appearance preferences saved!');
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold text-white">Settings</h2>
                <p className="text-slate-400 mt-1">Manage your account preferences and settings</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar */}
                <div className="lg:col-span-1">
                    <Card className="p-2">
                        <nav className="space-y-1">
                            {sections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeSection === section.id
                                            ? 'bg-teal-600 text-white'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                >
                                    <section.icon className="w-5 h-5" />
                                    <span>{section.label}</span>
                                </button>
                            ))}
                        </nav>
                    </Card>
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

                                <div className="pt-4 border-t border-slate-800">
                                    <Button
                                        onClick={handleSaveProfile}
                                        disabled={isSaving}
                                        className="bg-teal-600 hover:bg-teal-500"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Saving...
                                            </>
                                        ) : (
                                            'Save Changes'
                                        )}
                                    </Button>
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
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;

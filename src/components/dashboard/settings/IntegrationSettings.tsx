'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../ui/UIComponents';
import { 
  Mail, 
  Send, 
  MessageSquare, 
  Calendar, 
  CreditCard, 
  Zap, 
  FileText, 
  Briefcase, 
  Users, 
  Settings, 
  Globe,
  Search,
  Star,
  TrendingUp,
  Shield,
  CheckCircle,
  ArrowRight,
  AlertCircle,
  Info
} from 'lucide-react';
import { SlackIntegration } from '../integrations/SlackIntegration';
import { SendGridIntegration } from '../integrations/SendGridIntegration';
import { ResendIntegration } from '../integrations/ResendIntegration';
import { PlaywrightIntegration } from '../integrations/PlaywrightIntegration';
import { IntegrationMarketplaceDashboard } from '../integrations/IntegrationMarketplaceDashboard';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  category: 'payment' | 'crm' | 'communication' | 'productivity' | 'accounting' | 'analytics';
  status: 'available' | 'connected' | 'disabled' | 'coming-soon';
  features: string[];
  actionPoints: number;
  connected?: boolean;
  popular?: boolean;
  new?: boolean;
  settings?: {
    autoSync?: boolean;
    notifications?: boolean;
    frequency?: string;
    customSettings?: Record<string, any>;
  };
}

export function IntegrationSettings() {
  const { currentTenant } = useTenant();
  const [activeTab, setActiveTab] = useState('marketplace');
  const [integrations, setIntegrations] = useState<Integration[]>([
    // Communication
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get notifications and updates in Slack',
      icon: MessageSquare,
      category: 'communication',
      status: 'available',
      features: [
        'Payment notifications',
        'Lead alerts',
        'Task reminders',
        'Daily summaries'
      ],
      actionPoints: 15,
      connected: false,
      popular: true,
      settings: {
        autoSync: true,
        notifications: true,
        frequency: 'real-time'
      }
    },
    {
      id: 'sendgrid',
      name: 'SendGrid',
      description: 'Professional email delivery and marketing',
      icon: Send,
      category: 'communication',
      status: 'available',
      features: [
        'Email campaigns',
        'Automated sequences',
        'Analytics and tracking',
        'Template management'
      ],
      actionPoints: 25,
      connected: false,
      settings: {
        autoSync: false,
        notifications: true,
        frequency: 'daily'
      }
    },
    {
      id: 'resend',
      name: 'Resend',
      description: 'Modern email API for developers',
      icon: Mail,
      category: 'communication',
      status: 'available',
      features: [
        'Email API',
        'Templates and components',
        'Analytics',
        'Bulk sending'
      ],
      actionPoints: 20,
      connected: false,
      new: true,
      settings: {
        autoSync: true,
        notifications: false,
        frequency: 'hourly'
      }
    },
    // Payment
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Accept payments and manage subscriptions',
      icon: CreditCard,
      category: 'payment',
      status: 'available',
      features: [
        'Payment processing',
        'Subscription management',
        'Invoicing',
        'Financial reporting'
      ],
      actionPoints: 30,
      connected: false,
      popular: true,
      settings: {
        autoSync: true,
        notifications: true,
        frequency: 'real-time'
      }
    },
    // CRM & Sales
    {
      id: 'playwright',
      name: 'Lead Discovery',
      description: 'Find business leads from any website',
      icon: Search,
      category: 'crm',
      status: 'available',
      features: [
        'Web scraping for leads',
        'Contact information extraction',
        'Company details discovery',
        'Client-friendly error handling'
      ],
      actionPoints: 30,
      connected: false,
      new: true,
      settings: {
        autoSync: false,
        notifications: true,
        frequency: 'manual'
      }
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Complete CRM platform for growing businesses',
      icon: Users,
      category: 'crm',
      status: 'available',
      features: [
        'Contact synchronization',
        'Deal tracking',
        'Two-way sync',
        'Custom field mapping'
      ],
      actionPoints: 20,
      connected: false,
      settings: {
        autoSync: true,
        notifications: true,
        frequency: 'hourly'
      }
    },
    // Productivity
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Sync meetings and appointments',
      icon: Calendar,
      category: 'productivity',
      status: 'disabled',
      features: [
        'Meeting synchronization',
        'Appointment booking',
        'Calendar integration',
        'Event reminders'
      ],
      actionPoints: 15,
      connected: false,
      settings: {
        autoSync: true,
        notifications: true,
        frequency: 'real-time'
      }
    },
    {
      id: 'zoom',
      name: 'Zoom',
      description: 'Video conferencing and meetings',
      icon: Globe,
      category: 'productivity',
      status: 'coming-soon',
      features: [
        'Video meetings',
        'Screen sharing',
        'Recording',
        'Calendar integration'
      ],
      actionPoints: 15,
      connected: false,
      settings: {
        autoSync: false,
        notifications: true,
        frequency: 'manual'
      }
    }
  ]);

  const tabs = [
    { id: 'marketplace', name: 'Marketplace', icon: Globe },
    { id: 'connected', name: 'Connected', icon: CheckCircle },
    { id: 'settings', name: 'Settings', icon: Settings },
    { id: 'activity', name: 'Activity', icon: TrendingUp }
  ];

  const connectedIntegrations = integrations.filter(int => int.connected);
  const availableIntegrations = integrations.filter(int => int.status === 'available' && !int.connected);

  const updateIntegrationSettings = (integrationId: string, newSettings: any) => {
    setIntegrations(prev => prev.map(int => 
      int.id === integrationId 
        ? { ...int, settings: { ...int.settings, ...newSettings } }
        : int
    ));
    toast.success('Settings updated successfully');
  };

  const IntegrationSettingsCard = ({ integration }: { integration: Integration }) => {
    if (!integration.connected) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/50 border border-slate-700 rounded-xl p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <integration.icon className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{integration.name}</h3>
              <p className="text-sm text-slate-400">{integration.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/30 rounded-full">
            <CheckCircle className="w-3 h-3 text-green-400" />
            <span className="text-xs text-green-400">Connected</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <label className="text-sm text-slate-300">Auto Sync</label>
              <input
                type="checkbox"
                checked={integration.settings?.autoSync || false}
                onChange={(e) => updateIntegrationSettings(integration.id, { autoSync: e.target.checked })}
                className="rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-slate-300">Notifications</label>
              <input
                type="checkbox"
                checked={integration.settings?.notifications || false}
                onChange={(e) => updateIntegrationSettings(integration.id, { notifications: e.target.checked })}
                className="rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-slate-300">Sync Frequency</label>
              <select
                value={integration.settings?.frequency || 'real-time'}
                onChange={(e) => updateIntegrationSettings(integration.id, { frequency: e.target.value })}
                className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
              >
                <option value="real-time">Real-time</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t border-slate-700">
            <Button size="sm" variant="secondary" className="flex-1">
              <Settings className="w-4 h-4 mr-2" />
              Advanced
            </Button>
            <Button size="sm" variant="danger" className="flex-1">
              Disconnect
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Integration Settings</h1>
        <p className="text-slate-400">
          Manage all your integrations, configure settings, and monitor activity.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'marketplace' && (
          <IntegrationMarketplaceDashboard />
        )}

        {activeTab === 'connected' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Connected Integrations</h2>
              <div className="text-sm text-slate-400">
                {connectedIntegrations.length} of {integrations.length} integrations connected
              </div>
            </div>

            {connectedIntegrations.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-md font-medium text-white mb-4">Active Integrations</h3>
                  <SlackIntegration />
                  <SendGridIntegration />
                  <ResendIntegration />
                  <PlaywrightIntegration />
                </div>
                <div className="space-y-4">
                  <h3 className="text-md font-medium text-white mb-4">Integration Settings</h3>
                  {connectedIntegrations.map(integration => (
                    <IntegrationSettingsCard key={integration.id} integration={integration} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No integrations connected</h3>
                <p className="text-slate-400 mb-4">
                  Start by connecting your first integration from the marketplace.
                </p>
                <Button onClick={() => setActiveTab('marketplace')}>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Browse Marketplace
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Global Integration Settings</h2>
            
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-md font-medium text-white mb-4">Default Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Auto-connect new integrations</div>
                    <div className="text-xs text-slate-400">Automatically enable new integrations when available</div>
                  </div>
                  <input type="checkbox" className="rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Enable notifications</div>
                    <div className="text-xs text-slate-400">Get notified about integration updates</div>
                  </div>
                  <input type="checkbox" defaultChecked className="rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Error reporting</div>
                    <div className="text-xs text-slate-400">Share anonymous error data to improve integrations</div>
                  </div>
                  <input type="checkbox" defaultChecked className="rounded" />
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-md font-medium text-white mb-4">Security Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Two-factor authentication</div>
                    <div className="text-xs text-slate-400">Require 2FA for sensitive integration actions</div>
                  </div>
                  <input type="checkbox" className="rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">API key rotation</div>
                    <div className="text-xs text-slate-400">Automatically rotate API keys every 90 days</div>
                  </div>
                  <input type="checkbox" className="rounded" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Integration Activity</h2>
            
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-slate-300">Slack connected successfully</span>
                  <span className="text-slate-500 ml-auto">2 hours ago</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-slate-300">SendGrid email campaign sent</span>
                  <span className="text-slate-500 ml-auto">5 hours ago</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                  <span className="text-slate-300">Playwright found 15 new leads</span>
                  <span className="text-slate-500 ml-auto">1 day ago</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span className="text-slate-300">Resend API rate limit reached</span>
                  <span className="text-slate-500 ml-auto">2 days ago</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

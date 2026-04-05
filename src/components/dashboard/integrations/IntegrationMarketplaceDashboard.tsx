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
  ArrowRight
} from 'lucide-react';
import { SlackIntegration } from './SlackIntegration';
import { SendGridIntegration } from './SendGridIntegration';
import { ResendIntegration } from './ResendIntegration';
import { PlaywrightIntegration } from './PlaywrightIntegration';
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
}

interface Category {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  color: string;
}

export function IntegrationMarketplaceDashboard() {
  const { currentTenant } = useTenant();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConnectedOnly, setShowConnectedOnly] = useState(false);

  const categories: Category[] = [
    { id: 'all', name: 'All Integrations', icon: Globe, color: 'text-blue-400' },
    { id: 'communication', name: 'Communication', icon: MessageSquare, color: 'text-green-400' },
    { id: 'payment', name: 'Payment', icon: CreditCard, color: 'text-purple-400' },
    { id: 'crm', name: 'CRM & Sales', icon: Users, color: 'text-orange-400' },
    { id: 'productivity', name: 'Productivity', icon: Calendar, color: 'text-cyan-400' },
    { id: 'accounting', name: 'Accounting', icon: FileText, color: 'text-pink-400' },
    { id: 'analytics', name: 'Analytics', icon: TrendingUp, color: 'text-yellow-400' }
  ];

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
      popular: true
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
      connected: false
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
      new: true
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
      popular: true
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
      new: true
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
      connected: false
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
      connected: false
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
      connected: false
    },
    // Analytics
    {
      id: 'google-analytics',
      name: 'Google Analytics',
      description: 'Website and app analytics',
      icon: TrendingUp,
      category: 'analytics',
      status: 'coming-soon',
      features: [
        'Traffic analysis',
        'Conversion tracking',
        'Custom reports',
        'Real-time data'
      ],
      actionPoints: 20,
      connected: false
    }
  ]);

  const filteredIntegrations = integrations.filter(integration => {
    const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesConnection = !showConnectedOnly || integration.connected;
    
    return matchesCategory && matchesSearch && matchesConnection;
  });

  const handleConnect = async (integrationId: string) => {
    const integration = integrations.find(int => int.id === integrationId);
    
    if (integrationId === 'slack') {
      toast.success('Redirecting to Slack authorization...');
      setTimeout(() => {
        window.open('/api/slack/oauth', '_blank');
      }, 1000);
      return;
    }

    if (integrationId === 'stripe') {
      toast.success('Opening Stripe Connect...');
      // Handle Stripe connection
      return;
    }

    if (integrationId === 'sendgrid') {
      toast.success('Opening SendGrid configuration...');
      // Handle SendGrid connection
      return;
    }

    if (integrationId === 'resend') {
      toast.success('Opening Resend configuration...');
      // Handle Resend connection
      return;
    }

    if (integrationId === 'playwright') {
      toast.success('Lead Discovery is already available in your dashboard!');
      return;
    }

    toast.info(`${integration?.name} integration will be available soon!`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-full">Connected</span>;
      case 'available':
        return <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full">Available</span>;
      case 'disabled':
        return <span className="px-2 py-1 bg-slate-500/10 text-slate-400 text-xs rounded-full">Disabled</span>;
      case 'coming-soon':
        return <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-full">Coming Soon</span>;
      default:
        return null;
    }
  };

  const IntegrationCard = ({ integration }: { integration: Integration }) => (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            integration.connected ? 'bg-green-500/20 border-green-500/30' : 'bg-slate-700 border-slate-600'
          } border`}>
            <integration.icon className={`w-6 h-6 ${
              integration.connected ? 'text-green-400' : 'text-slate-400'
            }`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{integration.name}</h3>
              {integration.popular && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 border border-orange-500/30 rounded-full">
                  <Star className="w-3 h-3 text-orange-400" />
                  <span className="text-xs text-orange-400">Popular</span>
                </div>
              )}
              {integration.new && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/30 rounded-full">
                  <Zap className="w-3 h-3 text-green-400" />
                  <span className="text-xs text-green-400">New</span>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-1">{integration.description}</p>
          </div>
        </div>
        {getStatusBadge(integration.status)}
      </div>

      {/* Features */}
      <div className="space-y-2 mb-4">
        {integration.features.slice(0, 3).map((feature, index) => (
          <div key={index} className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle className="w-3 h-3 text-green-400" />
            <span>{feature}</span>
          </div>
        ))}
        {integration.features.length > 3 && (
          <div className="text-xs text-slate-500">
            +{integration.features.length - 3} more features
          </div>
        )}
      </div>

      {/* Action */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500">
            {integration.actionPoints} points
          </div>
          {integration.connected && (
            <div className="flex items-center gap-1 text-xs text-green-400">
              <Shield className="w-3 h-3" />
              <span>Active</span>
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant={integration.connected ? "secondary" : "primary"}
          onClick={() => handleConnect(integration.id)}
          disabled={integration.status === 'disabled' || integration.status === 'coming-soon'}
        >
          {integration.connected ? (
            <>
              <Settings className="w-4 h-4 mr-2" />
              Manage
            </>
          ) : integration.status === 'coming-soon' ? (
            <>
              <Calendar className="w-4 h-4 mr-2" />
              Coming Soon
            </>
          ) : (
            <>
              <ArrowRight className="w-4 h-4 mr-2" />
              Connect
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Integration Marketplace</h1>
        <p className="text-slate-400">
          Connect your favorite tools to streamline your workflow. Each integration earns you momentum points!
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={showConnectedOnly}
              onChange={(e) => setShowConnectedOnly(e.target.checked)}
              className="rounded"
            />
            Connected only
          </label>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map(category => {
          const Icon = category.icon;
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                selectedCategory === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${
                selectedCategory === category.id ? 'text-white' : category.color
              }`} />
              <span className="text-sm font-medium">{category.name}</span>
            </button>
          );
        })}
      </div>

      {/* Active Integrations */}
      {(selectedCategory === 'all' || showConnectedOnly) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Active Integrations</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SlackIntegration />
            <SendGridIntegration />
            <ResendIntegration />
            <PlaywrightIntegration />
          </div>
        </div>
      )}

      {/* Available Integrations */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">
          {showConnectedOnly ? 'Your Connected Integrations' : 
           selectedCategory === 'all' ? 'All Integrations' : 
           categories.find(c => c.id === selectedCategory)?.name}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIntegrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
        
        {filteredIntegrations.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No integrations found</h3>
            <p className="text-slate-400">
              Try adjusting your search or filters to find what you're looking for.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

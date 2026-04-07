// Integration Marketplace - Central Hub for All Integrations

'use client';
import { useState } from 'react';
import { Button } from '../ui/UIComponents';
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
  CheckCircle,
  Building
} from 'lucide-react';
import { StripeConnectOnboarding } from './StripeConnectOnboarding';
import toast from 'react-hot-toast';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  category: 'payment' | 'crm' | 'communication' | 'productivity' | 'accounting';
  status: 'connected' | 'available' | 'coming_soon' | 'disabled';
  connectedAt?: string;
  features: string[];
  actionPoints?: number;
}

export const IntegrationMarketplace: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'stripe',
      name: 'Stripe Connect',
      description: 'Receive payments directly to your bank account',
      icon: CreditCard,
      category: 'payment',
      status: 'available',
      features: [
        'Direct payments to your account',
        'Automatic invoicing',
        'Multi-currency support',
        'Professional checkout experience'
      ],
      actionPoints: 25
    },
    {
      id: 'hubspot',
      name: 'HubSpot CRM',
      description: 'Sync contacts and deals with HubSpot',
      icon: Users,
      category: 'crm',
      status: 'connected',
      connectedAt: '2024-01-15',
      features: [
        'Contact synchronization',
        'Deal tracking',
        'Two-way sync',
        'Custom field mapping'
      ],
      actionPoints: 20
    },
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
      actionPoints: 15
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
      actionPoints: 25
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
      actionPoints: 20
    },
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
      actionPoints: 30
    },
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
        'Reminder notifications'
      ],
      actionPoints: 15
    },
    {
      id: 'quickbooks',
      name: 'Native Accounting',
      description: 'Built-in accounting and expense tracking',
      icon: FileText,
      category: 'accounting',
      status: 'connected',
      features: [
        'Invoice management',
        'Expense tracking',
        'Financial reports',
        'Tax preparation'
      ],
      actionPoints: 25
    },
    {
      id: 'zapier',
      name: 'Native Automation',
      description: 'Built-in workflow automation',
      icon: Zap,
      category: 'productivity',
      status: 'coming_soon',
      features: [
        'Workflow builder',
        'Trigger-based actions',
        'Multi-step automation',
        'Custom integrations'
      ],
      actionPoints: 30
    }
  ]);

  const categories = [
    { id: 'all', name: 'All Integrations', icon: Building },
    { id: 'payment', name: 'Payments', icon: CreditCard },
    { id: 'crm', name: 'CRM', icon: Users },
    { id: 'communication', name: 'Communication', icon: MessageSquare },
    { id: 'productivity', name: 'Productivity', icon: Calendar },
    { id: 'accounting', name: 'Accounting', icon: FileText }
  ];

  const filteredIntegrations = selectedCategory === 'all' 
    ? integrations 
    : integrations.filter(int => int.category === selectedCategory);

  const getStatusColor = (status: Integration['status']) => {
    switch (status) {
      case 'connected': return 'text-green-400';
      case 'available': return 'text-teal-400';
      case 'coming_soon': return 'text-amber-400';
      case 'disabled': return 'text-slate-500';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = (status: Integration['status']) => {
    switch (status) {
      case 'connected': return CheckCircle;
      case 'available': return ExternalLink;
      case 'coming_soon': return AlertCircle;
      case 'disabled': return Lock;
      default: return AlertCircle;
    }
  };

  const getStatusText = (status: Integration['status']) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'available': return 'Connect';
      case 'coming_soon': return 'Coming Soon';
      case 'disabled': return 'Disabled';
      default: return 'Unknown';
    }
  };

  const handleConnect = async (integrationId: string) => {
    const integration = integrations.find(int => int.id === integrationId);
    
    if (integrationId === 'stripe') {
      // Stripe Connect is handled by the StripeConnectOnboarding component
      return;
    }

    if (integrationId === 'slack') {
      // Handle Slack integration
      toast.success('Redirecting to Slack authorization...');
      setTimeout(() => {
        window.open('/api/slack/oauth', '_blank');
      }, 1000);
      return;
    }

    if (integrationId === 'sendgrid') {
      // Handle SendGrid integration
      toast.success('Opening SendGrid configuration...');
      setTimeout(() => {
        window.open('/api/sendgrid/oauth', '_blank');
      }, 1000);
      return;
    }

    if (integrationId === 'resend') {
      // Handle Resend integration
      toast.success('Opening Resend configuration...');
      setTimeout(() => {
        window.open('/api/resend/oauth', '_blank');
      }, 1000);
      return;
    }

    if (integrationId === 'hubspot') {
      // Handle HubSpot reconnection
      toast.success('Redirecting to HubSpot authorization...');
      setTimeout(() => {
        window.open('/api/hubspot/connect', '_blank');
      }, 1000);
      return;
    }

    toast.info(`${integration?.name} integration will be available soon!`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Integration Marketplace</h2>
        <p className="text-slate-400">
          Connect your favorite tools to streamline your workflow. Each integration earns you momentum points!
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map(category => {
          const Icon = category.icon;
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                selectedCategory === category.id
                  ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{category.name}</span>
            </button>
          );
        })}
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredIntegrations.map(integration => {
          const Icon = integration.icon;
          const StatusIcon = getStatusIcon(integration.status);
          const statusColor = getStatusColor(integration.status);

          return (
            <div key={integration.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-blue-500 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{integration.name}</h3>
                    <p className="text-sm text-slate-400">{integration.description}</p>
                  </div>
                </div>
                
                <div className={`flex items-center gap-1 ${statusColor}`}>
                  <StatusIcon className="w-4 h-4" />
                  <span className="text-xs font-medium">{getStatusText(integration.status)}</span>
                </div>
              </div>

              {/* Special Case: Stripe Connect */}
              {integration.id === 'stripe' && integration.status === 'available' ? (
                <StripeConnectOnboarding />
              ) : (
                <>
                  {/* Features */}
                  <div className="space-y-2">
                    {integration.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-slate-300">
                        <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action Points */}
                  {integration.actionPoints && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">
                      <Zap className="w-3 h-3" />
                      <span>+{integration.actionPoints} momentum points</span>
                    </div>
                  )}

                  {/* Connected Date */}
                  {integration.connectedAt && (
                    <div className="text-xs text-slate-500">
                      Connected on {new Date(integration.connectedAt).toLocaleDateString()}
                    </div>
                  )}

                  {/* Action Button */}
                  <Button
                    onClick={() => handleConnect(integration.id)}
                    disabled={integration.status === 'coming_soon' || integration.status === 'disabled'}
                    className={`w-full ${
                      integration.status === 'connected'
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : integration.status === 'available'
                        ? 'bg-teal-600 hover:bg-teal-500 text-black'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {integration.status === 'connected' ? 'Manage' : getStatusText(integration.status)}
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredIntegrations.length === 0 && (
        <div className="text-center py-12">
          <Building className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-400 mb-2">No integrations found</h3>
          <p className="text-slate-500">Check back later for new integrations in this category.</p>
        </div>
      )}
    </div>
  );
};

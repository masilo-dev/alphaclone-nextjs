'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, CheckCircle, AlertCircle, Sparkles, CreditCard, Mail, Users, Calendar, Settings } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface SetupComponentProps {
  tenant: any;
  user: any;
  onComplete: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<SetupComponentProps>;
  isRequired: boolean;
  isCompleted: boolean;
  actionText: string;
  icon: React.ComponentType<any>;
}

// Profile Setup Component
const ProfileSetup: React.FC<SetupComponentProps> = ({ tenant, user, onComplete }) => {
  const [formData, setFormData] = useState({
    name: user.name || '',
    company: tenant?.name || '',
    phone: user.phone || '',
    timezone: user.timezone || 'UTC'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Update profile
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onComplete();
        toast.success('Profile updated successfully!');
      }
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <Users className="w-12 h-12 text-teal-500 mx-auto mb-4" />
        <h4 className="text-lg font-semibold text-white mb-2">Complete Your Profile</h4>
        <p className="text-slate-400 text-sm">Add your business information to personalize your experience</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Company Name</label>
          <input
            type="text"
            value={formData.company}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Phone Number</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Timezone</label>
          <select
            value={formData.timezone}
            onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern Time</option>
            <option value="America/Chicago">Central Time</option>
            <option value="America/Denver">Mountain Time</option>
            <option value="America/Los_Angeles">Pacific Time</option>
            <option value="Europe/London">London</option>
            <option value="Europe/Paris">Paris</option>
            <option value="Asia/Tokyo">Tokyo</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 bg-teal-500 hover:bg-teal-400 text-black font-semibold rounded-lg"
        >
          Complete Profile
        </button>
      </form>
    </div>
  );
};

// Stripe Connect Setup Component
const StripeConnectSetup: React.FC<SetupComponentProps> = ({ tenant, onComplete }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check if already connected
    const checkStripeStatus = async () => {
      try {
        const response = await fetch(`/api/stripe/connect/status?tenantId=${tenant.id}`);
        const data = await response.json();
        setIsConnected(data.connected);
      } catch (error) {
        console.error('Error checking Stripe status:', error);
      }
    };
    
    if (tenant?.id) {
      checkStripeStatus();
    }
  }, [tenant?.id]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/stripe/connect/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tenantId: tenant.id,
          returnUrl: `${window.location.origin}/dashboard/onboarding`,
          refreshUrl: `${window.location.origin}/dashboard/onboarding`
        })
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Stripe Connect error:', error);
      toast.error('Failed to connect Stripe');
    } finally {
      setIsConnecting(false);
    }
  };

  if (isConnected) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h4 className="text-lg font-semibold text-white mb-2">Stripe Connected</h4>
        <p className="text-slate-400 mb-6">Your payment system is ready to receive payments</p>
        <button
          onClick={onComplete}
          className="px-6 py-2 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-lg"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <CreditCard className="w-8 h-8 text-white" />
      </div>
      
      <h4 className="text-lg font-semibold text-white mb-2">Connect Your Stripe Account</h4>
      <p className="text-slate-400 mb-6">
        Receive payments directly to your bank account. AlphaClone never touches your money.
      </p>

      <div className="bg-slate-800 rounded-lg p-4 mb-6 text-left">
        <h5 className="font-medium text-white mb-2">Benefits of Stripe Connect:</h5>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Direct payments to your bank account
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Professional payment processing
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Multiple payment methods supported
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Automatic tax and compliance handling
          </li>
        </ul>
      </div>

      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="px-6 py-3 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-lg"
      >
        {isConnecting ? 'Connecting...' : 'Connect Stripe Account'}
      </button>
    </div>
  );
};

// Email Service Setup Component
const EmailServiceSetup: React.FC<SetupComponentProps> = ({ tenant, onComplete }) => {
  const [formData, setFormData] = useState({
    provider: 'sendgrid',
    apiKey: '',
    fromEmail: '',
    fromName: ''
  });
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          tenantId: tenant.id
        })
      });

      if (response.ok) {
        toast.success('Email service configured successfully!');
        onComplete();
      } else {
        toast.error('Failed to configure email service');
      }
    } catch (error) {
      toast.error('Error testing email service');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <Mail className="w-12 h-12 text-teal-500 mx-auto mb-4" />
        <h4 className="text-lg font-semibold text-white mb-2">Configure Email Service</h4>
        <p className="text-slate-400 text-sm">Set up SendGrid to send professional emails to clients</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Email Provider</label>
          <select
            value={formData.provider}
            onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
          >
            <option value="sendgrid">SendGrid</option>
            <option value="resend">Resend</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">API Key</label>
          <input
            type="password"
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            placeholder="Enter your API key"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">From Email</label>
          <input
            type="email"
            value={formData.fromEmail}
            onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
            placeholder="noreply@yourcompany.com"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">From Name</label>
          <input
            type="text"
            value={formData.fromName}
            onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
            placeholder="Your Company Name"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
            required
          />
        </div>

        <button
          onClick={handleTest}
          disabled={isTesting || !formData.apiKey || !formData.fromEmail}
          className="w-full px-4 py-2 bg-teal-500 hover:bg-teal-400 text-black font-semibold rounded-lg disabled:opacity-50"
        >
          {isTesting ? 'Testing...' : 'Test Email Service'}
        </button>
      </div>
    </div>
  );
};

// HubSpot Setup Component
const HubSpotSetup: React.FC<SetupComponentProps> = ({ tenant, onComplete }) => {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/hubspot/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tenantId: tenant.id,
          returnUrl: `${window.location.origin}/dashboard/onboarding`
        })
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('HubSpot Connect error:', error);
      toast.error('Failed to connect HubSpot');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-white font-bold text-xl">HS</span>
      </div>
      
      <h4 className="text-lg font-semibold text-white mb-2">Connect HubSpot CRM</h4>
      <p className="text-slate-400 mb-6">
        Sync contacts and deals with HubSpot for seamless workflow management
      </p>

      <div className="bg-slate-800 rounded-lg p-4 mb-6 text-left">
        <h5 className="font-medium text-white mb-2">HubSpot Integration Features:</h5>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Two-way contact synchronization
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Deal tracking and updates
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Email campaign integration
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Real-time data sync
          </li>
        </ul>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onComplete}
          className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg"
        >
          Skip for Now
        </button>
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-lg"
        >
          {isConnecting ? 'Connecting...' : 'Connect HubSpot'}
        </button>
      </div>
    </div>
  );
};

// Team Invitation Component
const TeamInvitation: React.FC<SetupComponentProps> = ({ tenant, onComplete }) => {
  const [emails, setEmails] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const handleInvite = async () => {
    setIsInviting(true);
    try {
      const emailList = emails.split(',').map(e => e.trim()).filter(e => e);
      
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          emails: emailList
        })
      });

      if (response.ok) {
        toast.success('Team invitations sent successfully!');
        onComplete();
      } else {
        toast.error('Failed to send invitations');
      }
    } catch (error) {
      toast.error('Error sending invitations');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <Users className="w-12 h-12 text-teal-500 mx-auto mb-4" />
        <h4 className="text-lg font-semibold text-white mb-2">Invite Team Members</h4>
        <p className="text-slate-400 text-sm">Add your team to collaborate on projects and clients</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Email Addresses</label>
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="Enter email addresses separated by commas"
            rows={4}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
          />
          <p className="text-xs text-slate-500 mt-1">Separate multiple emails with commas</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onComplete}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg"
          >
            Skip for Now
          </button>
          <button
            onClick={handleInvite}
            disabled={isInviting || !emails.trim()}
            className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-black font-semibold rounded-lg disabled:opacity-50"
          >
            {isInviting ? 'Sending Invitations...' : 'Send Invitations'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Setup Wizard Component
const SetupWizard: React.FC = () => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const steps: WizardStep[] = [
    {
      id: 'profile',
      title: 'Complete Your Profile',
      description: 'Add your business information to personalize your experience',
      component: ProfileSetup,
      isRequired: true,
      isCompleted: completedSteps.has('profile'),
      actionText: 'Complete Profile',
      icon: Users
    },
    {
      id: 'payments',
      title: 'Set Up Payment System',
      description: 'Connect Stripe to receive payments directly to your account',
      component: StripeConnectSetup,
      isRequired: true,
      isCompleted: completedSteps.has('payments'),
      actionText: 'Connect Stripe',
      icon: CreditCard
    },
    {
      id: 'email',
      title: 'Configure Email Service',
      description: 'Set up SendGrid to send professional emails to clients',
      component: EmailServiceSetup,
      isRequired: true,
      isCompleted: completedSteps.has('email'),
      actionText: 'Configure Email',
      icon: Mail
    },
    {
      id: 'crm',
      title: 'Connect Your CRM',
      description: 'Sync contacts and deals with HubSpot for seamless workflow',
      component: HubSpotSetup,
      isRequired: false,
      isCompleted: completedSteps.has('crm'),
      actionText: 'Connect HubSpot',
      icon: Settings
    },
    {
      id: 'team',
      title: 'Invite Team Members',
      description: 'Add your team to collaborate on projects and clients',
      component: TeamInvitation,
      isRequired: false,
      isCompleted: completedSteps.has('team'),
      actionText: 'Invite Team',
      icon: Users
    }
  ];

  const handleStepComplete = (stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
    toast.success('Step completed successfully!');
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (!steps[currentStep].isRequired) {
      handleNext();
    }
  };

  const handleFinish = () => {
    toast.success('Setup completed! Welcome to AlphaClone!');
    // Redirect to dashboard
    window.location.href = '/dashboard';
  };

  const currentStepData = steps[currentStep];
  const CurrentStepComponent = currentStepData.component;
  const StepIcon = currentStepData.icon;

  return (
    <div className="setup-wizard min-h-screen bg-slate-900">
      {/* Progress Indicator */}
      <div className="wizard-progress p-6 border-b border-slate-800">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-teal-500" />
              <h2 className="text-2xl font-bold text-white">Setup Your Business</h2>
            </div>
            <div className="text-sm text-slate-400">
              Step {currentStep + 1} of {steps.length}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${index < currentStep ? 'bg-green-500 text-white' : 
                      index === currentStep ? 'bg-teal-500 text-white' : 
                      'bg-slate-700 text-slate-400'}
                  `}>
                    {completedSteps.has(step.id) ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : index === currentStep ? (
                      <StepIcon className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`
                      w-16 h-1 mx-2
                      ${index < currentStep ? 'bg-green-500' : 'bg-slate-700'}
                    `} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="wizard-content p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
              <StepIcon className="w-5 h-5" />
              {currentStepData.title}
            </h3>
            <p className="text-slate-400">
              {currentStepData.description}
            </p>
          </div>

          <div className="bg-slate-800 rounded-xl p-6">
            <CurrentStepComponent
              tenant={currentTenant}
              user={user}
              onComplete={() => handleStepComplete(currentStepData.id)}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-3">
              {!currentStepData.isRequired && (
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Skip for now
                </button>
              )}

              {currentStep === steps.length - 1 ? (
                <button
                  onClick={handleFinish}
                  className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-400"
                >
                  Finish Setup
                  <CheckCircle className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={currentStepData.isRequired && !currentStepData.isCompleted}
                  className="flex items-center gap-2 px-6 py-2 bg-teal-500 text-black font-semibold rounded-lg hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;

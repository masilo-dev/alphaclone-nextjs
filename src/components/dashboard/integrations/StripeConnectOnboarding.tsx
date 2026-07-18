// Stripe Connect Onboarding Component

'use client';
import React, { useEffect, useState } from 'react';
import { Button } from '../../ui/UIComponents';
import { CreditCard, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

interface StripeConnectStatus {
  connected: boolean;
  accountId?: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirements?: any[];
}

export const StripeConnectOnboarding: React.FC = () => {
  const { currentTenant } = useTenant();
  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const checkConnectStatus = async () => {
    if (!currentTenant?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/stripe/connect/status?tenantId=${currentTenant.id}`);
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to check Stripe status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!currentTenant?.id) {
      toast.error('No active organization selected');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/stripe/connect/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tenantId: currentTenant.id,
          returnUrl: `${window.location.origin}/dashboard/business/settings?tab=integrations`,
          refreshUrl: `${window.location.origin}/dashboard/business/settings?tab=integrations`
        })
      });

      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe Connect onboarding
        window.location.href = data.url;
      } else {
        toast.error('Failed to create Stripe Connect account');
      }
    } catch (error) {
      console.error('Stripe Connect error:', error);
      toast.error('Failed to connect Stripe account');
    } finally {
      setLoading(false);
    }
  };

  const handleManageAccount = async () => {
    if (!status?.accountId) return;

    setLoading(true);
    try {
      const response = await fetch('/api/stripe/connect/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: currentTenant.id })
      });

      const data = await response.json();
      
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        toast.error('Failed to open Stripe dashboard');
      }
    } catch (error) {
      console.error('Stripe login error:', error);
      toast.error('Failed to open Stripe dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnectStatus();
  }, [currentTenant?.id]);

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <CreditCard className="w-6 h-6 text-teal-400" />
        <h3 className="text-lg font-semibold text-white">Stripe Connect</h3>
      </div>

      {!status ? (
        <div className="space-y-4">
          <p className="text-slate-400">
            Connect your Stripe account to receive payments directly from your clients. 
            AlphaClone never touches your money - payments go directly to your Stripe account.
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Receive payments directly to your bank account</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Automatic payment links and invoicing</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Professional payment experience for clients</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Multi-currency support</span>
            </div>
          </div>

          <Button 
            onClick={handleConnect}
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-500 text-black font-semibold"
          >
            {loading ? 'Connecting...' : 'Connect Stripe Account'}
          </Button>
        </div>
      ) : status.connected ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Stripe Connected</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Charges Enabled:</span>
              <span className={`ml-2 ${status.chargesEnabled ? 'text-green-400' : 'text-amber-400'}`}>
                {status.chargesEnabled ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Payouts Enabled:</span>
              <span className={`ml-2 ${status.payoutsEnabled ? 'text-green-400' : 'text-amber-400'}`}>
                {status.payoutsEnabled ? 'Yes' : 'No'}
              </span>
            </div>
          </div>

          {status.requirements && status.requirements.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium text-sm">Action Required</span>
              </div>
              <p className="text-xs text-slate-400">
                Complete the requirements in your Stripe dashboard to enable all features.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button 
              onClick={handleManageAccount}
              disabled={loading}
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Manage Account
            </Button>
            <Button 
              onClick={checkConnectStatus}
              disabled={loading}
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Refresh
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Connection In Progress</span>
          </div>
          
          <p className="text-slate-400 text-sm">
            Your Stripe account setup is in progress. Please complete the onboarding process in Stripe.
          </p>

          <Button 
            onClick={checkConnectStatus}
            disabled={loading}
            variant="outline"
            className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Check Status
          </Button>
        </div>
      )}
    </div>
  );
};

'use client';

import React, { useState, useEffect } from 'react';
import { Button, Modal, Input } from '../../ui/UIComponents';
import { toast } from 'react-hot-toast';
import { Mail, CheckCircle, AlertCircle, Settings, BarChart3, Code, Zap, AlertTriangle } from 'lucide-react';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';
import { motion } from 'framer-motion';

interface ResendStatus {
  isConnected: boolean;
  apiKey?: string;
  domain?: string;
  lastSync?: string;
}

interface EmailDomain {
  id: string;
  name: string;
  status: 'verified' | 'pending' | 'failed';
  dnsRecords?: any[];
}

interface ClientFriendlyError {
  title: string;
  message: string;
  suggestion: string;
  type: 'warning' | 'error' | 'info';
}

export function ResendIntegration() {
  const currentTenant = useCurrentTenantSafe();
  const [status, setStatus] = useState<ResendStatus>({ isConnected: false });
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [domain, setDomain] = useState('');
  const [domains, setDomains] = useState<EmailDomain[]>([]);
  const [testEmail, setTestEmail] = useState('');
  const [testSubject, setTestSubject] = useState('Test from AlphaClone');
  const [testMessage, setTestMessage] = useState('This is a test email from your AlphaClone platform via Resend.');
  const [clientError, setClientError] = useState<ClientFriendlyError | null>(null);

  useEffect(() => {
    if (currentTenant?.id) {
      checkResendStatus();
      loadDomains();
    }
  }, [currentTenant]);

  const checkResendStatus = async () => {
    try {
      const response = await fetch(`/api/integrations/status?service=resend&tenant_id=${currentTenant?.id}`);
      const data = await response.json();
      
      if (data.resend) {
        setStatus({
          isConnected: true,
          domain: data.resend.domain,
          lastSync: data.resend.updated_at
        });
      }
    } catch (error) {
      console.error('Failed to check Resend status:', error);
    }
  };

  const loadDomains = async () => {
    try {
      const response = await fetch(`/api/resend/domains?tenant_id=${currentTenant?.id}`);
      const data = await response.json();
      setDomains(data.domains || []);
    } catch (error) {
      console.error('Failed to load domains:', error);
    }
  };

  const connectResend = async () => {
    if (!apiKey.trim() || !domain.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/resend/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: currentTenant?.id,
          api_key: apiKey.trim(),
          domain: domain.trim()
        })
      });

      if (response.ok) {
        setStatus({
          isConnected: true,
          domain: domain,
          lastSync: new Date().toISOString()
        });
        toast.success('Resend connected successfully!');
        setShowModal(false);
        setApiKey('');
        loadDomains();
      } else {
        throw new Error('Failed to connect Resend');
      }
    } catch (error) {
      toast.error('Failed to connect Resend. Please check your API key and domain.');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectResend = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/resend/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: currentTenant?.id })
      });
      
      if (response.ok) {
        setStatus({ isConnected: false });
        toast.success('Resend integration disconnected');
        setShowModal(false);
        setDomains([]);
      }
    } catch (error) {
      toast.error('Failed to disconnect Resend');
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      setClientError({
        title: 'Email Address Required',
        message: 'Please enter an email address to send the test email.',
        suggestion: 'Enter a valid email address (e.g., user@example.com)',
        type: 'warning'
      });
      return;
    }

    // Basic email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(testEmail.trim())) {
      setClientError({
        title: 'Invalid Email Address',
        message: 'Please enter a valid email address.',
        suggestion: 'Make sure the email address is formatted correctly (e.g., user@example.com)',
        type: 'warning'
      });
      return;
    }

    setIsLoading(true);
    setClientError(null);

    try {
      const response = await fetch(`/api/resend/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: currentTenant?.id,
          to: testEmail.trim(),
          subject: testSubject,
          message: testMessage
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle client-friendly errors
        const friendlyError = translateEmailError(data.error || new Error(data.message));
        setClientError(friendlyError);
        return;
      }

      // Success
      toast.success(`Test email sent to ${testEmail}! Check your inbox.`);
      setTestEmail('');

    } catch (error) {
      const friendlyError = translateEmailError(error);
      setClientError(friendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  const translateEmailError = (error: any): ClientFriendlyError => {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    
    // Resend specific errors
    if (errorMessage.includes('invalid_api_key') || errorMessage.includes('unauthorized')) {
      return {
        title: 'API Key Issue',
        message: 'Your Resend API key is not working correctly.',
        suggestion: 'Please check your API key in settings and try again.',
        type: 'error'
      };
    }
    
    if (errorMessage.includes('domain') || errorMessage.includes('from_address')) {
      return {
        title: 'Domain Configuration Problem',
        message: 'Your sending domain is not configured correctly.',
        suggestion: 'Check your domain settings in the Resend dashboard.',
        type: 'error'
      };
    }
    
    if (errorMessage.includes('recipient') || errorMessage.includes('invalid email')) {
      return {
        title: 'Recipient Email Issue',
        message: 'The recipient email address is not valid.',
        suggestion: 'Please double-check the email address and try again.',
        type: 'warning'
      };
    }
    
    if (errorMessage.includes('rate_limit') || errorMessage.includes('too many requests')) {
      return {
        title: 'Sending Limit Reached',
        message: 'Resend has temporarily limited email sending.',
        suggestion: 'Please wait a few minutes and try again.',
        type: 'warning'
      };
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return {
        title: 'Connection Problem',
        message: 'Cannot connect to Resend servers right now.',
        suggestion: 'Please check your internet connection and try again.',
        type: 'warning'
      };
    }
    
    // Default friendly error
    return {
      title: 'Email Sending Failed',
      message: 'We encountered an issue sending your test email.',
      suggestion: 'Please try again. If this continues, check your Resend configuration.',
      type: 'error'
    };
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            status.isConnected ? 'bg-purple-500/20 border-purple-500/30' : 'bg-slate-800 border-slate-700'
          } border`}>
            <Mail className={`w-6 h-6 ${status.isConnected ? 'text-purple-400' : 'text-slate-400'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Resend Integration</h3>
            <p className="text-sm text-slate-400">
              {status.isConnected ? `Connected • Domain: ${status.domain}` : 'Connect your Resend account'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {status.isConnected ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowModal(true)}
              disabled={isLoading}
            >
              <Settings className="w-4 h-4 mr-2" />
              Manage
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowModal(true)}
              disabled={isLoading}
            >
              Connect
            </Button>
          )}
        </div>
      </div>

      {/* Status */}
      {status.isConnected && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-purple-400" />
            <span className="text-purple-400">Connected</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">Domain: {status.domain}</span>
            {status.lastSync && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">Last sync: {new Date(status.lastSync).toLocaleDateString()}</span>
              </>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <h4 className="text-sm font-medium text-white mb-2">Send Test Email</h4>
              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="Recipient email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500"
                />
                <input
                  type="text"
                  placeholder="Subject"
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500"
                />
                <textarea
                  placeholder="Message"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 resize-none"
                  rows={2}
                />
                <Button
                  size="sm"
                  onClick={sendTestEmail}
                  disabled={!testEmail.trim() || isLoading}
                  className="w-full"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send via Resend
                </Button>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <h4 className="text-sm font-medium text-white mb-2">Verified Domains</h4>
              <div className="space-y-2 max-h-24 overflow-y-auto">
                {domains.length > 0 ? (
                  domains.slice(0, 3).map((domain) => (
                    <div key={domain.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Code className="w-3 h-3 text-purple-400" />
                        <span className="text-slate-400 truncate">{domain.name}</span>
                      </div>
                      <span className={`${
                        domain.status === 'verified' ? 'text-green-400' :
                        domain.status === 'pending' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {domain.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-xs">No domains verified</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client-Friendly Error Display */}
      {clientError && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4"
        >
          <div className={`p-4 rounded-lg border ${
            clientError.type === 'error' ? 'bg-red-500/10 border-red-500/30' :
            clientError.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
            'bg-blue-500/10 border-blue-500/30'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                clientError.type === 'error' ? 'bg-red-500/20' :
                clientError.type === 'warning' ? 'bg-yellow-500/20' :
                'bg-blue-500/20'
              }`}>
                {clientError.type === 'error' ? (
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                ) : clientError.type === 'warning' ? (
                  <AlertCircle className="w-3 h-3 text-yellow-400" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-blue-400" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white mb-1">{clientError.title}</h4>
                <p className="text-sm text-slate-300 mb-2">{clientError.message}</p>
                <p className="text-xs text-slate-400">{clientError.suggestion}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Settings Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Resend Integration Settings"
        >
          <div className="space-y-6">
            {!status.isConnected ? (
              <>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">Connect Resend</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        API Key
                      </label>
                      <Input
                        type="password"
                        placeholder="Enter your Resend API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Sending Domain
                      </label>
                      <Input
                        type="text"
                        placeholder="yourdomain.com"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setShowModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={connectResend}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? 'Connecting...' : 'Connect'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Connection Status</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-400">Connected to Resend</span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-slate-400">
                    <p>Domain: {status.domain}</p>
                    <p>Verified Domains: {domains.filter(d => d.status === 'verified').length}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setShowModal(false)}
                    className="flex-1"
                  >
                    Close
                  </Button>
                  <Button
                    variant="danger"
                    onClick={disconnectResend}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? 'Disconnecting...' : 'Disconnect'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

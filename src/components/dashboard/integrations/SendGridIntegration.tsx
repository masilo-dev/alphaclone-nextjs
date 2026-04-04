'use client';

import React, { useState, useEffect } from 'react';
import { Button, Modal, Input } from '../../ui/UIComponents';
import { toast } from 'react-hot-toast';
import { Send, CheckCircle, AlertCircle, Settings, Mail, BarChart3, Template } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';

interface SendGridStatus {
  isConnected: boolean;
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
  lastSync?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  lastUsed?: string;
}

export function SendGridIntegration() {
  const { currentTenant } = useTenant();
  const [status, setStatus] = useState<SendGridStatus>({ isConnected: false });
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [testEmail, setTestEmail] = useState('');
  const [testSubject, setTestSubject] = useState('Test from AlphaClone');
  const [testMessage, setTestMessage] = useState('This is a test email from your AlphaClone platform.');

  useEffect(() => {
    if (currentTenant?.id) {
      checkSendGridStatus();
      loadTemplates();
    }
  }, [currentTenant]);

  const checkSendGridStatus = async () => {
    try {
      const response = await fetch(`/api/integrations/status?service=sendgrid&tenant_id=${currentTenant?.id}`);
      const data = await response.json();
      
      if (data.sendgrid) {
        setStatus({
          isConnected: true,
          fromEmail: data.sendgrid.from_email,
          fromName: data.sendgrid.from_name,
          lastSync: data.sendgrid.updated_at
        });
      }
    } catch (error) {
      console.error('Failed to check SendGrid status:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch(`/api/sendgrid/templates?tenant_id=${currentTenant?.id}`);
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const connectSendGrid = async () => {
    if (!apiKey.trim() || !fromEmail.trim() || !fromName.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/sendgrid/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: currentTenant?.id,
          api_key: apiKey.trim(),
          from_email: fromEmail.trim(),
          from_name: fromName.trim()
        })
      });

      if (response.ok) {
        setStatus({
          isConnected: true,
          fromEmail: fromEmail,
          fromName: fromName,
          lastSync: new Date().toISOString()
        });
        toast.success('SendGrid connected successfully!');
        setShowModal(false);
        setApiKey('');
      } else {
        throw new Error('Failed to connect SendGrid');
      }
    } catch (error) {
      toast.error('Failed to connect SendGrid. Please check your API key.');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectSendGrid = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sendgrid/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: currentTenant?.id })
      });
      
      if (response.ok) {
        setStatus({ isConnected: false });
        toast.success('SendGrid integration disconnected');
        setShowModal(false);
      }
    } catch (error) {
      toast.error('Failed to disconnect SendGrid');
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error('Please enter a test email address');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/sendgrid/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: currentTenant?.id,
          to: testEmail.trim(),
          subject: testSubject,
          message: testMessage
        })
      });

      if (response.ok) {
        toast.success('Test email sent successfully!');
        setTestEmail('');
      } else {
        throw new Error('Failed to send test email');
      }
    } catch (error) {
      toast.error('Failed to send test email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            status.isConnected ? 'bg-green-500/20 border-green-500/30' : 'bg-slate-800 border-slate-700'
          } border`}>
            <Send className={`w-6 h-6 ${status.isConnected ? 'text-green-400' : 'text-slate-400'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">SendGrid Integration</h3>
            <p className="text-sm text-slate-400">
              {status.isConnected ? `Connected • From: ${status.fromEmail}` : 'Connect your SendGrid account'}
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
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-green-400">Connected</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">From: {status.fromName} &lt;{status.fromEmail}&gt;</span>
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
                  Send Test Email
                </Button>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <h4 className="text-sm font-medium text-white mb-2">Email Templates</h4>
              <div className="space-y-2 max-h-24 overflow-y-auto">
                {templates.length > 0 ? (
                  templates.slice(0, 3).map((template) => (
                    <div key={template.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Template className="w-3 h-3 text-blue-400" />
                        <span className="text-slate-400 truncate">{template.name}</span>
                      </div>
                      <span className="text-slate-500">{template.subject}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-xs">No templates found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="SendGrid Integration Settings"
        >
          <div className="space-y-6">
            {!status.isConnected ? (
              <>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">Connect SendGrid</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        API Key
                      </label>
                      <Input
                        type="password"
                        placeholder="Enter your SendGrid API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        From Email
                      </label>
                      <Input
                        type="email"
                        placeholder="noreply@yourdomain.com"
                        value={fromEmail}
                        onChange={(e) => setFromEmail(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        From Name
                      </label>
                      <Input
                        type="text"
                        placeholder="Your Company Name"
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
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
                    onClick={connectSendGrid}
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
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Connected to SendGrid</span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-slate-400">
                    <p>From: {status.fromName} &lt;{status.fromEmail}&gt;</p>
                    <p>Templates: {templates.length} available</p>
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
                    onClick={disconnectSendGrid}
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

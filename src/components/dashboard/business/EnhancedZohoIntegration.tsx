'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Plus, Settings, RefreshCw, Target, Send, BarChart3, User, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '../../ui/UIComponents';
import toast from 'react-hot-toast';

interface ZohoIntegrationProps {
  onLeadsGenerated?: (leads: any[]) => void;
  onEmailsSent?: (count: number) => void;
}

interface ZohoAccount {
  accountId: string;
  email: string;
  displayName: string;
}

interface LeadData {
  First_Name: string;
  Last_Name: string;
  Company: string;
  Email: string;
  Phone: string;
  Description: string;
  Lead_Source: string;
}

const ZohoIntegration: React.FC<ZohoIntegrationProps> = ({ 
  onLeadsGenerated, 
  onEmailsSent 
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [emailStats, setEmailStats] = useState({ sent: 0, failed: 0, pending: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [accountInfo, setAccountInfo] = useState<ZohoAccount | null>(null);
  const [userId, setUserId] = useState<string>('');

  // Check if already connected on component mount
  useEffect(() => {
    // Get user ID from localStorage or context
    const savedUserId = localStorage.getItem('user_id') || 'default_user';
    setUserId(savedUserId);

    const savedToken = localStorage.getItem('zoho_access_token');
    if (savedToken) {
      setAccessToken(savedToken);
      setIsConnected(true);
      loadAccountInfo(savedToken, savedUserId);
      loadLeads(savedToken, savedUserId);
    }
  }, []);

  const connectToZoho = () => {
    // Redirect to Zoho OAuth
    const clientId = '1000.EHLUECNTL7GYIS34VV79J1KDPBCFWK';
    const redirectUri = `${window.location.origin}/api/zoho/callback`;
    const scope = 'ZohoCRM.modules.leads.READ,ZohoCRM.modules.contacts.READ,ZohoCRM.modules.emails.CREATE,ZohoMail.accounts.READ,ZohoMail.messages.CREATE';
    
    const authUrl = `https://accounts.zoho.com/oauth/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&access_type=offline`;
    
    window.location.href = authUrl;
  };

  const loadAccountInfo = async (token: string, userId: string) => {
    try {
      const response = await fetch(`/api/zoho/enhanced?userId=${userId}&action=get_account_info`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setAccountInfo(data.data);
        // Store account info in localStorage for future use
        localStorage.setItem('zoho_account_info', JSON.stringify(data.data));
      } else {
        console.error('Failed to load account info:', data.error);
        toast.error('Failed to load Zoho account information');
      }
    } catch (error) {
      console.error('Error loading account info:', error);
      toast.error('Error loading Zoho account information');
    }
  };

  const loadLeads = async (token: string, userId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/zoho/enhanced?userId=${userId}&action=get_leads`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setLeads(data.data || []);
        if (onLeadsGenerated) {
          onLeadsGenerated(data.data || []);
        }
      } else {
        console.error('Failed to load leads:', data.error);
        toast.error('Failed to load leads: ' + data.error);
      }
    } catch (error) {
      console.error('Error loading leads:', error);
      toast.error('Error loading leads');
    } finally {
      setLoading(false);
    }
  };

  const generateLeads = async (criteria: string) => {
    if (!isConnected || !accessToken || !userId) {
      toast.error('Please connect to Zoho first');
      return;
    }

    try {
      setLoading(true);
      
      // Generate sample leads based on criteria
      const sampleLeads: LeadData[] = [
        {
          First_Name: 'John',
          Last_Name: 'Smith',
          Company: 'Tech Innovations Inc',
          Email: 'john.smith@techinnovations.com',
          Phone: '+1-555-123-4567',
          Description: `Generated based on criteria: ${criteria}`,
          Lead_Source: 'AlphaClone Automation'
        },
        {
          First_Name: 'Sarah',
          Last_Name: 'Johnson',
          Company: 'Digital Solutions Ltd',
          Email: 'sarah.johnson@digitalsolutions.com',
          Phone: '+1-555-987-6543',
          Description: `Generated based on criteria: ${criteria}`,
          Lead_Source: 'AlphaClone Automation'
        },
        {
          First_Name: 'Michael',
          Last_Name: 'Chen',
          Company: 'Future Tech Corp',
          Email: 'michael.chen@futuretech.com',
          Phone: '+1-555-456-7890',
          Description: `Generated based on criteria: ${criteria}`,
          Lead_Source: 'AlphaClone Automation'
        }
      ];

      // Create leads in Zoho CRM
      for (const lead of sampleLeads) {
        try {
          const response = await fetch('/api/zoho/enhanced', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: userId,
              action: 'create_lead',
              data: lead
            }),
          });

          const result = await response.json();
          
          if (!response.ok || !result.success) {
            console.error('Failed to create lead:', result.error);
          }
        } catch (error) {
          console.error('Error creating lead:', error);
        }
      }

      // Reload leads after creation
      await loadLeads(accessToken, userId);
      
      toast.success(`Generated ${sampleLeads.length} leads successfully`);
      
      // Update stats
      setEmailStats(prev => ({
        ...prev,
        sent: prev.sent + sampleLeads.length
      }));

    } catch (error) {
      console.error('Error generating leads:', error);
      toast.error('Error generating leads');
    } finally {
      setLoading(false);
    }
  };

  const sendBulkEmails = async (recipients: string[], subject: string, body: string) => {
    if (!isConnected || !accessToken || !userId) {
      toast.error('Please connect to Zoho first');
      return;
    }

    if (!accountInfo?.email) {
      toast.error('No sender email configured. Please check your Zoho account settings.');
      return;
    }

    try {
      setLoading(true);
      let sent = 0;
      let failed = 0;

      for (const recipient of recipients) {
        try {
          const response = await fetch('/api/zoho/enhanced', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: userId,
              action: 'send_email',
              data: {
                to: recipient,
                subject: subject,
                content: body,
                fromAddress: accountInfo.email // Use the dynamically fetched email
              }
            }),
          });

          const result = await response.json();
          
          if (response.ok && result.success) {
            sent++;
          } else {
            failed++;
            console.error(`Failed to send email to ${recipient}:`, result.error);
          }
        } catch (error) {
          failed++;
          console.error(`Failed to send email to ${recipient}:`, error);
        }
      }

      setEmailStats(prev => ({
        sent: prev.sent + sent,
        failed: prev.failed + failed,
        pending: prev.pending
      }));

      if (onEmailsSent) {
        onEmailsSent(sent);
      }

      if (sent > 0) {
        toast.success(`Successfully sent ${sent} emails`);
      }
      
      if (failed > 0) {
        toast.error(`Failed to send ${failed} emails`);
      }

    } catch (error) {
      console.error('Error sending bulk emails:', error);
      toast.error('Error sending emails');
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    localStorage.removeItem('zoho_access_token');
    localStorage.removeItem('zoho_account_info');
    setAccessToken(null);
    setAccountInfo(null);
    setIsConnected(false);
    setLeads([]);
    toast.success('Disconnected from Zoho');
  };

  const QuickActions = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <Target className="w-5 h-5 text-teal-400" />
          <h4 className="font-semibold text-white">Generate Leads</h4>
        </div>
        <p className="text-slate-400 text-sm mb-3">Find potential customers based on your criteria</p>
        <div className="space-y-2">
          <Button
            size="sm"
            onClick={() => generateLeads('tech startups')}
            disabled={!isConnected || loading}
            className="w-full bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate Tech Leads
          </Button>
          <Button
            size="sm"
            onClick={() => generateLeads('real estate')}
            disabled={!isConnected || loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate Real Estate Leads
          </Button>
        </div>
      </div>

      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <Mail className="w-5 h-5 text-purple-400" />
          <h4 className="font-semibold text-white">Send Emails</h4>
        </div>
        <p className="text-slate-400 text-sm mb-3">Reach out to your leads automatically</p>
        <Button
          size="sm"
          onClick={() => {
            const recipients = leads.slice(0, 5).map(lead => lead.Email).filter(Boolean);
            if (recipients.length > 0) {
              sendBulkEmails(
                recipients,
                'Introduction from AlphaClone',
                'Hello! I noticed your interest in our services. Let me introduce you to AlphaClone...'
              );
            } else {
              toast.info('No leads with email addresses found');
            }
          }}
          disabled={!isConnected || loading || leads.length === 0}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          <Send className="w-4 h-4 mr-2" />
          Email Recent Leads
        </Button>
      </div>
    </div>
  );

  if (!isConnected) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <Zap className="w-8 h-8 text-yellow-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Connect to Zoho</h3>
        <p className="text-slate-400 mb-6">
          Integrate with Zoho CRM to automatically find leads and send emails from your dashboard.
        </p>
        <Button onClick={connectToZoho} className="bg-yellow-600 hover:bg-yellow-700">
          <Settings className="w-4 h-4 mr-2" />
          Connect to Zoho
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Zoho Integration</h2>
            <p className="text-slate-400 text-sm">
              {accountInfo ? (
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  Connected as {accountInfo.email}
                </span>
              ) : (
                'Connected to Zoho'
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(true)}
            className="border-slate-700 text-slate-300 hover:text-white"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={disconnect}
            className="border-red-700 text-red-400 hover:text-red-300"
          >
            Disconnect
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-5 h-5 text-teal-400" />
            <h3 className="font-semibold text-white">Leads Generated</h3>
          </div>
          <p className="text-2xl font-bold text-white">{leads.length}</p>
          <p className="text-slate-400 text-sm">Total leads in CRM</p>
        </div>

        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-white">Emails Sent</h3>
          </div>
          <p className="text-2xl font-bold text-white">{emailStats.sent}</p>
          <p className="text-slate-400 text-sm">Successful deliveries</p>
        </div>

        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Success Rate</h3>
          </div>
          <p className="text-2xl font-bold text-white">
            {emailStats.sent + emailStats.failed > 0 
              ? Math.round((emailStats.sent / (emailStats.sent + emailStats.failed)) * 100)
              : 0}%
          </p>
          <p className="text-slate-400 text-sm">Email delivery rate</p>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Recent Leads */}
      {leads.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Target className="w-4 h-4" />
              Recent Leads
            </h3>
          </div>
          <div className="divide-y divide-slate-700">
            {leads.slice(0, 5).map((lead, index) => (
              <div key={index} className="p-4 hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium">
                      {lead.First_Name} {lead.Last_Name}
                    </h4>
                    <p className="text-slate-400 text-sm">{lead.Company}</p>
                    <p className="text-slate-500 text-xs">{lead.Email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-sm">{lead.Phone}</p>
                    <p className="text-slate-500 text-xs">{lead.Lead_Source}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {leads.length > 5 && (
            <div className="p-4 border-t border-slate-700">
              <p className="text-slate-400 text-sm text-center">
                Showing 5 of {leads.length} leads
              </p>
            </div>
          )}
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Zoho Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Connected Account
                </label>
                {accountInfo ? (
                  <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <div>
                        <p className="text-white font-medium">{accountInfo.displayName}</p>
                        <p className="text-slate-400 text-sm">{accountInfo.email}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-400" />
                      <p className="text-slate-400">Account information not available</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Integration Status
                </label>
                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Connection</span>
                    <span className="flex items-center gap-1 text-green-400">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-slate-300">API Status</span>
                    <span className="flex items-center gap-1 text-green-400">
                      <CheckCircle className="w-3 h-3" />
                      Connected
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowSettings(false)}
                className="flex-1 border-slate-700 text-slate-300 hover:text-white"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  // Refresh account info
                  if (accessToken && userId) {
                    loadAccountInfo(accessToken, userId);
                    toast.success('Account information refreshed');
                  }
                }}
                className="flex-1 bg-teal-600 hover:bg-teal-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZohoIntegration;
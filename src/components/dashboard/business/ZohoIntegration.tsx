import React, { useState, useEffect } from 'react';
import { Mail, Plus, Settings, RefreshCw, Target, Send, BarChart3 } from 'lucide-react';
import { Button } from '../../ui/UIComponents';

interface ZohoIntegrationProps {
  onLeadsGenerated?: (leads: any[]) => void;
  onEmailsSent?: (count: number) => void;
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

  // Check if already connected on component mount
  useEffect(() => {
    const savedToken = localStorage.getItem('zoho_access_token');
    if (savedToken) {
      setAccessToken(savedToken);
      setIsConnected(true);
      loadLeads(savedToken);
    }
  }, []);

  const connectToZoho = () => {
    // Redirect to Zoho OAuth
    const clientId = '1000.EHLUECNTL7GYIS34VV79J1KDPBCFWK';
    const redirectUri = `${window.location.origin}/api/zoho/callback`;
    const scope = 'ZohoCRM.modules.leads.READ,ZohoCRM.modules.contacts.READ,ZohoCRM.modules.emails.CREATE';
    
    const authUrl = `https://accounts.zoho.com/oauth/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&access_type=offline`;
    
    window.location.href = authUrl;
  };

  const loadLeads = async (token: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/zoho', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_leads',
          access_token: token
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setLeads(data.data || []);
        if (onLeadsGenerated) {
          onLeadsGenerated(data.data || []);
        }
      } else {
        console.error('Failed to load leads:', data);
      }
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateLeads = async (criteria: string) => {
    if (!isConnected || !accessToken) return;

    try {
      setLoading(true);
      
      // This would typically call your backend to generate leads based on criteria
      const response = await fetch('/api/zoho', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_lead',
          access_token: accessToken,
          lead: {
            First_Name: 'Auto',
            Last_Name: 'Generated',
            Company: 'Prospect Company',
            Email: 'prospect@example.com',
            Phone: '+1234567890',
            Description: `Generated based on criteria: ${criteria}`,
            Lead_Source: 'AlphaClone Automation'
          }
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Reload leads after creation
        await loadLeads(accessToken);
        
        // Update stats
        setEmailStats(prev => ({
          ...prev,
          sent: prev.sent + 1
        }));
      } else {
        console.error('Failed to create lead:', data);
      }
    } catch (error) {
      console.error('Error creating lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendBulkEmails = async (recipients: string[], subject: string, body: string) => {
    if (!isConnected || !accessToken) return;

    try {
      setLoading(true);
      let sent = 0;
      let failed = 0;

      for (const recipient of recipients) {
        try {
          const response = await fetch('/api/zoho', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'send_email',
              access_token: accessToken,
              email: {
                to: [{ email: recipient }],
                subject: subject,
                content: body,
                from: 'noreply@alphaclone.com'
              }
            }),
          });

          if (response.ok) {
            sent++;
          } else {
            failed++;
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

    } catch (error) {
      console.error('Error sending bulk emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    localStorage.removeItem('zoho_access_token');
    setAccessToken(null);
    setIsConnected(false);
    setLeads([]);
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
            onClick={() => generateLeads('small business')}
            disabled={!isConnected || loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate SMB Leads
          </Button>
        </div>
      </div>

      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <Send className="w-5 h-5 text-green-400" />
          <h4 className="font-semibold text-white">Send Emails</h4>
        </div>
        <p className="text-slate-400 text-sm mb-3">Automated email campaigns to your leads</p>
        <Button
          size="sm"
          onClick={() => {
            const recipients = leads.map(lead => lead.Email).filter(Boolean);
            if (recipients.length > 0) {
              sendBulkEmails(
                recipients.slice(0, 10), // Limit to 10 for demo
                'Introduction from AlphaClone',
                'Hello! I noticed your company and wanted to reach out about how AlphaClone can help streamline your business operations...'
              );
            }
          }}
          disabled={!isConnected || loading || leads.length === 0}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <Send className="w-4 h-4 mr-2" />
          Send to {leads.length} Leads
        </Button>
      </div>
    </div>
  );

  const StatsDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center gap-3 mb-2">
          <Target className="w-5 h-5 text-teal-400" />
          <h4 className="font-semibold text-white">Total Leads</h4>
        </div>
        <div className="text-2xl font-bold text-teal-400">{leads.length}</div>
        <div className="text-sm text-slate-400">in your CRM</div>
      </div>

      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center gap-3 mb-2">
          <Send className="w-5 h-5 text-green-400" />
          <h4 className="font-semibold text-white">Emails Sent</h4>
        </div>
        <div className="text-2xl font-bold text-green-400">{emailStats.sent}</div>
        <div className="text-sm text-slate-400">successful sends</div>
      </div>

      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          <h4 className="font-semibold text-white">Success Rate</h4>
        </div>
        <div className="text-2xl font-bold text-blue-400">
          {emailStats.sent + emailStats.failed > 0 
            ? Math.round((emailStats.sent / (emailStats.sent + emailStats.failed)) * 100)
            : 0}%
        </div>
        <div className="text-sm text-slate-400">email success rate</div>
      </div>
    </div>
  );

  if (!isConnected) {
    return (
      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
        <div className="text-center">
          <Mail className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Zoho Integration</h3>
          <p className="text-slate-400 mb-4">
            Connect your Zoho CRM to automate lead generation and email campaigns
          </p>
          <Button
            onClick={connectToZoho}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Settings className="w-4 h-4 mr-2" />
            Connect to Zoho
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">Zoho CRM Integration</h3>
          <p className="text-slate-400">Automated lead generation and email campaigns</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-sm text-slate-400">Connected</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={disconnect}
            className="border-red-500 text-red-400 hover:bg-red-500/10"
          >
            Disconnect
          </Button>
        </div>
      </div>

      <StatsDashboard />
      <QuickActions />

      {leads.length > 0 && (
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <h4 className="font-semibold text-white mb-3">Recent Leads</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {leads.slice(0, 5).map((lead, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-slate-700 rounded">
                <div>
                  <div className="font-medium text-white">
                    {lead.First_Name} {lead.Last_Name}
                  </div>
                  <div className="text-sm text-slate-400">{lead.Company}</div>
                </div>
                <div className="text-sm text-slate-400">
                  {lead.Email}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-4">
          <RefreshCw className="w-6 h-6 animate-spin text-teal-400 mx-auto" />
          <p className="text-slate-400 mt-2">Processing...</p>
        </div>
      )}
    </div>
  );
};

export default ZohoIntegration;
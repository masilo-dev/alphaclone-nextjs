'use client';

import React, { useState, useEffect } from 'react';
import { Button, Modal, Input } from '../../ui/UIComponents';
import { toast } from 'react-hot-toast';
import { Search, CheckCircle, AlertCircle, Settings, Globe, Users, Target, Zap, AlertTriangle } from 'lucide-react';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';

interface PlaywrightStatus {
  isConnected: boolean;
  lastScrape?: string;
  totalLeadsFound?: number;
  successRate?: number;
}

interface ScrapingJob {
  id: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  leadsFound: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

interface ClientFriendlyError {
  title: string;
  message: string;
  suggestion: string;
  type: 'warning' | 'error' | 'info';
}

export function PlaywrightIntegration() {
  const currentTenant = useCurrentTenantSafe();
  const [status, setStatus] = useState<PlaywrightStatus>({ isConnected: false });
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [scrapingUrl, setScrapingUrl] = useState('');
  const [jobs, setJobs] = useState<ScrapingJob[]>([]);
  const [clientError, setClientError] = useState<ClientFriendlyError | null>(null);

  useEffect(() => {
    if (currentTenant?.id) {
      checkPlaywrightStatus();
      loadRecentJobs();
    }
  }, [currentTenant]);

  const checkPlaywrightStatus = async () => {
    try {
      const response = await fetch(`/api/integrations/status?service=playwright&tenant_id=${currentTenant?.id}`);
      const data = await response.json();
      
      if (data.playwright) {
        setStatus({
          isConnected: true,
          lastScrape: data.playwright.last_scrape,
          totalLeadsFound: data.playwright.total_leads_found,
          successRate: data.playwright.success_rate
        });
      }
    } catch (error) {
      console.error('Failed to check Playwright status:', error);
    }
  };

  const loadRecentJobs = async () => {
    try {
      const response = await fetch(`/api/playwright/jobs?tenant_id=${currentTenant?.id}`);
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  };

  const translateTechnicalError = (error: any): ClientFriendlyError => {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    
    // Common technical errors and their client-friendly translations
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('network')) {
      return {
        title: 'Connection Issue',
        message: 'We cannot reach the website right now.',
        suggestion: 'Please check if the website URL is correct and try again in a few minutes.',
        type: 'warning'
      };
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      return {
        title: 'Website Slow to Respond',
        message: 'The website is taking too long to load.',
        suggestion: 'Try again later or contact support if this continues.',
        type: 'warning'
      };
    }
    
    if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      return {
        title: 'Website Not Found',
        message: 'The website address does not exist.',
        suggestion: 'Please double-check the URL and try again.',
        type: 'error'
      };
    }
    
    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      return {
        title: 'Access Restricted',
        message: 'The website does not allow automated access.',
        suggestion: 'This website may have anti-scraping protection. Try a different source.',
        type: 'warning'
      };
    }
    
    if (errorMessage.includes('captcha') || errorMessage.includes('CAPTCHA')) {
      return {
        title: 'Security Check Detected',
        message: 'The website has security measures in place.',
        suggestion: 'Please try a different website or contact support for assistance.',
        type: 'warning'
      };
    }
    
    if (errorMessage.includes('puppeteer') || errorMessage.includes('playwright')) {
      return {
        title: 'Scraping System Error',
        message: 'Our lead discovery system encountered an issue.',
        suggestion: 'Please try again. If the problem continues, our team will investigate.',
        type: 'error'
      };
    }
    
    if (errorMessage.includes('No leads found') || errorMessage.includes('empty')) {
      return {
        title: 'No Leads Found',
        message: 'We could not find any business leads on this page.',
        suggestion: 'Try a different page or check if this website contains business information.',
        type: 'info'
      };
    }
    
    // Default friendly error
    return {
      title: 'Something Went Wrong',
      message: 'We encountered an unexpected issue while finding leads.',
      suggestion: 'Please try again. If this continues, contact our support team.',
      type: 'error'
    };
  };

  const startScraping = async () => {
    if (!scrapingUrl.trim()) {
      setClientError({
        title: 'Website URL Required',
        message: 'Please enter a website URL to search for leads.',
        suggestion: 'Enter the full website address (e.g., https://example.com)',
        type: 'warning'
      });
      return;
    }

    // Basic URL validation
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(scrapingUrl.trim())) {
      setClientError({
        title: 'Invalid Website URL',
        message: 'Please enter a valid website address.',
        suggestion: 'Include the full URL starting with http:// or https://',
        type: 'warning'
      });
      return;
    }

    setIsLoading(true);
    setClientError(null);

    try {
      const response = await fetch(`/api/playwright/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: currentTenant?.id,
          url: scrapingUrl.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle client-friendly errors
        const friendlyError = translateTechnicalError(data.error || new Error(data.message));
        setClientError(friendlyError);
        return;
      }

      // Success
      toast.success(`Started searching for leads on ${scrapingUrl}`);
      setScrapingUrl('');
      loadRecentJobs();
      checkPlaywrightStatus();

    } catch (error) {
      const friendlyError = translateTechnicalError(error);
      setClientError(friendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'running':
        return <Zap className="w-4 h-4 text-blue-400 animate-pulse" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getJobStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'running':
        return 'Searching...';
      default:
        return 'Pending';
    }
  };

  const ClientErrorDisplay = ({ error }: { error: ClientFriendlyError }) => (
    <div className={`p-4 rounded-lg border ${
      error.type === 'error' ? 'bg-red-500/10 border-red-500/30' :
      error.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
      'bg-blue-500/10 border-blue-500/30'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
          error.type === 'error' ? 'bg-red-500/20' :
          error.type === 'warning' ? 'bg-yellow-500/20' :
          'bg-blue-500/20'
        }`}>
          {error.type === 'error' ? (
            <AlertTriangle className="w-3 h-3 text-red-400" />
          ) : error.type === 'warning' ? (
            <AlertCircle className="w-3 h-3 text-yellow-400" />
          ) : (
            <AlertCircle className="w-3 h-3 text-blue-400" />
          )}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-white mb-1">{error.title}</h4>
          <p className="text-sm text-slate-300 mb-2">{error.message}</p>
          <p className="text-xs text-slate-400">{error.suggestion}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            status.isConnected ? 'bg-orange-500/20 border-orange-500/30' : 'bg-slate-800 border-slate-700'
          } border`}>
            <Search className={`w-6 h-6 ${status.isConnected ? 'text-orange-400' : 'text-slate-400'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Lead Discovery Tool</h3>
            <p className="text-sm text-slate-400">
              {status.isConnected ? 
                `Active • ${status.totalLeadsFound || 0} leads found` : 
                'Find business leads from any website'
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowModal(true)}
            disabled={isLoading}
          >
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      {/* Status */}
      {status.isConnected && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-green-400">Lead Discovery Active</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">Success Rate: {status.successRate || 0}%</span>
            {status.lastScrape && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">Last search: {new Date(status.lastScrape).toLocaleDateString()}</span>
              </>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <h4 className="text-sm font-medium text-white mb-2">Quick Lead Search</h4>
              <div className="space-y-2">
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={scrapingUrl}
                  onChange={(e) => setScrapingUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500"
                />
                <Button
                  size="sm"
                  onClick={startScraping}
                  disabled={!scrapingUrl.trim() || isLoading}
                  className="w-full"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {isLoading ? 'Searching...' : 'Find Leads'}
                </Button>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <h4 className="text-sm font-medium text-white mb-2">Recent Searches</h4>
              <div className="space-y-2 max-h-24 overflow-y-auto">
                {jobs.length > 0 ? (
                  jobs.slice(0, 3).map((job) => (
                    <div key={job.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {getJobStatusIcon(job.status)}
                        <span className="text-slate-400 truncate max-w-[120px]">{job.url}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-500">{getJobStatusText(job.status)}</div>
                        {job.leadsFound > 0 && (
                          <div className="text-green-400">{job.leadsFound} leads</div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-xs">No recent searches</p>
                )}
              </div>
            </div>
          </div>

          {/* Client-Friendly Error Display */}
          {clientError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <ClientErrorDisplay error={clientError} />
            </motion.div>
          )}
        </div>
      )}

      {/* Settings Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Lead Discovery Settings"
        >
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-semibold text-white mb-2">About Lead Discovery</h4>
              <p className="text-sm text-slate-300 mb-4">
                Our intelligent tool searches websites for business leads, contact information, and company details. 
                All errors are translated into clear, helpful messages.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Target className="w-4 h-4 text-orange-400" />
                  <span className="text-slate-300">Finds business contact information</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Users className="w-4 h-4 text-orange-400" />
                  <span className="text-slate-300">Discovers company details and services</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Globe className="w-4 h-4 text-orange-400" />
                  <span className="text-slate-300">Works with any public website</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <AlertCircle className="w-4 h-4 text-blue-400" />
                  <span className="text-slate-300">Clear error messages for any issues</span>
                </div>
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
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

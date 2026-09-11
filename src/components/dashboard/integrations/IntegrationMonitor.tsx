'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, XCircle, Settings, RefreshCw, Zap, Shield, Activity } from 'lucide-react';

interface IntegrationStatus {
  name: string;
  type: string;
  status: 'working' | 'needs_attention' | 'not_connected' | 'error';
  percentage: number;
  issues: string[];
  actions: string[];
  connected: boolean;
  reconnectRequired?: boolean;
  lastChecked: string;
}

interface OverallStatus {
  totalIntegrations: number;
  workingIntegrations: number;
  connectedIntegrations: number;
  averagePercentage: number;
  status: 'excellent' | 'good' | 'fair' | 'needs_attention';
}

interface IntegrationMonitorProps {
  tenantId: string;
  onIntegrationAction?: (type: string, action: string) => void;
}

const IntegrationMonitor: React.FC<IntegrationMonitorProps> = ({ tenantId, onIntegrationAction }) => {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [overallStatus, setOverallStatus] = useState<OverallStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchIntegrationStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/integrations/status?tenantId=${tenantId}`);
      if (!response.ok) {
        console.warn('Integration status API not available');
        setIntegrations([]);
        setOverallStatus(null);
        return;
      }
      const data = await response.json();
      
      if (data.success) {
        setIntegrations(data.integrations);
        setOverallStatus(data.overallStatus);
      }
    } catch (error) {
      console.error('Failed to fetch integration status:', error);
      setIntegrations([]);
      setOverallStatus(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchIntegrationStatus();
    }
  }, [tenantId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchIntegrationStatus();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working':
        return 'text-green-500';
      case 'needs_attention':
        return 'text-amber-500';
      case 'not_connected':
        return 'text-slate-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-slate-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'working':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'needs_attention':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'not_connected':
        return <XCircle className="w-5 h-5 text-slate-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <XCircle className="w-5 h-5 text-slate-500" />;
    }
  };

  const getOverallStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'good':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'fair':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'needs_attention':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'slack':
        return '💬';
      case 'facebook':
        return '📘';
      case 'twilio':
        return '📱';
      case 'google_calendar':
        return '📅';
      case 'stripe':
        return '💳';
      case 'sendgrid':
        return '📧';
      default:
        return '🔗';
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-teal-500 animate-spin" />
          <span className="ml-3 text-slate-400">Loading integration status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="integration-monitor bg-slate-800 rounded-xl p-6 border border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-teal-500" />
          <h3 className="text-xl font-semibold text-white">Integration Monitor</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Overall Status */}
      {overallStatus && (
        <div className={`mb-6 p-4 rounded-lg border ${getOverallStatusColor(overallStatus.status)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5" />
              <div>
                <h4 className="font-medium">Overall Status: {overallStatus.status.toUpperCase()}</h4>
                <p className="text-sm opacity-80">
                  {overallStatus.workingIntegrations}/{overallStatus.totalIntegrations} working • {overallStatus.averagePercentage}% average
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{overallStatus.averagePercentage}%</div>
              <div className="text-sm opacity-80">Functional</div>
            </div>
          </div>
        </div>
      )}

      {/* Integration List */}
      <div className="space-y-4">
        {integrations.map((integration) => (
          <div key={integration.type} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getIntegrationIcon(integration.type)}</span>
                <div>
                  <h4 className="font-medium text-white flex items-center gap-2">
                    {integration.name}
                    {getStatusIcon(integration.status)}
                  </h4>
                  <p className={`text-sm ${getStatusColor(integration.status)}`}>
                    {integration.status.replace('_', ' ').toUpperCase()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${getStatusColor(integration.status)}`}>
                  {integration.percentage}%
                </div>
                <div className="text-sm text-slate-400">Functional</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="w-full bg-slate-600 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    integration.percentage === 100 ? 'bg-green-500' :
                    integration.percentage >= 80 ? 'bg-blue-500' :
                    integration.percentage >= 60 ? 'bg-amber-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${integration.percentage}%` }}
                />
              </div>
            </div>

            {/* Issues */}
            {integration.issues.length > 0 && (
              <div className="mb-3">
                <h5 className="text-sm font-medium text-amber-400 mb-1">Issues:</h5>
                <ul className="text-sm text-slate-300 space-y-1">
                  {integration.issues.map((issue, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <AlertCircle className="w-3 h-3 text-amber-500" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(integration.reconnectRequired || integration.actions.some((a) => /reconnect/i.test(a))) && (
              <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                Token may be expired or missing. Reconnect this integration in Settings → Integrations.
              </div>
            )}

            {/* Actions */}
            {integration.actions.length > 0 && (
              <div className="mb-3">
                <h5 className="text-sm font-medium text-blue-400 mb-1">Recommended Actions:</h5>
                <div className="space-y-2">
                  {integration.actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => onIntegrationAction?.(integration.type, action)}
                      className="w-full text-left px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm text-white transition-colors flex items-center gap-2"
                    >
                      <Zap className="w-3 h-3" />
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Last Checked */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Last checked: {new Date(integration.lastChecked).toLocaleString()}</span>
              {integration.connected ? (
                <span className="text-green-500">Connected</span>
              ) : (
                <span className="text-slate-500">Not Connected</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-6 border-t border-slate-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-500">
              {integrations.filter(i => i.status === 'working').length}
            </div>
            <div className="text-sm text-slate-400">Working</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-500">
              {integrations.filter(i => i.status === 'needs_attention').length}
            </div>
            <div className="text-sm text-slate-400">Needs Attention</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-500">
              {integrations.filter(i => i.status === 'not_connected').length}
            </div>
            <div className="text-sm text-slate-400">Not Connected</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-500">
              {integrations.filter(i => i.status === 'error').length}
            </div>
            <div className="text-sm text-slate-400">Errors</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationMonitor;

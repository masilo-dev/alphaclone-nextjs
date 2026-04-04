'use client';

import React, { useState, useEffect } from 'react';
import { Button, Modal } from '../ui/UIComponents';
import { toast } from 'react-hot-toast';
import { Slack, CheckCircle, AlertCircle, Settings, MessageSquare, Calendar, Users } from 'lucide-react';

interface SlackIntegrationProps {
  tenantId: string;
  onConnected?: () => void;
}

interface SlackStatus {
  isConnected: boolean;
  teamName?: string;
  teamId?: string;
  botUserId?: string;
  lastSync?: string;
}

export function SlackIntegration({ tenantId, onConnected }: SlackIntegrationProps) {
  const [status, setStatus] = useState<SlackStatus>({ isConnected: false });
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    checkSlackStatus();
  }, [tenantId]);

  const checkSlackStatus = async () => {
    try {
      const response = await fetch('/api/integrations/status?service=slack');
      const data = await response.json();
      
      if (data.slack) {
        setStatus({
          isConnected: true,
          teamName: data.slack.team_name,
          teamId: data.slack.team_id,
          botUserId: data.slack.bot_user_id,
          lastSync: data.slack.updated_at
        });
      }
    } catch (error) {
      console.error('Failed to check Slack status:', error);
    }
  };

  const connectSlack = () => {
    const authUrl = `/api/slack/oauth/authorize?tenant_id=${tenantId}`;
    window.open(authUrl, 'slack-auth', 'width=600,height=700');
    
    // Poll for connection status
    const pollInterval = setInterval(async () => {
      const response = await fetch('/api/integrations/status?service=slack');
      const data = await response.json();
      
      if (data.slack) {
        clearInterval(pollInterval);
        setStatus({
          isConnected: true,
          teamName: data.slack.team_name,
          teamId: data.slack.team_id,
          botUserId: data.slack.bot_user_id,
          lastSync: data.slack.updated_at
        });
        toast.success('Slack integration connected successfully!');
        onConnected?.();
      }
    }, 2000);

    // Stop polling after 2 minutes
    setTimeout(() => clearInterval(pollInterval), 120000);
  };

  const disconnectSlack = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/integrations/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disconnect',
          service: 'slack',
          tenantId
        })
      });

      if (response.ok) {
        setStatus({ isConnected: false });
        toast.success('Slack integration disconnected');
      }
    } catch (error) {
      toast.error('Failed to disconnect Slack');
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/slack/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      });

      if (response.ok) {
        toast.success('Test message sent to Slack!');
      } else {
        toast.error('Failed to send test message');
      }
    } catch (error) {
      toast.error('Connection test failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (status.isConnected) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Slack className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Slack Integration</h3>
              <p className="text-sm text-slate-400">Connected to {status.teamName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Connected</span>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Team ID:</span>
            <span className="text-slate-300 font-mono">{status.teamId}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Bot User ID:</span>
            <span className="text-slate-300 font-mono">{status.botUserId}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Last Sync:</span>
            <span className="text-slate-300">
              {status.lastSync ? new Date(status.lastSync).toLocaleDateString() : 'Never'}
            </span>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
          <h4 className="text-white font-medium mb-3">Available Features</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-slate-300">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <span className="text-sm">Lead Management</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Calendar className="w-4 h-4 text-purple-400" />
              <span className="text-sm">Meeting Scheduling</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-sm">Team Notifications</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Settings className="w-4 h-4 text-purple-400" />
              <span className="text-sm">Workflow Automation</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={testConnection}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button
            onClick={() => setShowModal(true)}
            variant="outline"
            className="flex-1"
          >
            Configure
          </Button>
          <Button
            onClick={disconnectSlack}
            disabled={isLoading}
            variant="outline"
            className="text-red-400 border-red-400/30 hover:bg-red-400/10"
          >
            Disconnect
          </Button>
        </div>

        {showModal && (
          <Modal onClose={() => setShowModal(false)} title="Slack Configuration">
            <div className="space-y-4">
              <div>
                <h4 className="text-white font-medium mb-2">Slack Commands</h4>
                <div className="bg-slate-800 rounded-lg p-3 space-y-2">
                  <code className="text-sm text-purple-400">/alphaclone help</code>
                  <p className="text-xs text-slate-400">Show all available commands</p>
                  
                  <code className="text-sm text-purple-400">/lead create &lt;name&gt;</code>
                  <p className="text-xs text-slate-400">Create a new lead</p>
                  
                  <code className="text-sm text-purple-400">/meeting schedule &lt;title&gt;</code>
                  <p className="text-xs text-slate-400">Schedule a meeting</p>
                </div>
              </div>

              <div>
                <h4 className="text-white font-medium mb-2">Webhook URL</h4>
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/api/slack/events`}
                  className="w-full bg-slate-800 text-slate-300 px-3 py-2 rounded-lg text-sm font-mono"
                />
              </div>

              <Button onClick={() => setShowModal(false)} className="w-full">
                Close
              </Button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
          <Slack className="w-6 h-6 text-slate-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">Slack Integration</h3>
          <p className="text-sm text-slate-400">
            Connect your Slack workspace to manage leads and automate workflows
          </p>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Not Connected</span>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
        <h4 className="text-white font-medium mb-3">What you can do with Slack:</h4>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
            Create and manage leads using slash commands
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
            Schedule meetings and send notifications
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
            Get real-time updates on important events
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
            Automate workflows between Slack and AlphaClone
          </li>
        </ul>
      </div>

      <Button
        onClick={connectSlack}
        className="w-full bg-purple-600 hover:bg-purple-700"
      >
        <Slack className="w-4 h-4 mr-2" />
        Connect Slack Workspace
      </Button>
    </div>
  );
}

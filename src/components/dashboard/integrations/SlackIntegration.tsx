'use client';

import React, { useState, useEffect } from 'react';
import { Button, Modal } from '../../ui/UIComponents';
import { toast } from 'react-hot-toast';
import { Slack, CheckCircle, AlertCircle, Settings, MessageSquare, Calendar, Users, Send, RefreshCw } from 'lucide-react';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';

interface SlackStatus {
  isConnected: boolean;
  teamName?: string;
  teamId?: string;
  botUserId?: string;
  lastSync?: string;
}

interface SlackNotification {
  type: 'project_created' | 'client_added' | 'task_completed' | 'invoice_sent' | 'deal_won' | 'custom';
  message: string;
  channel?: string;
  timestamp: string;
}

export function SlackIntegration() {
  const currentTenant = useCurrentTenantSafe();
  const [status, setStatus] = useState<SlackStatus>({ isConnected: false });
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [notifications, setNotifications] = useState<SlackNotification[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('#general');

  useEffect(() => {
    if (currentTenant?.id) {
      checkSlackStatus();
      loadRecentNotifications();
    }
  }, [currentTenant]);

  const checkSlackStatus = async () => {
    try {
      const response = await fetch(`/api/integrations/status?service=slack&tenant_id=${currentTenant?.id}`);
      if (!response.ok) {
        console.warn('Slack status API not available');
        return;
      }
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

  const loadRecentNotifications = async () => {
    try {
      const response = await fetch(`/api/slack/notifications?tenant_id=${currentTenant?.id}`);
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const connectSlack = () => {
    const authUrl = `/api/slack/oauth/authorize?tenant_id=${currentTenant?.id}`;
    window.open(authUrl, '_blank');
    
    // Poll for connection status
    const pollInterval = setInterval(async () => {
      const response = await fetch(`/api/integrations/status?service=slack&tenant_id=${currentTenant?.id}`);
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
        toast.success('Successfully connected to Slack!');
      }
    }, 2000);

    // Stop polling after 2 minutes
    setTimeout(() => clearInterval(pollInterval), 120000);
  };

  const disconnectSlack = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/slack/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: currentTenant?.id })
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

  const sendNotification = async (message: string, channel: string = '#general') => {
    if (!status.isConnected) {
      toast.error('Please connect Slack first');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/slack/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: currentTenant?.id,
          message,
          channel
        })
      });

      if (response.ok) {
        toast.success('Notification sent to Slack!');
        loadRecentNotifications();
        setCustomMessage('');
      } else {
        throw new Error('Failed to send notification');
      }
    } catch (error) {
      toast.error('Failed to send notification');
    } finally {
      setIsLoading(false);
    }
  };

  const resendNotification = async (notificationId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/slack/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: currentTenant?.id,
          notification_id: notificationId
        })
      });

      if (response.ok) {
        toast.success('Notification resent to Slack!');
      } else {
        throw new Error('Failed to resend notification');
      }
    } catch (error) {
      toast.error('Failed to resend notification');
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
            <Slack className={`w-6 h-6 ${status.isConnected ? 'text-green-400' : 'text-slate-400'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Slack Integration</h3>
            <p className="text-sm text-slate-400">
              {status.isConnected ? `Connected to ${status.teamName}` : 'Connect your Slack workspace'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {status.isConnected ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowModal(true)}
              disabled={isLoading}
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
              Manage
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={connectSlack}
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
            <span className="text-slate-400">Team: {status.teamName}</span>
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
              <h4 className="text-sm font-medium text-white mb-2">Send Custom Message</h4>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Channel (#general)"
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500"
                />
                <textarea
                  placeholder="Type your message..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 resize-none"
                  rows={2}
                />
                <Button
                  size="sm"
                  onClick={() => sendNotification(customMessage, selectedChannel)}
                  disabled={!customMessage.trim() || isLoading}
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send to Slack
                </Button>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <h4 className="text-sm font-medium text-white mb-2">Recent Notifications</h4>
              <div className="space-y-2 max-h-24 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.slice(0, 3).map((notif) => (
                    <div key={notif.timestamp} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 truncate">{notif.message}</span>
                      <button
                        onClick={() => resendNotification(notif.timestamp)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-xs">No recent notifications</p>
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
          title="Slack Integration Settings"
        >
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-semibold text-white mb-2">Connection Status</h4>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-green-400">Connected to {status.teamName}</span>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-white mb-2">Notification Events</h4>
              <div className="space-y-2">
                {[
                  'Project created',
                  'Client added',
                  'Task completed',
                  'Invoice sent',
                  'Deal won'
                ].map((event) => (
                  <label key={event} className="flex items-center gap-3 text-sm text-slate-300">
                    <input type="checkbox" className="rounded" />
                    <span>{event}</span>
                  </label>
                ))}
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
                onClick={disconnectSlack}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

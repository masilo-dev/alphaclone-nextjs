'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, Clock, TrendingUp, Users, Mail, FileText, DollarSign, Target, CheckCircle, AlertCircle, Calendar, Zap, RefreshCw, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../ui/UIComponents';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenant } from '../../../contexts/TenantContext';
import toast from 'react-hot-toast';

interface DailySummary {
  id: string;
  date: string;
  period: 'morning' | 'afternoon' | 'evening';
  timestamp: string;
  metrics: {
    leadsGenerated: number;
    emailsSent: number;
    contractsCreated: number;
    invoicesIssued: number;
    tasksCompleted: number;
    meetingsScheduled: number;
    revenue: number;
    activeUsers: number;
  };
  achievements: string[];
  alerts: string[];
  recommendations: string[];
  nextActions: string[];
}

interface SummaryStats {
  totalLeads: number;
  totalEmails: number;
  totalContracts: number;
  totalRevenue: number;
  completionRate: number;
  activeProjects: number;
}

const DailySummarySystem: React.FC = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [currentSummary, setCurrentSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(6 * 60 * 60 * 1000); // 6 hours in milliseconds
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Mock data generator for demonstration
  const generateMockSummary = (period: 'morning' | 'afternoon' | 'evening'): DailySummary => {
    const now = new Date();
    const baseMetrics = {
      leadsGenerated: Math.floor(Math.random() * 20) + 5,
      emailsSent: Math.floor(Math.random() * 50) + 10,
      contractsCreated: Math.floor(Math.random() * 5) + 1,
      invoicesIssued: Math.floor(Math.random() * 15) + 5,
      tasksCompleted: Math.floor(Math.random() * 30) + 10,
      meetingsScheduled: Math.floor(Math.random() * 8) + 2,
      revenue: Math.floor(Math.random() * 5000) + 1000,
      activeUsers: Math.floor(Math.random() * 25) + 10
    };

    const achievements = [
      'Successfully generated 15 new leads through automated outreach',
      'Completed 3 major client presentations',
      'Onboarded 2 new team members',
      'Achieved 95% email delivery rate',
      'Closed deal worth $2,500',
      'Resolved 8 customer support tickets'
    ];

    const alerts = [
      'Lead quota approaching daily limit (35/40)',
      '3 invoices overdue for payment',
      'Email campaign showing lower engagement',
      'Team member availability low for next week'
    ];

    const recommendations = [
      'Consider upgrading lead generation strategy',
      'Follow up on overdue invoices',
      'Review email campaign content for better engagement',
      'Schedule team meeting for project alignment',
      'Focus on high-value lead nurturing'
    ];

    const nextActions = [
      'Send follow-up emails to new leads',
      'Review and approve pending contracts',
      'Update project timelines',
      'Prepare for upcoming client meetings',
      'Analyze campaign performance metrics'
    ];

    return {
      id: `${now.getTime()}-${period}`,
      date: now.toISOString().split('T')[0],
      period,
      timestamp: now.toISOString(),
      metrics: baseMetrics,
      achievements: achievements.slice(0, Math.floor(Math.random() * 3) + 2),
      alerts: alerts.slice(0, Math.floor(Math.random() * 2) + 1),
      recommendations: recommendations.slice(0, Math.floor(Math.random() * 3) + 2),
      nextActions: nextActions.slice(0, Math.floor(Math.random() * 3) + 2)
    };
  };

  const loadSummaries = async () => {
    try {
      setLoading(true);
      
      // Generate mock summaries for the last 7 days
      const mockSummaries: DailySummary[] = [];
      const periods: ('morning' | 'afternoon' | 'evening')[] = ['morning', 'afternoon', 'evening'];
      
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        periods.forEach(period => {
          if (i === 0 || Math.random() > 0.3) { // More recent days have more summaries
            mockSummaries.push(generateMockSummary(period));
          }
        });
      }

      setSummaries(mockSummaries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setCurrentSummary(mockSummaries[0] || null);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading summaries:', error);
      toast.error('Failed to load daily summaries');
    } finally {
      setLoading(false);
    }
  };

  const refreshSummary = async () => {
    await loadSummaries();
    toast.success('Daily summary refreshed');
  };

  const getSummaryStats = (): SummaryStats => {
    if (summaries.length === 0) {
      return {
        totalLeads: 0,
        totalEmails: 0,
        totalContracts: 0,
        totalRevenue: 0,
        completionRate: 0,
        activeProjects: 0
      };
    }

    const totals = summaries.reduce((acc, summary) => ({
      leads: acc.leads + summary.metrics.leadsGenerated,
      emails: acc.emails + summary.metrics.emailsSent,
      contracts: acc.contracts + summary.metrics.contractsCreated,
      revenue: acc.revenue + summary.metrics.revenue,
      tasks: acc.tasks + summary.metrics.tasksCompleted,
      projects: acc.projects + summary.metrics.meetingsScheduled
    }), { leads: 0, emails: 0, contracts: 0, revenue: 0, tasks: 0, projects: 0 });

    return {
      totalLeads: totals.leads,
      totalEmails: totals.emails,
      totalContracts: totals.contracts,
      totalRevenue: totals.revenue,
      completionRate: Math.round((totals.tasks / (totals.tasks + totals.projects * 2)) * 100),
      activeProjects: totals.projects
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 6) return `${diffInHours}h ago`;
    if (diffInHours < 24) return 'Today';
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  useEffect(() => {
    loadSummaries();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshSummary();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const stats = getSummaryStats();

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-700 rounded"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
          <div className="h-64 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-teal-400" />
            Daily Summary Dashboard
          </h1>
          <p className="text-slate-400 mt-1">
            Track your business performance with automated 6-hour updates
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={refreshSummary} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh Now
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Current Summary Card */}
      {currentSummary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                currentSummary.period === 'morning' ? 'bg-yellow-400' :
                currentSummary.period === 'afternoon' ? 'bg-orange-400' : 'bg-purple-400'
              }`}></div>
              <h2 className="text-xl font-bold text-white capitalize">
                {currentSummary.period} Summary
              </h2>
              <span className="text-slate-400 text-sm">
                {formatTimeAgo(new Date(currentSummary.timestamp))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400 text-sm">
                Next update in {Math.ceil((refreshInterval - (Date.now() - (lastUpdated?.getTime() || 0))) / (1000 * 60 * 60))}h
              </span>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-teal-400" />
                <span className="text-slate-400 text-sm">Leads</span>
              </div>
              <p className="text-2xl font-bold text-white">{currentSummary.metrics.leadsGenerated}</p>
            </div>
            
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-blue-400" />
                <span className="text-slate-400 text-sm">Emails</span>
              </div>
              <p className="text-2xl font-bold text-white">{currentSummary.metrics.emailsSent}</p>
            </div>
            
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span className="text-slate-400 text-sm">Contracts</span>
              </div>
              <p className="text-2xl font-bold text-white">{currentSummary.metrics.contractsCreated}</p>
            </div>
            
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-slate-400 text-sm">Revenue</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatCurrency(currentSummary.metrics.revenue)}</p>
            </div>
          </div>

          {/* Achievements */}
          {currentSummary.achievements.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                Achievements
              </h3>
              <div className="space-y-2">
                {currentSummary.achievements.map((achievement, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                    <p className="text-green-300">{achievement}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerts */}
          {currentSummary.alerts.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                Alerts
              </h3>
              <div className="space-y-2">
                {currentSummary.alerts.map((alert, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5" />
                    <p className="text-yellow-300">{alert}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {currentSummary.recommendations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-400" />
                Recommendations
              </h3>
              <div className="space-y-2">
                {currentSummary.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <Zap className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-blue-300">{recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Actions */}
          {currentSummary.nextActions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                Next Actions
              </h3>
              <div className="space-y-2">
                {currentSummary.nextActions.map((action, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <Calendar className="w-4 h-4 text-purple-400 mt-0.5" />
                    <p className="text-purple-300">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Weekly Overview */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-teal-400" />
          Weekly Overview
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-teal-400">{stats.totalLeads}</p>
            <p className="text-slate-400 text-sm">Total Leads</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-400">{stats.totalEmails}</p>
            <p className="text-slate-400 text-sm">Emails Sent</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-400">{stats.totalContracts}</p>
            <p className="text-slate-400 text-sm">Contracts</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-400">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-slate-400 text-sm">Total Revenue</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-yellow-400">{stats.completionRate}%</p>
            <p className="text-slate-400 text-sm">Completion Rate</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-400">{stats.activeProjects}</p>
            <p className="text-slate-400 text-sm">Active Projects</p>
          </div>
        </div>
      </div>

      {/* Recent Summaries */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-6 h-6 text-teal-400" />
          Recent Summaries
        </h3>
        
        <div className="space-y-4">
          {summaries.slice(1, 6).map((summary) => (
            <div
              key={summary.id}
              className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
              onClick={() => setCurrentSummary(summary)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  summary.period === 'morning' ? 'bg-yellow-400' :
                  summary.period === 'afternoon' ? 'bg-orange-400' : 'bg-purple-400'
                }`}></div>
                <div>
                  <p className="text-white font-medium capitalize">{summary.period} Summary</p>
                  <p className="text-slate-400 text-sm">{formatTimeAgo(new Date(summary.timestamp))}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-teal-400">{summary.metrics.leadsGenerated} leads</span>
                <span className="text-blue-400">{summary.metrics.emailsSent} emails</span>
                <span className="text-green-400">{formatCurrency(summary.metrics.revenue)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Summary Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div>
                    <p className="text-white font-medium">Auto-refresh</p>
                    <p className="text-slate-400 text-sm">Automatically update every 6 hours</p>
                  </div>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Refresh Interval
                </label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  disabled={!autoRefresh}
                >
                  <option value={1 * 60 * 60 * 1000}>1 hour</option>
                  <option value={3 * 60 * 60 * 1000}>3 hours</option>
                  <option value={6 * 60 * 60 * 1000}>6 hours</option>
                  <option value={12 * 60 * 60 * 1000}>12 hours</option>
                  <option value={24 * 60 * 60 * 1000}>24 hours</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowSettings(false)}
                className="flex-1 border-slate-700 text-slate-300 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowSettings(false);
                  toast.success('Settings saved');
                }}
                className="flex-1 bg-teal-600 hover:bg-teal-700"
              >
                Save Settings
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailySummarySystem;
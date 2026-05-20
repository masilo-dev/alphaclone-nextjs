'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Cpu, Play, CheckCircle, X, AlertTriangle, Clock, 
  ChevronRight, Plus, Pause, Settings, RefreshCw, 
  Brain, Shield, Sparkles, ListCollapse, UserCheck, 
  Eye, CheckCircle2, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useTenant } from '@/contexts/TenantContext';

type PlaybookStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped';

interface Playbook {
  id: string;
  name: string;
  key: string;
  status: PlaybookStatus;
  lastRun?: string;
  description: string;
  trigger: 'manual' | 'scheduled' | 'event';
}

interface RunnerAction {
  key: string;
  status: 'success' | 'failed' | 'skipped';
  details: string;
}

interface RunnerRun {
  id: string;
  status: 'running' | 'completed' | 'partial_success' | 'failed';
  started_at: string;
  completed_at: string | null;
  summary: {
    actions?: RunnerAction[];
  };
  trigger_snapshot?: {
    source?: string;
  };
}

interface RunnerApproval {
  id: string;
  action_key: string;
  risk_level: 'low' | 'medium' | 'high';
  confidence_score: number;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  reason: string;
  payload: Record<string, any>;
  created_at: string;
}

interface RunnerRules {
  enabled: boolean;
  auto_send_enabled: boolean;
  auto_send_confidence_threshold: number;
  high_risk_approval_required: boolean;
  stale_deal_days: number;
  social_inactivity_days: number;
}

const PLAYBOOKS: Playbook[] = [
  { id: '1', key: 'unread_buying_signal_inbox', name: 'Lead & Buying Signal Qualifier', status: 'idle', description: 'Scans customer conversations for purchase signals, scores intent, and drafts contextual follow-ups.', trigger: 'event' },
  { id: '2', key: 'stale_deals_7_days', name: 'Deal Score & Triage Update', status: 'idle', description: 'Audits pipeline deals, flagging stale ones (>7 days) and queuing strategic reminders.', trigger: 'scheduled' },
  { id: '3', key: 'overdue_invoices_escalation', name: 'Invoice Reminder & Escalator', status: 'idle', description: 'Identifies outstanding unpaid invoices and generates automated polite email escalation queues.', trigger: 'scheduled' },
  { id: '4', key: 'no_posts_in_3_days', name: 'Proactive Social Content Writer', status: 'idle', description: 'Auto-composes new marketing drafts (LinkedIn/Facebook) if there are no new posts for 3 days.', trigger: 'scheduled' },
  { id: '5', key: 'calendar_next_24h_prep', name: 'Meeting Prep & Calendar Sync', status: 'idle', description: 'Triage calendar schedules for the next 24 hours, building preparation checklists.', trigger: 'event' },
  { id: '6', key: 'payment_loop_reconciliation', name: 'Stripe Payment Reconciliation', status: 'idle', description: 'Scans Stripe Webhooks to match successful payments and auto-closes invoice records.', trigger: 'event' },
];

const STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  idle:            { dot: 'bg-slate-500', badge: 'bg-slate-500/15 text-slate-400 border border-slate-500/10', label: 'Idle' },
  running:         { dot: 'bg-blue-400 animate-pulse', badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/10', label: 'Running' },
  success:         { dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/10', label: 'Success' },
  completed:       { dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/10', label: 'Completed' },
  partial_success: { dot: 'bg-yellow-500', badge: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/10', label: 'Partial Success' },
  failed:          { dot: 'bg-red-500', badge: 'bg-red-500/15 text-red-400 border border-red-500/10', label: 'Failed' },
  skipped:         { dot: 'bg-slate-500', badge: 'bg-slate-800 text-slate-400 border border-transparent', label: 'Skipped' },
};

const AIAgentsTab: React.FC = () => {
  const { currentTenant } = useTenant();
  
  // Navigation tabs: 'playbooks' | 'approvals' | 'history' | 'settings'
  const [activeSubTab, setActiveSubTab] = useState<'playbooks' | 'approvals' | 'history' | 'settings'>('playbooks');
  
  // Data States
  const [runs, setRuns] = useState<RunnerRun[]>([]);
  const [approvals, setApprovals] = useState<RunnerApproval[]>([]);
  const [rules, setRules] = useState<RunnerRules>({
    enabled: true,
    auto_send_enabled: false,
    auto_send_confidence_threshold: 85,
    high_risk_approval_required: true,
    stale_deal_days: 7,
    social_inactivity_days: 3,
  });
  
  const [loading, setLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  // Fetch all runs, rules, and approvals
  const loadData = useCallback(async () => {
    if (!currentTenant?.id) return;
    try {
      const [trigRes, rulesRes] = await Promise.all([
        fetch(`/api/autonomous/trigger?tenantId=${encodeURIComponent(currentTenant.id)}`),
        fetch(`/api/autonomous/rules?tenantId=${encodeURIComponent(currentTenant.id)}`)
      ]);

      if (trigRes.ok) {
        const trigData = await trigRes.json();
        setRuns(trigData.runs || []);
        setApprovals(trigData.approvals || []);
      }
      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        if (rulesData.rules) {
          setRules({
            enabled: rulesData.rules.enabled,
            auto_send_enabled: rulesData.rules.auto_send_enabled,
            auto_send_confidence_threshold: rulesData.rules.auto_send_confidence_threshold,
            high_risk_approval_required: rulesData.rules.high_risk_approval_required,
            stale_deal_days: rulesData.rules.stale_deal_days,
            social_inactivity_days: rulesData.rules.social_inactivity_days,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load autonomous analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle manual trigger run
  const triggerAutonomousRunner = async () => {
    if (!currentTenant?.id || isTriggering) return;
    setIsTriggering(true);
    const toastId = toast.loading('Waking up Alpha Nexus Agents...', { id: 'nexus-runner' });
    try {
      const res = await fetch('/api/autonomous/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: currentTenant.id })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Alpha Nexus agents successfully executed all playbooks!', { id: toastId });
        await loadData();
      } else {
        throw new Error(data.error || 'Execution failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Execution failed', { id: toastId });
    } finally {
      setIsTriggering(false);
    }
  };

  // Handle Approvals
  const handleApprovalStatus = async (approvalId: string, status: 'approved' | 'rejected') => {
    if (!currentTenant?.id) return;
    const toastId = toast.loading(`${status === 'approved' ? 'Approving' : 'Rejecting'} action...`);
    try {
      const res = await fetch('/api/autonomous/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          approvalId,
          status
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Action successfully ${status}!`, { id: toastId });
        await loadData();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update approval', { id: toastId });
    }
  };

  // Update Settings
  const handleUpdateRules = async (updates: Partial<RunnerRules>) => {
    if (!currentTenant?.id) return;
    const updated = { ...rules, ...updates };
    setRules(updated);
    try {
      const res = await fetch('/api/autonomous/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          enabled: updated.enabled,
          autoSendEnabled: updated.auto_send_enabled,
          autoSendConfidenceThreshold: updated.auto_send_confidence_threshold,
          highRiskApprovalRequired: updated.high_risk_approval_required,
          staleDealDays: updated.stale_deal_days,
          socialInactivityDays: updated.social_inactivity_days
        })
      });
      if (!res.ok) throw new Error();
      toast.success('Agent parameters updated!');
    } catch {
      toast.error('Failed to update agent settings');
      loadData(); // Revert local state
    }
  };

  // Compute stats
  const completedRuns = runs.filter(r => r.status === 'completed' || r.status === 'partial_success');
  const successRate = runs.length > 0 
    ? Math.round((runs.filter(r => r.status === 'completed').length / runs.length) * 100)
    : 100;
  const failures = runs.filter(r => r.status === 'failed').length;
  const pendingApprovalsCount = approvals.filter(a => a.status === 'pending').length;

  // Enhance playbooks with real last run data from history
  const enhancedPlaybooks = PLAYBOOKS.map(pb => {
    let lastActionStatus: PlaybookStatus = 'idle';
    let lastRunTime = '';
    
    // Find last run where this playbook key was executed
    for (const run of runs) {
      const act = run.summary?.actions?.find(a => a.key === pb.key);
      if (act) {
        lastActionStatus = act.status as PlaybookStatus;
        lastRunTime = new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + new Date(run.started_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';
        break;
      }
    }

    return {
      ...pb,
      status: lastActionStatus,
      lastRun: lastRunTime || undefined
    };
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Accessing Alpha Nexus Registry...</span>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto pb-24 space-y-6 px-4 pt-4">

      {/* Primary Global Action Board */}
      <div className="bg-gradient-to-r from-purple-900/40 to-slate-900 border border-purple-500/10 rounded-3xl p-5 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-44 h-44 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              <h2 className="text-md font-black uppercase tracking-wider text-purple-400">AlphaClone Nexus Orchestrator</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-lg">
              Nexus acts as your sovereign automated agent network. It checks messages, prompts leads, drafts social posts, triages calendars, and reconciles payments.
            </p>
          </div>
          <button
            onClick={triggerAutonomousRunner}
            disabled={isTriggering || !rules.enabled}
            className={`w-full md:w-auto h-12 px-6 rounded-xl text-white font-black uppercase tracking-wider text-[12px] flex items-center justify-center gap-2 transition-all ${
              !rules.enabled 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5' 
                : 'bg-purple-600 hover:bg-purple-500 active:scale-95 shadow-lg shadow-purple-900/30'
            }`}
          >
            {isTriggering ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Running Playbooks...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Trigger Nexus Sync</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* System Health Indicators */}
      <div className="bg-slate-900 border border-white/5 rounded-3xl p-4">
        <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3 px-1">Autonomous Engine Health</div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-slate-950/40 p-2.5 rounded-2xl border border-white/5">
            <div className="text-[18px] md:text-[22px] font-black text-white">{runs.length}</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Total Runs</div>
          </div>
          <div className="bg-slate-950/40 p-2.5 rounded-2xl border border-white/5">
            <div className={`text-[18px] md:text-[22px] font-black ${successRate >= 90 ? 'text-emerald-400' : successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{successRate}%</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Success Rate</div>
          </div>
          <div className="bg-slate-950/40 p-2.5 rounded-2xl border border-white/5">
            <div className={`text-[18px] md:text-[22px] font-black ${failures > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{failures}</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Failures</div>
          </div>
          <div className="bg-slate-950/40 p-2.5 rounded-2xl border border-white/5 relative">
            <div className={`text-[18px] md:text-[22px] font-black ${pendingApprovalsCount > 0 ? 'text-purple-400' : 'text-slate-500'}`}>{pendingApprovalsCount}</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Pending Action</div>
            {pendingApprovalsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            )}
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-white/5 bg-slate-950 p-1 gap-1 rounded-2xl">
        {[
          { id: 'playbooks', label: 'Agent Playbooks' },
          { id: 'approvals', label: 'Approvals Queue', count: pendingApprovalsCount },
          { id: 'history', label: 'Execution Logs' },
          { id: 'settings', label: 'Agent Parameters' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeSubTab === tab.id 
                ? 'bg-purple-600/10 text-purple-400 border border-purple-500/25' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-[9px] font-black px-1.5 py-0.5 bg-purple-500 text-white rounded-md">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="space-y-4">
        {activeSubTab === 'playbooks' && (
          <div className="space-y-3">
            <div className="text-[12px] font-black uppercase tracking-wider text-slate-500 px-1">Active Automated Pipelines</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {enhancedPlaybooks.map(pb => {
                const style = STATUS_STYLES[pb.status];
                return (
                  <div 
                    key={pb.id}
                    onClick={() => setSelectedPlaybook(pb)}
                    className="p-4 bg-slate-900/60 border border-white/5 hover:border-purple-500/20 rounded-2xl flex flex-col justify-between gap-3 cursor-pointer transition-all hover:bg-slate-900 group"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-slate-950 border border-white/5 text-purple-400">
                            <Cpu className="w-4 h-4" />
                          </div>
                          <h4 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">{pb.name}</h4>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${style.badge}`}>
                          <span className={`w-1 h-1 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed opacity-75">{pb.description}</p>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-white/5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <span>Trigger: {pb.trigger}</span>
                      {pb.lastRun && <span>Last Sync: {pb.lastRun}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeSubTab === 'approvals' && (
          <div className="space-y-3">
            <div className="text-[12px] font-black uppercase tracking-wider text-slate-500 px-1">Actions Requiring Authorization</div>
            {approvals.filter(a => a.status === 'pending').length === 0 ? (
              <div className="py-12 text-center bg-slate-900/20 rounded-2xl border border-dashed border-white/5">
                <UserCheck className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-400">No pending approvals</h4>
                <p className="text-[11px] text-slate-600 mt-1 max-w-xs mx-auto">All autonomous outreach and actions are syncing cleanly.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {approvals.filter(a => a.status === 'pending').map((app) => (
                  <div key={app.id} className="p-4 bg-slate-900 border border-white/5 rounded-2xl space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[9px] font-black px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/25 rounded-md uppercase tracking-wider">
                          {app.action_key.replace(/_/g, ' ')}
                        </span>
                        <h4 className="text-xs font-bold text-white mt-1.5">{app.reason}</h4>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          app.risk_level === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          app.risk_level === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {app.risk_level} Risk
                        </span>
                        <div className="text-[10px] text-slate-500 font-bold mt-1">Match: {app.confidence_score}%</div>
                      </div>
                    </div>

                    {app.payload && (
                      <div className="bg-slate-950 p-3 rounded-xl border border-white/5 text-xs text-slate-300 font-mono space-y-1.5 max-h-36 overflow-y-auto">
                        <div className="text-[10px] text-slate-500 uppercase font-black">Draft Content Preview</div>
                        {app.payload.messageId && <div className="text-slate-500 text-[10px]">Source Msg ID: {app.payload.messageId}</div>}
                        <div className="italic leading-relaxed whitespace-pre-wrap">
                          {app.payload.reply_to || "No preview content compiled. Ready to dispatch default webhook."}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleApprovalStatus(app.id, 'rejected')}
                        className="px-3.5 py-1.5 bg-slate-950 border border-white/10 hover:bg-slate-800 text-rose-400 text-xs font-bold rounded-xl transition-all"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprovalStatus(app.id, 'approved')}
                        className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all"
                      >
                        Approve & Dispatch
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'history' && (
          <div className="space-y-3">
            <div className="text-[12px] font-black uppercase tracking-wider text-slate-500 px-1">Recent Execution Telemetry</div>
            {runs.length === 0 ? (
              <div className="py-12 text-center bg-slate-900/20 rounded-2xl border border-dashed border-white/5">
                <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-400">No logs on file</h4>
                <p className="text-[11px] text-slate-600 mt-1">Manual triggers or cron schedules will populate execution telemetry.</p>
              </div>
            ) : (
              <div className="space-y-2 bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                {runs.map((run) => {
                  const style = STATUS_STYLES[run.status];
                  const isExpanded = expandedRunId === run.id;
                  const runActions = run.summary?.actions || [];

                  return (
                    <div key={run.id} className="transition-all hover:bg-slate-900/20">
                      {/* Trigger Row */}
                      <button 
                        onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                        className="w-full flex items-center justify-between p-3.5 text-left text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>Execution Run</span>
                              <span className="text-[10px] text-slate-500 font-normal">({run.id.slice(0, 8)})</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Started: {new Date(run.started_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${style.badge}`}>
                            {style.label}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {/* Expandable Details Log */}
                      {isExpanded && (
                        <div className="bg-slate-950/80 p-3.5 border-t border-white/5 space-y-2">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 flex justify-between">
                            <span>Step Process Report</span>
                            <span>Source: {run.trigger_snapshot?.source || 'unknown'}</span>
                          </div>

                          {runActions.length === 0 ? (
                            <div className="text-slate-600 italic text-[11px]">No modules executed in this run cycle.</div>
                          ) : (
                            <div className="space-y-1.5">
                              {runActions.map((act, index) => {
                                const actStyle = STATUS_STYLES[act.status];
                                return (
                                  <div key={index} className="flex justify-between items-start gap-4 p-2 bg-slate-900 border border-white/5 rounded-xl text-[11px]">
                                    <div className="space-y-0.5">
                                      <div className="font-bold text-white uppercase tracking-wider text-[10px]">
                                        {act.key.replace(/_/g, ' ')}
                                      </div>
                                      <div className="text-slate-400">{act.details}</div>
                                    </div>
                                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0 ${actStyle.badge}`}>
                                      {act.status}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'settings' && (
          <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-purple-400" /> Nexus Parameter Configuration
              </h3>
              <p className="text-xs text-slate-400 mt-1">Fine-tune confidence scoring and scheduling thresholds for autonomous runs.</p>
            </div>

            <div className="space-y-4 pt-2">
              {/* Enabled switch */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-white/5 rounded-2xl">
                <div>
                  <span className="text-xs font-bold text-white block">Autonomous Execution Master</span>
                  <span className="text-[10px] text-slate-500">Allow background processes and cron scripts to execute playbooks.</span>
                </div>
                <button 
                  onClick={() => handleUpdateRules({ enabled: !rules.enabled })}
                  className={`w-[51px] h-[31px] rounded-full transition-colors relative flex-shrink-0 ${rules.enabled ? 'bg-purple-600' : 'bg-slate-800 border border-white/5'}`}
                >
                  <div className={`absolute top-0.5 w-[27px] h-[27px] bg-white rounded-full shadow transition-all ${rules.enabled ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Auto send emails switch */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-white/5 rounded-2xl">
                <div>
                  <span className="text-xs font-bold text-white block">Auto-Send Low-Risk Messages</span>
                  <span className="text-[10px] text-slate-500">Enable AI agents to automatically reply to clear buying signals without manual triage.</span>
                </div>
                <button 
                  onClick={() => handleUpdateRules({ auto_send_enabled: !rules.auto_send_enabled })}
                  className={`w-[51px] h-[31px] rounded-full transition-colors relative flex-shrink-0 ${rules.auto_send_enabled ? 'bg-purple-600' : 'bg-slate-800 border border-white/5'}`}
                >
                  <div className={`absolute top-0.5 w-[27px] h-[27px] bg-white rounded-full shadow transition-all ${rules.auto_send_enabled ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>

              {/* High risk approval required */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-white/5 rounded-2xl">
                <div>
                  <span className="text-xs font-bold text-white block">Force High-Risk Triage Gate</span>
                  <span className="text-[10px] text-slate-500">Hold actions in Approvals Queue if risk is scored high (Confidence &lt; 90%).</span>
                </div>
                <button 
                  onClick={() => handleUpdateRules({ high_risk_approval_required: !rules.high_risk_approval_required })}
                  className={`w-[51px] h-[31px] rounded-full transition-colors relative flex-shrink-0 ${rules.high_risk_approval_required ? 'bg-purple-600' : 'bg-slate-800 border border-white/5'}`}
                >
                  <div className={`absolute top-0.5 w-[27px] h-[27px] bg-white rounded-full shadow transition-all ${rules.high_risk_approval_required ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Sliders */}
              <div className="space-y-4 pt-2 border-t border-white/5">
                {/* Confidence Threshold */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-300">Auto-Send Confidence Threshold</span>
                    <span className="text-purple-400">{rules.auto_send_confidence_threshold}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    step="5"
                    value={rules.auto_send_confidence_threshold}
                    onChange={(e) => handleUpdateRules({ auto_send_confidence_threshold: Number(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="text-[9px] text-slate-500">Minimum AI confidence score required to auto-send message without manual queue check.</div>
                </div>

                {/* Stale deal days */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-300">Stale Deal Age Flag</span>
                    <span className="text-purple-400">{rules.stale_deal_days} Days</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="30"
                    step="1"
                    value={rules.stale_deal_days}
                    onChange={(e) => handleUpdateRules({ stale_deal_days: Number(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="text-[9px] text-slate-500">Flags deals as stale if inactive for longer than this duration, triggering triage.</div>
                </div>

                {/* Social Inactivity days */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-300">Social Inactivity Threshold</span>
                    <span className="text-purple-400">{rules.social_inactivity_days} Days</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="14"
                    step="1"
                    value={rules.social_inactivity_days}
                    onChange={(e) => handleUpdateRules({ social_inactivity_days: Number(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="text-[9px] text-slate-500">Auto-triggers draft composition for LinkedIn if no marketing runs detected within this timeframe.</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Playbook Info Sheet (Slide up) */}
      <AnimatePresence>
        {selectedPlaybook && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs"
          >
            <div className="flex-1" onClick={() => setSelectedPlaybook(null)} />
            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-slate-900 border-t border-white/10 rounded-t-3xl max-h-[85vh] overflow-y-auto px-4 pb-8"
            >
              <div className="flex justify-center pt-3 pb-4">
                <div className="w-10 h-1 bg-slate-700 rounded-full" />
              </div>

              <div className="space-y-5">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="text-[17px] font-black text-white">{selectedPlaybook.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Trigger: {selectedPlaybook.trigger}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${STATUS_STYLES[selectedPlaybook.status].badge}`}>
                    {STATUS_STYLES[selectedPlaybook.status].label}
                  </span>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-white/5 text-xs text-slate-400 leading-relaxed">
                  {selectedPlaybook.description}
                </div>

                {/* Settings Shortcut depending on playbook */}
                {selectedPlaybook.key === 'stale_deals_7_days' && (
                  <div className="p-3 bg-slate-950 rounded-2xl border border-white/5 space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400">Current Threshold:</span>
                      <span className="text-purple-400">{rules.stale_deal_days} Days</span>
                    </div>
                    <button 
                      onClick={() => { setSelectedPlaybook(null); setActiveSubTab('settings'); }}
                      className="w-full text-center text-[10px] font-bold uppercase tracking-wider text-purple-400 py-1 hover:text-purple-300"
                    >
                      Configure Slider Parameter &rarr;
                    </button>
                  </div>
                )}

                {selectedPlaybook.key === 'no_posts_in_3_days' && (
                  <div className="p-3 bg-slate-950 rounded-2xl border border-white/5 space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400">Current Threshold:</span>
                      <span className="text-purple-400">{rules.social_inactivity_days} Days</span>
                    </div>
                    <button 
                      onClick={() => { setSelectedPlaybook(null); setActiveSubTab('settings'); }}
                      className="w-full text-center text-[10px] font-bold uppercase tracking-wider text-purple-400 py-1 hover:text-purple-300"
                    >
                      Configure Slider Parameter &rarr;
                    </button>
                  </div>
                )}

                {/* Show recent runs specific to this playbook action */}
                <div className="space-y-2">
                  <div className="text-[10px] text-slate-500 uppercase font-black tracking-wider px-1">Pipeline Run Log</div>
                  {runs.filter(r => r.summary?.actions?.some(a => a.key === selectedPlaybook.key)).slice(0, 5).length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic p-3 bg-slate-950/40 rounded-xl border border-white/5">
                      No matching executions recorded for this playbook yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {runs
                        .filter(r => r.summary?.actions?.some(a => a.key === selectedPlaybook.key))
                        .slice(0, 5)
                        .map((run) => {
                          const action = run.summary.actions!.find(a => a.key === selectedPlaybook.key)!;
                          const actionStyle = STATUS_STYLES[action.status];
                          return (
                            <div key={run.id} className="p-3 bg-slate-950 rounded-2xl border border-white/5 flex flex-col gap-2">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500">
                                  Run: {new Date(run.started_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                                <span className={`font-black uppercase px-1.5 py-0.2 rounded-md ${actionStyle.badge}`}>
                                  {action.status}
                                </span>
                              </div>
                              <div className="text-xs text-slate-300 font-mono leading-relaxed bg-slate-900 p-2 rounded-xl border border-white/5">
                                {action.details}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedPlaybook(null)}
                    className="flex-1 h-12 bg-slate-800 border border-white/10 hover:bg-slate-700 text-slate-300 rounded-xl font-bold uppercase tracking-wider text-[12px]"
                  >
                    Close
                  </button>
                  <button 
                    onClick={() => { setSelectedPlaybook(null); triggerAutonomousRunner(); }}
                    className="flex-1 h-12 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black uppercase tracking-wider text-[12px] flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3 h-3 fill-current" /> Run Playbook
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIAgentsTab;

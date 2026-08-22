'use client';

import React, { useState, useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Zap,
  Activity,
  Search,
  Plus,
  HelpCircle,
  TrendingUp,
  XCircle,
  Brain,
  MessageSquare,
  FileCheck,
  ChevronRight,
  RefreshCw,
  Lock,
  Layers,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WORKSPACE } from '@/constants/design';

import { Client360ViewPage } from '@/components/dashboard/crm/Client360ViewPage';

import { businessClientService } from '@/services/businessClientService';

type TabType = 'hud' | 'health' | 'alamos' | 'failures' | 'ask_bonnie' | 'clients_360';

export function OperationsCommandCenter() {
  const { currentTenant } = useTenant();
  const [activeTab, setActiveTab] = useState<TabType>('hud');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hudData, setHudData] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [failures, setFailures] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [alamosEvaluations, setAlamosEvaluations] = useState<any[]>([]);
  const [bonnieQuery, setBonnieQuery] = useState('');
  const [bonnieResponse, setBonnieResponse] = useState<any>(null);
  const [askingBonnie, setAskingBonnie] = useState(false);

  // New Decision Modal state
  const [showNewDecisionModal, setShowNewDecisionModal] = useState(false);
  const [newDecision, setNewDecision] = useState({
    decision_title: '',
    context: '',
    objective: '',
    evidence_label: 'ESTIMATED' as const,
    cost_amount: 0,
    probability_of_success: 0.8,
    reversibility: 'reversible' as const,
  });

  // ALAMOS Modal state
  const [showAlamosModal, setShowAlamosModal] = useState(false);
  const [alamosForm, setAlamosForm] = useState({
    title: '',
    alamos_01_outcome_metric: '',
    alamos_02_zero_multiplier: '',
    alamos_03_success_probability: 0.75,
    alamos_04_cost_and_tradeoffs: '',
    alamos_05_potential_failure_modes: '',
    alamos_06_verification_method: '',
    alamos_07_post_evidence_plan: '',
    resulting_action: 'TEST' as const,
  });

  const loadData = async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const [hudRes, healthRes, failuresRes, decisionsRes, alamosRes, clientsRes] = await Promise.all([
        fetch(`/api/operations?view=hud`),
        fetch(`/api/operations?view=health`),
        fetch(`/api/operations?view=failures`),
        fetch(`/api/operations?view=decisions`),
        fetch(`/api/operations?view=alamos`),
        businessClientService.getClients(currentTenant.id, 1, 50),
      ]);

      if (hudRes.ok) setHudData(await hudRes.json());
      if (healthRes.ok) setHealthData(await healthRes.json());
      if (failuresRes.ok) {
        const d = await failuresRes.json();
        setFailures(d.failures || []);
      }
      if (decisionsRes.ok) {
        const d = await decisionsRes.json();
        setDecisions(d.decisions || []);
      }
      if (alamosRes.ok) {
        const d = await alamosRes.json();
        setAlamosEvaluations(d.evaluations || []);
      }
      if (clientsRes?.clients) {
        setClientsList(clientsRes.clients);
      }
    } catch (err) {
      console.error('Error fetching operations data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [currentTenant?.id]);

  const handleAskBonnie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonnieQuery.trim()) return;
    setAskingBonnie(true);
    try {
      const res = await fetch(`/api/operations?view=ask_bonnie&q=${encodeURIComponent(bonnieQuery)}`);
      if (res.ok) {
        setBonnieResponse(await res.json());
      }
    } catch (err) {
      console.error('Error asking Bonnie:', err);
    } finally {
      setAskingBonnie(false);
    }
  };

  const submitNewDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_decision',
          payload: newDecision,
        }),
      });
      if (res.ok) {
        setShowNewDecisionModal(false);
        void loadData();
      }
    } catch (err) {
      console.error('Error creating decision:', err);
    }
  };

  const submitAlamosEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate_alamos',
          payload: alamosForm,
        }),
      });
      if (res.ok) {
        setShowAlamosModal(false);
        void loadData();
      }
    } catch (err) {
      console.error('Error evaluating ALAMOS:', err);
    }
  };

  const stats = hudData?.todayStats || {
    tasksDue: 0,
    overdueTasks: 0,
    pendingSlas: 0,
    pendingApprovals: 0,
    activeBlockers: 0,
    recentFailures: 0,
    overdueInvoices: 0,
  };

  return (
    <div className="space-y-6 pb-24 ac-safe-bottom" data-tour="operations-command">
      {/* Executive Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 tracking-wide uppercase">
              ALAMOS OS 2.0
            </span>
            <span className="text-xs text-gray-400 font-mono">Tenant: {currentTenant?.name || 'Workspace'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2">
            <Activity className="w-7 h-7 text-cyan-400" />
            Operations Command Center
          </h1>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Real-time exception-based operating system. Zero noise, high velocity decision-making & accountability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadData()}
            className="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold flex items-center gap-1.5 transition border border-white/10"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh HUD
          </button>
          <button
            onClick={() => setShowAlamosModal(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 hover:opacity-90 transition flex items-center gap-1.5"
          >
            <ShieldAlert className="w-4 h-4" />
            ALAMOS Decision Gate
          </button>
        </div>
      </header>

      {/* 8-Tile Executive Status Strip */}
      <section className="grid grid-cols-2 min-[576px]:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 hover:border-cyan-500/40 transition">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Due Today</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-white mt-1">{stats.tasksDue}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 hover:border-red-500/40 transition">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Overdue Work</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-black text-red-400 mt-1">{stats.overdueTasks}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Client 24h SLA</span>
            <MessageSquare className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400 mt-1">{stats.pendingSlas}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 hover:border-purple-500/40 transition">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Approvals</span>
            <FileCheck className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-purple-400 mt-1">{stats.pendingApprovals}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 hover:border-orange-500/40 transition">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Blockers</span>
            <Lock className="w-4 h-4 text-orange-400" />
          </div>
          <p className="text-2xl font-black text-orange-400 mt-1">{stats.activeBlockers}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 hover:border-rose-500/40 transition">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Failures</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400 mt-1">{stats.recentFailures}</p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 hover:border-emerald-500/40 transition col-span-2 min-[576px]:col-span-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Overdue A/R</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats.overdueInvoices}</p>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('hud')}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap',
            activeTab === 'hud'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
        >
          <Zap className="w-4 h-4" />
          Today HUD
        </button>

        <button
          onClick={() => setActiveTab('health')}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap',
            activeTab === 'health'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
        >
          <Activity className="w-4 h-4" />
          Business Health & Constraints
        </button>

        <button
          onClick={() => setActiveTab('alamos')}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap',
            activeTab === 'alamos'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
        >
          <ShieldAlert className="w-4 h-4" />
          ALAMOS & Decisions ({decisions.length})
        </button>

        <button
          onClick={() => setActiveTab('failures')}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap',
            activeTab === 'failures'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
        >
          <XCircle className="w-4 h-4" />
          Failures & Incident Log ({failures.length})
        </button>

        <button
          onClick={() => setActiveTab('ask_bonnie')}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap',
            activeTab === 'ask_bonnie'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
        >
          <Brain className="w-4 h-4" />
          Ask Bonnie Operations
        </button>

        <button
          onClick={() => setActiveTab('clients_360')}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap',
            activeTab === 'clients_360'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
        >
          <Users className="w-4 h-4" />
          Client 360 View
        </button>
      </div>

      {/* TAB 1: TODAY HUD */}
      {activeTab === 'hud' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Action Items Column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Priority Tasks */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Priority Tasks Requiring Action Today
                </h3>
                <span className="text-xs text-gray-400">{hudData?.tasksDueToday?.length || 0} items</span>
              </div>

              {hudData?.tasksDueToday?.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No tasks due today. All operations running smoothly.</p>
              ) : (
                <div className="space-y-2.5">
                  {(hudData?.tasksDueToday || []).map((t: any) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between hover:bg-white/[0.06] transition"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{t.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Status: <span className="text-cyan-400 font-medium">{t.status}</span> · Priority:{' '}
                          <span className="text-amber-400 font-medium">{t.priority || 'medium'}</span>
                        </p>
                      </div>
                      <a
                        href="/dashboard/tasks"
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
                      >
                        Execute
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 24-Hour Communication SLAs */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  24-Hour Client Response SLA Tracker
                </h3>
                <span className="text-xs text-amber-400 font-mono font-bold">Max 24h SLA Policy</span>
              </div>

              {hudData?.slaItems?.length === 0 ? (
                <p className="text-xs text-gray-500 italic">Zero pending client communications breaching SLA.</p>
              ) : (
                <div className="space-y-2.5">
                  {(hudData?.slaItems || []).map((s: any) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{s.subject || 'Client Message'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          From: {s.contact_email || 'Client'} · Received:{' '}
                          {new Date(s.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="px-2.5 py-1 rounded text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Status: {s.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Active Blockers & Approvals */}
          <div className="space-y-5">
            {/* Active Blockers */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-orange-400" />
                Active Work Blockers
              </h3>

              {hudData?.blockers?.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No active work blockers reported.</p>
              ) : (
                <div className="space-y-2.5">
                  {(hudData?.blockers || []).map((b: any) => (
                    <div key={b.id} className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
                      <p className="text-xs font-bold text-orange-300">{b.title}</p>
                      <p className="text-xs text-gray-400 mt-1">{b.blocker_cause}</p>
                      <p className="text-[11px] text-gray-500 mt-1.5 font-medium">Impact: {b.business_impact}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Approvals */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-purple-400" />
                Human Approvals
              </h3>

              {hudData?.approvals?.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No actions requiring human sign-off.</p>
              ) : (
                <div className="space-y-2.5">
                  {(hudData?.approvals || []).map((a: any) => (
                    <div key={a.id} className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
                      <p className="text-xs font-bold text-purple-300">{a.action_type || 'Approval Requested'}</p>
                      <p className="text-xs text-gray-400 mt-1">{a.details || 'Pending owner decision'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BUSINESS HEALTH */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {/* Primary Constraint Detector Callout */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-slate-900 to-slate-900 border border-cyan-500/30 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
              <Zap className="w-4 h-4" />
              Automated Primary Constraint Detector
            </div>
            <h3 className="text-xl font-black text-white">
              {healthData?.primaryBottleneck || 'Scanning operating bottlenecks...'}
            </h3>
            <p className="text-xs text-gray-400 max-w-2xl">
              ALAMOS constantly audits workflow queues, task resolution rates, and SLA compliance to surface the #1 operational bottleneck restricting overall company throughput.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
              <p className="text-xs font-medium text-gray-400">Active Projects</p>
              <p className="text-3xl font-black text-white">{healthData?.activeProjectsCount || 0}</p>
              <p className="text-xs text-red-400">{healthData?.projectsAtRiskCount || 0} projects at risk</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
              <p className="text-xs font-medium text-gray-400">24h SLA Compliance</p>
              <p className="text-3xl font-black text-cyan-400">{healthData?.slaCompliancePct || 100}%</p>
              <p className="text-xs text-gray-400">Client response timeliness</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
              <p className="text-xs font-medium text-gray-400">Outstanding Revenue (A/R)</p>
              <p className="text-3xl font-black text-emerald-400">
                £{(healthData?.outstandingRevenue || 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">Pending collection</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ALAMOS & DECISIONS */}
      {activeTab === 'alamos' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Decision Records & ALAMOS 01–07 Protocol</h3>
              <p className="text-xs text-gray-400">
                Structured decision records with evidence quality tags and mandatory gates for high-risk actions.
              </p>
            </div>
            <button
              onClick={() => setShowNewDecisionModal(true)}
              className="px-3.5 py-2 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New Decision Record
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {decisions.length === 0 ? (
              <p className="text-xs text-gray-500 italic col-span-2">No decision records logged yet.</p>
            ) : (
              decisions.map((d) => (
                <div key={d.id} className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {d.evidence_label}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {new Date(d.decision_date).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white">{d.decision_title}</h4>
                  <p className="text-xs text-gray-300">{d.context}</p>
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                    <span>Reversibility: <strong className="text-white">{d.reversibility}</strong></span>
                    <span>Cost: <strong className="text-emerald-400">£{(d.cost_amount || 0).toLocaleString()}</strong></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: FAILURES & INCIDENT LOG */}
      {activeTab === 'failures' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">System & Process Failure Incident Log</h3>
          <p className="text-xs text-gray-400">
            Immutable log of operational, automation, API, and deliverable failures to eliminate repeat mistakes.
          </p>

          {failures.length === 0 ? (
            <p className="text-xs text-gray-500 italic">Zero failure incidents recorded.</p>
          ) : (
            <div className="space-y-3">
              {failures.map((f) => (
                <div key={f.id} className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-300 uppercase">
                      Category: {f.category}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {new Date(f.failure_time).toLocaleString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{f.title}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-300 pt-1">
                    <p><strong className="text-gray-400">Expected:</strong> {f.expected_result}</p>
                    <p><strong className="text-rose-400">Actual:</strong> {f.actual_result}</p>
                  </div>
                  <p className="text-xs text-amber-300 font-medium pt-1">Business Impact: {f.business_impact}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ASK BONNIE OPERATIONS */}
      {activeTab === 'ask_bonnie' && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-white/10 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-cyan-400" />
              Ask Bonnie Operations Engine
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Ask natural language operational questions. Bonnie evaluates current system records and responds with explicit data evidence tags.
            </p>
          </div>

          <form onSubmit={handleAskBonnie} className="flex items-center gap-3">
            <input
              type="text"
              value={bonnieQuery}
              onChange={(e) => setBonnieQuery(e.target.value)}
              placeholder="e.g. What requires my attention today? Or What is our highest bottleneck?"
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500 transition"
            />
            <button
              type="submit"
              disabled={askingBonnie}
              className="px-5 py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition flex items-center gap-2 disabled:opacity-50"
            >
              {askingBonnie ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Query Operations
            </button>
          </form>

          {bonnieResponse && (
            <div className="p-5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Evidence: {bonnieResponse.evidenceQuality}
                </span>
                <span className="text-xs text-cyan-400 font-mono">Bonnie Operational Reasoning</span>
              </div>
              <p className="text-sm font-semibold text-white">{bonnieResponse.answer}</p>
              {bonnieResponse.recommendation && (
                <p className="text-xs text-emerald-300 font-medium">
                  <strong>Recommended Action:</strong> {bonnieResponse.recommendation}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: CLIENT 360 VIEW */}
      {activeTab === 'clients_360' && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-white/10 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                Client Operations 360° Relationship Graph
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Unified 360° view of client relationships, promises/commitments, lifetime value, active deals, and interaction timelines.
              </p>
            </div>
            {selectedClientId && (
              <button
                onClick={() => setSelectedClientId(null)}
                className="px-3.5 py-2 rounded-lg bg-white/10 text-gray-300 text-xs font-semibold hover:bg-white/20 transition"
              >
                ← Back to All Clients
              </button>
            )}
          </div>

          {selectedClientId ? (
            <Client360ViewPage
              tenantId={currentTenant?.id || ''}
              clientId={selectedClientId}
              onBack={() => setSelectedClientId(null)}
            />
          ) : (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white">Select a Client to View 360° Relationship Graph:</h4>
              {clientsList.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No clients found in workspace. Add clients in CRM Workspace.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {clientsList.map((c: any) => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedClientId(c.id)}
                      className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/5 cursor-pointer transition space-y-1"
                    >
                      <p className="text-sm font-bold text-white">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.email || c.company || 'No email specified'}</p>
                      <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/20 text-cyan-300">
                        View 360° Relationship Profile →
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* NEW DECISION MODAL */}
      {showNewDecisionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Log Decision Record</h3>
            <form onSubmit={submitNewDecision} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Decision Title</label>
                <input
                  type="text"
                  required
                  value={newDecision.decision_title}
                  onChange={(e) => setNewDecision({ ...newDecision, decision_title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Context & Background</label>
                <textarea
                  required
                  value={newDecision.context}
                  onChange={(e) => setNewDecision({ ...newDecision, context: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white h-20"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Objective</label>
                <input
                  type="text"
                  required
                  value={newDecision.objective}
                  onChange={(e) => setNewDecision({ ...newDecision, objective: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1">Cost (£)</label>
                  <input
                    type="number"
                    value={newDecision.cost_amount}
                    onChange={(e) => setNewDecision({ ...newDecision, cost_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Reversibility</label>
                  <select
                    value={newDecision.reversibility}
                    onChange={(e) => setNewDecision({ ...newDecision, reversibility: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white"
                  >
                    <option value="reversible">Reversible</option>
                    <option value="partially_reversible">Partially Reversible</option>
                    <option value="irreversible">Irreversible</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewDecisionModal(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold">
                  Save Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ALAMOS DECISION GATE MODAL */}
      {showAlamosModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-cyan-400" />
              ALAMOS 01–07 Protocol Gate Evaluation
            </h3>
            <form onSubmit={submitAlamosEvaluation} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Decision / Project Title</label>
                <input
                  type="text"
                  required
                  value={alamosForm.title}
                  onChange={(e) => setAlamosForm({ ...alamosForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                />
              </div>

              <div>
                <label className="block text-cyan-400 font-bold mb-1">ALAMOS 01: Key Outcome Metric</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Increase monthly recurring revenue by 15%"
                  value={alamosForm.alamos_01_outcome_metric}
                  onChange={(e) => setAlamosForm({ ...alamosForm, alamos_01_outcome_metric: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                />
              </div>

              <div>
                <label className="block text-cyan-400 font-bold mb-1">ALAMOS 02: Zero Multipliers (Single points of failure)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Single API key rate limit breach"
                  value={alamosForm.alamos_02_zero_multiplier}
                  onChange={(e) => setAlamosForm({ ...alamosForm, alamos_02_zero_multiplier: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-cyan-400 font-bold mb-1">ALAMOS 03: Success Probability (0-1)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={alamosForm.alamos_03_success_probability}
                    onChange={(e) => setAlamosForm({ ...alamosForm, alamos_03_success_probability: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-cyan-400 font-bold mb-1">Resulting Action Protocol</label>
                  <select
                    value={alamosForm.resulting_action}
                    onChange={(e) => setAlamosForm({ ...alamosForm, resulting_action: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white font-bold"
                  >
                    {['BUILD', 'FIX', 'SCALE', 'KEEP', 'SIMPLIFY', 'TEST', 'DEFER', 'AUTOMATE', 'REMOVE', 'KILL'].map((act) => (
                      <option key={act} value={act}>{act}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-cyan-400 font-bold mb-1">ALAMOS 04: Costs & Tradeoffs</label>
                <input
                  type="text"
                  required
                  value={alamosForm.alamos_04_cost_and_tradeoffs}
                  onChange={(e) => setAlamosForm({ ...alamosForm, alamos_04_cost_and_tradeoffs: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                />
              </div>

              <div>
                <label className="block text-cyan-400 font-bold mb-1">ALAMOS 05: Failure Modes</label>
                <input
                  type="text"
                  required
                  value={alamosForm.alamos_05_potential_failure_modes}
                  onChange={(e) => setAlamosForm({ ...alamosForm, alamos_05_potential_failure_modes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                />
              </div>

              <div>
                <label className="block text-cyan-400 font-bold mb-1">ALAMOS 06: Verification Plan</label>
                <input
                  type="text"
                  required
                  value={alamosForm.alamos_06_verification_method}
                  onChange={(e) => setAlamosForm({ ...alamosForm, alamos_06_verification_method: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                />
              </div>

              <div>
                <label className="block text-cyan-400 font-bold mb-1">ALAMOS 07: Post-Evidence Plan</label>
                <input
                  type="text"
                  required
                  value={alamosForm.alamos_07_post_evidence_plan}
                  onChange={(e) => setAlamosForm({ ...alamosForm, alamos_07_post_evidence_plan: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAlamosModal(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold">
                  Submit ALAMOS Evaluation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OperationsCommandCenter;

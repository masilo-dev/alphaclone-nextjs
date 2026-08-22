'use client';

import React, { useState, useEffect } from 'react';
import {
  User, Building, Mail, Phone, Calendar, Clock, AlertCircle, CheckCircle,
  FileText, DollarSign, ShieldAlert, Zap, MessageSquare, ArrowRight, Activity, Handshake
} from 'lucide-react';
import { Customer360Profile } from '@/services/intelligence/customer360Service';

interface Client360ViewPageProps {
  tenantId: string;
  clientId: string;
  onBack?: () => void;
}

export const Client360ViewPage: React.FC<Client360ViewPageProps> = ({ tenantId, clientId, onBack }) => {
  const [profile, setProfile] = useState<Customer360Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'commercial' | 'calendar' | 'commitments' | 'decisions'>('timeline');

  useEffect(() => {
    fetchProfile();
  }, [tenantId, clientId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/${tenantId}/clients/${clientId}/360`);
      const data = await res.json();
      if (data.success && data.profile) {
        setProfile(data.profile);
      }
    } catch (err) {
      console.error('Failed to load client 360 profile:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-400">
        <Activity className="w-8 h-8 animate-spin text-cyan-400 mr-3" />
        <span>Loading Client 360 Relationship Graph...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-center">
        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-white">Client Profile Not Found</h3>
        <p className="text-sm text-slate-400 mt-1">Could not assemble relationship graph for ID: {clientId}</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition">
            Back to Clients
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100">
      {/* Header Bar */}
      <div className="p-6 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-cyan-500/20">
              {profile.primary_name ? profile.primary_name.charAt(0).toUpperCase() : 'C'}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">{profile.primary_name}</h1>
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {profile.relationship_status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-400">
                {profile.company_name && (
                  <span className="flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-slate-500" /> {profile.company_name}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-slate-500" /> {profile.primary_email}
                </span>
                {profile.primary_phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-slate-500" /> {profile.primary_phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 self-end md:self-auto border-t md:border-t-0 border-slate-800 pt-4 md:pt-0">
            <div className="text-right">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">Lifetime Value</span>
              <span className="text-xl font-bold text-cyan-400">${profile.lifetime_value.toLocaleString()}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">Engagement</span>
              <span className="text-xl font-bold text-emerald-400">{profile.engagement_score}/100</span>
            </div>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Total Revenue</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-xl font-bold text-white">${profile.total_revenue.toLocaleString()}</span>
          </div>

          <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Outstanding Balance</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-xl font-bold text-amber-400">${profile.outstanding_balance.toLocaleString()}</span>
          </div>

          <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Active Commitments</span>
              <Handshake className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-xl font-bold text-purple-400">{profile.commitments.filter(c => c.status === 'pending').length}</span>
          </div>

          <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Active Deals Value</span>
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-xl font-bold text-cyan-400">${profile.active_deals_value.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
            activeTab === 'timeline' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Activity Timeline ({profile.timeline.length})
        </button>
        <button
          onClick={() => setActiveTab('commitments')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
            activeTab === 'commitments' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Commitments ({profile.commitments.length})
        </button>
        <button
          onClick={() => setActiveTab('commercial')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
            activeTab === 'commercial' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Proposals & Deals ({profile.proposals.length})
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
            activeTab === 'calendar' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Calendar & Meetings ({profile.calendar_events.past.length + profile.calendar_events.future.length})
        </button>
        <button
          onClick={() => setActiveTab('decisions')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
            activeTab === 'decisions' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Decisions Log ({profile.decisions.length})
        </button>
      </div>

      {/* Tab Content Panels */}
      {activeTab === 'timeline' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">Unified Activity Timeline</h3>
          <div className="relative pl-6 border-l-2 border-slate-800 space-y-6">
            {profile.timeline.map((item) => (
              <div key={item.id} className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-cyan-500/20 border-2 border-cyan-400" />
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                      {item.type}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-white mt-2">{item.title}</h4>
                  <p className="text-sm text-slate-400 mt-1">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'commitments' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">Promises & Commitments Audit</h3>
          <div className="grid gap-3">
            {profile.commitments.length === 0 ? (
              <p className="text-slate-400 text-sm">No active commitments recorded.</p>
            ) : (
              profile.commitments.map((c) => (
                <div key={c.id} className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${c.makerType === 'our_team' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                        {c.makerType === 'our_team' ? 'Our Promise' : 'Client Promise'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${c.status === 'fulfilled' ? 'bg-emerald-500/10 text-emerald-400' : c.status === 'overdue' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        {c.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-white font-medium mt-2">{c.commitment}</p>
                  </div>
                  {c.dueDate && (
                    <span className="text-xs text-slate-400">Due: {new Date(c.dueDate).toLocaleDateString()}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'commercial' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">Proposals & Quotations</h3>
          <div className="grid gap-3">
            {profile.proposals.length === 0 ? (
              <p className="text-slate-400 text-sm">No proposal records found.</p>
            ) : (
              profile.proposals.map((p) => (
                <div key={p.id} className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-white">{p.title}</h4>
                    <span className="text-xs text-slate-400 mt-1 block">Created: {new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold text-cyan-400 block">${p.amount.toLocaleString()}</span>
                    <span className="text-xs text-slate-400 uppercase">{p.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">Calendar & Meeting History</h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Upcoming & Today ({profile.calendar_events.today.length + profile.calendar_events.future.length})</h4>
              {[...profile.calendar_events.today, ...profile.calendar_events.future].map((mtg) => (
                <div key={mtg.id} className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between mb-2">
                  <span className="text-sm text-white font-medium">{mtg.title}</span>
                  <span className="text-xs text-slate-400">{new Date(mtg.time).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Past Meetings ({profile.calendar_events.past.length})</h4>
              {profile.calendar_events.past.map((mtg) => (
                <div key={mtg.id} className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between mb-2 opacity-75">
                  <span className="text-sm text-slate-300">{mtg.title}</span>
                  <span className="text-xs text-slate-500">{new Date(mtg.time).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'decisions' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">Logged Project Decisions</h3>
          <div className="grid gap-3">
            {profile.decisions.length === 0 ? (
              <p className="text-slate-400 text-sm">No formal decisions logged yet.</p>
            ) : (
              profile.decisions.map((d) => (
                <div key={d.id} className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg">
                  <h4 className="text-sm font-medium text-white">{d.title}</h4>
                  {d.decidedAt && (
                    <span className="text-xs text-slate-400 mt-1 block">Logged: {new Date(d.decidedAt).toLocaleString()}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

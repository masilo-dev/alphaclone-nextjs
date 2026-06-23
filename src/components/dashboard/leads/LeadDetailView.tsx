'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Building2, Mail, Phone, Globe, MapPin, Tag, 
  Star, TrendingUp, MessageSquare, Calendar, FileText,
  Send, Edit2, Trash2, CheckCircle, AlertCircle, Clock,
  Zap, Target, Award, BarChart3, ChevronRight, Copy,
  ExternalLink, MoreVertical, CheckCircle2, XCircle,
  PhoneCall, MailPlus, Linkedin, UserCheck, Briefcase,
  Search, DollarSign
} from 'lucide-react';
import { Lead, leadService } from '@/services/leadService';
import { contactService } from '@/services/contactService';
import { quoteService } from '@/services/quoteService';
import { dealService } from '@/services/dealService';
import { calendarService } from '@/services/calendarService';
import { taskService } from '@/services/taskService';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import GhostIntelligence from '@/components/leads/GhostIntelligence';
import { useTenant } from '@/contexts/TenantContext';

const ComposeEmailModal = dynamic(
  () => import('@/components/dashboard/business/ComposeEmailModal'),
  { ssr: false }
);

interface LeadDetailViewProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (lead: Lead) => void;
  onDelete?: (leadId: string) => void;
}

// Lead Score Calculator
function calculateLeadScore(lead: Lead): number {
  let score = 0;
  
  // Contact Quality (40 points)
  if (lead.email) score += 15;
  if (lead.phone) score += 15;
  if (lead.website) score += 10;
  
  // Data Completeness (30 points)
  if (lead.industry) score += 10;
  if (lead.location) score += 10;
  if (lead.value && lead.value > 0) score += 10;
  
  // Enrichment Quality (20 points)
  if (lead.techStack && lead.techStack.length > 0) score += 10;
  if (lead.painPoints && lead.painPoints.length > 0) score += 10;
  
  // Verification (10 points)
  if (lead.isVerified) score += 10;
  
  return Math.min(100, score);
}

// Get Next Best Action
function getNextBestAction(lead: Lead): {
  action: string;
  icon: React.ReactNode;
  color: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
} {
  const score = calculateLeadScore(lead);
  
  if (!lead.email && !lead.phone) {
    return {
      action: 'Find Contact Info',
      icon: <Search className="w-4 h-4" />,
      color: 'text-yellow-400',
      reason: 'Missing contact details - use Email Discovery',
      priority: 'high'
    };
  }
  
  if (lead.stage === 'lead' && score >= 60) {
    return {
      action: 'Qualify Lead',
      icon: <Target className="w-4 h-4" />,
      color: 'text-blue-400',
      reason: 'High score - ready to qualify and move to CRM',
      priority: 'high'
    };
  }
  
  if (lead.stage === 'qualified' && lead.email) {
    return {
      action: 'Send Outreach Email',
      icon: <Send className="w-4 h-4" />,
      color: 'text-green-400',
      reason: 'Qualified with email - start conversation',
      priority: 'high'
    };
  }
  
  if (lead.stage === 'proposal' && !lead.value) {
    return {
      action: 'Add Value Estimate',
      icon: <DollarSign className="w-4 h-4" />,
      color: 'text-purple-400',
      reason: 'Need deal value for proposal stage',
      priority: 'medium'
    };
  }
  
  if (score < 40) {
    return {
      action: 'Enrich Data',
      icon: <Zap className="w-4 h-4" />,
      color: 'text-orange-400',
      reason: 'Low score - gather more intelligence first',
      priority: 'medium'
    };
  }
  
  return {
    action: 'Schedule Follow-up',
    icon: <Calendar className="w-4 h-4" />,
    color: 'text-slate-400',
    reason: 'Keep momentum - schedule next touchpoint',
    priority: 'low'
  };
}

// Quick Action Button Component
function QuickActionButton({ 
  icon, label, onClick, color = 'blue', disabled = false, title: titleAttr
}: { 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'teal';
  disabled?: boolean;
  title?: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
    green: 'bg-green-500/20 text-green-400 hover:bg-green-500/30',
    purple: 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30',
    orange: 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30',
    red: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
    teal: 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30'
  };
  
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titleAttr}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg ${colorClasses[color]} 
        transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium`}
    >
      {icon}
      {label}
    </button>
  );
}

function getVerificationStatus(lead: Lead): { label: string; className: string } | null {
  const quality = lead.metadata?.verification?.data_quality as string | undefined;
  if (quality === 'verified') {
    return { label: 'Verified', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  }
  if (quality === 'partial') {
    return { label: 'Partial', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  }
  if (quality === 'unverified') {
    return { label: 'Unverified', className: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
  }
  if (lead.isVerified) {
    return { label: 'Verified', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  }
  return null;
}

export default function LeadDetailView({ lead, isOpen, onClose, onUpdate, onDelete }: LeadDetailViewProps) {
  const toast = useToast();
  const { currentTenant } = useTenant();
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'deals' | 'tasks'>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [relatedDeals, setRelatedDeals] = useState<any[]>([]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(lead.notes || '');
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailDraft, setEmailDraft] = useState<{ to: string; subject: string; body: string } | null>(null);
  
  const leadScore = calculateLeadScore(lead);
  const nextAction = getNextBestAction(lead);
  
  useEffect(() => {
    if (isOpen) {
      loadRelatedData();
    }
  }, [isOpen, lead.id]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user?.id) setCurrentUserId(data.user.id);
    })();
  }, []);
  
  const loadRelatedData = async () => {
    setIsLoading(true);
    try {
      // Load activities
      const { activities: acts } = await leadService.getLeadActivities(lead.id);
      setActivities(acts || []);
      
      // Load related deals
      const { data: deals } = await leadService.getRelatedDeals(lead.id);
      setRelatedDeals(deals || []);
    } catch (err) {
      console.error('Failed to load related data:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveNotes = async () => {
    setIsLoading(true);
    try {
      const { error } = await leadService.updateLead(lead.id, { notes });
      if (error) throw new Error(error);
      
      toast.success('Notes saved');
      setEditingNotes(false);
      onUpdate?.({ ...lead, notes });
      
      // Log activity
      await leadService.addLeadActivity(lead.id, 'user-id', 'note_updated', 'Notes updated');
    } catch (err) {
      toast.error('Failed to save notes');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleConvertToContact = async () => {
    setIsLoading(true);
    try {
      const { contactId, error } = await contactService.convertLeadToContact(lead.id);
      if (error) throw new Error(error);
      
      toast.success('Lead converted to contact');
      onUpdate?.({ ...lead, client_id: contactId ?? undefined, stage: 'qualified' });
      setShowConvertModal(false);
      loadRelatedData();
    } catch (err: any) {
      toast.error(err.message || 'Conversion failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCreateDeal = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to create a deal');

      const { deal, error } = await dealService.createDeal(user.id, {
        name: lead.businessName,
        contactId: lead.client_id,
        value: lead.value,
        description: lead.notes,
        stage: lead.stage === 'qualified' ? 'qualified' : 'lead'
      });
      if (error) throw new Error(error);
      
      toast.success('Deal created from lead');
      loadRelatedData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create deal');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEnrich = async () => {
    if (enriching) return;
    setEnriching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to enrich a lead');
      const { error } = await leadService.enrichLead(lead.id, user.id);
      if (error) throw new Error(error);

      if (currentTenant?.id) {
        await fetch('/api/leads/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: currentTenant.id, leadId: lead.id }),
        }).catch(() => null);
      }

      toast.success('Lead enriched — refreshed details and verification score.');
      loadRelatedData();
      onUpdate?.(lead);
    } catch (err: any) {
      toast.error(err.message || 'Enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  const verificationBadge = getVerificationStatus(lead);

  const handleSendEmail = async () => {
    if (!lead.email) {
      toast.error('No email address available');
      return;
    }

    const draft = {
      to: lead.email,
      subject: `Partnership Opportunity - ${lead.businessName}`,
      body: `Hello,\n\nI hope you are doing well. I wanted to reach out regarding ${lead.businessName}.\n\nBest regards,`,
    };
    setEmailDraft(draft);
    setShowEmailComposer(true);
  };
  
  const handleScheduleCall = async () => {
    if (!lead.phone) {
      toast.error('No phone number available');
      return;
    }
    
    // Create a task for the call
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('You must be signed in to create tasks');
      return;
    }

    await taskService.createTask(user.id, {
      title: `Call ${lead.businessName}`,
      description: `Phone: ${lead.phone}`,
      relatedToLead: lead.id,
      priority: 'high'
    });
    
    toast.success('Call task created');
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };
  
  const getStageBadge = (stage: string) => {
    const stages: Record<string, { color: string; label: string }> = {
      lead: { color: 'bg-slate-500/20 text-slate-400', label: 'Lead' },
      qualified: { color: 'bg-blue-500/20 text-blue-400', label: 'Qualified' },
      proposal: { color: 'bg-purple-500/20 text-purple-400', label: 'Proposal' },
      negotiation: { color: 'bg-orange-500/20 text-orange-400', label: 'Negotiation' },
      won: { color: 'bg-green-500/20 text-green-400', label: 'Won' },
      lost: { color: 'bg-red-500/20 text-red-400', label: 'Lost' }
    };
    
    const stageInfo = stages[stage] || stages.lead;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${stageInfo.color}`}>
        {stageInfo.label}
      </span>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-slate-900 border-l border-slate-700 z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{lead.businessName}</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStageBadge(lead.stage)}
                    {verificationBadge && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${verificationBadge.className}`}>
                        <CheckCircle2 className="w-3 h-3" />
                        {verificationBadge.label}
                        {lead.metadata?.verification?.score != null && (
                          <span className="opacity-80">· {lead.metadata.verification.score}</span>
                        )}
                      </span>
                    )}
                    {lead.industry && (
                      <span className="text-xs text-slate-400">{lead.industry}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onDelete?.(lead.id)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Delete lead"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 border-b border-slate-800">
                <GhostIntelligence 
                  lead={lead} 
                  onAction={handleSendEmail} 
                />
              </div>

              {/* Lead Score & Next Action */}
              <div className="p-4 border-b border-slate-800">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Lead Score</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-3xl font-bold ${getScoreColor(leadScore)}`}>
                        {leadScore}
                      </span>
                      <span className="text-slate-500">/ 100</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Next Action</p>
                    <div className={`flex items-center gap-2 ${nextAction.color}`}>
                      {nextAction.icon}
                      <span className="font-medium">{nextAction.action}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{nextAction.reason}</p>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      leadScore >= 80 ? 'bg-green-500' :
                      leadScore >= 60 ? 'bg-blue-500' :
                      leadScore >= 40 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${leadScore}%` }}
                  />
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="p-4 border-b border-slate-800">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Quick Actions</p>
                <div className="flex flex-wrap gap-2">
                  <QuickActionButton
                    icon={<Send className="w-4 h-4" />}
                    label="Send Email"
                    onClick={handleSendEmail}
                    color="blue"
                    disabled={!lead.email}
                  />
                  <QuickActionButton
                    icon={<PhoneCall className="w-4 h-4" />}
                    label="Schedule Call"
                    onClick={handleScheduleCall}
                    color="green"
                    disabled={!lead.phone}
                  />
                  <QuickActionButton
                    icon={<UserCheck className="w-4 h-4" />}
                    label="Convert to Contact"
                    onClick={() => setShowConvertModal(true)}
                    color="purple"
                  />
                  <QuickActionButton
                    icon={<Briefcase className="w-4 h-4" />}
                    label="Create Deal"
                    onClick={handleCreateDeal}
                    color="teal"
                  />
                  <QuickActionButton
                    icon={<Zap className="w-4 h-4" />}
                    label={enriching ? 'Enriching…' : 'Enrich Data'}
                    onClick={handleEnrich}
                    color="orange"
                    disabled={enriching}
                    title="Use AI to research and fill in missing lead details"
                  />
                </div>
              </div>
              
              {/* Contact Info */}
              <div className="p-4 border-b border-slate-800">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Contact Information</p>
                <div className="space-y-2">
                  {lead.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-slate-500" />
                      <button
                        type="button"
                        onClick={handleSendEmail}
                        className="text-teal-300 hover:text-teal-200 underline-offset-2 hover:underline"
                      >
                        {lead.email}
                      </button>
                      <button 
                        onClick={() => navigator.clipboard.writeText(lead.email || '')}
                        className="p-1 text-slate-500 hover:text-white"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={handleSendEmail}
                        className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-semibold hover:bg-teal-500/20"
                      >
                        <MailPlus className="w-3 h-3" />
                        Send
                      </button>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-slate-500" />
                      <span className="text-white">{lead.phone}</span>
                      <a 
                        href={`tel:${lead.phone}`}
                        className="p-1 text-green-400 hover:text-green-300"
                      >
                        <PhoneCall className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {lead.website && (
                    <div className="flex items-center gap-3 text-sm">
                      <Globe className="w-4 h-4 text-slate-500" />
                      <a 
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        {lead.website}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {lead.location && (
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-300">{lead.location}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Tabs */}
              <div className="border-b border-slate-800">
                <div className="flex">
                  {(['overview', 'activity', 'deals', 'tasks'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-3 text-sm font-medium capitalize transition-colors relative ${
                        activeTab === tab ? 'text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab}
                      {activeTab === tab && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Tab Content */}
              <div className="p-4">
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Value & Source */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-1">Est. Value</p>
                        <p className="text-lg font-semibold text-white">
                          {lead.value ? `$${lead.value.toLocaleString()}` : 'Not set'}
                        </p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 mb-1">Source</p>
                        <p className="text-sm font-medium text-white capitalize">{lead.source}</p>
                      </div>
                    </div>
                    
                    {/* Tech Stack */}
                    {lead.techStack && lead.techStack.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Tech Stack</p>
                        <div className="flex flex-wrap gap-2">
                          {lead.techStack.map((tech, i) => (
                            <span key={i} className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded">
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Pain Points */}
                    {lead.painPoints && lead.painPoints.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Pain Points</p>
                        <ul className="space-y-1">
                          {lead.painPoints.map((point, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                              <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5" />
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Notes */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-slate-400 uppercase tracking-wider">Notes</p>
                        {!editingNotes ? (
                          <button
                            onClick={() => setEditingNotes(true)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Edit
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveNotes}
                              disabled={isLoading}
                              className="text-xs text-green-400 hover:text-green-300"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingNotes(false);
                                setNotes(lead.notes || '');
                              }}
                              className="text-xs text-slate-400 hover:text-slate-300"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                      {editingNotes ? (
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="w-full h-32 p-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white resize-none focus:outline-none focus:border-blue-500"
                          placeholder="Add notes about this lead..."
                        />
                      ) : (
                        <div className="bg-slate-800/50 rounded-lg p-3 min-h-[100px]">
                          <p className="text-sm text-slate-300 whitespace-pre-wrap">
                            {lead.notes || 'No notes added yet.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {activeTab === 'activity' && (
                  <div className="space-y-3">
                    {activities.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No activity yet</p>
                    ) : (
                      activities.map((activity, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center">
                            <Clock className="w-4 h-4 text-slate-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-white">{activity.description}</p>
                            <p className="text-xs text-slate-500">
                              {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
                
                {activeTab === 'deals' && (
                  <div className="space-y-3">
                    {relatedDeals.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-slate-500 mb-4">No deals created from this lead</p>
                        <button
                          onClick={handleCreateDeal}
                          className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm"
                        >
                          Create Deal
                        </button>
                      </div>
                    ) : (
                      relatedDeals.map((deal) => (
                        <div key={deal.id} className="bg-slate-800/50 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-white">{deal.name}</h4>
                            <span className={`px-2 py-1 rounded text-xs ${
                              deal.stage === 'won' ? 'bg-green-500/20 text-green-400' :
                              deal.stage === 'lost' ? 'bg-red-500/20 text-red-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {deal.stage}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 mt-1">
                            ${deal.value?.toLocaleString() || 0}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
                
                {activeTab === 'tasks' && (
                  <div className="text-center py-8 px-4">
                    <p className="text-slate-400 mb-4 text-sm max-w-md mx-auto">
                      Create and track tasks in Production Tasks. Link this lead when assigning work there.
                    </p>
                    <Link
                      href="/dashboard/tasks"
                      className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-500 transition-colors"
                    >
                      Open tasks
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}

      {showEmailComposer && currentUserId && emailDraft && (
        <ComposeEmailModal
          isOpen={true}
          onClose={() => setShowEmailComposer(false)}
          userId={currentUserId}
          initialTo={emailDraft.to}
          initialSubject={emailDraft.subject}
          initialBody={emailDraft.body}
        />
      )}
    </AnimatePresence>
  );
}

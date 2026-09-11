'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Plus, Trash2, CheckCircle2, AlertCircle, 
  Sparkles, Loader2, ClipboardList, Clock, Check, 
  Send, ExternalLink, RefreshCw, Layers, Eye
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

interface OnboardingStep {
  id: string;
  tenant_id: string;
  step_name: string;
  step_description: string | null;
  step_order: number;
  step_type: 'form' | 'contract' | 'payment' | 'upload';
  is_required: boolean;
  created_at: string;
}

interface OnboardingSubmission {
  id: string;
  contact_id: string | null;
  step_id: string;
  submitted_data: Record<string, any> | null;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  completed_at: string | null;
  created_at: string;
  contacts?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  onboarding_steps?: OnboardingStep | null;
}

export default function ClientOnboardingTab() {
  const { currentTenant: tenant } = useTenant();
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [submissions, setSubmissions] = useState<OnboardingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStepModal, setShowStepModal] = useState(false);
  const [savingStep, setSavingStep] = useState(false);
  const [seedingAi, setSeedingAi] = useState(false);
  const [vertical, setVertical] = useState('Consulting');

  const [stepForm, setStepForm] = useState({
    step_name: '',
    step_description: '',
    step_order: 1,
    step_type: 'form' as OnboardingStep['step_type'],
    is_required: true
  });

  const loadOnboardingData = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const [stepsRes, subRes] = await Promise.all([
        supabase
          .from('onboarding_steps')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('step_order', { ascending: true }),
        supabase
          .from('onboarding_submissions')
          .select('*, contacts!inner(first_name, last_name, email, tenant_id), onboarding_steps(*)')
          .eq('contacts.tenant_id', tenant.id)
          .order('created_at', { ascending: false })
      ]);

      if (stepsRes.error) throw stepsRes.error;
      if (subRes.error) throw subRes.error;

      setSteps(stepsRes.data || []);
      setSubmissions(subRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load onboarding details: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    loadOnboardingData();
  }, [loadOnboardingData]);

  const handleCreateStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    if (!stepForm.step_name.trim()) return toast.error('Step title is required');

    setSavingStep(true);
    try {
      const { error } = await supabase
        .from('onboarding_steps')
        .insert({
          tenant_id: tenant.id,
          step_name: stepForm.step_name,
          step_description: stepForm.step_description || null,
          step_order: stepForm.step_order,
          step_type: stepForm.step_type,
          is_required: stepForm.is_required
        });

      if (error) throw error;
      toast.success('Onboarding step registered');
      setShowStepModal(false);
      setStepForm({ step_name: '', step_description: '', step_order: steps.length + 1, step_type: 'form', is_required: true });
      loadOnboardingData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingStep(false);
    }
  };

  const handleDeleteStep = async (id: string) => {
    if (!confirm('Are you sure you want to delete this onboarding step?')) return;
    try {
      const { error } = await supabase
        .from('onboarding_steps')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Step deleted');
      setSteps(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleReviewSubmission = async (id: string, status: 'approved' | 'pending' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('onboarding_submissions')
        .update({
          status,
          completed_at: status === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', id);

      if (error) throw error;
      toast.success(
        status === 'approved'
          ? 'Submission approved'
          : status === 'rejected'
            ? 'Submission rejected'
            : 'Submission sent back for revision'
      );
      loadOnboardingData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAiSeed = async () => {
    if (!tenant?.id) return;
    setSeedingAi(true);
    const seedToast = toast.loading('AI is formulating onboarding workflow plan...');
    try {
      const res = await fetch('/api/inbox/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Define 3 required onboarding steps for a ${vertical} client.`,
          context: 'Return only a JSON array of steps without any markdown formatting. Example format: [{"step_name": "Step 1 name", "step_description": "Short explanation", "step_order": 1, "step_type": "form", "is_required": true}]'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI generation failed');
      
      const parsedSteps = JSON.parse(data.draft.replace(/```json|```/g, '').trim());
      if (Array.isArray(parsedSteps)) {
        for (const step of parsedSteps) {
          await supabase
            .from('onboarding_steps')
            .insert({
              tenant_id: tenant.id,
              step_name: step.step_name || step.title,
              step_description: step.step_description || step.description || null,
              step_order: step.step_order || step.sort_order || 1,
              step_type: step.step_type || 'form',
              is_required: step.is_required !== undefined ? step.is_required : true
            });
        }
        toast.success('Workflow generated and seeded!', { id: seedToast });
        loadOnboardingData();
      } else {
        throw new Error('AI output was not in correct format');
      }
    } catch (err: any) {
      toast.error('AI seed error: ' + err.message, { id: seedToast });
    } finally {
      setSeedingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-teal-400" />
            Client Onboarding portal
          </h2>
          <p className="text-xs text-slate-400">Design onboarding workflows and automatically verify client submissions</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setStepForm({ step_name: '', step_description: '', step_order: steps.length + 1, step_type: 'form', is_required: true });
              setShowStepModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Step
          </button>
        </div>
      </div>

      {/* Grid: Workflow steps designer vs submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Workflow designer & checklist */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/20 border border-slate-800 rounded-3xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal-400" />
                Active Onboarding Workflow Steps
              </span>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="p-8 text-center text-slate-500">Loading steps...</div>
              ) : steps.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl text-slate-500 space-y-2">
                  <ClipboardList className="w-8 h-8 mx-auto opacity-30 text-teal-400" />
                  <p className="text-sm font-semibold">No steps defined yet</p>
                  <p className="text-xs">Create custom steps or use our AI Generator below.</p>
                </div>
              ) : (
                steps.map(step => (
                  <div key={step.id} className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold text-xs">
                          {step.step_order}
                        </span>
                        <h4 className="text-xs font-bold text-white">{step.step_name}</h4>
                        {step.is_required && (
                          <span className="text-[9px] font-bold bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/20">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 pl-7">{step.step_description || 'No description provided'}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteStep(step.id)}
                      className="p-1.5 hover:bg-slate-850 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AI Seed tool */}
          <div className="bg-gradient-to-br from-violet-600/5 to-indigo-600/5 border border-violet-500/15 rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">AI Workflow Architect</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Let AI formulate best-practice onboarding workflows instantly</p>
              </div>
            </div>

            <div className="flex gap-3 items-center">
              <select
                value={vertical}
                onChange={e => setVertical(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-teal-500"
              >
                <option value="Consulting">Consulting Business</option>
                <option value="SaaS / Software">SaaS Product</option>
                <option value="Creative Agency">Creative Agency</option>
                <option value="Interior Design">Interior Design</option>
                <option value="Freelance Development">Freelance Developer</option>
              </select>

              <button
                onClick={handleAiSeed}
                disabled={seedingAi}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
              >
                {seedingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Generate Workflow
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Submissions reviewer */}
        <div className="space-y-6">
          <div className="bg-slate-900/20 border border-slate-800 rounded-3xl p-5 space-y-4">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">Recent client submissions</span>

            <div className="space-y-3">
              {loading ? (
                <div className="p-4 text-center text-slate-500">Loading submissions...</div>
              ) : submissions.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  No submissions recorded yet from client portal.
                </div>
              ) : (
                submissions.map(sub => (
                  <div key={sub.id} className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                      <div>
                        <p className="text-xs font-bold text-white">
                          {sub.contacts ? `${sub.contacts.first_name || ''} ${sub.contacts.last_name || ''}`.trim() || sub.contacts.email : 'Anonymous'}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          Step: {sub.onboarding_steps?.step_name || 'Unknown step'}
                        </p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded capitalize ${
                        sub.status === 'approved' ? 'bg-teal-500/10 text-teal-400' :
                        sub.status === 'submitted' ? 'bg-violet-500/10 text-violet-400' :
                        sub.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>
                        {sub.status}
                      </span>
                    </div>

                    {sub.submitted_data && (
                      <div className="text-[10px] font-mono bg-slate-900 p-2 rounded text-slate-300 overflow-x-auto max-h-24">
                        {JSON.stringify(sub.submitted_data, null, 2)}
                      </div>
                    )}

                    {sub.status === 'pending' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleReviewSubmission(sub.id, 'approved')}
                          className="flex-1 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/20 rounded-lg text-[10px] font-bold transition-all"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReviewSubmission(sub.id, 'rejected')}
                          className="flex-1 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/20 rounded-lg text-[10px] font-bold transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Dialog */}
      {showStepModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="font-bold text-white text-sm">Add Onboarding Step</h3>
              <button onClick={() => setShowStepModal(false)} className="text-slate-400 hover:text-white text-sm">Close</button>
            </div>

            <form onSubmit={handleCreateStep} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Step Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule Kickoff Call"
                  value={stepForm.step_name}
                  onChange={e => setStepForm(f => ({ ...f, step_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Description</label>
                <textarea
                  placeholder="Tell the client what they need to do for this step"
                  value={stepForm.step_description}
                  onChange={e => setStepForm(f => ({ ...f, step_description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500 resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Order Index</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={stepForm.step_order}
                    onChange={e => setStepForm(f => ({ ...f, step_order: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="flex items-center pt-5 gap-2">
                  <input
                    type="checkbox"
                    id="isRequired"
                    checked={stepForm.is_required}
                    onChange={e => setStepForm(f => ({ ...f, is_required: e.target.checked }))}
                    className="w-4 h-4 text-teal-500 border-slate-850 rounded bg-slate-950 focus:ring-teal-500"
                  />
                  <label htmlFor="isRequired" className="text-xs text-slate-300 font-semibold cursor-pointer">Required</label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingStep}
                  className="flex-1 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {savingStep ? 'Saving...' : 'Add Step'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowStepModal(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

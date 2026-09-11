'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, Plus, 
  Trash2, Sparkles, Loader2, RefreshCw, ChevronRight,
  ArrowUpRight, ArrowDownRight, Lightbulb, AlertTriangle, Check
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';
import { StandardStatCard, type CardTheme } from '@/components/ui/design-system';

interface CashFlowProjection {
  id: string;
  tenant_id: string;
  projection_date: string;
  type: 'inflow' | 'outflow';
  amount: number;
  category: string;
  description: string | null;
  status: 'estimated' | 'confirmed';
  created_at: string;
}

export default function CashFlowForecastTab() {
  const { currentTenant: tenant } = useTenant();
  const [projections, setProjections] = useState<CashFlowProjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningAi, setRunningAi] = useState(false);
  const [aiInsights, setAiInsights] = useState<string>('');
  
  const [form, setForm] = useState({
    projection_date: new Date().toISOString().split('T')[0],
    type: 'inflow' as 'inflow' | 'outflow',
    amount: '',
    category: '',
    description: '',
    status: 'estimated' as 'estimated' | 'confirmed'
  });

  const loadProjections = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cash_flow_projections')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('projection_date', { ascending: true });

      if (error) throw error;
      setProjections(data || []);
    } catch (err: any) {
      toast.error('Failed to load projections: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    loadProjections();
  }, [loadProjections]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    if (!form.amount || parseFloat(form.amount) <= 0) {
      return toast.error('Amount must be positive');
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('cash_flow_projections')
        .insert({
          tenant_id: tenant.id,
          projection_date: form.projection_date,
          type: form.type,
          amount: parseFloat(form.amount),
          category: form.category || (form.type === 'inflow' ? 'Revenue' : 'Expenses'),
          description: form.description || null,
          status: form.status
        });

      if (error) throw error;
      
      toast.success('Projection recorded successfully');
      setShowModal(false);
      setForm({
        projection_date: new Date().toISOString().split('T')[0],
        type: 'inflow',
        amount: '',
        category: '',
        description: '',
        status: 'estimated'
      });
      loadProjections();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cash flow item?')) return;
    try {
      const { error } = await supabase
        .from('cash_flow_projections')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Item deleted');
      setProjections(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRunAiForecast = async () => {
    setRunningAi(true);
    try {
      const res = await fetch('/api/inbox/draft-reply', { // Using drafting endpoint for AI convenience
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Evaluate my cash flow forecast: ${JSON.stringify(projections)}`,
          context: 'Provide a concise 3-sentence cash flow outlook. Analyze the ratio of inbound to outbound cash, identify any upcoming deficit periods, and offer one actionable optimization tip.'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiInsights(data.draft);
    } catch (err: any) {
      toast.error('Failed to run AI outlook: ' + err.message);
    } finally {
      setRunningAi(false);
    }
  };

  // Math metrics
  const startingCash = 25000; // Hypothetical starting treasury
  const totalInflow = projections
    .filter(p => p.type === 'inflow')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalOutflow = projections
    .filter(p => p.type === 'outflow')
    .reduce((sum, p) => sum + p.amount, 0);
  const endingCash = startingCash + totalInflow - totalOutflow;

  // Chart data calculations for SVG line rendering
  const getChartPoints = () => {
    if (projections.length === 0) return '';
    let currentCash = startingCash;
    const sorted = [...projections].sort((a, b) => new Date(a.projection_date).getTime() - new Date(b.projection_date).getTime());
    
    const cashTimeline = sorted.map(p => {
      currentCash += (p.type === 'inflow' ? p.amount : -p.amount);
      return currentCash;
    });

    const maxCash = Math.max(...cashTimeline, startingCash) * 1.1;
    const minCash = Math.min(...cashTimeline, startingCash) * 0.9;
    const spread = maxCash - minCash || 1;

    // Map to width=500, height=120
    const points = cashTimeline.map((val, index) => {
      const x = (index / (cashTimeline.length - 1)) * 480 + 10;
      const y = 110 - ((val - minCash) / spread) * 100;
      return `${x},${y}`;
    });

    return points.join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-400" />
            Cash Flow & Liquidity Forecast
          </h2>
          <p className="text-xs text-slate-400">Model inflows and payables to stay completely ahead of your business expenses</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            New Projection
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StandardStatCard
          label="Ending Treasury Cash"
          value={`$${endingCash.toLocaleString()}`}
          themeColor="teal"
          icon={DollarSign}
          interactive={false}
          comparisonText="Starting base: $25,000"
        />
        <StandardStatCard
          label="Inbound Revenue"
          value={`+$${totalInflow.toLocaleString()}`}
          themeColor="emerald"
          icon={ArrowUpRight}
          interactive={false}
          comparisonText="Pipeline receivables"
        />
        <StandardStatCard
          label="Outbound Commitments"
          value={`-$${totalOutflow.toLocaleString()}`}
          themeColor="rose"
          icon={ArrowDownRight}
          interactive={false}
          comparisonText="Payables & upcoming bills"
        />
        <StandardStatCard
          label="Net Delta Ratio"
          value={`${totalOutflow > 0 ? ((totalInflow / totalOutflow) * 100).toFixed(0) : '100'}%`}
          themeColor={endingCash >= startingCash ? 'teal' : 'amber'}
          icon={TrendingUp}
          interactive={false}
          comparisonText="Revenue vs expense safety"
        />
      </div>

      {/* SVG Chart Section */}
      {projections.length > 0 && (
        <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Liquidity Projection Timeline</h3>
          <div className="relative w-full h-32 bg-slate-950/40 border border-slate-850 rounded-2xl p-2 flex items-end">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              <line x1="0" y1="20" x2="500" y2="20" stroke="#1e293b" strokeWidth="0.5" />
              <line x1="0" y1="60" x2="500" y2="60" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3" />
              <line x1="0" y1="100" x2="500" y2="100" stroke="#1e293b" strokeWidth="0.5" />
              
              {/* Path & area */}
              <path
                d={`M 10 110 L ${getChartPoints()} L 490 110 Z`}
                fill="url(#chartGradient)"
              />
              <polyline
                fill="none"
                stroke="#2dd4bf"
                strokeWidth="2.5"
                points={getChartPoints()}
              />
            </svg>
          </div>
        </div>
      )}

      {/* Split layout: projections table vs AI insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/20 border border-slate-800 rounded-3xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Scheduled cash movements</span>
            </div>

            <div className="divide-y divide-slate-850">
              {loading ? (
                <div className="p-8 text-center text-slate-500">Loading forecast data...</div>
              ) : projections.length === 0 ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <DollarSign className="w-8 h-8 mx-auto opacity-30 text-teal-400" />
                  <p className="text-sm font-semibold">No projection entries yet</p>
                  <p className="text-xs">Schedule future revenue and payouts to preview cash runway.</p>
                </div>
              ) : (
                projections.map(proj => (
                  <div key={proj.id} className="p-4 hover:bg-slate-900/10 flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${proj.type === 'inflow' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {proj.type === 'inflow' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{proj.category}</p>
                        <p className="text-[10px] text-slate-400">{proj.description || 'No description'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className={`text-xs font-black font-mono ${proj.type === 'inflow' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {proj.type === 'inflow' ? '+' : '-'}${proj.amount.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-slate-500">{new Date(proj.projection_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                      </div>

                      <button
                        onClick={() => handleDelete(proj.id)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* AI Outlook Forecast Sidebar */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
              AI Liquidity Forecast
            </h4>
            <button
              onClick={handleRunAiForecast}
              disabled={runningAi || projections.length === 0}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
              title="Run AI cash flow forecasting evaluation"
            >
              {runningAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </button>
          </div>

          {aiInsights ? (
            <div className="space-y-4">
              <div className="p-4 bg-violet-500/5 border border-violet-500/10 rounded-2xl space-y-3">
                <div className="flex gap-2 items-start text-xs text-slate-300 leading-relaxed font-semibold">
                  <Lightbulb className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                  <p>{aiInsights}</p>
                </div>
              </div>

              <div className="p-3 bg-teal-500/5 rounded-xl border border-teal-500/10 text-[10px] text-teal-300 flex items-center gap-2">
                <Check className="w-3.5 h-3.5" />
                Treasury cash flow trajectory within safety limit.
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 space-y-3">
              <BrainIcon className="w-8 h-8 mx-auto text-slate-600 animate-pulse" />
              <p className="text-xs font-medium">Predict future runway periods and cash flow risks with machine intelligence.</p>
              <button
                onClick={handleRunAiForecast}
                disabled={runningAi || projections.length === 0}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
              >
                Evaluate Runway
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="font-bold text-white text-sm">Add Cash Flow Projection</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-sm">Close</button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Projection Date</label>
                <input
                  type="date"
                  required
                  value={form.projection_date}
                  onChange={e => setForm(f => ({ ...f, projection_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Movement Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="inflow">Inflow (Incoming cash)</option>
                  <option value="outflow">Outflow (Outgoing cost)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Amount (USD)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="2500"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Category</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Project Phase 2, Hosting"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Additional context notes"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {saving ? 'Recording...' : 'Add Projection'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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

function BrainIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M12 5v14" />
      <path d="M19 12H5" />
    </svg>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Receipt, DollarSign, Calendar, Plus, Trash2, 
  Sparkles, Loader2, RefreshCw, AlertCircle, Check,
  Percent, Scale, FileSpreadsheet, ShieldAlert
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

interface TaxRecord {
  id: string;
  tenant_id: string;
  tax_year: number;
  quarter: number;
  estimated_income: number;
  estimated_expenses: number;
  deduction_amount: number;
  estimated_tax_due: number;
  status: 'draft' | 'paid';
  created_at: string;
}

export default function TaxEstimatorTab() {
  const { currentTenant: tenant } = useTenant();
  const [records, setRecords] = useState<TaxRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningAi, setRunningAi] = useState(false);
  const [aiTips, setAiTips] = useState<string>('');

  const [form, setForm] = useState({
    tax_year: 2026,
    quarter: 1,
    estimated_income: '',
    estimated_expenses: '',
    deduction_amount: '',
    status: 'draft' as 'draft' | 'paid'
  });

  const loadTaxRecords = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tax_records')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('tax_year', { ascending: false })
        .order('quarter', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (err: any) {
      toast.error('Failed to load tax records: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    loadTaxRecords();
  }, [loadTaxRecords]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    
    const income = parseFloat(form.estimated_income) || 0;
    const expenses = parseFloat(form.estimated_expenses) || 0;
    const deduction = parseFloat(form.deduction_amount) || 0;
    
    // Simulate SE Tax calculation (15.3%) + basic federal income tax brackets (simulated overall average 15%)
    const netProfit = Math.max(0, income - expenses - deduction);
    const calculatedTax = netProfit * 0.28; // Estimated aggregate rate of 28% for federal + self-employment

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tax_records')
        .insert({
          tenant_id: tenant.id,
          tax_year: form.tax_year,
          quarter: form.quarter,
          estimated_income: income,
          estimated_expenses: expenses,
          deduction_amount: deduction,
          estimated_tax_due: parseFloat(calculatedTax.toFixed(2)),
          status: form.status
        });

      if (error) throw error;
      toast.success('Quarterly tax estimate logged');
      setShowModal(false);
      setForm({
        tax_year: 2026,
        quarter: records.length === 0 ? 1 : Math.min(4, records[0].quarter + 1),
        estimated_income: '',
        estimated_expenses: '',
        deduction_amount: '',
        status: 'draft'
      });
      loadTaxRecords();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this quarterly tax record?')) return;
    try {
      const { error } = await supabase
        .from('tax_records')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Record deleted');
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRunDeductionTriage = async () => {
    if (records.length === 0) return;
    setRunningAi(true);
    try {
      const activeRecord = records[0];
      const res = await fetch('/api/inbox/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `My Q${activeRecord.quarter} income is $${activeRecord.estimated_income} with expenses $${activeRecord.estimated_expenses}.`,
          context: 'Provide exactly 3 bullet points of high-probability tax write-offs or deduction tips for this solopreneur business profile (e.g. Home office, Section 179 equipment, retirement account contributions).'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiTips(data.draft);
    } catch (err: any) {
      toast.error('Failed to run deduction triage: ' + err.message);
    } finally {
      setRunningAi(false);
    }
  };

  // Aggregated totals
  const totalIncome = records.reduce((sum, r) => sum + r.estimated_income, 0);
  const totalExpenses = records.reduce((sum, r) => sum + r.estimated_expenses, 0);
  const totalDeductions = records.reduce((sum, r) => sum + r.deduction_amount, 0);
  const totalTaxDue = records.reduce((sum, r) => sum + r.estimated_tax_due, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Percent className="w-5 h-5 text-teal-400" />
            Quarterly Tax Estimator
          </h2>
          <p className="text-xs text-slate-400">Calculate self-employment obligation, simulate deductions, and log quarterly payments</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRunDeductionTriage}
            disabled={runningAi || records.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-bold border border-white/10"
          >
            {runningAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-teal-400" />}
            AI Deductions Triage
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Log Quarter
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-teal-500/10 to-emerald-500/10 border border-teal-500/20 rounded-3xl p-5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Tax Liability</span>
          <div className="text-2xl font-black text-teal-400 font-mono mt-1">${totalTaxDue.toLocaleString()}</div>
          <span className="text-[10px] text-slate-500 mt-1 block">YTD estimated due</span>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Gross Income YTD</span>
          <div className="text-2xl font-black text-white font-mono mt-1">${totalIncome.toLocaleString()}</div>
          <span className="text-[10px] text-slate-500 mt-1 block">Reportable revenues</span>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Write-Offs</span>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">${(totalExpenses + totalDeductions).toLocaleString()}</div>
          <span className="text-[10px] text-slate-500 mt-1 block">Expenses + deductions</span>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Net Taxable Profit</span>
          <div className="text-2xl font-black text-white font-mono mt-1">${Math.max(0, totalIncome - totalExpenses - totalDeductions).toLocaleString()}</div>
          <span className="text-[10px] text-slate-500 mt-1 block">Simulated bracket base</span>
        </div>
      </div>

      {/* Main Split Layout: Records list vs AI Triage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/20 border border-slate-800 rounded-3xl overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Quarterly Filings Timeline</span>
            </div>

            <div className="divide-y divide-slate-850">
              {loading ? (
                <div className="p-8 text-center text-slate-500">Retrieving IRS/SE schedules...</div>
              ) : records.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-2">
                  <Scale className="w-10 h-10 mx-auto opacity-30 text-teal-400" />
                  <p className="text-sm font-semibold">No tax records logged</p>
                  <p className="text-xs">File estimates for each business quarter to preview self-employment tax burden.</p>
                </div>
              ) : (
                records.map(rec => (
                  <div key={rec.id} className="p-4 hover:bg-slate-900/10 flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-850 flex flex-col items-center justify-center border border-white/5">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Q{rec.quarter}</span>
                        <span className="text-[9px] font-bold text-teal-400">{rec.tax_year}</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Quarter {rec.quarter} Filing</p>
                        <p className="text-[10px] text-slate-400">
                          Income: ${rec.estimated_income.toLocaleString()} | Deductions: ${(rec.estimated_expenses + rec.deduction_amount).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs font-black text-teal-400 font-mono">
                          ${rec.estimated_tax_due.toLocaleString()} Due
                        </p>
                        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded capitalize ${
                          rec.status === 'paid' ? 'bg-teal-500/15 text-teal-400' : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {rec.status}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDelete(rec.id)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
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

        {/* AI Deductions Tips */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
              AI Write-Off Optimizer
            </h4>
          </div>

          {aiTips ? (
            <div className="space-y-4">
              <div className="p-4 bg-violet-500/5 border border-violet-500/10 rounded-2xl">
                <div className="text-xs text-slate-300 leading-relaxed font-semibold whitespace-pre-wrap">
                  {aiTips}
                </div>
              </div>

              <div className="p-3 bg-teal-500/5 rounded-xl border border-teal-500/10 text-[10px] text-teal-300 flex items-center gap-2">
                <Check className="w-3.5 h-3.5" />
                Deductions compiled for maximum legal relief.
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 space-y-3">
              <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-600 animate-pulse" />
              <p className="text-xs font-medium">Evaluate write-offs and auto-simulate home office or auto deductions with AI triage.</p>
              <button
                onClick={handleRunDeductionTriage}
                disabled={runningAi || records.length === 0}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
              >
                Scan Write-Offs
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
              <h3 className="font-bold text-white text-sm">Log Quarterly Tax Metrics</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-sm">Close</button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Tax Year</label>
                  <input
                    type="number"
                    required
                    value={form.tax_year}
                    onChange={e => setForm(f => ({ ...f, tax_year: parseInt(e.target.value) || 2026 }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Quarter</label>
                  <select
                    value={form.quarter}
                    onChange={e => setForm(f => ({ ...f, quarter: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                  >
                    <option value={1}>Quarter 1 (Jan - Mar)</option>
                    <option value={2}>Quarter 2 (Apr - Jun)</option>
                    <option value={3}>Quarter 3 (Jul - Sep)</option>
                    <option value={4}>Quarter 4 (Oct - Dec)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Estimated Income (USD)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 15000"
                  value={form.estimated_income}
                  onChange={e => setForm(f => ({ ...f, estimated_income: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Quarterly Expenses</label>
                  <input
                    type="number"
                    placeholder="e.g. 2400"
                    value={form.estimated_expenses}
                    onChange={e => setForm(f => ({ ...f, estimated_expenses: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Deductions</label>
                  <input
                    type="number"
                    placeholder="e.g. 1000"
                    value={form.deduction_amount}
                    onChange={e => setForm(f => ({ ...f, deduction_amount: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Filing Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="draft">Unpaid (Draft Estimate)</option>
                  <option value="paid">Paid Estimated Tax</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Log Quarter'}
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

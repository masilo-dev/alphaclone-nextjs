'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, FileText, Archive, Download, PenLine, X, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User } from '../../types';
import toast from 'react-hot-toast';

type ContractStatus = 'draft' | 'sent' | 'signed' | 'expired' | 'pending_approval';

interface Contract {
  id: string; title: string; counterparty_name?: string; status: ContractStatus;
  created_at: string; signed_at?: string; tenant_id: string; version?: number; clauses?: string[];
}

const STATUS_COLORS: Record<ContractStatus, string> = {
  draft:            'bg-slate-500/15 text-slate-400 border-slate-500/20',
  sent:             'bg-blue-500/15 text-blue-400 border-blue-500/20',
  signed:           'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  expired:          'bg-red-500/15 text-red-400 border-red-500/20',
  pending_approval: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
};

const STAGE_STEPS: ContractStatus[] = ['draft', 'sent', 'pending_approval', 'signed'];

// ── Signature Pad Sheet ────────────────────────────────────────────────────────
const SignaturePadSheet: React.FC<{ onClose: () => void; onConfirm: (sig: string) => void }> = ({ onClose, onConfirm }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [typed, setTyped] = useState('');
  const [mode, setMode] = useState<'draw' | 'type'>('draw');

  const startDraw = (e: React.PointerEvent) => {
    drawing.current = true;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };
  const draw = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d')!;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineCap = 'round';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };
  const endDraw = () => { drawing.current = false; };
  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleConfirm = () => {
    const sig = mode === 'type' ? typed : (canvasRef.current?.toDataURL() || '');
    onConfirm(sig);
    onClose();
  };

  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="bg-slate-900 border-t border-white/10 rounded-t-3xl">
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 bg-slate-700 rounded-full" /></div>
        <div className="px-4 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-bold text-white">Sign Contract</h3>
            <div className="flex bg-slate-800 rounded-xl p-0.5">
              {(['draw', 'type'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 rounded-lg text-[13px] font-bold capitalize transition-all ${mode === m ? 'bg-teal-600 text-white' : 'text-slate-400'}`}>{m}</button>
              ))}
            </div>
          </div>

          {mode === 'draw' ? (
            <div className="bg-slate-800 rounded-2xl overflow-hidden border border-white/5">
              <canvas
                ref={canvasRef}
                width={360}
                height={160}
                className="w-full touch-none"
                onPointerDown={startDraw}
                onPointerMove={draw}
                onPointerUp={endDraw}
              />
            </div>
          ) : (
            <input value={typed} onChange={e => setTyped(e.target.value)} placeholder="Type your full name..."
              className="w-full bg-slate-800 border border-white/5 rounded-2xl px-4 py-3 text-[20px] text-teal-400 font-serif outline-none" />
          )}

          <div className="flex gap-2">
            <button onClick={clearCanvas} className="flex-1 h-12 bg-slate-800 rounded-xl text-[13px] font-bold text-slate-300">Clear</button>
            <button onClick={handleConfirm} className="flex-1 h-12 bg-teal-600 rounded-xl text-[13px] font-bold text-white">Confirm Signature</button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ── Contract Detail ────────────────────────────────────────────────────────────
const ContractDetail: React.FC<{ contract: Contract; onBack: () => void }> = ({ contract, onBack }) => {
  const [showSignPad, setShowSignPad] = useState(false);
  const [expandedClauses, setExpandedClauses] = useState<number[]>([]);
  const stepIdx = STAGE_STEPS.indexOf(contract.status);

  const toggleClause = (i: number) => setExpandedClauses(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"><ArrowLeft className="w-4 h-4 text-slate-300" /></button>
        <span className="text-[17px] font-bold text-white flex-1 truncate">{contract.title}</span>
        {contract.version && <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full">v{contract.version}</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-4">
        {/* Step indicator */}
        <div className="flex items-center justify-between bg-slate-900 border border-white/5 rounded-2xl px-4 py-3">
          {STAGE_STEPS.map((step, i) => (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${i <= stepIdx ? 'bg-teal-500 text-white' : 'bg-slate-800 text-slate-500'}`}>{i + 1}</div>
                <span className="text-[9px] text-slate-500 capitalize">{step.replace('_', ' ')}</span>
              </div>
              {i < STAGE_STEPS.length - 1 && <div className={`flex-1 h-px mx-1 ${i < stepIdx ? 'bg-teal-500' : 'bg-slate-800'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-3">
          {[{ label: 'Your Entity', role: 'Service Provider' }, { label: contract.counterparty_name || 'Counterparty', role: 'Client' }].map(p => (
            <div key={p.label} className="bg-slate-900 border border-white/5 rounded-2xl p-3 space-y-1">
              <div className="text-[13px] font-bold text-white truncate">{p.label}</div>
              <div className="text-[11px] text-slate-500">{p.role}</div>
            </div>
          ))}
        </div>

        {/* Clauses */}
        {(contract.clauses || ['Scope of Work', 'Payment Terms', 'Confidentiality', 'Termination']).map((clause, i) => (
          <div key={i} className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
            <button onClick={() => toggleClause(i)} className="w-full flex items-center justify-between px-4 py-3">
              <span className="text-[15px] text-white">{clause}</span>
              {expandedClauses.includes(i) ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            </button>
            <AnimatePresence>
              {expandedClauses.includes(i) && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <p className="px-4 pb-4 text-[15px] text-slate-400 leading-relaxed">This clause governs the {clause.toLowerCase()} terms of this agreement between both parties.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-white/5 pb-[env(safe-area-inset-bottom,0px)]">
        {contract.status !== 'signed' && (
          <button onClick={() => setShowSignPad(true)} className="w-full h-[52px] bg-teal-600 text-white font-black uppercase tracking-wider text-[13px] flex items-center justify-center gap-2">
            <PenLine className="w-5 h-5" /> Sign Contract
          </button>
        )}
        <div className="flex divide-x divide-white/5">
          {['Request Approval', 'Download PDF', 'Delete'].map(lbl => (
            <button key={lbl} className={`flex-1 py-3 text-[11px] font-bold hover:bg-white/5 transition-colors ${lbl === 'Delete' ? 'text-red-400' : 'text-slate-400'}`}>{lbl}</button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showSignPad && <SignaturePadSheet onClose={() => setShowSignPad(false)} onConfirm={(sig) => { toast.success('Contract signed!'); }} />}
      </AnimatePresence>
    </div>
  );
};

interface ContractRowProps {
  contract: Contract;
  onSelect: (c: Contract) => void;
  onArchive: (id: string) => void;
}

const ContractRow: React.FC<ContractRowProps> = ({ contract, onSelect, onArchive }) => {
  const x = useMotionValue(0);
  const rOp = useTransform(x, [-80, 0], [1, 0]);

  return (
    <div className="relative overflow-hidden">
      <motion.div style={{ opacity: rOp }} className="absolute inset-y-0 right-0 w-20 bg-slate-700 flex items-center justify-center z-0">
        <Archive className="w-5 h-5 text-white" />
      </motion.div>
      <motion.div drag="x" dragConstraints={{ left: -100, right: 0 }} dragElastic={0.1}
        onDragEnd={(_: any, info: any) => { if (info.offset.x < -80) onArchive(contract.id); x.set(0); }}
        style={{ x }} onClick={() => onSelect(contract)}
        className="relative z-10 bg-slate-950 flex items-center gap-3 px-4 py-3 cursor-pointer">
        <FileText className="w-5 h-5 text-slate-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-white truncate">{contract.title}</div>
          {contract.counterparty_name && <div className="text-[13px] text-slate-500 opacity-55 truncate">{contract.counterparty_name}</div>}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[contract.status]}`}>{contract.status.replace('_', ' ')}</span>
          <span className="text-[11px] text-slate-500 opacity-55">
            {new Date(contract.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </motion.div>
    </div>
  );
};

// ── Main ContractsTab ──────────────────────────────────────────────────────────
interface ContractsTabProps { user: User; }

const ContractsTab: React.FC<ContractsTabProps> = ({ user }) => {
  const { currentTenant } = useTenant();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contract | null>(null);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data } = await supabase.from('contracts').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false });
    setContracts((data as Contract[]) || []);
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { load(); }, [load]);

  const archiveContract = async (id: string) => {
    await supabase.from('contracts').update({ status: 'expired' }).eq('id', id);
    setContracts(p => p.map(c => c.id === id ? { ...c, status: 'expired' as ContractStatus } : c));
    toast.success('Archived');
  };

  if (selected) return <ContractDetail contract={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="relative flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pb-20 bg-slate-950 divide-y divide-white/5">
        {loading ? [...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-900/40 animate-pulse" />) :
          contracts.length === 0 ? <div className="py-16 text-center text-[13px] text-slate-500">No contracts yet.</div> :
          contracts.map(c => (
            <ContractRow
              key={c.id}
              contract={c}
              onSelect={setSelected}
              onArchive={archiveContract}
            />
          ))
        }
      </div>
    </div>
  );
};

export default ContractsTab;

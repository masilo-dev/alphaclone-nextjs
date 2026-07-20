'use client';

/**
 * ApprovalCenter
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-page approval dashboard accessible at /dashboard/bonnie/approvals.
 *
 * New capabilities (Agentic OS upgrade):
 *  • Inline argument editor — edit any approval field before approving
 *  • Edit history timeline — shows all prior edits with timestamps
 *  • Risk badge enhanced — distinguishes low/medium/high/critical
 *  • High-risk gate — surfaces 403 INSUFFICIENT_ROLE with clear messaging
 *  • Real-time updates via Supabase Realtime (in useBonnieApprovals)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Wrench,
  RefreshCw,
  Inbox,
  AlertTriangle,
  Loader2,
  Pencil,
  History,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { useBonnieApprovals, BonnieApprovalItem } from '@/hooks/useBonnieApprovals';
import { useTenant } from '@/contexts/TenantContext';
import { useTenantRole } from '@/contexts/TenantContext';
import { toast } from 'react-hot-toast';
import { canApproveHighRisk } from '@/lib/bonnie/bonnieRiskPolicy';

// ── Risk badge ────────────────────────────────────────────────────────────────

const RISK_STYLES: Record<string, string> = {
  critical: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  high: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  low: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
};

const RISK_ICONS: Record<string, React.ReactNode> = {
  critical: <Lock className="h-2.5 w-2.5" />,
  high: <ShieldAlert className="h-2.5 w-2.5" />,
  medium: <AlertTriangle className="h-2.5 w-2.5" />,
  low: <ShieldCheck className="h-2.5 w-2.5" />,
};

function RiskBadge({ risk }: { risk?: string }) {
  const key = (risk || 'low').toLowerCase();
  const cls = RISK_STYLES[key] ?? RISK_STYLES.medium;
  const Icon = RISK_ICONS[key] ?? RISK_ICONS.medium;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${cls}`}>
      {Icon}
      {risk || 'low'} risk
    </span>
  );
}

// ── Inline arg editor ─────────────────────────────────────────────────────────

type InlineEditorProps = {
  args: Record<string, unknown>;
  onChange: (updated: Record<string, unknown>) => void;
};

function InlineArgEditor({ args, onChange }: InlineEditorProps) {
  const [localArgs, setLocalArgs] = useState<Record<string, unknown>>(args);

  const handleFieldChange = (key: string, value: string) => {
    const updated = { ...localArgs, [key]: value };
    setLocalArgs(updated);
    onChange(updated);
  };

  const editableKeys = Object.keys(localArgs).filter(
    (k) => typeof localArgs[k] === 'string' || typeof localArgs[k] === 'number'
  );

  if (!editableKeys.length) {
    return (
      <p className="text-[11px] text-slate-500 italic">No editable fields in this payload.</p>
    );
  }

  return (
    <div className="space-y-2">
      {editableKeys.map((key) => (
        <div key={key}>
          <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {key}
          </label>
          {typeof localArgs[key] === 'string' && String(localArgs[key]).length > 80 ? (
            <textarea
              rows={3}
              value={String(localArgs[key])}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[11px] text-slate-200 focus:border-teal-500 focus:outline-none"
            />
          ) : (
            <input
              type="text"
              value={String(localArgs[key])}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[11px] text-slate-200 focus:border-teal-500 focus:outline-none"
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Edit history timeline ─────────────────────────────────────────────────────

type EditHistoryEntry = {
  timestamp: string;
  action?: string;
  previous_args?: Record<string, unknown>;
  new_args?: Record<string, unknown>;
};

function EditHistoryTimeline({ history }: { history: EditHistoryEntry[] }) {
  if (!history.length) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
        <History className="h-3 w-3" /> Edit history ({history.length})
      </p>
      <div className="space-y-1.5 border-l-2 border-slate-800 pl-3">
        {history.map((entry, i) => (
          <div key={i} className="text-[10px] text-slate-500">
            <span className="text-slate-400 font-semibold">
              {entry.action ? entry.action.replace(/_/g, ' ') : 'Edited'}
            </span>{' '}
            · {new Date(entry.timestamp).toLocaleTimeString()}
            {entry.previous_args && entry.new_args && (
              <span className="ml-1 text-slate-600">
                ({Object.keys(entry.new_args).length} field(s) changed)
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Approval card ─────────────────────────────────────────────────────────────

type ApprovalCardProps = {
  approval: BonnieApprovalItem;
  onApprove: (id: string, editedArgs?: Record<string, unknown>) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  isProcessing: boolean;
  userRole: string | null;
};

function ApprovalCard({ approval, onApprove, onReject, isProcessing, userRole }: ApprovalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<'approve' | 'reject' | null>(null);
  const [editedArgs, setEditedArgs] = useState<Record<string, unknown>>({});
  const [hasEdits, setHasEdits] = useState(false);

  const target = approval.preview?.target;
  const draft = approval.preview?.draft;
  const payloadArgs = (approval.payload?.args || {}) as Record<string, unknown>;
  const editHistory = approval.editHistory || [];

  const isHighRisk = ['high', 'critical'].includes((approval.riskLevel || '').toLowerCase());
  const canApprove = !isHighRisk || canApproveHighRisk(userRole);

  const handleArgsChange = (updated: Record<string, unknown>) => {
    setEditedArgs(updated);
    setHasEdits(true);
  };

  const handleApprove = async () => {
    if (!canApprove) {
      toast.error('Only workspace admins can approve high-risk actions.');
      return;
    }
    if (confirming !== 'approve') {
      setConfirming('approve');
      return;
    }
    await onApprove(approval.id, hasEdits ? editedArgs : undefined);
    setConfirming(null);
  };

  const handleReject = async () => {
    if (confirming !== 'reject') {
      setConfirming('reject');
      return;
    }
    await onReject(approval.id);
    setConfirming(null);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-2xl border border-white/5 bg-slate-900 overflow-hidden shadow-md"
    >
      {/* Card header */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Icon */}
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
          isHighRisk
            ? 'bg-rose-500/10 border-rose-500/20'
            : 'bg-amber-500/10 border-amber-500/20'
        }`}>
          <ShieldAlert className={`h-4 w-4 ${isHighRisk ? 'text-rose-400' : 'text-amber-400'}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {approval.toolName && (
              <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300 border border-slate-700/60">
                {approval.toolName}
              </span>
            )}
            <RiskBadge risk={approval.riskLevel} />
            {hasEdits && (
              <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold text-teal-300">
                Edited
              </span>
            )}
            {editHistory.length > 0 && (
              <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
                <History className="h-2.5 w-2.5" /> {editHistory.length} edit{editHistory.length !== 1 ? 's' : ''}
              </span>
            )}
            {approval.createdAt && (
              <span className="ml-auto text-[10px] text-slate-600">
                {new Date(approval.createdAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {approval.reason && (
            <p className="mt-1 text-sm text-slate-300 leading-snug">
              {approval.reason}
            </p>
          )}

          {target && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
              <Wrench className="h-3 w-3 shrink-0" />
              Target:&nbsp;
              <span className="font-mono text-slate-400 truncate">{target}</span>
            </p>
          )}

          {isHighRisk && !canApprove && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 px-2.5 py-1.5 text-[11px] text-rose-300">
              <Lock className="h-3 w-3 shrink-0" />
              Only workspace admins can approve high-risk actions. Contact your workspace owner.
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 shrink-0 text-slate-600 hover:text-slate-300 transition-colors"
        >
          {expanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded payload + editor */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-800 px-4 py-3 space-y-3">
              {/* Draft preview or raw payload */}
              {!editing && draft && (
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Content preview
                  </p>
                  <pre className="max-h-48 overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-950 p-3 text-[11px] text-slate-300 whitespace-pre-wrap custom-scrollbar">
                    {draft}
                  </pre>
                </div>
              )}
              {!editing && !draft && approval.payload && Object.keys(approval.payload).length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Raw payload
                  </p>
                  <pre className="max-h-48 overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-950 p-3 text-[11px] text-slate-400 custom-scrollbar">
                    {JSON.stringify(approval.payload, null, 2)}
                  </pre>
                </div>
              )}

              {/* Inline editor */}
              {editing && (
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                    <Pencil className="h-3 w-3" /> Edit arguments
                  </p>
                  <InlineArgEditor
                    args={payloadArgs}
                    onChange={handleArgsChange}
                  />
                </div>
              )}

              {/* Edit action button */}
              {Object.keys(payloadArgs).length > 0 && (
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-[11px] text-slate-300 hover:border-teal-500/40 hover:text-teal-300 transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                  {editing ? 'Preview' : 'Edit arguments'}
                </button>
              )}

              {/* Edit history */}
              <EditHistoryTimeline history={editHistory} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action bar */}
      <div className="flex items-center gap-2 border-t border-slate-800 bg-slate-950/50 px-4 py-2.5">
        {confirming === 'approve' && (
          <p className="mr-auto text-xs text-emerald-300 font-semibold animate-pulse">
            Click again to confirm approval →
          </p>
        )}
        {confirming === 'reject' && (
          <p className="mr-auto text-xs text-rose-300 font-semibold animate-pulse">
            Click again to confirm rejection →
          </p>
        )}
        {!confirming && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 mr-auto">
            <Clock className="h-3 w-3" />
            Awaiting decision
          </div>
        )}

        <button
          type="button"
          disabled={isProcessing}
          onClick={handleReject}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            confirming === 'reject'
              ? 'bg-rose-600 text-white'
              : 'border border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
          }`}
        >
          {isProcessing && confirming === 'reject'
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <XCircle className="h-3.5 w-3.5" />}
          {confirming === 'reject' ? 'Confirm Reject' : 'Reject'}
        </button>

        <button
          type="button"
          disabled={isProcessing || !canApprove}
          onClick={handleApprove}
          title={!canApprove ? 'Admin approval required for high-risk actions' : undefined}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            confirming === 'approve'
              ? 'bg-emerald-600 text-white'
              : !canApprove
                ? 'border border-slate-700 text-slate-600 cursor-not-allowed'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
          }`}
        >
          {isProcessing && confirming === 'approve'
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : !canApprove
              ? <Lock className="h-3.5 w-3.5" />
              : <CheckCircle2 className="h-3.5 w-3.5" />}
          {confirming === 'approve'
            ? hasEdits ? 'Approve with edits' : 'Confirm Approve'
            : !canApprove
              ? 'Admin only'
              : hasEdits
                ? 'Approve (edited)'
                : 'Approve'}
        </button>
      </div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ApprovalCenter() {
  const { currentTenant } = useTenant();
  const userRole = useTenantRole();
  const tenantId = currentTenant?.id;
  const {
    approvals,
    pendingCount,
    handleApproval,
    refresh,
    loading,
  } = useBonnieApprovals(tenantId);

  const [processing, setProcessing] = useState<string | null>(null);

  // Show only pending items in this view
  const pendingApprovals = approvals.filter((a) => a.status === 'pending');

  const approve = async (id: string, editedArgs?: Record<string, unknown>) => {
    setProcessing(id);
    try {
      await handleApproval(id, 'approved', editedArgs);
    } catch {
      toast.error('Failed to approve — please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (id: string) => {
    setProcessing(id);
    try {
      await handleApproval(id, 'rejected');
      toast.success('Action rejected.');
    } catch {
      toast.error('Failed to reject — please try again.');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="min-h-full px-1 py-2">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
            </div>
            <h1 className="text-lg font-black text-white tracking-tight">
              Approval Center
            </h1>
            {pendingCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-slate-950">
                {pendingCount}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 ml-10">
            Review and authorise Bonnie&apos;s pending actions. High-risk actions require admin approval.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refresh()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && pendingApprovals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <Loader2 className="h-8 w-8 animate-spin mb-3" />
          <p className="text-sm">Loading approvals…</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && pendingApprovals.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
            <Inbox className="h-7 w-7 text-slate-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-400">No pending approvals</h3>
          <p className="mt-1 text-xs text-slate-600 max-w-xs">
            Bonnie will ask for your sign-off here whenever an action carries medium-or-higher risk.
            High-risk actions require a workspace admin.
          </p>
        </motion.div>
      )}

      {/* Approval list */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-3 max-w-2xl">
          {pendingApprovals.map((a) => (
            <ApprovalCard
              key={a.id}
              approval={a}
              onApprove={approve}
              onReject={reject}
              isProcessing={processing === a.id}
              userRole={userRole}
            />
          ))}
        </div>
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
      ` }} />
    </div>
  );
}

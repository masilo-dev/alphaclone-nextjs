export type SemanticStatus =
  | 'success'
  | 'active'
  | 'running'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'blocked';

export type SemanticStatusStyle = {
  label: string;
  dot: string;
  text: string;
  badge: string;
  border: string;
  bg: string;
  bar: string;
};

export const SEMANTIC_STATUS_STYLES: Record<SemanticStatus, SemanticStatusStyle> = {
  success: {
    label: 'Complete',
    dot: 'bg-[var(--success-500)]',
    text: 'text-[var(--success-text,var(--success-500))]',
    badge: 'border-emerald-400/25 bg-[var(--success-500)]/10 text-[var(--success-text,var(--success-500))]',
    border: 'border-emerald-400/25',
    bg: 'bg-[var(--success-500)]/10',
    bar: 'bg-[var(--success-500)]',
  },
  active: {
    label: 'Active',
    dot: 'bg-[var(--brand-blue-400)]',
    text: 'text-[var(--brand-blue-300)]',
    badge: 'border-teal-400/25 bg-[var(--brand-blue-400)]/10 text-teal-200',
    border: 'border-teal-400/25',
    bg: 'bg-[var(--brand-blue-400)]/10',
    bar: 'bg-[var(--brand-blue-400)]',
  },
  running: {
    label: 'Running',
    dot: 'bg-[var(--info-500)]',
    text: 'text-[var(--info-text,var(--info-500))]',
    badge: 'border-sky-400/25 bg-[var(--info-500)]/10 text-sky-200',
    border: 'border-sky-400/25',
    bg: 'bg-[var(--info-500)]/10',
    bar: 'bg-[var(--info-500)]',
  },
  warning: {
    label: 'Needs attention',
    dot: 'bg-[var(--warning-500)]',
    text: 'text-[var(--warning-text,var(--warning-500))]',
    badge: 'border-amber-400/25 bg-[var(--warning-500)]/10 text-amber-200',
    border: 'border-amber-400/25',
    bg: 'bg-[var(--warning-500)]/10',
    bar: 'bg-[var(--warning-500)]',
  },
  danger: {
    label: 'Failed',
    dot: 'bg-[var(--error-500)]',
    text: 'text-[var(--error-text,var(--error-500))]',
    badge: 'border-rose-400/25 bg-[var(--error-500)]/10 text-rose-200',
    border: 'border-rose-400/25',
    bg: 'bg-[var(--error-500)]/10',
    bar: 'bg-[var(--error-500)]',
  },
  blocked: {
    label: 'Blocked',
    dot: 'bg-[var(--error-500)]',
    text: 'text-[var(--error-text,var(--error-500))]',
    badge: 'border-red-500/25 bg-[var(--error-500)]/10 text-red-200',
    border: 'border-red-500/25',
    bg: 'bg-[var(--error-500)]/10',
    bar: 'bg-[var(--error-500)]',
  },
  neutral: {
    label: 'Pending',
    dot: 'bg-slate-400',
    text: 'text-[var(--ws-text-secondary)]',
    badge: 'border-slate-500/20 bg-slate-500/10 text-[var(--ws-text-secondary)]',
    border: 'border-slate-500/20',
    bg: 'bg-slate-500/10',
    bar: 'bg-slate-500',
  },
};

const SUCCESS = new Set(['success', 'succeeded', 'complete', 'completed', 'done', 'paid', 'sent', 'won', 'closed_won', 'healthy', 'operational']);
const ACTIVE = new Set(['active', 'open', 'confirmed', 'qualified', 'proposal', 'negotiation', 'in_progress', 'on_track']);
const RUNNING = new Set(['running', 'processing', 'queued', 'sending', 'syncing', 'draft', 'pending_approval']);
const WARNING = new Set(['warning', 'degraded', 'pending', 'overdue', 'partial', 'partially_paid', 'at_risk', 'review']);
const DANGER = new Set(['failed', 'error', 'lost', 'closed_lost', 'cancelled', 'canceled', 'void', 'unhealthy']);
const BLOCKED = new Set(['blocked', 'stuck', 'needs_input', 'needs_attention']);

export function semanticStatusFor(value: unknown): SemanticStatus {
  const key = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (SUCCESS.has(key)) return 'success';
  if (ACTIVE.has(key)) return 'active';
  if (RUNNING.has(key)) return 'running';
  if (WARNING.has(key)) return 'warning';
  if (DANGER.has(key)) return 'danger';
  if (BLOCKED.has(key)) return 'blocked';
  return 'neutral';
}

export function semanticStatusStyle(value: unknown): SemanticStatusStyle {
  return SEMANTIC_STATUS_STYLES[semanticStatusFor(value)];
}

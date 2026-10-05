'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Milestone } from '@/services/milestoneService';
import { Project } from '@/types';
import { Card } from '@/components/ui/UIComponents';
import { CheckCircle2, Calendar, MessageSquare, Send, Loader2, Lock, ReceiptText, Timer, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface ProjectComment {
  id: string;
  author_name: string;
  author_email?: string | null;
  content: string;
  is_client: boolean;
  created_at: string;
}

interface ProjectPortalInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  dueDate?: string | null;
  paidAt?: string | null;
  isPaid: boolean;
}

const portalPasswordKey = (token: string) => `portal_pw_${token}`;

export default function PublicProjectPage() {
  const params = useParams();
  const portalRef = params?.id as string;
  const [project, setProject] = useState<Partial<Project> | null>(null);
  const [internalProjectId, setInternalProjectId] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [invoices, setInvoices] = useState<ProjectPortalInvoice[]>([]);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [expired, setExpired] = useState(false);
  const [portalPassword, setPortalPassword] = useState('');
  const [accessPassword, setAccessPassword] = useState<string | undefined>(undefined);
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [clientFinancePortalUrl, setClientFinancePortalUrl] = useState<string | null>(null);

  const portalHeaders = useCallback((): Record<string, string> => {
    if (!accessPassword) return {};
    return { 'X-Portal-Password': accessPassword };
  }, [accessPassword]);

  const loadComments = useCallback(async () => {
    if (!portalRef) return;
    if (requiresPassword && !accessPassword) return;
    const res = await fetch(`/api/projects/public/${portalRef}/comments`, {
      headers: portalHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (data.success) setComments(data.comments || []);
  }, [portalRef, accessPassword, requiresPassword, portalHeaders]);

  const loadPortal = useCallback(async (password?: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (password) headers['X-Portal-Password'] = password;

      const res = await fetch(`/api/projects/public/${portalRef}/access`, { headers, cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.expired) {
          setExpired(true);
          setError('This client link has expired. Ask your provider for a new one.');
          return;
        }
        if (data.requiresPassword) {
          setRequiresPassword(true);
          if (data.projectName) setProject({ name: data.projectName });
          return;
        }
        throw new Error(data.error || 'Not found');
      }

      setRequiresPassword(false);
      setExpired(false);
      setProject(data.project);
      setInternalProjectId(data.projectId);
      setClientFinancePortalUrl(data.clientFinancePortalUrl || null);
      setMilestones(
        (data.milestones || []).map((m: Record<string, unknown>) => ({
          id: String(m.id),
          projectId: data.projectId,
          name: String(m.name || ''),
          status: (m.status as Milestone['status']) || 'pending',
          dueDate: m.due_date ? String(m.due_date) : undefined,
          description: m.description ? String(m.description) : undefined,
        }))
      );
      setInvoices(data.invoices || []);
      if (password) {
        sessionStorage.setItem(portalPasswordKey(portalRef), password);
        setAccessPassword(password);
      }
    } catch {
      setError('Failed to load project details');
    } finally {
      setLoading(false);
    }
  }, [portalRef]);

  useEffect(() => {
    if (!portalRef) return;
    const saved = sessionStorage.getItem(portalPasswordKey(portalRef)) || undefined;
    if (saved) setAccessPassword(saved);
    loadPortal(saved);
  }, [portalRef, loadPortal]);

  useEffect(() => {
    if (!internalProjectId || requiresPassword) return;
    loadComments();
    const channel = supabase
      .channel(`project_comments_${internalProjectId}`)
      .on('postgres_changes' as any, {
        event: 'INSERT',
        schema: 'public',
        table: 'project_comments',
        filter: `project_id=eq.${internalProjectId}`,
      }, (payload: any) => {
        const row = payload.new as ProjectComment;
        setComments((prev) => (prev.some((c) => c.id === row.id) ? prev : [...prev, row]));
      })
      .on('postgres_changes' as any, {
        event: 'UPDATE',
        schema: 'public',
        table: 'projects',
        filter: `id=eq.${internalProjectId}`,
      }, () => {
        loadPortal(accessPassword);
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [internalProjectId, loadComments, requiresPassword, loadPortal, accessPassword]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalPassword.trim()) {
      toast.error('Enter the password from your provider');
      return;
    }
    setVerifying(true);
    await loadPortal(portalPassword.trim());
    setVerifying(false);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !newComment.trim()) {
      toast.error('Name and message are required');
      return;
    }
    setPosting(true);
    try {
      const res = await fetch(`/api/projects/public/${portalRef}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...portalHeaders() },
        body: JSON.stringify({
          authorName,
          authorEmail,
          content: newComment,
          isClient: true,
          password: accessPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post');
      if (data.comment) setComments((prev) => [...prev, data.comment]);
      setNewComment('');
      toast.success('Message sent to your team');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--ws-panel)] flex items-center justify-center text-teal-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p>Loading project status...</p>
        </div>
      </div>
    );
  }

  if (requiresPassword && !expired) {
    return (
      <div className="min-h-screen bg-[var(--ws-canvas)] flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 border-[var(--ws-border)] bg-[var(--ws-panel)]/80">
          <div className="flex items-center gap-3 mb-4 text-teal-400">
            <Lock className="w-5 h-5" />
            <h1 className="text-xl font-bold text-white">Password required</h1>
          </div>
          <p className="type-card-description text-[var(--ws-text-muted)] mb-6">
            {project?.name ? `"${project.name}" is protected.` : 'This project link is protected.'}{' '}
            Enter the password your provider shared with you.
          </p>
          <form onSubmit={handleUnlock} className="space-y-4">
            <input
              type="password"
              value={portalPassword}
              onChange={(e) => setPortalPassword(e.target.value)}
              placeholder="Portal password"
              className="w-full rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)] px-4 py-3 text-white"
              autoFocus
            />
            <button
              type="submit"
              disabled={verifying}
              className="w-full py-3 bg-teal-600 hover:bg-teal-500 rounded-xl font-bold text-white disabled:opacity-50"
            >
              {verifying ? 'Checking…' : 'View project'}
            </button>
          </form>
        </Card>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[var(--ws-panel)] flex items-center justify-center text-red-400">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-bold mb-2">{expired ? 'Link expired' : 'Project Not Found'}</h1>
          <p className="text-[var(--ws-text-muted)]">{error || 'This project may not be public or the link is invalid.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ws-canvas)] text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-block px-4 py-1.5 rounded-full bg-teal-500/10 text-teal-400 type-ui font-medium border border-teal-500/20">
            AlphaClone Systems — Project Portal
          </div>
          <div className="flex flex-col items-center gap-3">
            <h1 className="text-4xl md:text-5xl font-bold">{project.name}</h1>
            {clientFinancePortalUrl && (
              <a
                href={clientFinancePortalUrl}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:text-violet-200 type-caption font-bold uppercase tracking-wider transition-all"
              >
                Go to client workspace
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          {project.ownerName && <p className="text-[var(--ws-text-muted)]">Client: {project.ownerName}</p>}
        </div>

        <Card className="p-8 border-[var(--ws-border)] bg-[var(--ws-panel)]/50 backdrop-blur-xl">
          <div className="space-y-2 mb-6">
            <div className="flex justify-between type-ui text-[var(--ws-text-muted)]">
              <span>Overall Progress</span>
              <span className="text-teal-400 font-bold">{project.progress}%</span>
            </div>
            <div className="h-4 bg-[var(--ws-surface-secondary)] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all" style={{ width: `${project.progress}%` }} />
            </div>
          </div>
          <div className="text-3xl font-bold text-teal-400">{project.currentStage || 'In Progress'}</div>
          <div className="grid gap-3 md:grid-cols-3 mt-6 type-ui">
            <div className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)]/60 p-4">
              <p className="text-[var(--ws-text-muted)]">Status</p>
              <p className="font-semibold text-white">{project.status || 'Active'}</p>
            </div>
            <div className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)]/60 p-4">
              <p className="text-[var(--ws-text-muted)]">Deadline</p>
              <p className="font-semibold text-white">{project.dueDate ? new Date(project.dueDate).toLocaleDateString() : 'Not set'}</p>
            </div>
            <div className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)]/60 p-4">
              <p className="text-[var(--ws-text-muted)] flex items-center gap-1"><Timer className="w-3.5 h-3.5" /> Time left</p>
              <p className="font-semibold text-white">
                {(project as any).daysLeft == null ? 'Not set' : (project as any).daysLeft > 0 ? `${(project as any).daysLeft} day${(project as any).daysLeft === 1 ? '' : 's'}` : 'Due now'}
              </p>
            </div>
          </div>
          {(project as any).portalExpiresAt && (
            <p className="mt-4 type-card-description text-[var(--ws-text-muted)]">
              This secure portal link is valid until {new Date((project as any).portalExpiresAt).toLocaleString()}.
            </p>
          )}
        </Card>

        {invoices.length > 0 && (
          <Card className="p-6 border-[var(--ws-border)] bg-[var(--ws-panel)]/50">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
              <ReceiptText className="w-5 h-5 text-teal-400" /> Invoices & Payments
            </h3>
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)]/60 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-white">{invoice.invoiceNumber || 'Invoice'}</p>
                      <p className="type-card-description text-[var(--ws-text-muted)]">
                        {invoice.dueDate ? `Due ${new Date(invoice.dueDate).toLocaleDateString()}` : 'No due date'}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-right type-ui">
                      <div>
                        <p className="text-[var(--ws-text-muted)]">Total</p>
                        <p className="font-semibold">{invoice.currency} {invoice.total.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[var(--ws-text-muted)]">Paid</p>
                        <p className="font-semibold text-[var(--brand-blue-300)]">{invoice.currency} {invoice.amountPaid.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[var(--ws-text-muted)]">Balance</p>
                        <p className="font-semibold text-[var(--warning-text,var(--warning-500))]">{invoice.currency} {invoice.balanceDue.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className={`inline-flex rounded-full px-3 py-1 type-caption font-bold ${invoice.isPaid ? 'bg-teal-500/10 text-[var(--brand-blue-300)]' : 'bg-amber-500/10 text-[var(--warning-text,var(--warning-500))]'}`}>
                      {invoice.isPaid ? 'Paid' : invoice.status || 'Open'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {milestones.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold">Timeline</h3>
            {milestones.map((m, index) => (
              <div key={m.id} className="p-6 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/50">
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.status === 'completed' ? 'bg-teal-500 text-white' : 'bg-[var(--ws-surface-secondary)] text-[var(--ws-text-muted)]'}`}>
                    {m.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{m.name}</h4>
                    {m.dueDate && (
                      <p className="type-card-description text-[var(--ws-text-muted)] flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" /> {new Date(m.dueDate).toLocaleDateString()}
                      </p>
                    )}
                    {m.description && <p className="type-card-description text-[var(--ws-text-muted)] mt-2">{m.description}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Card className="p-6 border-[var(--ws-border)] bg-[var(--ws-panel)]/50">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-teal-400" /> Project Conversation
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
            {comments.length === 0 ? (
              <p className="type-card-description text-[var(--ws-text-muted)] italic">No messages yet. Tell your team what you need below.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className={`p-4 rounded-xl ${c.is_client ? 'bg-teal-500/5 border border-teal-500/20 ml-4' : 'bg-[var(--ws-surface-secondary)]/50 border border-[var(--ws-border)]/50 mr-4'}`}>
                  <div className="flex justify-between type-caption text-[var(--ws-text-muted)] mb-1">
                    <span className="font-bold text-[var(--ws-text-secondary)]">{c.author_name}{c.is_client ? ' (You)' : ' (Team)'}</span>
                    <span>{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="type-card-description text-[var(--ws-text-secondary)] whitespace-pre-wrap">{c.content}</p>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handlePostComment} className="space-y-3 border-t border-[var(--ws-border)] pt-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Your name" className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)] px-4 py-2 type-ui text-white" required />
              <input value={authorEmail} onChange={(e) => setAuthorEmail(e.target.value)} placeholder="Email (optional)" type="email" className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)] px-4 py-2 type-ui text-white" />
            </div>
            <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="What do you need? Add notes, questions, or feedback..." rows={3} className="w-full rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)] px-4 py-3 type-ui text-white resize-none" required />
            <button type="submit" disabled={posting} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 rounded-xl text-white font-bold type-ui disabled:opacity-50">
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Message
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, FileText, XCircle } from 'lucide-react';
import { Card, Button } from '@/components/ui/UIComponents';
import type { TenantBranding } from '@/lib/tenantBranding';

export default function PublicProposalPage() {
  const params = useParams();
  const token = params?.token as string;
  const [proposal, setProposal] = useState<Record<string, unknown> | null>(null);
  const [branding, setBranding] = useState<TenantBranding>({ name: 'Your Business' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (!token) return;
    void fetch(`/api/proposals/public?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.proposal) {
          setProposal(payload.proposal);
          setBranding(payload.branding || { name: 'Your Business' });
        } else {
          setError(payload.error || 'Proposal not found');
        }
      })
      .catch(() => setError('Failed to load proposal'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleRespond = async (accepted: boolean) => {
    setResponding(true);
    try {
      const res = await fetch('/api/proposals/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accepted }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setProposal((p) => (p ? { ...p, status: accepted ? 'accepted' : 'rejected' } : p));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to respond');
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Loading proposal…</p>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <Card className="p-8 text-center max-w-md">
          <p className="text-slate-300">{error || 'Proposal not found'}</p>
        </Card>
      </div>
    );
  }

  const content = (proposal.content || {}) as Record<string, unknown>;
  const sections = (content.sections || []) as Array<{ heading: string; body: string }>;
  const status = String(proposal.status || 'draft');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="h-12 mx-auto mb-4 object-contain" />
          ) : null}
          <p className="text-teal-400 text-sm font-medium">{branding.name}</p>
          <h1 className="text-3xl font-bold text-white mt-2">{String(proposal.title || 'Proposal')}</h1>
        </div>

        <Card className="p-6 space-y-6">
          {sections.length > 0 ? (
            sections.map((s, i) => (
              <section key={i}>
                <h2 className="text-lg font-semibold text-white mb-2">{s.heading}</h2>
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{s.body}</p>
              </section>
            ))
          ) : (
            <p className="text-slate-300 leading-relaxed">
              {String(content.executive_summary || content.body || 'Proposal details')}
            </p>
          )}

          {status === 'accepted' ? (
            <div className="flex items-center gap-2 text-emerald-400 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              Proposal accepted — thank you!
            </div>
          ) : status === 'rejected' ? (
            <div className="flex items-center gap-2 text-slate-400 p-4 rounded-lg bg-slate-500/10">
              <XCircle className="w-5 h-5" aria-hidden="true" />
              Proposal declined
            </div>
          ) : (
            <div className="flex gap-3 pt-4 border-t border-white/10">
              <Button
                onClick={() => handleRespond(true)}
                disabled={responding}
                className="flex-1 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                Accept proposal
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleRespond(false)}
                disabled={responding}
                className="flex-1"
              >
                Decline
              </Button>
            </div>
          )}
        </Card>

        <p className="text-center text-slate-500 text-xs flex items-center justify-center gap-1">
          <FileText className="w-3 h-3" aria-hidden="true" />
          Secure proposal from {branding.name}
        </p>
      </div>
    </div>
  );
}

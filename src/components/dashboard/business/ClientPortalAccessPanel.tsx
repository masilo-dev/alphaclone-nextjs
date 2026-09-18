'use client';

import { useState } from 'react';
import { Check, Clipboard, ExternalLink, Eye, EyeOff, KeyRound, Mail, ShieldCheck, UserRoundPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import type { BusinessClient } from '@/services/businessClientService';
import { businessClientService } from '@/services/businessClientService';

type ClientPortalAccessPanelProps = {
  client: BusinessClient;
  tenantId: string;
  onClose: () => void;
  onClientUpdated?: (client: BusinessClient) => void;
};

export default function ClientPortalAccessPanel({ client, tenantId, onClose, onClientUpdated }: ClientPortalAccessPanelProps) {
  const [email, setEmail] = useState(client.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [portalUrl, setPortalUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const grantAccess = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      toast.error('Add a valid client email first.');
      return;
    }
    if (password.length < 10) {
      toast.error('Use a password with at least 10 characters.');
      return;
    }

    setSaving(true);
    try {
      if (normalizedEmail !== (client.email || '').trim().toLowerCase()) {
        const { error } = await businessClientService.updateClient(client.id, { email: normalizedEmail });
        if (error) throw new Error(error);
        onClientUpdated?.({ ...client, email: normalizedEmail });
      }

      const response = await fetch('/api/client-finance/grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, tenantId, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Portal access could not be created.');

      setPortalUrl(String(payload.portalUrl || ''));
      toast.success('Client portal access is ready.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Portal access could not be created.');
    } finally {
      setSaving(false);
    }
  };

  const copyHandoff = async () => {
    if (!portalUrl) return;
    const message = `Your AlphaClone client workspace is ready.\n\nSign in: ${portalUrl}\nEmail: ${email.trim()}\nPassword: ${password}\n\nPlease change your password after signing in.`;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success('Client handoff copied.');
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error('Could not copy the handoff. Select and copy it manually.');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="presentation">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-950 shadow-2xl shadow-black/60" role="dialog" aria-modal="true" aria-labelledby="client-portal-access-title">
        <div className="border-b border-slate-800 bg-gradient-to-br from-cyan-950/40 to-slate-950 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-cyan-300"><UserRoundPlus className="h-5 w-5" aria-hidden="true" /></div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Client handoff</p>
                <h2 id="client-portal-access-title" className="mt-1 text-lg font-bold text-white">Set up {client.name}&apos;s portal</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">Create secure access, then copy the exact details to send to your client.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl px-2 py-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close client portal access">×</button>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div>
            <label htmlFor="client-portal-email" className="mb-1.5 block text-xs font-semibold text-slate-200">Client email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input id="client-portal-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="client@company.com" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-9 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10" />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">This updates the email on the client record if it has changed.</p>
          </div>

          <div>
            <label htmlFor="client-portal-password" className="mb-1.5 block text-xs font-semibold text-slate-200">Temporary portal password</label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input id="client-portal-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters" autoComplete="new-password" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-9 py-2.5 pr-11 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-amber-300/80">Share this password through a secure channel. It is never stored in the browser URL.</p>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-relaxed text-slate-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <span>The password is hashed server-side, existing sessions are revoked when access is reset, and portal activity is audited.</span>
          </div>

          {!portalUrl ? (
            <button type="button" onClick={grantAccess} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60">
              {saving ? 'Creating secure access…' : 'Create client portal access'}
            </button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-300"><Check className="h-4 w-4" aria-hidden="true" /> Access is ready</div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
                <p><span className="text-slate-500">Sign in:</span> <a href={portalUrl} target="_blank" rel="noreferrer" className="break-all text-cyan-300 underline underline-offset-2">{portalUrl}</a></p>
                <p className="mt-1"><span className="text-slate-500">Email:</span> {email.trim()}</p>
                <p className="mt-1"><span className="text-slate-500">Password:</span> {showPassword ? password : '••••••••••'}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={copyHandoff} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-300">
                  {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy handoff details'}
                </button>
                <a href={portalUrl} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200 hover:border-cyan-400/40 hover:text-white">
                  <ExternalLink className="h-4 w-4" /> Open portal
                </a>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">For security, ask the client to change this password after their first sign-in. If you need to reset it, create a new password here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

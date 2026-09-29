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
  const [portalLoginUrl, setPortalLoginUrl] = useState('');
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
        // The grant must follow the client shown in this panel, not a stale relationship query.
        body: JSON.stringify({ clientId: client.id, tenantId, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Portal access could not be created.');

      setPortalUrl(String(payload.portalUrl || ''));
      setPortalLoginUrl(String(payload.portalLoginUrl || payload.portalUrl || ''));
      toast.success('Client portal access is ready.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Portal access could not be created.');
    } finally {
      setSaving(false);
    }
  };

  const copyHandoff = async () => {
    if (!portalUrl) return;
    const message = `Your AlphaClone client workspace is ready.\n\nClient login: ${portalLoginUrl || portalUrl}\nEmail / username: ${email.trim()}\nPassword: ${password}\n\nPlease change your password after signing in.`;
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
    <div className="fixed inset-0 ac-layer-modal flex items-end justify-center overflow-y-auto bg-[var(--ws-overlay-backdrop)] p-3 backdrop-blur-sm sm:items-center sm:p-6" role="presentation">
      <div className="w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-3xl border border-[var(--ws-border-strong)] bg-[var(--ws-panel)] shadow-2xl shadow-black/60 sm:max-h-[calc(100dvh-3rem)]" role="dialog" aria-modal="true" aria-labelledby="client-portal-access-title">
        <div className="border-b border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-[var(--info-border)] bg-[var(--info-surface)] p-2.5 text-[var(--info-text)]"><UserRoundPlus className="h-5 w-5" aria-hidden="true" /></div>
              <div>
                <p className="type-caption font-bold uppercase tracking-caps text-[var(--info-text)]">Client handoff</p>
                <h2 id="client-portal-access-title" className="mt-1 text-lg font-bold text-[var(--ws-text-primary)]">Set up {client.name}&apos;s portal</h2>
                <p className="mt-1 type-card-description leading-relaxed text-[var(--ws-text-secondary)]">Create secure access, then copy the exact details to send to your client.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl px-2 py-1 text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)]" aria-label="Close client portal access">×</button>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div>
            <label htmlFor="client-portal-email" className="mb-1.5 block type-label font-semibold text-[var(--ws-text-primary)]">Client email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ws-text-muted)]" aria-hidden="true" />
              <input id="client-portal-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="client@company.com" className="w-full rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] px-9 py-2.5 type-ui text-[var(--ws-text-primary)] outline-none transition-colors placeholder:text-[var(--ws-text-muted)] focus:border-[var(--ac-accent)] focus:ring-2 focus:ring-[var(--focus-ring)]" />
            </div>
            <p className="mt-1.5 type-card-description text-[var(--ws-text-muted)]">This updates the email on the client record if it has changed.</p>
          </div>

          <div>
            <label htmlFor="client-portal-password" className="mb-1.5 block type-label font-semibold text-[var(--ws-text-primary)]">Temporary portal password</label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ws-text-muted)]" aria-hidden="true" />
              <input id="client-portal-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters" autoComplete="new-password" className="w-full rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] px-9 py-2.5 pr-11 type-ui text-[var(--ws-text-primary)] outline-none transition-colors placeholder:text-[var(--ws-text-muted)] focus:border-[var(--ac-accent)] focus:ring-2 focus:ring-[var(--focus-ring)]" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)]" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 type-card-description text-[var(--warning-text)]">Share this password through a secure channel. It is never stored in the browser URL.</p>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] p-3 type-caption leading-relaxed text-[var(--ws-text-secondary)]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success-text)]" aria-hidden="true" />
            <span>The password is hashed server-side, existing sessions are revoked when access is reset, and portal activity is audited.</span>
          </div>

          {!portalUrl ? (
            <button type="button" onClick={grantAccess} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ac-accent)] px-4 py-3 type-ui font-bold text-white transition-colors hover:bg-[var(--ac-accent-hover)] disabled:cursor-wait disabled:opacity-60">
              {saving ? 'Creating secure access…' : 'Create client portal access'}
            </button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-[var(--success-border)] bg-[var(--success-surface)] p-4">
              <div className="flex items-center gap-2 type-ui font-bold text-[var(--success-text)]"><Check className="h-4 w-4" aria-hidden="true" /> Access is ready</div>
              <div className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] p-3 type-caption text-[var(--ws-text-secondary)]">
                <p><span className="text-[var(--ws-text-muted)]">Client login:</span> <a href={portalLoginUrl || portalUrl} target="_blank" rel="noreferrer" className="break-all text-[var(--info-text)] underline underline-offset-2">{portalLoginUrl || portalUrl}</a></p>
                <p className="mt-1"><span className="text-[var(--ws-text-muted)]">Email / username:</span> {email.trim()}</p>
                <p className="mt-1"><span className="text-[var(--ws-text-muted)]">Password:</span> {showPassword ? password : '••••••••••'}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={copyHandoff} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--ac-accent)] px-4 py-2.5 type-ui font-bold text-white hover:bg-[var(--ac-accent-deep)]">
                  {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy handoff details'}
                </button>
                <a href={portalUrl} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--ws-border)] px-4 py-2.5 type-ui font-bold text-[var(--ws-text-primary)] hover:border-[var(--ac-accent)] hover:text-[var(--ws-text-primary)]">
                  <ExternalLink className="h-4 w-4" /> Open portal
                </a>
              </div>
              <p className="type-card-description leading-relaxed text-[var(--ws-text-muted)]">For security, ask the client to change this password after their first sign-in. If you need to reset it, create a new password here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

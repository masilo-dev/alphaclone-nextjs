'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Mail,
  PenSquare,
  RefreshCw,
  Reply,
  Search,
  Send,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { buildSafeEmailBodyHtml } from '@/lib/email/sanitizeEmailHtml';
import { refreshMicrosoftTokenIfNeeded, refreshZohoTokenIfNeeded } from '@/lib/email/tokenRefresh';
import { useMicrosoftEmails } from '@/hooks/useMicrosoftEmails';
import { useZohoEmails } from '@/hooks/useZohoEmails';
import { microsoftAuthService } from '@/services/microsoftAuthService';
import { useAuth } from '@/contexts/AuthContext';
import ComposeEmailModal from './ComposeEmailModal';
import { parseEmailFromHeader } from '../crm/emailRecipient';
import type { InboxFolder, InboxProvider, UnifiedInboxMessage } from '@/types/unifiedInbox';

type ComposeState = {
  to?: string;
  subject?: string;
  body?: string;
};

type UnifiedInboxViewProps = {
  defaultProvider?: InboxProvider;
};

function toUnifiedMicrosoft(
  emails: ReturnType<typeof useMicrosoftEmails>['emails']
): UnifiedInboxMessage[] {
  return emails.map((email) => ({
    id: email.id,
    provider: 'microsoft' as const,
    subject: email.subject,
    from: email.from,
    snippet: email.snippet,
    body: email.body,
    receivedAt: email.receivedAt,
  }));
}

async function fetchProviderStatus(): Promise<{ microsoft: boolean; zoho: boolean }> {
  const [microsoft, zohoRes] = await Promise.all([
    microsoftAuthService.isConnected().catch(() => false),
    fetch('/api/auth/zoho/status', { credentials: 'include' })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => Boolean(d.isConnected)),
  ]);
  return { microsoft, zoho: zohoRes };
}

export default function UnifiedInboxView({ defaultProvider }: UnifiedInboxViewProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const urlProvider = searchParams?.get('provider');
  const initialProvider: InboxProvider =
    urlProvider === 'zoho' || urlProvider === 'microsoft'
      ? urlProvider
      : defaultProvider || 'microsoft';

  const [provider, setProvider] = useState<InboxProvider>(initialProvider);
  const [statusChecked, setStatusChecked] = useState(false);
  const [status, setStatus] = useState({ microsoft: false, zoho: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<ComposeState>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingBody, setLoadingBody] = useState(false);

  const microsoft = useMicrosoftEmails(50, statusChecked && provider === 'microsoft');
  const zoho = useZohoEmails(50, statusChecked && provider === 'zoho');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await fetchProviderStatus();
      if (cancelled) return;
      setStatus(next);
      const preferred =
        urlProvider === 'zoho' || urlProvider === 'microsoft'
          ? urlProvider
          : defaultProvider;
      if (preferred && (preferred === 'microsoft' ? next.microsoft : next.zoho)) {
        setProvider(preferred);
      } else if (next.microsoft) {
        setProvider('microsoft');
      } else if (next.zoho) {
        setProvider('zoho');
      }
      setStatusChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultProvider, urlProvider]);

  useEffect(() => {
    if (!statusChecked || !searchParams || searchParams.get('action') !== 'compose') return;
    setComposeDraft({
      to: searchParams.get('to') || '',
      subject: searchParams.get('subject') || '',
      body: searchParams.get('body') || '',
    });
    setComposeOpen(true);
  }, [statusChecked, searchParams]);

  const active = provider === 'microsoft' ? microsoft : zoho;
  const anyConnected = status.microsoft || status.zoho;
  const providerConnected = provider === 'microsoft' ? status.microsoft : status.zoho;

  useEffect(() => {
    if (!statusChecked || !anyConnected) return;

    const refreshTokens = () => {
      if (status.microsoft) void refreshMicrosoftTokenIfNeeded(false);
      if (status.zoho) void refreshZohoTokenIfNeeded(false);
    };

    refreshTokens();
    const interval = window.setInterval(refreshTokens, 25 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [statusChecked, anyConnected, status.microsoft, status.zoho]);

  const emails: UnifiedInboxMessage[] = useMemo(
    () => (provider === 'microsoft' ? toUnifiedMicrosoft(microsoft.emails) : zoho.emails),
    [provider, microsoft.emails, zoho.emails]
  );

  const folder = active.folder as InboxFolder;
  const setFolder = active.setFolder as (f: InboxFolder) => void;

  const filteredEmails = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return emails;
    return emails.filter(
      (email) =>
        (email.subject || '').toLowerCase().includes(q) ||
        (email.from || '').toLowerCase().includes(q) ||
        (email.snippet || '').toLowerCase().includes(q)
    );
  }, [emails, searchQuery]);

  const selectedEmail = useMemo(
    () => filteredEmails.find((email) => email.id === selectedId) || null,
    [filteredEmails, selectedId]
  );

  const selectedEmailHtml = useMemo(
    () => buildSafeEmailBodyHtml(selectedEmail?.body, selectedEmail?.snippet),
    [selectedEmail]
  );

  const refresh = useCallback(() => {
    if (provider === 'microsoft') void microsoft.refresh();
    else void zoho.refresh();
  }, [provider, microsoft, zoho]);

  const switchProvider = (next: InboxProvider) => {
    setProvider(next);
    setSelectedId(null);
    setSearchQuery('');
  };

  useEffect(() => {
    if (!selectedEmail || selectedEmail.body || provider !== 'zoho') return;
    let cancelled = false;
    setLoadingBody(true);
    zoho
      .loadMessageBody(selectedEmail)
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load message');
      })
      .finally(() => {
        if (!cancelled) setLoadingBody(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEmail?.id, provider, zoho, selectedEmail]);

  const openNewEmail = () => {
    setComposeDraft({});
    setComposeOpen(true);
  };

  const openReply = () => {
    if (!selectedEmail) {
      toast.error('Select a message to reply to.');
      return;
    }
    const parsed = parseEmailFromHeader(selectedEmail.from || '');
    if (!parsed.email) {
      toast.error('Could not parse sender email from this message.');
      return;
    }
    setComposeDraft({
      to: parsed.email,
      subject: selectedEmail.subject?.startsWith('Re:')
        ? selectedEmail.subject
        : `Re: ${selectedEmail.subject || ''}`,
      body: `\n\n---\nOn ${new Date(selectedEmail.receivedAt).toLocaleString()}, ${selectedEmail.from} wrote:\n${selectedEmail.snippet || ''}`,
    });
    setComposeOpen(true);
  };

  const connectMicrosoft = () => microsoftAuthService.initiateOAuth();

  const connectZoho = () => {
    window.location.href = '/api/auth/zoho/connect';
  };

  if (!statusChecked) {
    return (
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-teal-400 mx-auto mb-3" />
        <p className="text-sm text-slate-400">Checking your email accounts…</p>
      </div>
    );
  }

  if (!anyConnected) {
    return (
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-8 text-center max-w-lg mx-auto">
        <Mail className="w-10 h-10 text-teal-400 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">Connect email to see your inbox</h2>
        <p className="text-sm text-slate-400 mb-6">
          Link Outlook or Zoho — then you can read mail, write new messages, and reply from here.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={connectMicrosoft}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Connect Microsoft 365
          </button>
          <button
            type="button"
            onClick={connectZoho}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Connect Zoho Mail
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-[min(88dvh,820px)] min-h-[480px] rounded-2xl border border-white/5 bg-slate-900/40 overflow-hidden">
        {/* Sidebar list */}
        <div
          className={`${
            selectedId ? 'hidden md:flex' : 'flex'
          } w-full md:w-[340px] lg:w-[380px] flex-col border-r border-white/5 bg-slate-950/50 shrink-0`}
        >
          <div className="p-3 border-b border-white/5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">Inbox</h3>
                <p className="text-[10px] text-slate-500">
                  {active.loading ? 'Loading…' : `${filteredEmails.length} message${filteredEmails.length === 1 ? '' : 's'}`}
                </p>
              </div>
              <button
                type="button"
                onClick={refresh}
                className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={openNewEmail}
              disabled={!providerConnected}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 px-4 py-2.5 text-sm font-bold text-white"
            >
              <PenSquare className="w-4 h-4" />
              Write new email
            </button>

            <Link
              href="/dashboard/business/campaigns"
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
            >
              <Users className="w-3.5 h-3.5" />
              Bulk send (campaigns)
            </Link>

            <div className="flex gap-1 p-1 rounded-xl bg-slate-900 border border-white/5">
              <button
                type="button"
                onClick={() => switchProvider('microsoft')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${
                  provider === 'microsoft' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Outlook{status.microsoft ? '' : ' · off'}
              </button>
              <button
                type="button"
                onClick={() => switchProvider('zoho')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${
                  provider === 'zoho' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Zoho{status.zoho ? '' : ' · off'}
              </button>
            </div>

            {!providerConnected && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                {provider === 'microsoft' ? (
                  <>
                    Outlook not connected.{' '}
                    <button type="button" onClick={connectMicrosoft} className="underline font-semibold">
                      Connect
                    </button>
                  </>
                ) : (
                  <>
                    Zoho not connected.{' '}
                    <button type="button" onClick={connectZoho} className="underline font-semibold">
                      Connect
                    </button>
                  </>
                )}
              </div>
            )}

            {active.error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200 space-y-2">
                <p>{active.error}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={refresh} className="underline font-semibold">
                    Retry
                  </button>
                  {/expired|reconnect|not connected/i.test(active.error) && (
                    <button
                      type="button"
                      onClick={provider === 'microsoft' ? connectMicrosoft : connectZoho}
                      className="underline font-semibold"
                    >
                      Reconnect {provider === 'microsoft' ? 'Outlook' : 'Zoho'}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search mail…"
                className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/40"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto">
              {(['inbox', 'sent', 'drafts', 'trash'] as InboxFolder[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setFolder(f);
                    setSelectedId(null);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize whitespace-nowrap ${
                    folder === f
                      ? provider === 'microsoft'
                        ? 'bg-blue-600 text-white'
                        : 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {active.loading ? (
              <div className="p-6 flex flex-col items-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                <span className="text-xs">Loading {folder}…</span>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 text-center space-y-2">
                <p>{providerConnected ? `No messages in ${folder}.` : 'Connect this account first.'}</p>
                {providerConnected && (
                  <button type="button" onClick={openNewEmail} className="text-teal-400 text-xs font-semibold underline">
                    Write a new email
                  </button>
                )}
              </div>
            ) : (
              filteredEmails.map((email) => (
                <button
                  key={`${email.provider}-${email.id}`}
                  type="button"
                  onClick={() => setSelectedId(email.id)}
                  className={`w-full text-left p-3 transition-colors ${
                    selectedEmail?.id === email.id
                      ? 'bg-teal-500/10 border-l-2 border-l-teal-500'
                      : 'hover:bg-white/5 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {(email.from || '').split('<')[0].trim() || email.from || 'Unknown'}
                    </p>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(email.receivedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-300 truncate">
                    {email.subject || '(no subject)'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{email.snippet}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Read & reply */}
        <div className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
          {selectedEmail ? (
            <>
              <div className="flex items-center gap-3 p-3 md:p-4 border-b border-white/5 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="md:hidden p-2 -ml-1 text-slate-400 hover:text-white"
                  aria-label="Back to list"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      provider === 'microsoft'
                        ? 'bg-blue-500/15 text-blue-300'
                        : 'bg-teal-500/15 text-teal-300'
                    }`}
                  >
                    {provider === 'microsoft' ? 'Outlook' : 'Zoho'}
                  </span>
                  <h3 className="text-base font-semibold text-white truncate mt-1">
                    {selectedEmail.subject || '(no subject)'}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">{selectedEmail.from}</p>
                </div>
                <button
                  type="button"
                  onClick={openReply}
                  disabled={!providerConnected}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 px-3 py-2 text-xs font-bold text-white shrink-0 disabled:opacity-40"
                >
                  <Reply className="w-3.5 h-3.5" />
                  Reply
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {loadingBody && provider === 'zoho' && !selectedEmail.body ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading message…
                  </div>
                ) : (
                  <div
                    className="prose prose-invert max-w-none prose-p:text-slate-300 prose-pre:bg-slate-950/60 text-sm"
                    dangerouslySetInnerHTML={{ __html: selectedEmailHtml }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <Send className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm font-medium text-slate-400">Pick an email from the list</p>
              <p className="text-xs mt-1 max-w-xs">
                Or use <strong className="text-slate-300">Write new email</strong> to compose to anyone in your contacts.
              </p>
              <button
                type="button"
                onClick={openNewEmail}
                disabled={!providerConnected}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 px-4 py-2 text-sm font-semibold text-white"
              >
                <PenSquare className="w-4 h-4" />
                Write new email
              </button>
            </div>
          )}
        </div>
      </div>

      {composeOpen && user && (
        <ComposeEmailModal
          isOpen={composeOpen}
          onClose={() => {
            setComposeOpen(false);
            refresh();
          }}
          userId={user.id}
          initialTo={composeDraft.to || ''}
          initialSubject={composeDraft.subject || ''}
          initialBody={composeDraft.body || ''}
        />
      )}
    </>
  );
}

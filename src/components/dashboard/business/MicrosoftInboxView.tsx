'use client';

import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Loader2,
  Mail,
  PenSquare,
  RefreshCw,
  Reply,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { buildSafeEmailBodyHtml } from '@/lib/email/sanitizeEmailHtml';
import { useMicrosoftEmails } from '@/hooks/useMicrosoftEmails';
import { microsoftAuthService } from '@/services/microsoftAuthService';
import { useAuth } from '@/contexts/AuthContext';
import { CommunicationModal } from '../crm/CommunicationModal';
import { parseEmailFromHeader, type EmailRecipient } from '../crm/emailRecipient';

type ComposeState = {
  recipient?: EmailRecipient;
  subject?: string;
  body?: string;
};

export default function MicrosoftInboxView() {
  const { user } = useAuth();
  const { emails, loading, connected, error, refresh, folder, setFolder } = useMicrosoftEmails(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeModal, setComposeModal] = useState<ComposeState | null>(null);

  const selectedEmail = useMemo(
    () => emails.find((email) => email.id === selectedId) || emails[0] || null,
    [emails, selectedId]
  );
  const selectedEmailHtml = useMemo(
    () => buildSafeEmailBodyHtml(selectedEmail?.body, selectedEmail?.snippet),
    [selectedEmail]
  );

  const handleConnect = () => {
    microsoftAuthService.initiateOAuth();
  };

  const openCompose = (draft?: ComposeState) => {
    setComposeModal(draft || {});
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
    openCompose({
      recipient: parsed,
      subject: selectedEmail.subject?.startsWith('Re:')
        ? selectedEmail.subject
        : `Re: ${selectedEmail.subject || ''}`,
      body: `\n\n---\nOn ${new Date(selectedEmail.receivedAt).toLocaleString()}, ${selectedEmail.from} wrote:\n${selectedEmail.snippet || ''}`,
    });
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto mb-3" />
        <p className="text-sm text-slate-400">Loading Outlook inbox...</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-8 text-center">
        <Mail className="w-10 h-10 text-blue-400 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">Connect Outlook to activate the unified inbox</h2>
        <p className="text-sm text-slate-400 mb-6">
          Outlook messages flow into Alphaclone once Microsoft 365 is connected.
        </p>
        <button
          type="button"
          onClick={handleConnect}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Connect Microsoft 365
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-[360px,1fr,320px] gap-4 h-full">
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <div>
              <h3 className="text-white font-semibold">Outlook Mail</h3>
              <p className="text-xs text-slate-400 capitalize">{folder} Items</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openCompose()}
                className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 text-blue-300 hover:text-white"
                title="Compose email"
              >
                <PenSquare className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => refresh()}
                className="rounded-lg border border-white/5 bg-slate-950/50 p-2 text-slate-300 hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-1 p-2 bg-slate-950/30 border-b border-white/5 overflow-x-auto">
            {(['inbox', 'sent', 'drafts', 'trash'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFolder(f);
                  setSelectedId(null);
                }}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-all whitespace-nowrap ${
                  folder === f
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="divide-y divide-white/5 flex-1 overflow-y-auto max-h-[70vh]">
            {emails.length === 0 ? (
              <div className="p-6 text-sm text-slate-400">No Outlook messages found yet.</div>
            ) : (
              emails.map((email) => (
                <button
                  key={email.id}
                  type="button"
                  onClick={() => setSelectedId(email.id)}
                  className={`w-full text-left p-4 transition-colors ${
                    selectedEmail?.id === email.id ? 'bg-blue-500/10' : 'hover:bg-slate-950/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{email.subject || '(no subject)'}</p>
                      <p className="text-xs text-slate-400 truncate mt-1">{email.from}</p>
                    </div>
                    <span className="text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(email.receivedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">{email.snippet}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-900/60 overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-white font-semibold truncate">{selectedEmail?.subject || 'Select a conversation'}</h3>
              <p className="text-xs text-slate-400 truncate">{selectedEmail?.from || 'Outlook mail viewer'}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedEmail && (
                <button
                  type="button"
                  onClick={openReply}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950/50 px-2.5 py-1.5 text-xs text-slate-200 hover:text-white"
                >
                  <Reply className="w-3.5 h-3.5" />
                  Reply
                </button>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-1 text-[11px] text-blue-300">
                <BadgeCheck className="w-3 h-3" />
                Microsoft
              </span>
            </div>
          </div>
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {selectedEmail ? (
              <div
                className="prose prose-invert max-w-none prose-p:text-slate-300 prose-pre:bg-slate-950/60"
                dangerouslySetInnerHTML={{ __html: selectedEmailHtml }}
              />
            ) : (
              <div className="text-sm text-slate-400">Choose a message to view its body.</div>
            )}
            {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-900/60 overflow-hidden flex flex-col justify-center p-6 text-center">
          <Mail className="w-10 h-10 text-blue-400 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">AlphaClone Email Compose</h3>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Send via Microsoft 365 using the same compose flow as CRM, deals, and invoices — with provider selection and AI drafting.
          </p>
          <button
            type="button"
            onClick={() => openCompose()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <PenSquare className="w-4 h-4" />
            Compose Email
          </button>
          {selectedEmail && (
            <button
              type="button"
              onClick={openReply}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-200 hover:text-white"
            >
              <Reply className="w-4 h-4" />
              Reply to Selected
            </button>
          )}
        </div>
      </div>

      {composeModal && user && (
        <CommunicationModal
          user={user}
          recipient={composeModal.recipient}
          prefilledSubject={composeModal.subject}
          prefilledBody={composeModal.body}
          preferredProvider="microsoft"
          lockRecipient={Boolean(composeModal.recipient?.email)}
          onClose={() => setComposeModal(null)}
          onSent={() => {
            setComposeModal(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

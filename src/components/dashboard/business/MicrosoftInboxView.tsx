'use client';

import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Loader2,
  Mail,
  RefreshCw,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { buildSafeEmailBodyHtml } from '@/lib/email/sanitizeEmailHtml';
import { useMicrosoftEmails } from '@/hooks/useMicrosoftEmails';
import { microsoftAuthService } from '@/services/microsoftAuthService';

export default function MicrosoftInboxView() {
  const { emails, loading, connected, error, refresh, sendEmail, folder, setFolder } = useMicrosoftEmails(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [compose, setCompose] = useState({ to: '', subject: '', body: '' });

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

  const handleSend = async () => {
    if (!compose.to.trim() || !compose.subject.trim() || !compose.body.trim()) {
      toast.error('Recipient, subject, and body are required.');
      return;
    }

    setIsSending(true);
    try {
      await sendEmail({
        to: compose.to.split(',').map((item) => item.trim()).filter(Boolean),
        subject: compose.subject,
        body: compose.body,
      });
      toast.success('Outlook email sent');
      setCompose({ to: '', subject: '', body: '' });
    } catch (sendError: any) {
      toast.error(sendError.message || 'Failed to send Outlook email');
    } finally {
      setIsSending(false);
    }
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
    <div className="grid grid-cols-1 xl:grid-cols-[360px,1fr,360px] gap-4 h-full">
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div>
            <h3 className="text-white font-semibold">Outlook Mail</h3>
            <p className="text-xs text-slate-400 capitalize">{folder} Items</p>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            className="rounded-lg border border-white/5 bg-slate-950/50 p-2 text-slate-300 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        
        {/* Premium Folder Tabs Selector */}
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
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">{selectedEmail?.subject || 'Select a conversation'}</h3>
            <p className="text-xs text-slate-400">{selectedEmail?.from || 'Outlook mail viewer'}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-1 text-[11px] text-blue-300">
            <BadgeCheck className="w-3 h-3" />
            Microsoft
          </span>
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

      <div className="rounded-2xl border border-white/5 bg-slate-900/60 overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-white font-semibold">Compose via Outlook</h3>
          <p className="text-xs text-slate-400 mt-1">Same Alphaclone workflow, backed by Microsoft Graph.</p>
        </div>
        <div className="p-4 space-y-3">
          <input
            value={compose.to}
            onChange={(event) => setCompose((prev) => ({ ...prev, to: event.target.value }))}
            placeholder="To"
            className="w-full rounded-xl border border-white/5 bg-slate-950/50 px-3 py-2 text-sm text-white"
          />
          <input
            value={compose.subject}
            onChange={(event) => setCompose((prev) => ({ ...prev, subject: event.target.value }))}
            placeholder="Subject"
            className="w-full rounded-xl border border-white/5 bg-slate-950/50 px-3 py-2 text-sm text-white"
          />
          <textarea
            value={compose.body}
            onChange={(event) => setCompose((prev) => ({ ...prev, body: event.target.value }))}
            rows={12}
            placeholder="Write your email..."
            className="w-full rounded-xl border border-white/5 bg-slate-950/50 px-3 py-2 text-sm text-white resize-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Outlook Email
          </button>
        </div>
      </div>
    </div>
  );
}

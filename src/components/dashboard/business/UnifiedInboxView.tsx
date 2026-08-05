'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  AlertTriangle,
  Forward,
  Loader2,
  Mail,
  Maximize2,
  Minimize2,
  PenSquare,
  RefreshCw,
  Reply,
  ReplyAll,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { classifyEmailFromAddress, type EmailClassification } from '@/lib/email/classifyEmail';
import { buildSafeEmailBodyHtml } from '@/lib/email/sanitizeEmailHtml';
import { refreshMicrosoftTokenIfNeeded, refreshZohoTokenIfNeeded } from '@/lib/email/tokenRefresh';
import { useMicrosoftEmails } from '@/hooks/useMicrosoftEmails';
import { useZohoEmails } from '@/hooks/useZohoEmails';
import { useBonnieDeepLinkFocus } from '@/hooks/useBonnieDeepLinkFocus';
import { microsoftAuthService } from '@/services/microsoftAuthService';
import { microsoftGraphService } from '@/services/microsoftGraphService';
import { businessClientService } from '@/services/businessClientService';
import { contactService } from '@/services/contactService';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import ComposeEmailModal from './ComposeEmailModal';
import EmailLeadInsightPanel from '../inbox/EmailLeadInsightPanel';
import AiDraftReviewBanner from '../inbox/AiDraftReviewBanner';
import { parseEmailFromHeader } from '../crm/emailRecipient';
import type { InboxFolder, InboxLabel, InboxProvider, UnifiedInboxMessage } from '@/types/unifiedInbox';
import { INBOX_LABEL_OPTIONS } from '@/types/unifiedInbox';
import type { DeliveryEmailProvider } from '@/lib/email/emailProviderOptions';
import {
  normalizeDeliveryProvider,
  resolveAutoProvider,
} from '@/lib/email/emailProviderOptions';
import EmailProviderSelector from '@/components/shared/EmailProviderSelector';

type ComposeState = {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  preferredProvider?: DeliveryEmailProvider;
};

type UnifiedInboxViewProps = {
  defaultProvider?: InboxProvider;
  initialFolder?: InboxFolder;
};

function toUnifiedMicrosoft(
  emails: ReturnType<typeof useMicrosoftEmails>['emails']
): UnifiedInboxMessage[] {
  return emails.map((email) => ({
    id: email.id,
    provider: 'microsoft' as const,
    subject: email.subject,
    from: email.from,
    to: email.to,
    snippet: email.snippet,
    body: email.body,
    receivedAt: email.receivedAt,
    threadId: email.threadId,
    isRead: email.isRead,
    hasAttachments: email.hasAttachments,
    webLink: email.webLink,
  }));
}

async function fetchProviderStatus(tenantId?: string): Promise<{ microsoft: boolean; zoho: boolean }> {
  const [microsoft, zoho] = await Promise.all([
    microsoftAuthService.isConnected().catch(() => false),
    tenantId
      ? fetch(`/api/auth/zoho/status?tenantId=${encodeURIComponent(tenantId)}`, { credentials: 'include' })
          .then((r) => r.json().catch(() => ({})))
          .then((d) => Boolean(d.isConnected))
          .catch(() => false)
      : Promise.resolve(false),
  ]);
  return { microsoft, zoho };
}

function buildReplyQuote(email: UnifiedInboxMessage): string {
  const when = new Date(email.receivedAt).toLocaleString();
  const excerpt = email.snippet || '';
  return `\n\n---\nOn ${when}, ${email.from} wrote:\n${excerpt}`;
}

function buildForwardBody(email: UnifiedInboxMessage): string {
  const when = new Date(email.receivedAt).toLocaleString();
  const bodyText = email.body?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || email.snippet || '';
  return `\n\n---------- Forwarded message ----------\nFrom: ${email.from}\nDate: ${when}\nSubject: ${email.subject || '(no subject)'}\n\n${bodyText}`;
}

export default function UnifiedInboxView({ defaultProvider, initialFolder }: UnifiedInboxViewProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlProvider = searchParams?.get('provider');
  const initialProvider: InboxProvider =
    urlProvider === 'zoho' || urlProvider === 'microsoft' ? urlProvider : defaultProvider || 'microsoft';

  const [provider, setProvider] = useState<InboxProvider>(initialProvider);
  const [statusChecked, setStatusChecked] = useState(false);
  const [status, setStatus] = useState({ microsoft: false, zoho: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<ComposeState>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLabel, setActiveLabel] = useState<InboxLabel | 'all'>('all');
  const [labelMap, setLabelMap] = useState<Record<string, InboxLabel[]>>({});
  const [loadingBody, setLoadingBody] = useState(false);
  const [emailClassification, setEmailClassification] = useState<EmailClassification>('Direct');
  const [senderKnown, setSenderKnown] = useState<boolean | null>(null);
  const [creatingContact, setCreatingContact] = useState(false);
  const [readerExpanded, setReaderExpanded] = useState(false);

  const [threadMessages, setThreadMessages] = useState<UnifiedInboxMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [inlineReply, setInlineReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deliveryProvider, setDeliveryProvider] = useState<DeliveryEmailProvider>('auto');
  const [workspaceDefault, setWorkspaceDefault] = useState<DeliveryEmailProvider>('auto');
  const [providerOptions, setProviderOptions] = useState<
    Array<{ id: DeliveryEmailProvider; label: string; connected: boolean; native?: boolean; campaigns?: boolean }>
  >([]);

  const microsoft = useMicrosoftEmails(50, statusChecked && provider === 'microsoft');
  const zoho = useZohoEmails(50, statusChecked && provider === 'zoho', currentTenant?.id);

  useBonnieDeepLinkFocus({
    onFocus: ({ tab, focus }) => {
      if (tab === 'sent' || tab === 'drafts' || tab === 'trash' || tab === 'inbox') {
        if (provider === 'microsoft') microsoft.setFolder(tab);
        if (provider === 'zoho') zoho.setFolder(tab);
      }
      if (focus === 'draft' || focus === 'compose') {
        setComposeOpen(true);
      }
    },
    showToast: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await fetchProviderStatus(currentTenant?.id);
      if (cancelled) return;
      setStatus(next);
      const preferred =
        urlProvider === 'zoho' || urlProvider === 'microsoft' ? urlProvider : defaultProvider;
      if (
        preferred &&
        ((preferred === 'microsoft' && next.microsoft) || (preferred === 'zoho' && next.zoho))
      ) {
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
  }, [defaultProvider, urlProvider, currentTenant?.id]);

  useEffect(() => {
    if (!currentTenant?.id) return;
    fetch(`/api/settings/email-provider?tenantId=${encodeURIComponent(currentTenant.id)}`, {
      credentials: 'include',
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        const connected = (data.connectedProviders || []) as typeof providerOptions;
        setProviderOptions(connected);
        const tenantDefault = normalizeDeliveryProvider(data.defaultProvider);
        setWorkspaceDefault(tenantDefault);
        setDeliveryProvider(tenantDefault);
      })
      .catch(() => {});
  }, [currentTenant?.id]);

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
  const providerConnected =
    provider === 'microsoft' ? status.microsoft : status.zoho;

  useEffect(() => {
    if (!statusChecked || !anyConnected) return;

    const refreshTokens = () => {
      if (status.microsoft) void refreshMicrosoftTokenIfNeeded(false);
      if (status.zoho) void refreshZohoTokenIfNeeded(false, currentTenant?.id);
    };

    refreshTokens();
    const interval = window.setInterval(refreshTokens, 25 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [statusChecked, anyConnected, status.microsoft, status.zoho, currentTenant?.id]);

  const emails: UnifiedInboxMessage[] = useMemo(() => {
    if (provider === 'microsoft') return toUnifiedMicrosoft(microsoft.emails);
    return zoho.emails;
  }, [provider, microsoft.emails, zoho.emails]);

  const folder = active.folder as InboxFolder;
  const setFolder = active.setFolder as (f: InboxFolder) => void;

  useEffect(() => {
    if (initialFolder) setFolder(initialFolder);
  }, [initialFolder, setFolder]);

  useEffect(() => {
    if (!currentTenant?.id || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(`inbox_labels_${currentTenant.id}`);
      if (raw) setLabelMap(JSON.parse(raw) as Record<string, InboxLabel[]>);
    } catch {
      /* ignore */
    }
  }, [currentTenant?.id]);

  const persistLabels = useCallback(
    (next: Record<string, InboxLabel[]>) => {
      setLabelMap(next);
      if (currentTenant?.id && typeof window !== 'undefined') {
        window.localStorage.setItem(`inbox_labels_${currentTenant.id}`, JSON.stringify(next));
      }
    },
    [currentTenant?.id]
  );

  const toggleMessageLabel = useCallback(
    (messageId: string, label: InboxLabel) => {
      const key = `${provider}:${messageId}`;
      const current = labelMap[key] || [];
      const nextLabels = current.includes(label)
        ? current.filter((l) => l !== label)
        : [...current, label];
      persistLabels({ ...labelMap, [key]: nextLabels });
    },
    [labelMap, persistLabels, provider]
  );

  const filteredEmails = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return emails.filter((email) => {
      const key = `${provider}:${email.id}`;
      const labels = email.labels || labelMap[key] || [];
      if (activeLabel !== 'all' && !labels.includes(activeLabel)) return false;
      if (!q) return true;
      return (
        (email.subject || '').toLowerCase().includes(q) ||
        (email.from || '').toLowerCase().includes(q) ||
        (email.snippet || '').toLowerCase().includes(q)
      );
    });
  }, [emails, searchQuery, activeLabel, labelMap, provider]);

  const selectedEmail = useMemo(
    () => filteredEmails.find((email) => email.id === selectedId) || null,
    [filteredEmails, selectedId]
  );

  const displayMessages = threadMessages.length > 0 ? threadMessages : selectedEmail ? [selectedEmail] : [];

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
    setThreadMessages([]);
    setInlineReply('');
    setSearchQuery('');
  };

  const openCompose = (draft: ComposeState) => {
    const connectedIds = providerOptions.filter((p) => p.connected).map((p) => p.id);
    const resolved =
      deliveryProvider === 'auto'
        ? resolveAutoProvider(connectedIds, workspaceDefault)
        : deliveryProvider;
    setComposeDraft({
      ...draft,
      preferredProvider: draft.preferredProvider || resolved,
    });
    setComposeOpen(true);
  };

  const openNewEmail = () => {
    openCompose({});
  };

  const openReply = (replyAll = false, bodyOverride?: string) => {
    if (!selectedEmail) {
      toast.error('Select a message to reply to.');
      return;
    }
    const parsed = parseEmailFromHeader(selectedEmail.from || '');
    if (!parsed.email) {
      toast.error('Could not parse sender email from this message.');
      return;
    }
    const subject = selectedEmail.subject?.match(/^Re:/i)
      ? selectedEmail.subject
      : `Re: ${selectedEmail.subject || ''}`;
    const toList = replyAll
      ? [parsed.email, ...(selectedEmail.to || []).filter((e) => e && e !== parsed.email)]
      : [parsed.email];
    openCompose({
      to: [...new Set(toList)].join(', '),
      subject,
      body: bodyOverride ?? buildReplyQuote(selectedEmail),
    });
  };

  const openForward = () => {
    if (!selectedEmail) {
      toast.error('Select a message to forward.');
      return;
    }
    openCompose({
      subject: selectedEmail.subject?.match(/^Fwd:/i)
        ? selectedEmail.subject
        : `Fwd: ${selectedEmail.subject || ''}`,
      body: buildForwardBody(selectedEmail),
    });
  };

  const openDraftInCompose = (email: UnifiedInboxMessage) => {
    const parsed = parseEmailFromHeader(email.from || '');
    openCompose({
      to: (email.to || []).join(', ') || parsed.email || '',
      subject: email.subject || '',
      body: email.body || email.snippet || '',
    });
  };

  const handleSelectEmail = (email: UnifiedInboxMessage) => {
    if (folder === 'drafts') {
      void (async () => {
        let full = email;
        try {
          if (provider === 'zoho' && !email.body) {
            const body = await zoho.loadMessageBody(email);
            full = { ...email, body };
          } else if (provider === 'microsoft' && !email.body) {
            const detailed = await microsoftGraphService.getMessage(email.id);
            full = {
              ...email,
              body: detailed.body,
              to: detailed.to,
              subject: detailed.subject,
            };
          }
        } catch {
          /* use list metadata */
        }
        openDraftInCompose(full);
      })();
      return;
    }
    setSelectedId(email.id);
    setInlineReply('');
    setThreadMessages([]);
  };

  useEffect(() => {
    if (!selectedEmail || provider !== 'microsoft' || folder === 'drafts') {
      setThreadMessages([]);
      return;
    }

    let cancelled = false;
    setThreadLoading(true);
    (async () => {
      try {
        if (selectedEmail.threadId) {
          const msgs = await microsoftGraphService.getConversationMessages(
            selectedEmail.threadId,
            selectedEmail.id
          );
          if (cancelled) return;
          setThreadMessages(
            msgs.map((m) => ({
              id: m.id,
              provider: 'microsoft' as const,
              subject: m.subject,
              from: m.from,
              to: m.to,
              snippet: m.snippet,
              body: m.body,
              receivedAt: m.receivedAt,
              threadId: m.threadId,
              isRead: m.isRead,
              hasAttachments: m.hasAttachments,
              webLink: m.webLink,
            }))
          );
        } else {
          setThreadMessages([selectedEmail]);
        }
      } catch {
        if (!cancelled) setThreadMessages([selectedEmail]);
      } finally {
        if (!cancelled) setThreadLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedEmail?.id, provider, folder, selectedEmail]);

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

  useEffect(() => {
    if (!selectedEmail?.from) {
      setSenderKnown(null);
      setEmailClassification('Direct');
      return;
    }
    const parsed = parseEmailFromHeader(selectedEmail.from);
    if (!parsed.email) return;

    let cancelled = false;
    (async () => {
      try {
        const tenantId = currentTenant?.id;
        const [{ clients }, { contacts }] = await Promise.all([
          tenantId
            ? businessClientService.getClients(tenantId, 1, 50, false, parsed.email)
            : Promise.resolve({ clients: [] as Awaited<ReturnType<typeof businessClientService.getClients>>['clients'] }),
          contactService.getContacts({ search: parsed.email }),
        ]);
        if (cancelled) return;
        const isClient = (clients || []).some(
          (c) => c.email?.toLowerCase() === parsed.email.toLowerCase()
        );
        const isLead = (contacts || []).some(
          (c) => c.email?.toLowerCase() === parsed.email.toLowerCase()
        );
        setSenderKnown(isClient || isLead);
        setEmailClassification(
          classifyEmailFromAddress(selectedEmail.from, {
            isKnownClient: isClient,
            isKnownLead: isLead && !isClient,
          })
        );
      } catch {
        if (!cancelled) {
          setSenderKnown(false);
          setEmailClassification(classifyEmailFromAddress(selectedEmail.from));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedEmail?.from, currentTenant?.id]);

  const handleCreateContactFromSender = async () => {
    if (!selectedEmail?.from) return;
    const parsed = parseEmailFromHeader(selectedEmail.from);
    if (!parsed.email) {
      toast.error('Could not parse sender email.');
      return;
    }
    setCreatingContact(true);
    try {
      const nameParts = (parsed.name || parsed.email.split('@')[0]).trim().split(/\s+/);
      const firstName = nameParts[0] || 'Contact';
      const lastName = nameParts.slice(1).join(' ') || 'Unknown';
      const { contact, error } = await contactService.createContact({
        firstName,
        lastName,
        email: parsed.email,
        status: 'active',
      });
      if (error) throw new Error(error);
      toast.success(`Added ${contact?.fullName || parsed.email} to CRM`);
      setSenderKnown(true);
      setEmailClassification('Lead');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create contact');
    } finally {
      setCreatingContact(false);
    }
  };

  const handleInlineReply = async (replyAll = false) => {
    if (!selectedEmail || !inlineReply.trim()) return;
    if (provider !== 'microsoft') {
      openReply(replyAll);
      return;
    }
    setSendingReply(true);
    try {
      if (replyAll) {
        await microsoftGraphService.replyAllToMessage(selectedEmail.id, inlineReply);
      } else {
        await microsoftGraphService.replyToMessage(selectedEmail.id, inlineReply);
      }
      toast.success('Reply sent via Outlook');
      setInlineReply('');
      refresh();
      if (selectedEmail.threadId) {
        const msgs = await microsoftGraphService.getConversationMessages(
          selectedEmail.threadId,
          selectedEmail.id
        );
        setThreadMessages(
          msgs.map((m) => ({
            id: m.id,
            provider: 'microsoft' as const,
            subject: m.subject,
            from: m.from,
            to: m.to,
            snippet: m.snippet,
            body: m.body,
            receivedAt: m.receivedAt,
            threadId: m.threadId,
            isRead: m.isRead,
            hasAttachments: m.hasAttachments,
            webLink: m.webLink,
          }))
        );
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmail) return;
    setDeleting(true);
    try {
      if (provider === 'microsoft') {
        await microsoftGraphService.deleteMessage(selectedEmail.id);
      } else if (selectedEmail.zohoFolderId) {
        const res = await fetch(
          `/api/zoho/mail?messageId=${encodeURIComponent(selectedEmail.id)}&folderId=${encodeURIComponent(selectedEmail.zohoFolderId)}&tenantId=${encodeURIComponent(currentTenant?.id || '')}`,
          { method: 'DELETE', credentials: 'include' }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to delete message');
        }
      }
      toast.success('Message moved to trash');
      setSelectedId(null);
      setThreadMessages([]);
      refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete message');
    } finally {
      setDeleting(false);
    }
  };

  const classificationColors: Record<EmailClassification, string> = {
    Marketing: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    Lead: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    Client: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    Unverified: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    Direct: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  };

  const connectMicrosoft = () => {
    const search = searchParams?.toString();
    microsoftAuthService.initiateOAuth(`${pathname}${search ? `?${search}` : ''}`);
  };

  const connectZoho = () => {
    window.location.href = '/api/auth/zoho/connect';
  };

  useEffect(() => {
    if (!readerExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setReaderExpanded(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [readerExpanded]);

  if (!statusChecked) {
    return (
      <div className="ac-workspace-panel rounded-lg p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-teal-400 mx-auto mb-3" />
        <p className="text-sm text-slate-400">Checking your email accounts…</p>
      </div>
    );
  }

  if (!anyConnected) {
    return (
      <div className="ac-workspace-panel rounded-lg p-8 text-center max-w-lg mx-auto">
        <Mail className="w-10 h-10 text-teal-400 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">Connect email to see your inbox</h2>
        <p className="text-sm text-slate-400 mb-6">
          Link Outlook or Zoho to read mail here. When you send, pick Microsoft, Zoho, Brevo, SendGrid, or Resend — whatever you have connected.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={connectMicrosoft}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Connect Microsoft 365
          </button>
          <button
            type="button"
            onClick={connectZoho}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Connect Zoho Mail
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={readerExpanded ? 'fixed inset-0 z-[80] bg-slate-950 p-0 sm:p-3' : 'relative h-full min-h-0'}>
      <div
        className={`flex h-full overflow-hidden bg-[#1e2129] ${readerExpanded ? 'rounded-none sm:rounded-xl' : 'rounded-xl border border-white/[0.06] min-h-[480px]'}`}
        role="region"
        aria-label="Email mailbox"
      >
        {/* ── Left sidebar ─────────────────────────────────────── */}
        <div className={`${readerExpanded ? 'hidden' : selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-[260px] lg:w-[280px] flex-col bg-[#1a1d24] border-r border-white/[0.06] shrink-0`}>
          {/* Top: Compose + refresh + provider toggle */}
          <div className="px-3 pt-4 pb-2 space-y-2.5">
            <AiDraftReviewBanner onOpenDraft={(draft) => { openCompose({ to: draft.fromEmail || draft.from || '', subject: draft.subject?.match(/^Re:/i) ? draft.subject : `Re: ${draft.subject || ''}`, body: draft.body || '' }); }} />
            <div className="flex gap-2">
              <button type="button" onClick={openNewEmail} disabled={!providerConnected}
                className="flex-1 flex items-center gap-2 rounded-2xl bg-[#2a2f3d] hover:bg-[#333a4d] disabled:opacity-40 px-4 py-2.5 text-sm font-semibold text-white shadow transition-colors">
                <PenSquare className="w-4 h-4 text-blue-400" /> Compose
              </button>
              <button type="button" onClick={refresh} aria-label="Refresh"
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04]">
              <button type="button" onClick={() => switchProvider('microsoft')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${provider === 'microsoft' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {status.microsoft ? '● ' : '○ '}Outlook
              </button>
              <button type="button" onClick={() => switchProvider('zoho')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${provider === 'zoho' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {status.zoho ? '● ' : '○ '}Zoho
              </button>
            </div>
          </div>

          {/* Folder nav */}
          <nav className="px-2 pb-1 space-y-0.5" aria-label="Mail folders">
            {(['inbox', 'sent', 'drafts', 'trash'] as InboxFolder[]).map((f) => {
              const FIcon = f === 'inbox' ? Mail : f === 'sent' ? Send : f === 'drafts' ? PenSquare : Trash2;
              const isActive = folder === f;
              return (
                <button key={f} type="button"
                  onClick={() => { setFolder(f); setSelectedId(null); setThreadMessages([]); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-blue-600/15 text-blue-300 font-semibold' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'}`}>
                  <FIcon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                  <span className="capitalize">{f}</span>
                </button>
              );
            })}
            <Link href="/dashboard/business/campaigns"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-white/[0.04] hover:text-white transition-colors">
              <Users className="w-4 h-4" /><span>Bulk campaigns</span>
            </Link>
          </nav>

          {/* Label chips */}
          <div className="px-3 py-1.5 flex flex-wrap gap-1 border-t border-white/[0.04]">
            <button type="button" onClick={() => setActiveLabel('all')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-full border transition-colors ${activeLabel === 'all' ? 'bg-blue-600/20 text-blue-300 border-blue-500/30' : 'text-slate-500 border-white/10 hover:text-slate-300'}`}>
              All
            </button>
            {INBOX_LABEL_OPTIONS.map((opt) => (
              <button key={opt.id} type="button" onClick={() => setActiveLabel(opt.id)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-full border transition-colors ${activeLabel === opt.id ? 'bg-blue-600/20 text-blue-300 border-blue-500/30' : 'text-slate-500 border-white/10 hover:text-slate-300'}`}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Alerts */}
          {!providerConnected && (
            <div className="mx-3 mb-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
              {provider === 'microsoft'
                ? <><span>Outlook not connected. </span><button type="button" onClick={connectMicrosoft} className="underline font-bold">Connect</button></>
                : <><span>Zoho not connected. </span><button type="button" onClick={connectZoho} className="underline font-bold">Connect</button></>}
            </div>
          )}
          {active.error && (
            <div className="mx-3 mb-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-300 space-y-1">
              <p>{active.error}</p>
              <div className="flex gap-3">
                <button type="button" onClick={refresh} className="underline font-bold">Retry</button>
                {/expired|reconnect|not connected/i.test(active.error) && (
                  <button type="button" onClick={provider === 'microsoft' ? connectMicrosoft : connectZoho} className="underline font-bold">
                    Reconnect {provider === 'microsoft' ? 'Outlook' : 'Zoho'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search mail…" aria-label="Search mail"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors" />
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto" role="list" aria-label={`${folder} messages`}>
            {active.loading ? (
              <div className="p-6 flex flex-col items-center gap-2 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                <span className="text-xs">Loading {folder}…</span>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="p-6 text-xs text-slate-500 text-center space-y-2">
                <p>{providerConnected ? `No messages in ${folder}.` : 'Connect this account first.'}</p>
                {providerConnected && folder !== 'drafts' && (
                  <button type="button" onClick={openNewEmail} className="text-blue-400 underline text-xs font-semibold">Compose a new email</button>
                )}
              </div>
            ) : (
              filteredEmails.map((email) => {
                const isSelected = selectedEmail?.id === email.id && folder !== 'drafts';
                const isUnread = email.isRead === false;
                const senderLabel = folder === 'sent' || folder === 'drafts'
                  ? (email.to || []).join(', ') || 'Draft'
                  : (email.from || '').split('<')[0].trim() || email.from || 'Unknown';
                const initial = senderLabel.trim()[0]?.toUpperCase() || '?';
                const avatarPalette = ['bg-blue-600','bg-violet-600','bg-rose-600','bg-amber-600','bg-teal-600','bg-indigo-600'];
                const avatarBg = avatarPalette[initial.charCodeAt(0) % avatarPalette.length];
                const rowLabels = labelMap[`${provider}:${email.id}`] || email.labels || [];
                return (
                  <button key={`${email.provider}-${email.id}`} type="button" role="listitem"
                    onClick={() => handleSelectEmail(email)}
                    className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-all border-b border-white/[0.04] ${isSelected ? 'bg-blue-600/10 border-l-2 border-l-blue-500' : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'} ${isUnread && !isSelected ? 'bg-white/[0.015]' : ''}`}>
                    <div className={`w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5`}>
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1 mb-0.5">
                        <p className={`text-xs truncate ${isUnread ? 'font-bold text-white' : 'font-medium text-slate-300'}`}>{senderLabel}</p>
                        <span className="text-[10px] text-slate-600 shrink-0">
                          {new Date(email.receivedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className={`text-[11px] truncate mb-0.5 ${isUnread ? 'font-semibold text-slate-200' : 'text-slate-400'}`}>
                        {email.subject || '(no subject)'}
                      </p>
                      {email.snippet && <p className="text-[11px] text-slate-600 truncate">{email.snippet}</p>}
                      {rowLabels.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {rowLabels.map((lab) => (
                            <span key={lab} className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                              {INBOX_LABEL_OPTIONS.find((o) => o.id === lab)?.label || lab}
                            </span>
                          ))}
                        </div>
                      )}
                      {folder === 'drafts' && <span className="text-[10px] font-bold text-amber-400">Draft — tap to edit</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Reading pane ────────────────────────────────────── */}
        <div className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
          {selectedEmail && folder !== 'drafts' ? (
            <>
              {/* Header */}
              <div className="px-5 pt-4 pb-3 border-b border-white/[0.06] shrink-0">
                <div className="flex items-start gap-2 mb-3">
                  <button type="button" onClick={() => { setSelectedId(null); setThreadMessages([]); }}
                    className="md:hidden p-1 -ml-1 text-slate-400 hover:text-white shrink-0 mt-1" aria-label="Back">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h3 className="flex-1 text-base font-bold text-white leading-snug">{selectedEmail.subject || '(no subject)'}</h3>
                  <button type="button" onClick={() => setReaderExpanded((c) => !c)}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    title={readerExpanded ? 'Exit full window (Esc)' : 'Full window'}>
                    {readerExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>

                {/* Sender meta */}
                <div className="flex items-center gap-3">
                  {(() => {
                    const s = (selectedEmail.from || '').split('<')[0].trim() || '?';
                    const init = s[0]?.toUpperCase() || '?';
                    const palette = ['bg-blue-600','bg-violet-600','bg-rose-600','bg-amber-600','bg-teal-600','bg-indigo-600'];
                    return (
                      <div className={`w-9 h-9 rounded-full ${palette[init.charCodeAt(0) % palette.length]} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                        {init}
                      </div>
                    );
                  })()}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white truncate">{selectedEmail.from}</p>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${provider === 'microsoft' ? 'bg-blue-500/15 text-blue-300' : 'bg-teal-500/15 text-teal-300'}`}>
                        {provider === 'microsoft' ? 'Outlook' : 'Zoho'}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${classificationColors[emailClassification]}`}>
                        {emailClassification === 'Unverified' && <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />}
                        {emailClassification}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{new Date(selectedEmail.receivedAt).toLocaleString()}</p>
                  </div>
                </div>

                {/* Label toggle pills */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {INBOX_LABEL_OPTIONS.map((opt) => {
                    const key = `${provider}:${selectedEmail.id}`;
                    const assigned = (labelMap[key] || selectedEmail.labels || []).includes(opt.id);
                    return (
                      <button key={opt.id} type="button" onClick={() => toggleMessageLabel(selectedEmail.id, opt.id)}
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border transition-colors ${assigned ? 'bg-blue-500/20 text-blue-200 border-blue-500/40' : 'text-slate-600 border-white/10 hover:border-blue-500/30 hover:text-slate-400'}`}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Unknown sender CTA */}
                {senderKnown === false && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-amber-400 font-semibold">Unknown sender</span>
                    <button type="button" onClick={handleCreateContactFromSender} disabled={creatingContact}
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 disabled:opacity-50">
                      {creatingContact ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                      Add to CRM
                    </button>
                  </div>
                )}

                {/* Action toolbar */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <button type="button" onClick={() => openReply(false)} disabled={!providerConnected}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40 transition-colors">
                    <Reply className="w-3.5 h-3.5" /> Reply
                  </button>
                  <button type="button" onClick={() => openReply(true)} disabled={!providerConnected}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40 transition-colors">
                    <ReplyAll className="w-3.5 h-3.5" /> Reply all
                  </button>
                  <button type="button" onClick={openForward} disabled={!providerConnected}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40 transition-colors">
                    <Forward className="w-3.5 h-3.5" /> Forward
                  </button>
                  <button type="button" onClick={handleDelete} disabled={deleting}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-300 disabled:opacity-40 transition-colors">
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
                  </button>
                  {selectedEmail.webLink && (
                    <a href={selectedEmail.webLink} target="_blank" rel="noopener noreferrer"
                      className="ml-auto text-[10px] text-blue-400 hover:text-blue-300 font-bold">
                      Open in Outlook ↗
                    </a>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                <EmailLeadInsightPanel from={selectedEmail.from} subject={selectedEmail.subject} collapsible />
                {threadLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading conversation…
                  </div>
                ) : displayMessages.length > 1 ? (
                  displayMessages.map((msg) => {
                    const init = (msg.from || '')[0]?.toUpperCase() || '?';
                    const palette = ['bg-blue-600','bg-violet-600','bg-rose-600','bg-amber-600','bg-teal-600','bg-indigo-600'];
                    return (
                      <div key={msg.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-7 h-7 rounded-full ${palette[init.charCodeAt(0) % palette.length]} flex items-center justify-center text-white text-xs font-bold`}>{init}</div>
                          <p className="text-sm font-semibold text-white flex-1 truncate">{msg.from}</p>
                          <span className="text-[10px] text-slate-500 shrink-0">{new Date(msg.receivedAt).toLocaleString()}</span>
                        </div>
                        <div className="prose prose-invert max-w-none prose-p:text-slate-300 text-sm"
                          dangerouslySetInnerHTML={{ __html: buildSafeEmailBodyHtml(msg.body, msg.snippet) }} />
                      </div>
                    );
                  })
                ) : loadingBody && provider === 'zoho' && !selectedEmail.body ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading message…
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none prose-p:text-slate-300 text-sm"
                    dangerouslySetInnerHTML={{ __html: selectedEmailHtml }} />
                )}
              </div>

              {/* Quick reply */}
              {folder !== 'sent' && folder !== 'trash' && (
                <div className="px-5 py-4 border-t border-white/[0.06] shrink-0">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                    {providerOptions.some((p) => p.connected) && (
                      <EmailProviderSelector value={deliveryProvider} onChange={setDeliveryProvider} providers={providerOptions} compact />
                    )}
                    <textarea value={inlineReply} onChange={(e) => setInlineReply(e.target.value)}
                      placeholder="Reply…" rows={3} aria-label="Quick reply"
                      className="w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none resize-none" />
                    <div className="flex items-center justify-end gap-2">
                      {provider === 'microsoft' && deliveryProvider === 'microsoft' && (
                        <button type="button" onClick={() => handleInlineReply(true)} disabled={sendingReply || !inlineReply.trim()}
                          className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40">
                          <ReplyAll className="w-3.5 h-3.5" /> Reply all
                        </button>
                      )}
                      <button type="button"
                        onClick={() => { if (provider === 'microsoft' && deliveryProvider === 'microsoft') { void handleInlineReply(false); return; } openReply(false, `${inlineReply}${buildReplyQuote(selectedEmail!)}`); }}
                        disabled={sendingReply || !inlineReply.trim()}
                        className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40 transition-colors">
                        {sendingReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Mail className="w-14 h-14 text-slate-700 mb-4" />
              <p className="text-sm font-semibold text-slate-400 mb-1">Select an email to read</p>
              <p className="text-xs max-w-xs text-slate-600 mb-5">Read Outlook or Zoho mail. Compose sends via Microsoft, Zoho, Brevo, SendGrid, or Resend.</p>
              <button type="button" onClick={openNewEmail} disabled={!providerConnected}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-5 py-2.5 text-sm font-bold text-white transition-colors">
                <PenSquare className="w-4 h-4" /> Compose
              </button>
            </div>
          )}
        </div>
      </div>

      {composeOpen && user && (
        <ComposeEmailModal isOpen={composeOpen}
          onClose={() => { setComposeOpen(false); refresh(); }}
          userId={user.id}
          initialTo={composeDraft.to || ''}
          initialSubject={composeDraft.subject || ''}
          initialBody={composeDraft.body || ''}
          preferredProvider={composeDraft.preferredProvider}
          presentation="dock" skipCrmGate entityType="direct" />
      )}
    </div>
  );

}

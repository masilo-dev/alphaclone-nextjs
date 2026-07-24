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
    <>
      <div className="mb-3">
        <AiDraftReviewBanner
          onOpenDraft={(draft) => {
            openCompose({
              to: draft.fromEmail || draft.from || '',
              subject: draft.subject?.match(/^Re:/i) ? draft.subject : `Re: ${draft.subject || ''}`,
              body: draft.body || '',
            });
          }}
        />
      </div>
      <div
        className="flex h-[min(88dvh,820px)] min-h-[480px] ac-workspace-panel overflow-hidden"
        role="region"
        aria-label="Email mailbox"
      >
        {/* Sidebar list */}
        <div
          className={`${
            selectedId ? 'hidden md:flex' : 'flex'
          } w-full md:w-[340px] lg:w-[380px] flex-col border-r border-white/5 bg-slate-950/50 shrink-0`}
        >
          <div className="p-3 border-b border-white/5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">Mail</h3>
                <p className="text-[10px] text-slate-500">
                  {active.loading ? 'Loading…' : `${filteredEmails.length} message${filteredEmails.length === 1 ? '' : 's'}`}
                </p>
              </div>
              <button
                type="button"
                onClick={refresh}
                className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white"
                aria-label="Refresh mailbox"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={openNewEmail}
              disabled={!providerConnected}
              aria-label="Compose new email"
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-40 px-4 py-2.5 text-sm font-bold text-white"
            >
              <PenSquare className="w-4 h-4" />
              Compose
            </button>

            <Link
              href="/dashboard/business/campaigns"
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
            >
              <Users className="w-3.5 h-3.5" />
              Bulk send (campaigns)
            </Link>

            <div className="flex gap-1 p-1 rounded-lg bg-slate-900 border border-white/5">
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
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
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
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200 space-y-2">
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
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search mail…"
                aria-label="Search mail"
                className="w-full bg-slate-900 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/40"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Mail folders">
              {(['inbox', 'sent', 'drafts', 'trash'] as InboxFolder[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={folder === f}
                  onClick={() => {
                    setFolder(f);
                    setSelectedId(null);
                    setThreadMessages([]);
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

            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Mail labels">
              <button
                type="button"
                role="tab"
                aria-selected={activeLabel === 'all'}
                onClick={() => setActiveLabel('all')}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-full whitespace-nowrap ${
                  activeLabel === 'all'
                    ? 'bg-white/10 text-white'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                All labels
              </button>
              {INBOX_LABEL_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={activeLabel === opt.id}
                  onClick={() => setActiveLabel(opt.id)}
                  className={`px-2.5 py-1 text-[10px] font-semibold rounded-full whitespace-nowrap ${
                    activeLabel === opt.id
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/5" role="list" aria-label={`${folder} messages`}>
            {active.loading ? (
              <div className="p-6 flex flex-col items-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                <span className="text-xs">Loading {folder}…</span>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 text-center space-y-2">
                <p>{providerConnected ? `No messages in ${folder}.` : 'Connect this account first.'}</p>
                {providerConnected && folder !== 'drafts' && (
                  <button type="button" onClick={openNewEmail} className="text-teal-400 text-xs font-semibold underline">
                    Compose a new email
                  </button>
                )}
              </div>
            ) : (
              filteredEmails.map((email) => (
                <button
                  key={`${email.provider}-${email.id}`}
                  type="button"
                  role="listitem"
                  onClick={() => handleSelectEmail(email)}
                  className={`w-full text-left p-3 transition-colors ${
                    selectedEmail?.id === email.id && folder !== 'drafts'
                      ? 'bg-teal-500/10 border-l-2 border-l-teal-500'
                      : 'hover:bg-white/5 border-l-2 border-l-transparent'
                  } ${email.isRead === false ? 'bg-white/[0.02]' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p
                      className={`text-sm truncate ${
                        email.isRead === false ? 'font-bold text-white' : 'font-semibold text-white'
                      }`}
                    >
                      {folder === 'sent' || folder === 'drafts'
                        ? email.subject || '(no subject)'
                        : (email.from || '').split('<')[0].trim() || email.from || 'Unknown'}
                    </p>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(email.receivedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-300 truncate">
                    {folder === 'sent' || folder === 'drafts'
                      ? (email.to || []).join(', ') || email.from || 'Draft'
                      : email.subject || '(no subject)'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{email.snippet}</p>
                  {(labelMap[`${provider}:${email.id}`] || email.labels || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(labelMap[`${provider}:${email.id}`] || email.labels || []).map((lab) => (
                        <span
                          key={lab}
                          className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20"
                        >
                          {INBOX_LABEL_OPTIONS.find((o) => o.id === lab)?.label || lab}
                        </span>
                      ))}
                    </div>
                  )}
                  {folder === 'drafts' && (
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase text-amber-400">
                      Tap to edit draft
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Read & reply */}
        <div className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
          {selectedEmail && folder !== 'drafts' ? (
            <>
              <div className="flex items-center gap-2 p-3 md:p-4 border-b border-white/5 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setThreadMessages([]);
                  }}
                  className="md:hidden p-2 -ml-1 text-slate-400 hover:text-white"
                  aria-label="Back to list"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border mr-1.5 ${classificationColors[emailClassification]}`}
                  >
                    {emailClassification === 'Unverified' && <AlertTriangle className="w-3 h-3" />}
                    {emailClassification}
                  </span>
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
                  <div className="mt-2 flex flex-wrap gap-1">
                    {INBOX_LABEL_OPTIONS.map((opt) => {
                      const key = `${provider}:${selectedEmail.id}`;
                      const assigned = (labelMap[key] || selectedEmail.labels || []).includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleMessageLabel(selectedEmail.id, opt.id)}
                          className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border transition-colors ${
                            assigned
                              ? 'bg-teal-500/20 text-teal-200 border-teal-500/40'
                              : 'bg-transparent text-slate-500 border-white/10 hover:border-teal-500/30 hover:text-slate-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {senderKnown === false && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] text-amber-400 font-semibold">Unknown sender</span>
                      <button
                        type="button"
                        onClick={handleCreateContactFromSender}
                        disabled={creatingContact}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-lg bg-teal-600/20 text-teal-300 hover:bg-teal-600/30 disabled:opacity-50"
                      >
                        {creatingContact ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <UserPlus className="w-3 h-3" />
                        )}
                        Create Contact
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => openReply(false)}
                    disabled={!providerConnected}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 disabled:opacity-40"
                    title="Reply with provider picker (Brevo, Zoho, Outlook, etc.)"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => openReply(true)}
                    disabled={!providerConnected}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 disabled:opacity-40"
                  >
                    <ReplyAll className="w-3.5 h-3.5" />
                    All
                  </button>
                  <button
                    type="button"
                    onClick={openForward}
                    disabled={!providerConnected}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 disabled:opacity-40"
                  >
                    <Forward className="w-3.5 h-3.5" />
                    Fwd
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1.5 text-[10px] font-bold text-rose-300 disabled:opacity-40"
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                  {selectedEmail.webLink && (
                    <a
                      href={selectedEmail.webLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 px-2 py-1.5"
                    >
                      Open in Outlook
                    </a>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">
                <EmailLeadInsightPanel from={selectedEmail.from} subject={selectedEmail.subject} />

                {threadLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading conversation…
                  </div>
                ) : displayMessages.length > 1 ? (
                  displayMessages.map((msg) => (
                    <div key={msg.id} className="border-b border-white/5 pb-6 last:border-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold text-white">{msg.from}</p>
                        <span className="text-[10px] text-slate-500">
                          {new Date(msg.receivedAt).toLocaleString()}
                        </span>
                      </div>
                      <div
                        className="prose prose-invert max-w-none prose-p:text-slate-300 prose-pre:bg-slate-950/60 text-sm"
                        dangerouslySetInnerHTML={{
                          __html: buildSafeEmailBodyHtml(msg.body, msg.snippet),
                        }}
                      />
                    </div>
                  ))
                ) : loadingBody && provider === 'zoho' && !selectedEmail.body ? (
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

              {folder !== 'sent' && folder !== 'trash' && (
                <div className="p-4 border-t border-white/5 shrink-0">
                  <div className="rounded-xl border border-white/10 bg-slate-950/80 p-3 space-y-3">
                    {providerOptions.some((p) => p.connected) && (
                      <EmailProviderSelector
                        value={deliveryProvider}
                        onChange={setDeliveryProvider}
                        providers={providerOptions}
                        compact
                      />
                    )}
                    <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                      {provider === 'microsoft' && deliveryProvider === 'microsoft'
                        ? 'Quick reply via Outlook'
                        : 'Quick reply — or open full compose to send'}
                    </p>
                    <textarea
                      value={inlineReply}
                      onChange={(e) => setInlineReply(e.target.value)}
                      placeholder="Type your reply…"
                      rows={3}
                      aria-label="Quick reply message"
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/40 resize-y"
                    />
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[10px] text-slate-500">
                        Send via Brevo, SendGrid, Resend, Zoho, or Outlook — pick above or use Reply for full compose.
                      </p>
                      <div className="flex gap-2">
                        {provider === 'microsoft' && deliveryProvider === 'microsoft' && (
                          <button
                            type="button"
                            onClick={() => handleInlineReply(true)}
                            disabled={sendingReply || !inlineReply.trim()}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40"
                          >
                            <ReplyAll className="w-3.5 h-3.5" />
                            Reply all
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (provider === 'microsoft' && deliveryProvider === 'microsoft') {
                              void handleInlineReply(false);
                              return;
                            }
                            openReply(false, `${inlineReply}${buildReplyQuote(selectedEmail!)}`);
                          }}
                          disabled={sendingReply || !inlineReply.trim()}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                        >
                          {sendingReply ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <Send className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm font-medium text-slate-400">Pick an email from the list</p>
              <p className="text-xs mt-1 max-w-sm">
                Read Outlook or Zoho mail here. Compose lets you send via Microsoft, Zoho, Brevo, SendGrid, or Resend — whichever you connected.
              </p>
              <button
                type="button"
                onClick={openNewEmail}
                disabled={!providerConnected}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-40 px-4 py-2 text-sm font-semibold text-white"
              >
                <PenSquare className="w-4 h-4" />
                Compose
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
          preferredProvider={composeDraft.preferredProvider}
          skipCrmGate
          entityType="direct"
        />
      )}
    </>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Mail, Send, Inbox, Archive, Trash2, Search, Loader2, Plus, 
    ArrowLeft, Menu, X, MoreVertical, Sparkles, Reply,
    AlertCircle, FileText, CheckSquare, PenTool
} from 'lucide-react';
import { generateEmailReply } from '@/services/unifiedAIService';
<<<<<<< HEAD
import { UnifiedEmailService } from '@/services/email/UnifiedEmailService';
=======
>>>>>>> origin/main
import { EmailBody } from '../../common/EmailBody';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { integrationsService, IntegrationConfig } from '@/services/integrationsService';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import LeadOutreachModal from './LeadOutreachModal';
import CRMContactPickerModal from './CRMContactPickerModal';
<<<<<<< HEAD
import { CommunicationModal } from '../crm/CommunicationModal';
import { parseEmailFromHeader, type EmailRecipient } from '../crm/emailRecipient';

type ComposeDraft = {
    recipient?: EmailRecipient;
    subject?: string;
    body?: string;
};
=======
>>>>>>> origin/main

interface Message {
    messageId: string;
    sender: string;
    subject: string;
    receivedTime: string;
    snippet: string;
    status?: string; // read/unread
    category?: 'urgent' | 'follow-up' | 'newsletter' | 'spam' | 'normal';
    fromAddress?: string;
}

interface Folder {
    folderId: string;
    folderName: string;
    unreadCount: number;
}

type ZohoMailViewProps = {
    userId?: string;
};

// Custom SVG for PenSquare/SquarePen to guarantee cross-environment compilation safety
const PenSquare = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
    </svg>
);

const EmailSkeleton = () => (
    <div className="py-3 px-4 flex items-center gap-3 animate-pulse border-b border-white/5 ml-14">
        <div className="w-9 h-9 bg-white/5 rounded-full shrink-0" />
        <div className="flex-1 space-y-2 py-1">
            <div className="h-3 bg-white/10 rounded w-1/3" />
            <div className="h-3 bg-white/5 rounded w-3/4" />
        </div>
    </div>
);

export default function ZohoMailView({ userId: userIdProp }: ZohoMailViewProps) {
    const { user } = useAuth();
    const { currentTenant } = useTenant();
    const { isMobile } = useBreakpoint();
    
    const [folders, setFolders] = useState<Folder[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string>('1'); // Inbox
    const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
    const [messageContent, setMessageContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
<<<<<<< HEAD
    const [composeModal, setComposeModal] = useState<ComposeDraft | null>(null);
=======
    const [composing, setComposing] = useState(false);
>>>>>>> origin/main
    
    // Compose form state
    const [toInput, setToInput] = useState('');
    const [ccInput, setCcInput] = useState('');
    const [bccInput, setBccInput] = useState('');
    const [toEmails, setToEmails] = useState<string[]>([]);
    const [ccEmails, setCcEmails] = useState<string[]>([]);
    const [bccEmails, setBccEmails] = useState<string[]>([]);
    const [showCcBcc, setShowCcBcc] = useState(false);

    const [emailData, setEmailData] = useState({ to: '', subject: '', body: '', provider: null as string | null });
    const [availableProviders, setAvailableProviders] = useState<IntegrationConfig[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<IntegrationConfig | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
    const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(true);
    const [needsReconnect, setNeedsReconnect] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'urgent' | 'follow-up' | 'newsletter'>('all');
    const [smartReplies] = useState<string[]>([
        'Yes, sounds good!', 
        'I\'ll check and get back to you.', 
        'Can we schedule a call?', 
        'Thanks for the update.'
    ]);
    const [configuredRegion, setConfiguredRegion] = useState<string | null>(null);
    const [replyBody, setReplyBody] = useState('');
    const [messageCache, setMessageCache] = useState<Record<string, any>>({});
<<<<<<< HEAD
    const [threadSummary, setThreadSummary] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
=======
>>>>>>> origin/main
    const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

    const getInitials = (name: string) => {
        if (!name) return '??';
        const cleanName = name.split('<')[0].trim();
        const parts = cleanName.split(' ').filter(p => p.length > 0);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return '??';
    };

    const selectedMessageMeta = useMemo(
        () => messages.find((m) => m.messageId === selectedMessage) || null,
        [messages, selectedMessage]
    );

<<<<<<< HEAD
    const openCompose = (draft?: ComposeDraft) => {
        setComposeModal(draft || {});
        setIsMobileMenuOpen(false);
    };

    const openReplyCompose = (bodyText?: string, subject?: string) => {
        const senderRaw = selectedMessageMeta?.sender || messageContent?.sender || '';
        const parsed = parseEmailFromHeader(senderRaw);
        if (!parsed.email) {
            toast.error('Could not parse recipient email.');
            return;
        }
        openCompose({
            recipient: parsed,
            subject: subject || `Re: ${messageContent?.subject || selectedMessageMeta?.subject || ''}`,
            body: bodyText || '',
        });
    };

    const reconnectUrl = (() => {
        const params = new URLSearchParams();
        if (currentTenant?.id) params.set('tenantId', currentTenant.id);
=======
    const reconnectUrl = (() => {
        const params = new URLSearchParams();
        if (userIdProp) params.set('state', userIdProp);
>>>>>>> origin/main
        if (configuredRegion) params.set('region', configuredRegion);
        const query = params.toString();
        return query ? `/api/auth/zoho/connect?${query}` : '/api/auth/zoho/connect';
    })();

    useEffect(() => {
        if (user?.id) {
            integrationsService.getUserIntegrations(user.id).then(({ integrations }) => {
                const emailTypes = ['zoho', 'brevo', 'resend', 'sendgrid', 'gmail'];
                const filtered = integrations.filter(i => i.enabled && emailTypes.includes(i.type));
                setAvailableProviders(filtered);
                const zoho = filtered.find(p => p.type === 'zoho');
                setSelectedProvider(zoho || filtered[0] || null);
            });
        }
    }, [user?.id]);

    useEffect(() => {
        const verifyZohoMailReady = async () => {
            try {
<<<<<<< HEAD
                if (!currentTenant?.id) return;
                const res = await fetch(`/api/auth/zoho/status?tenantId=${encodeURIComponent(currentTenant.id)}`, { credentials: 'include' });
=======
                const res = await fetch('/api/auth/zoho/status', { credentials: 'include' });
>>>>>>> origin/main
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return;
                if (typeof data?.configuredRegion === 'string' && data.configuredRegion) setConfiguredRegion(data.configuredRegion);
                if (data?.isConnected !== true) {
                    setIsConnected(false);
                    setNeedsReconnect(true);
                    setError('Zoho Mail is not fully connected. Reconnect in Settings.');
                } else {
                    setIsConnected(true);
                }
            } catch {
                setIsConnected(false);
            }
        };
        verifyZohoMailReady();
<<<<<<< HEAD
    }, [currentTenant?.id]);
=======
    }, []);
>>>>>>> origin/main

    const categorizeEmail = (message: Message): 'urgent' | 'follow-up' | 'newsletter' | 'spam' | 'normal' => {
        const subject = (message.subject || '').toLowerCase();
        const snippet = (message.snippet || '').toLowerCase();
        if (['urgent', 'asap', 'critical'].some(kw => subject.includes(kw) || snippet.includes(kw))) return 'urgent';
        if (['follow up', 'reminder'].some(kw => subject.includes(kw) || snippet.includes(kw))) return 'follow-up';
        if (['newsletter', 'unsubscribe'].some(kw => subject.includes(kw) || snippet.includes(kw))) return 'newsletter';
        return 'normal';
    };

    const displayFolders = folders.length > 0 ? folders : [
        { folderId: '1', folderName: 'Inbox', unreadCount: 0 },
        { folderId: '2', folderName: 'Sent', unreadCount: 0 },
        { folderId: '3', folderName: 'Drafts', unreadCount: 0 },
        { folderId: '4', folderName: 'Spam', unreadCount: 0 },
        { folderId: '5', folderName: 'Trash', unreadCount: 0 }
    ];

    const filteredMessages = useMemo(() => {
        const scoped = categoryFilter === 'all'
            ? messages
            : messages.filter(msg => msg.category === categoryFilter);
        const query = searchTerm.trim().toLowerCase();
        if (!query) return scoped;
        return scoped.filter(msg =>
            (msg.sender || '').toLowerCase().includes(query) ||
            (msg.subject || '').toLowerCase().includes(query) ||
            (msg.snippet || '').toLowerCase().includes(query)
        );
    }, [messages, categoryFilter, searchTerm]);

    const zohoFetch = async (url: string, options?: RequestInit): Promise<any> => {
<<<<<<< HEAD
        if (!currentTenant?.id) {
            setError('Select a workspace to use Zoho Mail.');
            return null;
        }
        const targetUrl = `${url}${url.includes('?') ? '&' : '?'}tenantId=${encodeURIComponent(currentTenant.id)}`;
=======
        const targetUrl = userIdProp ? `${url}${url.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userIdProp)}` : url;
>>>>>>> origin/main
        const res = await fetch(targetUrl, { credentials: 'include', ...options });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (res.status === 401 && data.reconnect) setNeedsReconnect(true);
            setError(data.error || 'Request failed');
            return null;
        }
        return data;
    };

<<<<<<< HEAD
    useEffect(() => { if (currentTenant?.id) fetchFolders(); }, [currentTenant?.id]);
=======
    useEffect(() => { fetchFolders(); }, []);
>>>>>>> origin/main
    useEffect(() => { if (selectedFolder) fetchMessages(selectedFolder); }, [selectedFolder]);

    const fetchFolders = async () => {
        const data = await zohoFetch('/api/zoho/mail?action=folders');
        if (Array.isArray(data) && data.length > 0) {
            setFolders(data);
            const inbox = data.find((f: any) => f.folderName?.toLowerCase().includes('inbox')) || data[0];
            if (inbox?.folderId) setSelectedFolder(inbox.folderId);
        }
    };

    const fetchMessages = async (folderId: string) => {
        setLoading(true);
        try {
            const data = await zohoFetch(`/api/zoho/mail?action=messages&folderId=${folderId}`);
            if (Array.isArray(data)) {
                setMessages(data.map((msg: Message) => ({ ...msg, category: categorizeEmail(msg) })));
            } else setMessages([]);
        } finally { setLoading(false); }
    };

    const fetchMessageContent = async (id: string) => {
        if (messageCache[id]) {
            setMessageContent(messageCache[id]);
            setSelectedMessage(id);
<<<<<<< HEAD
            summarizeMessage(id, messageCache[id]);
=======
>>>>>>> origin/main
            return;
        }

        setLoading(true);
        try {
            const data = await zohoFetch(`/api/zoho/mail?action=content&messageId=${id}&folderId=${selectedFolder}`);
            if (data) {
<<<<<<< HEAD
                const completeMessage = { ...selectedMessageMeta, ...data, messageId: id };
                setMessageCache(prev => ({ ...prev, [id]: completeMessage }));
                setMessageContent(completeMessage);
                setSelectedMessage(id);
                summarizeMessage(id, completeMessage);
=======
                setMessageCache(prev => ({ ...prev, [id]: data }));
                setMessageContent(data);
                setSelectedMessage(id);
>>>>>>> origin/main
            }
        } finally { setLoading(false); }
    };

<<<<<<< HEAD
    const summarizeMessage = async (messageId: string, data: { sender?: string; snippet?: string; content?: string; subject?: string }) => {
        setIsSummarizing(true);
        setThreadSummary(null);
        try {
            const res = await UnifiedEmailService.summarizeThread(messageId, [{
                from: data.sender || '',
                subject: data.subject || '',
                snippet: data.snippet || String(data.content || '').slice(0, 500),
            }]);
            if (res.success && res.summary) {
                setThreadSummary(String(res.summary));
            }
        } catch {
            // Non-fatal — message still displays
        } finally {
            setIsSummarizing(false);
        }
    };

    const toggleMessageSelection = (id: string) => {
        setSelectedMessageIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        let finalTo = [...toEmails];
        if (toInput.trim().includes('@')) {
            finalTo.push(toInput.trim());
        }
        if (finalTo.length === 0) {
            toast.error('Recipient email is required');
            return;
        }
        
        if (!emailData.subject?.trim()) {
            toast.error('Subject is required');
            return;
        }

        setSending(true);
        try {
            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: finalTo.join(', '),
                    cc: ccEmails.join(', '),
                    bcc: bccEmails.join(', '),
                    subject: emailData.subject,
                    text: emailData.body,
                    tenantId: currentTenant?.id,
                    userId: user?.id,
                    provider: selectedProvider?.type || 'zoho'
                })
            });
            if (res.ok) {
                toast.success('Sent!');
                setReplyBody('');
                setToEmails([]);
                setCcEmails([]);
                setBccEmails([]);
                setEmailData({ to: '', subject: '', body: '', provider: null });
            } else {
                const errData = await res.json().catch(() => ({}));
                toast.error(errData.error || 'Failed to send');
            }
        } catch { 
            toast.error('Failed to send'); 
        } finally { 
            setSending(false); 
        }
    };
=======
    const toggleMessageSelection = (id: string) => {
        setSelectedMessageIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        let finalTo = [...toEmails];
        if (toInput.trim().includes('@')) {
            finalTo.push(toInput.trim());
        }
        
        if (finalTo.length === 0) {
            toast.error('Recipient email required');
            return;
        }

        setSending(true);
        try {
            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: finalTo.join(', '),
                    cc: ccEmails.join(', '),
                    bcc: bccEmails.join(', '),
                    subject: emailData.subject,
                    text: emailData.body,
                    tenantId: currentTenant?.id,
                    userId: user?.id,
                    provider: selectedProvider?.type || 'zoho'
                })
            });
            if (res.ok) {
                toast.success('Sent!');
                setComposing(false);
                setReplyBody('');
                setToEmails([]);
                setCcEmails([]);
                setBccEmails([]);
                setEmailData({ to: '', subject: '', body: '', provider: null });
            } else {
                const errData = await res.json().catch(() => ({}));
                toast.error(errData.error || 'Failed to send');
            }
        } catch { 
            toast.error('Failed to send'); 
        } finally { 
            setSending(false); 
        }
    };

    const handleArchive = async (messageId: string) => {
        try {
            await zohoFetch(`/api/zoho/mail?action=archive&messageId=${messageId}&folderId=${selectedFolder}`);
            toast.success('Archived');
            setMessages(prev => prev.filter(m => m.messageId !== messageId));
            if (selectedMessage === messageId) setSelectedMessage(null);
        } catch {
            toast.error('Failed to archive');
        }
    };

    const handleDelete = async (messageId: string) => {
        try {
            const targetUrl = `/api/zoho/mail?messageId=${messageId}&folderId=${selectedFolder}`;
            const finalUrl = userIdProp ? `${targetUrl}&userId=${encodeURIComponent(userIdProp)}` : targetUrl;
            const res = await fetch(finalUrl, { method: 'DELETE', credentials: 'include' });
            if (res.ok) {
                toast.success('Deleted');
                setMessages(prev => prev.filter(m => m.messageId !== messageId));
                if (selectedMessage === messageId) setSelectedMessage(null);
            } else {
                throw new Error('Delete failed');
            }
        } catch {
            toast.error('Failed to delete');
        }
    };

    const handleQuickReply = async () => {
        if (!replyBody.trim()) return;
        setSending(true);
        try {
            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: selectedMessageMeta?.sender || messageContent?.sender || '',
                    subject: `Re: ${messageContent?.subject || ''}`,
                    text: replyBody,
                    tenantId: currentTenant?.id,
                    userId: user?.id,
                    provider: selectedProvider?.type || 'zoho'
                })
            });
            if (res.ok) {
                toast.success('Sent!');
                setReplyBody('');
            }
        } catch {
            toast.error('Failed to send');
        } finally {
            setSending(false);
        }
    };

    const handleAiReply = async (customPrompt?: string) => {
        if (!messageContent) return;
        setAiGenerating(true);
        try {
            const reply = await generateEmailReply(messageContent.content || messageContent.snippet || '', customPrompt || 'Professional');
            if (reply) {
                setEmailData({
                    to: selectedMessageMeta?.sender || messageContent.sender || '',
                    subject: `Re: ${messageContent.subject || ''}`,
                    body: reply,
                    provider: 'zoho'
                });
                setComposing(true);
            }
        } finally { setAiGenerating(false); }
    };

    const handleSmartReply = async (text: string) => {
        setReplyBody(text);
        setEmailData({
            to: selectedMessageMeta?.sender || messageContent?.sender || '',
            subject: `Re: ${messageContent?.subject || ''}`,
            body: text,
            provider: 'zoho'
        });
        setComposing(true);
    };

    const formatDate = (dateStr: any) => {
        if (!dateStr) return 'N/A';
        const d = new Date(isNaN(Number(dateStr)) ? dateStr : Number(dateStr));
        return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const handleEmailInputKeyDown = (type: 'to' | 'cc' | 'bcc', e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
            e.preventDefault();
            const val = type === 'to' ? toInput : type === 'cc' ? ccInput : bccInput;
            if (val.trim()) {
                handleAddEmail(type, val);
            }
        }
    };

    const handleAddEmail = (type: 'to' | 'cc' | 'bcc', value: string) => {
        const trimmed = value.trim().replace(/,$/, '');
        if (trimmed && trimmed.includes('@')) {
            if (type === 'to') setToEmails(prev => [...prev, trimmed]);
            if (type === 'cc') setCcEmails(prev => [...prev, trimmed]);
            if (type === 'bcc') setBccEmails(prev => [...prev, trimmed]);
            if (type === 'to') setToInput('');
            if (type === 'cc') setCcInput('');
            if (type === 'bcc') setBccInput('');
        }
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 bg-[#0f0f0f] min-h-[400px] flex-1">
                <div className="w-24 h-24 bg-white/5 rounded-[40px] flex items-center justify-center mb-6">
                    <Mail size={48} className="text-gray-400" />
                </div>
                <h3 className="text-[17px] font-bold text-white uppercase tracking-tight">Connect Zoho Mail</h3>
                <p className="text-[13px] text-gray-500 opacity-55 max-w-xs mt-3 mb-8">
                    Connect your Zoho account to view and manage emails directly in AlphaClone.
                </p>
                <a 
                    href={reconnectUrl}
                    className="w-full max-w-sm h-[52px] flex items-center justify-center bg-teal-500 text-white font-black uppercase text-xs rounded-2xl shadow-xl shadow-teal-900/20 active:scale-95 transition-all"
                >
                    Connect Zoho Mail
                </a>
            </div>
        );
    }

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            <div className="p-6 border-b border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
                    <Mail size={22} />
                </div>
                <span className="font-black text-white uppercase tracking-widest text-sm">Zoho Mail</span>
            </div>
            
            <div className="p-6">
                <button 
                    onClick={() => { setComposing(true); setSelectedMessage(null); setIsMobileMenuOpen(false); }}
                    className="w-full flex items-center justify-center gap-3 bg-teal-500 hover:bg-teal-400 text-white py-4 px-4 rounded-2xl transition-all shadow-xl active:scale-95 group font-black uppercase text-xs"
                >
                    <Plus size={20} /> 
                    Compose
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5 custom-scrollbar">
                <div className="mt-4 mb-3 px-2 text-xs font-black text-gray-600 uppercase tracking-widest">Mailboxes</div>
                {displayFolders.map(folder => (
                    <button
                        key={folder.folderId}
                        onClick={() => { setSelectedFolder(folder.folderId); setSelectedMessage(null); setComposing(false); setIsMobileMenuOpen(false); }}
                        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group ${selectedFolder === folder.folderId ? 'bg-teal-500/10 text-white border border-teal-500/20' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
                    >
                        <div className="flex items-center gap-3">
                            <Inbox size={20} />
                            <span className="text-sm font-bold">{folder.folderName}</span>
                        </div>
                        {folder.unreadCount > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-black bg-teal-500 text-white">{folder.unreadCount}</span>
                        )}
                    </button>
                ))}
            </nav>

            <div className="p-4 border-t border-white/5 space-y-2">
                <button onClick={() => setIsLeadModalOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-white/5 transition-all text-sm font-bold">
                    <Sparkles size={18} className="text-teal-500" /> Lead Outreach
                </button>
            </div>
        </div>
    );
>>>>>>> origin/main

    const handleArchive = async (messageId: string) => {
        try {
            await zohoFetch(`/api/zoho/mail?action=archive&messageId=${messageId}&folderId=${selectedFolder}`);
            toast.success('Archived');
            setMessages(prev => prev.filter(m => m.messageId !== messageId));
            if (selectedMessage === messageId) setSelectedMessage(null);
        } catch {
            toast.error('Failed to archive');
        }
    };

    const handleDelete = async (messageId: string) => {
        try {
            const targetUrl = `/api/zoho/mail?messageId=${messageId}&folderId=${selectedFolder}`;
            if (!currentTenant?.id) throw new Error('Select a workspace first');
            const finalUrl = `${targetUrl}&tenantId=${encodeURIComponent(currentTenant.id)}`;
            const res = await fetch(finalUrl, { method: 'DELETE', credentials: 'include' });
            if (res.ok) {
                toast.success('Deleted');
                setMessages(prev => prev.filter(m => m.messageId !== messageId));
                if (selectedMessage === messageId) setSelectedMessage(null);
            } else {
                throw new Error('Delete failed');
            }
        } catch {
            toast.error('Failed to delete');
        }
    };

    const handleQuickReply = async () => {
        if (!replyBody.trim()) return;
        openReplyCompose(replyBody);
        setReplyBody('');
    };

    const handleAiReply = async (customPrompt?: string) => {
        if (!messageContent) return;
        setAiGenerating(true);
        try {
            const reply = await generateEmailReply(messageContent.content || messageContent.snippet || '', customPrompt || 'Professional');
            if (reply) {
                openReplyCompose(reply);
            }
        } finally { setAiGenerating(false); }
    };

    const handleSmartReply = async (text: string) => {
        setReplyBody(text);
        openReplyCompose(text);
    };

    const formatDate = (dateStr: any) => {
        if (!dateStr) return 'N/A';
        const d = new Date(isNaN(Number(dateStr)) ? dateStr : Number(dateStr));
        return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const handleEmailInputKeyDown = (type: 'to' | 'cc' | 'bcc', e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
            e.preventDefault();
            const val = type === 'to' ? toInput : type === 'cc' ? ccInput : bccInput;
            if (val.trim()) {
                handleAddEmail(type, val);
            }
        }
    };

    const handleAddEmail = (type: 'to' | 'cc' | 'bcc', value: string) => {
        const trimmed = value.trim().replace(/,$/, '');
        if (trimmed && trimmed.includes('@')) {
            if (type === 'to') setToEmails(prev => [...prev, trimmed]);
            if (type === 'cc') setCcEmails(prev => [...prev, trimmed]);
            if (type === 'bcc') setBccEmails(prev => [...prev, trimmed]);
            if (type === 'to') setToInput('');
            if (type === 'cc') setCcInput('');
            if (type === 'bcc') setBccInput('');
        }
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 bg-[#0f0f0f] min-h-[400px] flex-1">
                <div className="w-24 h-24 bg-white/5 rounded-[40px] flex items-center justify-center mb-6">
                    <Mail size={48} className="text-gray-400" />
                </div>
                <h3 className="text-[17px] font-bold text-white uppercase tracking-tight">Connect Zoho Mail</h3>
                <p className="text-[13px] text-gray-500 opacity-55 max-w-xs mt-3 mb-8">
                    Connect your Zoho account to view and manage emails directly in AlphaClone.
                </p>
                <a 
                    href={reconnectUrl}
                    className="w-full max-w-sm h-[52px] flex items-center justify-center bg-teal-500 text-white font-black uppercase text-xs rounded-2xl shadow-xl shadow-teal-900/20 active:scale-95 transition-all"
                >
                    Connect Zoho Mail
                </a>
            </div>
        );
    }

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            <div className="p-6 border-b border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
                    <Mail size={22} />
                </div>
                <span className="font-black text-white uppercase tracking-widest text-sm">Zoho Mail</span>
            </div>
            
            <div className="p-6">
                <button 
                    onClick={() => { openCompose(); setSelectedMessage(null); }}
                    className="w-full flex items-center justify-center gap-3 bg-teal-500 hover:bg-teal-400 text-white py-4 px-4 rounded-2xl transition-all shadow-xl active:scale-95 group font-black uppercase text-xs"
                >
                    <Plus size={20} /> 
                    Compose
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5 custom-scrollbar">
                <div className="mt-4 mb-3 px-2 text-xs font-black text-gray-600 uppercase tracking-widest">Mailboxes</div>
                {displayFolders.map(folder => (
                    <button
                        key={folder.folderId}
                        onClick={() => { setSelectedFolder(folder.folderId); setSelectedMessage(null); setComposeModal(null); setIsMobileMenuOpen(false); }}
                        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group ${selectedFolder === folder.folderId ? 'bg-teal-500/10 text-white border border-teal-500/20' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
                    >
                        <div className="flex items-center gap-3">
                            <Inbox size={20} />
                            <span className="text-sm font-bold">{folder.folderName}</span>
                        </div>
                        {folder.unreadCount > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-black bg-teal-500 text-white">{folder.unreadCount}</span>
                        )}
                    </button>
                ))}
            </nav>

            <div className="p-4 border-t border-white/5 space-y-2">
                <button onClick={() => setIsLeadModalOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-white/5 transition-all text-sm font-bold">
                    <Sparkles size={18} className="text-teal-500" /> Lead Outreach
                </button>
            </div>
        </div>
    );

    return (
        <div className={`flex flex-col bg-[#0f0f0f] rounded-2xl md:rounded-3xl border border-white/5 overflow-hidden backdrop-blur-sm relative h-[calc(100dvh-140px)]`}>
            
            {/* Expired Token Inline Banner (non-blocking, below header) */}
            {needsReconnect && (
                <div className="h-[44px] shrink-0 bg-yellow-500 text-slate-900 px-4 flex items-center justify-between text-xs font-semibold select-none z-20">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span>Session expired — reconnect</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <a 
                            href={reconnectUrl}
                            className="bg-slate-900 text-yellow-500 px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider"
                        >
                            Reconnect
                        </a>
                        <button 
                            onClick={() => setNeedsReconnect(false)}
                            className="text-slate-900 hover:text-black"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden">
                {/* Desktop Sidebar */}
                <div className="hidden md:flex w-72 flex-col bg-[#0a0a0a] border-r border-white/5 shrink-0">
                    <SidebarContent />
                </div>

                {/* Mobile Menu Drawer */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]" />
                            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="fixed inset-y-0 left-0 w-4/5 bg-[#0a0a0a] z-[101] shadow-2xl">
                                <SidebarContent />
                                <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-6 right-6 p-2 text-gray-500"><X size={24} /></button>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* Message List Panel */}
<<<<<<< HEAD
                <div className={`flex flex-col bg-[#0f0f0f] border-r border-white/5 shrink-0 transition-all duration-300 w-full md:w-96 ${selectedMessage ? 'hidden md:flex' : 'flex'}`}>
=======
                <div className={`flex flex-col bg-[#0f0f0f] border-r border-white/5 shrink-0 transition-all duration-300 w-full md:w-96 ${selectedMessage || composing ? 'hidden md:flex' : 'flex'}`}>
>>>>>>> origin/main
                    
                    {/* Header Bar */}
                    <div className="h-20 border-b border-white/5 px-6 flex items-center gap-4 sticky top-0 z-10 bg-[#0f0f0f]/80 backdrop-blur-md shrink-0">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-400 md:hidden"><Menu size={24} /></button>
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                            <input 
                                type="text" placeholder="Search mail..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-black/40 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:border-teal-500/50 outline-none"
                            />
                        </div>
                    </div>

                    {/* Folder Tabs - Mobile only (Sticky below header bar) */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 px-4 bg-[#0f0f0f] border-b border-white/5 sticky top-20 z-20 md:hidden h-[50px] shrink-0">
                        {displayFolders.map(folder => (
                            <button
                                key={folder.folderId}
<<<<<<< HEAD
                                onClick={() => { setSelectedFolder(folder.folderId); setSelectedMessage(null); setComposeModal(null); }}
=======
                                onClick={() => { setSelectedFolder(folder.folderId); setSelectedMessage(null); setComposing(false); }}
>>>>>>> origin/main
                                className={`h-[34px] px-4 rounded-full text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-all flex items-center justify-center shrink-0 ${selectedFolder === folder.folderId ? 'bg-teal-500 text-white font-black' : 'bg-transparent text-white opacity-55'}`}
                            >
                                {folder.folderName}
                            </button>
                        ))}
                    </div>

                    {error && (
                        <div className="mx-4 mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                            {error}
                        </div>
                    )}

                    {/* Inbox Flat List of Rows */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {/* Category Filter Pills */}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-2 border-b border-white/5">
                            {['all', 'urgent', 'follow-up', 'newsletter'].map(cat => (
                                <button key={cat} onClick={() => setCategoryFilter(cat as any)} className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border transition-all ${categoryFilter === cat ? 'bg-teal-500 border-teal-500 text-white shadow-lg shadow-teal-500/20' : 'bg-white/5 border-white/5 text-gray-500'}`}>
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {loading && messages.length === 0 ? (
                            <div className="space-y-1">
                                <EmailSkeleton />
                                <EmailSkeleton />
                                <EmailSkeleton />
                                <EmailSkeleton />
                                <EmailSkeleton />
                            </div>
                        ) : filteredMessages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center p-8 py-20">
                                <Mail size={48} className="text-slate-700 mb-4" />
                                <h4 className="text-[15px] font-semibold text-white">You're all caught up</h4>
                                <p className="text-[13px] text-gray-500 opacity-55 mt-1">No new messages</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {filteredMessages.map(msg => (
                                    <div key={msg.messageId} className="relative overflow-hidden min-h-[44px]">
                                        
                                        {/* Swipe Background Zones */}
                                        <div className="absolute inset-0 flex justify-between items-center px-4 pointer-events-none">
                                            <div className="bg-green-600 h-full flex items-center justify-start px-4 text-white text-xs font-bold w-1/2">
                                                Archive
                                            </div>
                                            <div className="bg-red-600 h-full flex items-center justify-end px-4 text-white text-xs font-bold w-1/2 text-right">
                                                Delete
                                            </div>
                                        </div>

                                        {/* Swipeable Row content */}
                                        <motion.div
                                            drag="x"
                                            dragDirectionLock
                                            dragConstraints={{ left: -100, right: 100 }}
                                            dragElastic={0.1}
                                            onDragEnd={(e, info) => {
                                                if (info.offset.x > 60) {
                                                    handleArchive(msg.messageId);
                                                } else if (info.offset.x < -60) {
                                                    handleDelete(msg.messageId);
                                                }
                                            }}
                                            onClick={() => fetchMessageContent(msg.messageId)}
                                            className={`relative z-10 flex items-center gap-3 py-3 px-4 cursor-pointer select-none transition-colors ${msg.status === 'unread' ? 'bg-slate-900/30' : 'bg-[#0f0f0f]'}`}
                                        >
                                            {/* Avatar/Initial Circle */}
                                            <div className="w-9 h-9 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm shrink-0">
                                                {getInitials(msg.sender)}
                                            </div>

                                            {/* Text Stacked Center */}
                                            <div className="flex-1 min-w-0 pr-2">
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[15px] truncate block ${msg.status === 'unread' ? 'font-semibold text-white' : 'font-normal text-gray-300'}`}>
                                                        {msg.sender.split('<')[0].trim()}
                                                    </span>
                                                </div>
                                                <div className="text-[15px] text-gray-200 truncate">{msg.subject}</div>
                                                <div className="text-[13px] text-gray-500 opacity-55 truncate mt-0.5">{msg.snippet}</div>
                                            </div>

                                            {/* Right Timestamp & Unread Dot */}
                                            <div className="flex flex-col items-end gap-1.5 shrink-0 self-start pt-1">
                                                <span className="text-[11px] text-gray-400 opacity-55">{formatDate(msg.receivedTime)}</span>
                                                {msg.status === 'unread' && (
                                                    <div className="w-2 h-2 rounded-full bg-teal-500" />
                                                )}
                                            </div>
                                        </motion.div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Mobile Compose FAB */}
                    <button 
<<<<<<< HEAD
                        onClick={() => { openCompose(); setSelectedMessage(null); }}
=======
                        onClick={() => { setComposing(true); setSelectedMessage(null); }}
>>>>>>> origin/main
                        className="fixed bottom-[calc(49px+env(safe-area-inset-bottom)+16px)] right-4 w-[52px] h-[52px] rounded-full bg-teal-500 hover:bg-teal-400 text-white flex items-center justify-center shadow-2xl active:scale-95 transition-all z-30 md:hidden"
                        title="Compose email"
                    >
                        <PenSquare className="w-6 h-6" />
                    </button>
                </div>

                {/* Message Content Area */}
<<<<<<< HEAD
                <div className={`flex-1 flex flex-col bg-[#141414] relative ${!selectedMessage ? 'hidden md:flex' : 'flex'}`}>
                    <AnimatePresence mode="wait">
                        {selectedMessage && messageContent ? (
                            <motion.div 
                                key="content" 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                className="fixed inset-0 z-[110] bg-[#0f0f0f] flex flex-col md:relative md:inset-auto md:z-auto md:bg-transparent md:flex-1 h-full overflow-hidden"
                            >
                                {/* Header Bar */}
                                <div className="h-14 px-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0f0f0f] md:bg-transparent md:h-20 md:px-8">
                                    <button onClick={() => setSelectedMessage(null)} className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-400 hover:text-white"><ArrowLeft size={20} /></button>
                                    <h2 className="text-[17px] font-semibold text-white">Inbox</h2>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleAiReply()} disabled={aiGenerating} className="flex items-center gap-1.5 bg-teal-500/10 text-teal-400 px-3 py-1.5 rounded-xl border border-teal-600/20 text-xs font-black uppercase tracking-widest">
                                            <Sparkles size={12} /> {aiGenerating ? '...' : 'AI'}
                                        </button>
                                        <button onClick={() => handleArchive(messageContent.messageId)} className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:text-white"><Archive size={20} /></button>
                                        <button onClick={() => handleDelete(messageContent.messageId)} className="w-11 h-11 flex items-center justify-center rounded-xl text-red-500 hover:text-red-400"><Trash2 size={20} /></button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto px-4 py-6 md:p-10 custom-scrollbar">
                                    <div className="max-w-4xl mx-auto space-y-6">
                                        
                                        {/* Subject */}
                                        <h1 className="text-[17px] font-semibold text-white mt-4">{messageContent.subject || 'No Subject'}</h1>

                                        {/* Sender Row */}
                                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm shrink-0">
                                                    {getInitials(messageContent.sender)}
                                                </div>
                                                <div>
                                                    <div className="text-[15px] font-bold text-white">{messageContent.sender?.split('<')[0]?.trim()}</div>
                                                    <div className="text-[13px] text-gray-400 opacity-55 truncate max-w-[200px] sm:max-w-md">
                                                        {messageContent.sender?.includes('<') ? messageContent.sender.split('<')[1].replace('>', '') : messageContent.sender}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-[11px] text-gray-400 opacity-55">
                                                {formatDate(messageContent.receivedTime)}
                                            </div>
                                        </div>

                                        {(isSummarizing || threadSummary) && (
                                            <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4">
                                                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-teal-400 mb-2">
                                                    <Sparkles size={12} />
                                                    {isSummarizing ? 'Summarizing…' : 'Summary'}
                                                </div>
                                                {threadSummary && (
                                                    <p className="text-sm text-slate-300 leading-relaxed">{threadSummary}</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Sandboxed Body Content */}
                                        <div className="text-[15px] leading-[1.6] text-gray-200">
                                            <EmailBody content={messageContent.content || messageContent.snippet || ''} />
                                        </div>

                                        {/* Attachments scrolling chip row */}
                                        {messageContent.attachments && messageContent.attachments.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-white/5">
                                                <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Attachments</div>
                                                <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
                                                    {messageContent.attachments.map((att: any, idx: number) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                if (!att.attachmentId || !currentTenant?.id) return toast.error('Attachment is unavailable');
                                                                const url = `/api/zoho/mail?action=attachment&tenantId=${encodeURIComponent(currentTenant.id)}&folderId=${encodeURIComponent(selectedFolder)}&messageId=${encodeURIComponent(messageContent.messageId)}&attachmentId=${encodeURIComponent(att.attachmentId)}&fileName=${encodeURIComponent(att.fileName || 'attachment')}`;
                                                                window.location.assign(url);
                                                            }}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-[13px] text-white hover:bg-white/10 shrink-0"
                                                        >
                                                            <FileText size={14} className="text-teal-400" />
                                                            <span>{att.fileName}</span>
                                                            <span className="opacity-55">({att.fileSize})</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                </div>
                                
                                {/* Quick Reply and Smart Reply Bar */}
                                <div className="p-4 sm:p-6 bg-[#0a0a0a]/50 border-t border-white/5 flex flex-col gap-4">
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                        {smartReplies.map((reply, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => handleSmartReply(reply)}
                                                className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-gray-400 hover:text-teal-400 hover:border-teal-500/30 whitespace-nowrap transition-all"
                                            >
                                                {reply}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 relative">
                                            <input 
                                                value={replyBody}
                                                onChange={e => setReplyBody(e.target.value)}
                                                placeholder="Type a quick reply..." 
                                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-teal-500/50 pr-12"
                                                onKeyDown={e => e.key === 'Enter' && handleQuickReply()}
                                            />
                                            <button 
                                                onClick={handleQuickReply}
                                                disabled={sending || !replyBody.trim()}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-teal-500 hover:text-teal-400 disabled:opacity-30"
                                            >
                                                <Send size={20} />
                                            </button>
                                        </div>
=======
                <div className={`flex-1 flex flex-col bg-[#141414] relative ${!selectedMessage && !composing ? 'hidden md:flex' : 'flex'}`}>
                    <AnimatePresence mode="wait">
                        {composing ? (
                            <motion.div 
                                key="compose" 
                                initial={{ opacity: 0, y: 20 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                exit={{ opacity: 0, y: -20 }} 
                                className="fixed inset-0 z-[110] bg-[#0f0f0f] flex flex-col md:relative md:inset-auto md:z-auto md:bg-transparent md:flex-1"
                            >
                                {/* Custom Mobile-Aware Header */}
                                <div className="h-14 px-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0f0f0f] md:bg-transparent md:h-20 md:px-8">
                                    <button 
                                        type="button"
                                        onClick={() => setComposing(false)} 
                                        className="text-[15px] font-medium text-gray-400 hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <h2 className="text-[17px] font-semibold text-white">New Message</h2>
                                    <button 
                                        type="button"
                                        onClick={() => handleSend()}
                                        disabled={sending || (toEmails.length === 0 && !toInput.includes('@')) || !emailData.subject}
                                        className="text-[15px] font-semibold text-teal-400 disabled:opacity-40 disabled:pointer-events-none"
                                    >
                                        {sending ? 'Sending...' : 'Send'}
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
                                    {/* Tag input style for To Recipient */}
                                    <div className="flex flex-wrap gap-1.5 p-2 bg-black/20 border-b border-white/5 items-center">
                                        <div className="flex justify-between items-center w-full mb-1">
                                            <span className="text-[13px] text-gray-500 font-semibold">To:</span>
                                            <button type="button" onClick={() => setIsContactPickerOpen(true)} className="text-xs font-black text-teal-400 uppercase tracking-widest hover:text-teal-300">
                                                + Add from CRM
                                            </button>
                                        </div>
                                        {toEmails.map((email, idx) => (
                                            <span key={idx} className="flex items-center gap-1 bg-teal-500/10 border border-teal-500/20 text-teal-400 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                                {email}
                                                <button type="button" onClick={() => setToEmails(prev => prev.filter((_, i) => i !== idx))} className="text-teal-400 hover:text-white">
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                        <input
                                            type="text"
                                            value={toInput}
                                            onChange={e => setToInput(e.target.value)}
                                            onKeyDown={e => handleEmailInputKeyDown('to', e)}
                                            onBlur={() => handleAddEmail('to', toInput)}
                                            placeholder={toEmails.length === 0 ? "recipient@domain.com" : ""}
                                            className="flex-1 bg-transparent border-none outline-none text-[15px] text-white min-w-[120px] py-1"
                                        />
                                        <button type="button" onClick={() => setShowCcBcc(!showCcBcc)} className="text-xs text-teal-500 font-semibold px-2">
                                            CC/BCC
                                        </button>
                                    </div>

                                    {/* CC/BCC inputs */}
                                    {showCcBcc && (
                                        <div className="space-y-2 border-b border-white/5 pb-2">
                                            <div className="flex flex-wrap gap-1.5 p-2 bg-black/20 items-center">
                                                <span className="text-[13px] text-gray-500 font-semibold w-8">CC:</span>
                                                {ccEmails.map((email, idx) => (
                                                    <span key={idx} className="flex items-center gap-1 bg-white/5 border border-white/10 text-white px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                                        {email}
                                                        <button type="button" onClick={() => setCcEmails(prev => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-white">
                                                            <X size={12} />
                                                        </button>
                                                    </span>
                                                ))}
                                                <input
                                                    type="text"
                                                    value={ccInput}
                                                    onChange={e => setCcInput(e.target.value)}
                                                    onKeyDown={e => handleEmailInputKeyDown('cc', e)}
                                                    onBlur={() => handleAddEmail('cc', ccInput)}
                                                    className="flex-1 bg-transparent border-none outline-none text-[15px] text-white min-w-[120px] py-1"
                                                />
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 p-2 bg-black/20 items-center">
                                                <span className="text-[13px] text-gray-500 font-semibold w-8">BCC:</span>
                                                {bccEmails.map((email, idx) => (
                                                    <span key={idx} className="flex items-center gap-1 bg-white/5 border border-white/10 text-white px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                                        {email}
                                                        <button type="button" onClick={() => setBccEmails(prev => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-white">
                                                            <X size={12} />
                                                        </button>
                                                    </span>
                                                ))}
                                                <input
                                                    type="text"
                                                    value={bccInput}
                                                    onChange={e => setBccInput(e.target.value)}
                                                    onKeyDown={e => handleEmailInputKeyDown('bcc', e)}
                                                    onBlur={() => handleAddEmail('bcc', bccInput)}
                                                    className="flex-1 bg-transparent border-none outline-none text-[15px] text-white min-w-[120px] py-1"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Subject */}
                                    <div className="flex items-center gap-1.5 p-2 bg-black/20 border-b border-white/5">
                                        <span className="text-[13px] text-gray-500 font-semibold w-8">Sub:</span>
                                        <input 
                                            type="text" 
                                            value={emailData.subject} 
                                            onChange={e => setEmailData({...emailData, subject: e.target.value})} 
                                            placeholder="Subject"
                                            className="flex-1 bg-transparent border-none outline-none text-[15px] text-white py-1"
                                        />
                                    </div>

                                    {/* Auto-growing Textarea Body */}
                                    <div className="flex-1 flex flex-col min-h-[250px]">
                                        <div className="flex justify-between items-center py-2 px-1">
                                            <span className="text-xs font-black text-gray-600 uppercase tracking-widest">Body</span>
                                            <button type="button" onClick={() => handleAiReply()} className="flex items-center gap-2 text-xs font-black text-teal-500 uppercase tracking-widest bg-teal-500/10 px-3 py-1.5 rounded-lg border border-teal-500/20">
                                                <Sparkles size={12} /> AI Assist
                                            </button>
                                        </div>
                                        <textarea 
                                            value={emailData.body} 
                                            onChange={e => setEmailData({...emailData, body: e.target.value})} 
                                            placeholder="Type your message..."
                                            className="w-full flex-1 bg-transparent border-none outline-none text-[15px] text-white py-2 resize-none leading-relaxed min-h-[250px]"
                                        />
                                    </div>
                                </div>

                                {/* Custom toolbar above keyboard & provider badge */}
                                <div className="border-t border-white/5 bg-[#0a0a0a] px-4 py-2 flex items-center justify-between shrink-0 h-[60px] pb-[calc(env(safe-area-inset-bottom)+8px)]">
                                    <div className="flex items-center gap-1">
                                        <button type="button" className="w-[44px] h-[44px] flex items-center justify-center text-gray-400 hover:text-white rounded-lg transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                        </button>
                                        <button type="button" className="w-[44px] h-[44px] flex items-center justify-center text-gray-400 hover:text-white rounded-lg transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
                                        </button>
                                        <button type="button" className="w-[44px] h-[44px] flex items-center justify-center text-gray-400 hover:text-white rounded-lg transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>
                                        </button>
                                        <button type="button" className="w-[44px] h-[44px] flex items-center justify-center text-gray-400 hover:text-white rounded-lg transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                        </button>
                                    </div>
                                    
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                                            Via {selectedProvider?.type || 'zoho'}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ) : selectedMessage && messageContent ? (
                            <motion.div 
                                key="content" 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                className="fixed inset-0 z-[110] bg-[#0f0f0f] flex flex-col md:relative md:inset-auto md:z-auto md:bg-transparent md:flex-1 h-full overflow-hidden"
                            >
                                {/* Header Bar */}
                                <div className="h-14 px-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0f0f0f] md:bg-transparent md:h-20 md:px-8">
                                    <button onClick={() => setSelectedMessage(null)} className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-400 hover:text-white"><ArrowLeft size={20} /></button>
                                    <h2 className="text-[17px] font-semibold text-white">Inbox</h2>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleAiReply()} disabled={aiGenerating} className="flex items-center gap-1.5 bg-teal-500/10 text-teal-400 px-3 py-1.5 rounded-xl border border-teal-600/20 text-xs font-black uppercase tracking-widest">
                                            <Sparkles size={12} /> {aiGenerating ? '...' : 'AI'}
                                        </button>
                                        <button onClick={() => handleArchive(messageContent.messageId)} className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:text-white"><Archive size={20} /></button>
                                        <button onClick={() => handleDelete(messageContent.messageId)} className="w-11 h-11 flex items-center justify-center rounded-xl text-red-500 hover:text-red-400"><Trash2 size={20} /></button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto px-4 py-6 md:p-10 custom-scrollbar">
                                    <div className="max-w-4xl mx-auto space-y-6">
                                        
                                        {/* Subject */}
                                        <h1 className="text-[17px] font-semibold text-white mt-4">{messageContent.subject || 'No Subject'}</h1>

                                        {/* Sender Row */}
                                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm shrink-0">
                                                    {getInitials(messageContent.sender)}
                                                </div>
                                                <div>
                                                    <div className="text-[15px] font-bold text-white">{messageContent.sender?.split('<')[0]?.trim()}</div>
                                                    <div className="text-[13px] text-gray-400 opacity-55 truncate max-w-[200px] sm:max-w-md">
                                                        {messageContent.sender?.includes('<') ? messageContent.sender.split('<')[1].replace('>', '') : messageContent.sender}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-[11px] text-gray-400 opacity-55">
                                                {formatDate(messageContent.receivedTime)}
                                            </div>
                                        </div>

                                        {/* Sandboxed Body Content */}
                                        <div className="text-[15px] leading-[1.6] text-gray-200">
                                            <EmailBody content={messageContent.content || messageContent.snippet || ''} />
                                        </div>

                                        {/* Attachments scrolling chip row */}
                                        {messageContent.attachments && messageContent.attachments.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-white/5">
                                                <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Attachments</div>
                                                <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
                                                    {messageContent.attachments.map((att: any, idx: number) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => toast.success(`Opening ${att.fileName}`)}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-[13px] text-white hover:bg-white/10 shrink-0"
                                                        >
                                                            <FileText size={14} className="text-teal-400" />
                                                            <span>{att.fileName}</span>
                                                            <span className="opacity-55">({att.fileSize})</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                </div>
                                
                                {/* Quick Reply and Smart Reply Bar */}
                                <div className="p-4 sm:p-6 bg-[#0a0a0a]/50 border-t border-white/5 flex flex-col gap-4">
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                        {smartReplies.map((reply, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => handleSmartReply(reply)}
                                                className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-gray-400 hover:text-teal-400 hover:border-teal-500/30 whitespace-nowrap transition-all"
                                            >
                                                {reply}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 relative">
                                            <input 
                                                value={replyBody}
                                                onChange={e => setReplyBody(e.target.value)}
                                                placeholder="Type a quick reply..." 
                                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-teal-500/50 pr-12"
                                                onKeyDown={e => e.key === 'Enter' && handleQuickReply()}
                                            />
                                            <button 
                                                onClick={handleQuickReply}
                                                disabled={sending || !replyBody.trim()}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-teal-500 hover:text-teal-400 disabled:opacity-30"
                                            >
                                                <Send size={20} />
                                            </button>
                                        </div>
>>>>>>> origin/main
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#141414]">
                                <div className="w-24 h-24 bg-white/5 rounded-[40px] flex items-center justify-center mb-6">
                                    <Mail size={48} className="text-gray-700" />
                                </div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">Select a message</h3>
                                <p className="text-sm text-gray-600 max-w-xs mt-3">Choose an email from the list to view its contents and use AI tools.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <CRMContactPickerModal 
                isOpen={isContactPickerOpen}
                onClose={() => setIsContactPickerOpen(false)}
                onSelectContact={(email) => {
                    setToEmails(prev => [...prev, email]);
                }}
            />

            <LeadOutreachModal 
                isOpen={isLeadModalOpen}
                onClose={() => setIsLeadModalOpen(false)}
                onEmailDrafted={(data) => {
<<<<<<< HEAD
                    openCompose({
                        recipient: { name: data.to.split('@')[0], email: data.to },
                        subject: data.subject,
                        body: data.body,
=======
                    setComposing(true);
                    setToEmails([data.to]);
                    setEmailData({
                        to: data.to,
                        subject: data.subject,
                        body: data.body,
                        provider: data.provider || null
>>>>>>> origin/main
                    });
                }}
            />

<<<<<<< HEAD
            {composeModal && user && (
                <CommunicationModal
                    user={user}
                    recipient={composeModal.recipient}
                    prefilledSubject={composeModal.subject}
                    prefilledBody={composeModal.body}
                    preferredProvider="zoho"
                    lockRecipient={Boolean(composeModal.recipient?.email)}
                    onClose={() => setComposeModal(null)}
                    onSent={() => setComposeModal(null)}
                />
            )}

=======
>>>>>>> origin/main
            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            ` }} />
        </div>
    );
}

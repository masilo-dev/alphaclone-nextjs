'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Mail, Send, Inbox, Archive, Trash2, Search, Loader2, Plus, 
    ArrowLeft, Menu, X, MoreVertical, Sparkles, Reply, Forward,
    MoreHorizontal, CheckCircle2, RotateCcw, AlertCircle, FileText, ShieldCheck, BookUser, CheckSquare, Users
} from 'lucide-react';
import { generateEmailReply, generateEmailDraft } from '@/services/unifiedAIService';
import { taskService } from '@/services/taskService';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { integrationsService, IntegrationConfig } from '@/services/integrationsService';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

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

import LeadOutreachModal from './LeadOutreachModal';
import CRMContactPickerModal from './CRMContactPickerModal';
import { supabase } from '@/lib/supabase';

type ZohoMailViewProps = {
    userId?: string;
};

export default function ZohoMailView({ userId: userIdProp }: ZohoMailViewProps) {
    const { user } = useAuth();
    const { currentTenant } = useTenant();
    const [folders, setFolders] = useState<Folder[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string>('1'); // Inbox
    const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
    const [messageContent, setMessageContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [composing, setComposing] = useState(false);
    const [emailData, setEmailData] = useState({ to: '', subject: '', body: '', provider: null as string | null });
    const [availableProviders, setAvailableProviders] = useState<IntegrationConfig[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<IntegrationConfig | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
    const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [needsReconnect, setNeedsReconnect] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [showAiPrompt, setShowAiPrompt] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'urgent' | 'follow-up' | 'newsletter' | 'spam' | 'normal'>('all');
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [taskFromEmail, setTaskFromEmail] = useState<{ title: string; description: string; priority: string } | null>(null);
    const [emailSummary, setEmailSummary] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [replySuggestions, setReplySuggestions] = useState<string[]>([]);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
    const [showRouteModal, setShowRouteModal] = useState(false);
    const [routeToEmail, setRouteToEmail] = useState('');
    const [configuredRegion, setConfiguredRegion] = useState<string | null>(null);
    const [replyBody, setReplyBody] = useState('');

    const getInitials = (name: string) => {
        if (!name) return '??';
        const cleanName = name.split('<')[0].trim();
        const parts = cleanName.split(' ').filter(p => p.length > 0);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return '??';
    };
    const selectedMessageMeta = useMemo(
        () => messages.find((m) => m.messageId === selectedMessage) || null,
        [messages, selectedMessage]
    );
    const reconnectUrl = (() => {
        const params = new URLSearchParams();
        if (userIdProp) params.set('state', userIdProp);
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
                
                // Default to Zoho if available
                const zoho = filtered.find(p => p.type === 'zoho');
                setSelectedProvider(zoho || filtered[0] || null);
            });
        }
    }, [user?.id]);

    useEffect(() => {
        if (emailData.provider) {
            const provider = availableProviders.find(p => p.type === emailData.provider);
            if (provider) setSelectedProvider(provider);
        }
    }, [emailData.provider, availableProviders]);

    useEffect(() => {
        const verifyZohoMailReady = async () => {
            try {
                const res = await fetch('/api/auth/zoho/status', { credentials: 'include' });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return;
                if (typeof data?.configuredRegion === 'string' && data.configuredRegion) {
                    setConfiguredRegion(data.configuredRegion);
                }
                if (data?.isConnected !== true) {
                    setNeedsReconnect(true);
                    setError('Zoho Mail is not fully connected for this account. Reconnect Zoho in Settings.');
                }
            } catch {
                // keep existing UI behavior
            }
        };
        verifyZohoMailReady();
    }, []);

    // Email categorization function
    const categorizeEmail = (message: Message): 'urgent' | 'follow-up' | 'newsletter' | 'spam' | 'normal' => {
        const subject = (message.subject || '').toLowerCase();
        const sender = (message.sender || '').toLowerCase();
        const snippet = (message.snippet || '').toLowerCase();

        // Urgent keywords
        const urgentKeywords = ['urgent', 'asap', 'emergency', 'critical', 'deadline', 'important', 'priority', 'immediately'];
        if (urgentKeywords.some(kw => subject.includes(kw) || snippet.includes(kw))) {
            return 'urgent';
        }

        // Follow-up keywords
        const followUpKeywords = ['follow up', 'checking in', 'reminder', 'update', 'status', 'next steps', 'action required'];
        if (followUpKeywords.some(kw => subject.includes(kw) || snippet.includes(kw))) {
            return 'follow-up';
        }

        // Newsletter indicators
        const newsletterIndicators = ['unsubscribe', 'newsletter', 'digest', 'weekly', 'update', '@newsletter.com', '@news.', '@digest.'];
        if (newsletterIndicators.some(ind => subject.includes(ind) || sender.includes(ind) || snippet.includes(ind))) {
            return 'newsletter';
        }

        // Spam indicators
        const spamIndicators = ['winner', 'congratulations', 'free money', 'click here', 'limited time', 'act now', 'you have been selected', 'prize', 'lottery'];
        if (spamIndicators.some(ind => subject.includes(ind) || snippet.includes(ind))) {
            return 'spam';
        }

        return 'normal';
    };

    // Filter messages by category
    const filteredMessages = useMemo(() => {
        if (categoryFilter === 'all') return messages;
        return messages.filter(msg => msg.category === categoryFilter);
    }, [messages, categoryFilter]);

    // Central fetch helper — session cookies + clear errors for Zoho vs login
    const withUserContext = (url: string): string => {
        if (!userIdProp) return url;
        const hasQuery = url.includes('?');
        const hasUserId = /(?:\?|&)userId=/.test(url);
        if (hasUserId) return url;
        return `${url}${hasQuery ? '&' : '?'}userId=${encodeURIComponent(userIdProp)}`;
    };

    const zohoFetch = async (url: string, options?: RequestInit): Promise<any> => {
        const targetUrl = withUserContext(url);
        const res = await fetch(targetUrl, { credentials: 'include', ...options });
        const raw = await res.text();
        let data: Record<string, unknown> = {};
        try {
            data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        } catch {
            data = { error: raw?.slice(0, 200) || `HTTP ${res.status}` };
        }
        if (res.status === 401) {
            if (data?.code === 'NO_SUPABASE_SESSION') {
                setNeedsReconnect(false);
                setError(
                    typeof data.error === 'string'
                        ? data.error
                        : 'Sign in again to load mail. Third-party cookie blocking can also break the session.'
                );
                return null;
            }
            if (data?.reconnect) {
                setNeedsReconnect(true);
                setError(
                    typeof data.error === 'string'
                        ? data.error
                        : 'Your Zoho connection needs to be renewed. Reconnect Zoho under Integrations.'
                );
                return null;
            }
            setError(typeof data.error === 'string' ? data.error : 'Unauthorized');
            return null;
        }
        if (res.status === 503 && data?.code === 'ZOHO_UPSTREAM_UNAVAILABLE') {
            setError(
                typeof data.error === 'string'
                    ? data.error
                    : 'Zoho Mail is temporarily unavailable.'
            );
            return null;
        }
        if (!res.ok) {
            setError(
                typeof data.error === 'string' ? data.error : `Request failed (${res.status})`
            );
            return null;
        }
        return data;
    };

    useEffect(() => {
        fetchFolders();
    }, []);

    useEffect(() => {
        if (selectedFolder && !searchTerm) fetchMessages(selectedFolder);
    }, [selectedFolder, searchTerm]);

    const fetchFolders = async () => {
        const data = await zohoFetch('/api/zoho/mail?action=folders');
        if (Array.isArray(data) && data.length > 0) {
            setFolders(data);
            const inbox = data.find((f: any) =>
                f.folderName?.toLowerCase().includes('inbox')
            ) || data[0];
            if (inbox?.folderId) setSelectedFolder(inbox.folderId);
        }
    };

    const fetchMessages = async (folderId: string) => {
        setLoading(true);
        try {
            const data = await zohoFetch(`/api/zoho/mail?action=messages&folderId=${folderId}`);
            if (Array.isArray(data)) {
                // Apply categorization to each message
                const categorizedMessages = data.map((msg: Message) => ({
                    ...msg,
                    category: categorizeEmail(msg)
                }));
                setMessages(categorizedMessages);
            } else {
                setMessages([]);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchMessageContent = async (id: string) => {
        setLoading(true);
        try {
            const data = await zohoFetch(`/api/zoho/mail?action=content&messageId=${id}&folderId=${selectedFolder}`);
            if (data) {
                setMessageContent(data);
                setSelectedMessage(id);
                setEmailSummary(null);
                setReplySuggestions([]);
                fetch(`/api/zoho/mail?action=markRead&messageId=${id}&folderId=${selectedFolder}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                }).catch(() => {});
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribeAutoResponder = async () => {
        setAiGenerating(true);
        try {
            const res = await fetch('/api/zoho/mail?action=subscribe', {
                method: 'POST',
                credentials: 'include',
            });
            const subRaw = await res.text();
            let data: { success?: boolean; error?: string; reconnect?: boolean } = {};
            try {
                data = subRaw ? JSON.parse(subRaw) : {};
            } catch {
                data = { error: subRaw?.slice(0, 120) || `HTTP ${res.status}` };
            }
            if (res.status === 401 && data.reconnect) {
                setNeedsReconnect(true);
                throw new Error(data.error || 'Reconnect Zoho under Integrations.');
            }
            if (res.ok && data?.success) {
                toast.success('AI Auto-Responder active!');
            } else {
                throw new Error(data?.error || 'Failed to activate auto-responder.');
            }
        } catch (err: any) {
            toast.error(err.message || 'Activation failed');
        } finally {
            setAiGenerating(false);
        }
    };

    const formatDate = (dateStr: any) => {
        if (!dateStr) return 'N/A';
        try {
            const date = isNaN(Number(dateStr)) ? new Date(dateStr) : new Date(Number(dateStr));
            if (isNaN(date.getTime())) return String(dateStr);
            return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch {
            return String(dateStr);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm) return;
        setLoading(true);
        try {
            const data = await zohoFetch(`/api/zoho/mail?action=search&q=${encodeURIComponent(searchTerm)}`);
            if (Array.isArray(data)) setMessages(data);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this message?')) return;
        const data = await zohoFetch(`/api/zoho/mail?messageId=${id}&folderId=${selectedFolder}`, { method: 'DELETE' });
        if (data !== null) {
            setSelectedMessage(null);
            fetchMessages(selectedFolder);
        }
    };

    const handleArchive = async (id: string) => {
        const data = await zohoFetch(`/api/zoho/mail?action=archive&messageId=${id}&folderId=${selectedFolder}`);
        if (data !== null) {
            setSelectedMessage(null);
            fetchMessages(selectedFolder);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const normalizedSubject = emailData.subject.trim();
        if (!normalizedSubject) {
            toast.error('Subject is required.');
            return;
        }
        setSending(true);
        try {
            // Use unified email API if it's not Zoho, or if we want multi-provider support
            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: emailData.to,
                    subject: normalizedSubject,
                    text: emailData.body,
                    tenantId: currentTenant?.id,
                    userId: user?.id,
                    provider: selectedProvider?.type || 'zoho'
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Failed to send' }));
                throw new Error(err.error || 'Failed to send email');
            }

            setComposing(false);
            setEmailData({ to: '', subject: '', body: '', provider: null });
            toast.success(`Email sent via ${selectedProvider?.name || 'Zoho'}`);
        } catch (err: any) {
            toast.error(err.message || 'Failed to send email');
        } finally {
            setSending(false);
        }
    };

    const handleAiReply = async (customPrompt?: string) => {
        if (!messageContent) return;
        const emailText = messageContent.content || messageContent.body || messageContent.text || '';
        if (!emailText) {
            toast.error('No email content found to generate a reply for.');
            return;
        }
        setAiGenerating(true);
        try {
            const context = customPrompt || 'Be helpful, professional and try to move the discussion forward.';
            const reply = await generateEmailReply(emailText, context);
            if (!reply) throw new Error('AI returned an empty response.');
            const recipient = selectedMessageMeta?.sender || messageContent?.sender || '';
            const subjectBase = selectedMessageMeta?.subject || messageContent?.subject || '';
            setEmailData({
                to: recipient,
                subject: /^re:/i.test(subjectBase) ? subjectBase : `Re: ${subjectBase}`,
                body: reply,
                provider: null
            });
            setComposing(true);
            setAiPrompt('');
            setShowAiPrompt(false);
            toast.success('AI reply drafted!');
        } catch (err: any) {
            console.error('AI Reply failed', err);
            toast.error(err?.message || 'AI reply failed.');
        } finally {
            setAiGenerating(false);
        }
    };

    const handleGenerateAiDraft = async () => {
        if (!aiPrompt) {
            toast.error('Please describe what you want in the email.');
            return;
        }
        setAiGenerating(true);
        try {
            const draft = await generateEmailDraft(aiPrompt, emailData.to, emailData.subject);
            if (!draft) throw new Error('AI failed to generate a draft.');
            setEmailData(prev => ({ ...prev, body: draft }));
            toast.success('Professional draft generated!');
            setShowAiPrompt(false);
            setAiPrompt('');
        } catch (err: any) {
            console.error('Draft generation failed:', err);
            toast.error('Failed to generate draft.');
        } finally {
            setAiGenerating(false);
        }
    };

    const handleCreateTaskFromEmail = () => {
        if (!messageContent) return;
        
        const title = messageContent.subject || 'Task from email';
        const description = `From: ${messageContent.sender}\n\n${messageContent.content || messageContent.snippet || ''}`;
        
        setTaskFromEmail({ title, description, priority: 'medium' });
        setShowTaskModal(true);
    };

    const handleSaveTask = async (taskData: { title: string; description: string; priority: string }) => {
        let userId = userIdProp?.trim() || '';
        if (!userId) {
            const { data: { user } } = await supabase.auth.getUser();
            userId = user?.id || '';
        }
        if (!userId) {
            toast.error('Sign in required to create a task.');
            return;
        }

        try {
            const { error } = await taskService.createTask(userId, {
                title: taskData.title,
                description: taskData.description,
                priority: taskData.priority as any,
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Due in 7 days
            });
            
            if (!error) {
                toast.success('Task created successfully!');
                setShowTaskModal(false);
                setTaskFromEmail(null);
            } else {
                toast.error('Failed to create task');
            }
        } catch (err) {
            toast.error('Failed to create task');
        }
    };

    const handleSummarizeEmail = async () => {
        if (!messageContent) return;
        
        setIsSummarizing(true);
        try {
            const content = messageContent.content || messageContent.snippet || '';
            const summary = await generateEmailDraft(
                `Summarize this email:\n\nSubject: ${messageContent.subject}\nFrom: ${messageContent.sender}\n\n${content}`,
                '',
                ''
            );
            
            if (summary) {
                setEmailSummary(summary);
                toast.success('Email summarized!');
            } else {
                toast.error('Failed to summarize email');
            }
        } catch (err) {
            toast.error('Failed to summarize email');
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleGenerateReplySuggestions = async () => {
        if (!messageContent) return;
        
        setIsGeneratingSuggestions(true);
        try {
            const content = messageContent.content || messageContent.snippet || '';
            const suggestions = await generateEmailDraft(
                `Generate exactly 3 concise professional reply suggestions for this email. Do not prefix with labels like Option 1 or numbers.\n\nSubject: ${selectedMessageMeta?.subject || messageContent.subject}\nFrom: ${selectedMessageMeta?.sender || messageContent.sender}\n\n${content}`,
                '',
                ''
            );
            
            if (suggestions) {
                // Parse the numbered list into an array
                const parsedSuggestions = suggestions
                    .split('\n')
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0)
                    .map((line) => line.replace(/^(option\s*\d+[:.)-]?\s*|\d+[.)-]\s*)/i, ''));
                
                setReplySuggestions(parsedSuggestions.length > 0 ? parsedSuggestions : [suggestions]);
                toast.success('Reply suggestions generated!');
            } else {
                toast.error('Failed to generate suggestions');
            }
        } catch (err) {
            toast.error('Failed to generate suggestions');
        } finally {
            setIsGeneratingSuggestions(false);
        }
    };

    const handleRouteEmail = async () => {
        if (!messageContent || !routeToEmail) {
            toast.error('Please select an email to route to');
            return;
        }

        try {
            // Forward the email to the team member
            await zohoFetch('/api/zoho/mail?action=forward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messageId: selectedMessage,
                    to: routeToEmail,
                    folderId: selectedFolder
                })
            });
            
            toast.success('Email routed successfully!');
            setShowRouteModal(false);
            setRouteToEmail('');
        } catch (err) {
            toast.error('Failed to route email');
        }
    };

    return (
        <div className="flex flex-col bg-gray-950 text-gray-100 rounded-2xl border border-white/5 overflow-hidden shadow-2xl h-[calc(100vh-140px)] min-h-[600px] relative">
            {needsReconnect && (
                <div className="flex items-center justify-between gap-3 px-5 py-3 bg-red-900/40 border-b border-red-500/30 text-sm">
                    <div className="flex items-center gap-2 text-red-300">
                        <AlertCircle size={16} />
                        <span className="font-semibold">Zoho session expired.</span>
                    </div>
                    <a href={reconnectUrl} className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors">Reconnect</a>
                </div>
            )}
            <div className="flex flex-1 overflow-hidden">
                <div className={`
                    ${isMobileMenuOpen ? 'fixed inset-0 z-50 bg-gray-950 w-64 border-r border-white/5 shadow-2xl shadow-blue-500/10' : 'hidden lg:flex'} 
                    w-64 flex-col bg-gray-900/40 backdrop-blur-xl shrink-0 transition-all duration-300
                `}>
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-blue-600/20 rounded-lg text-blue-400"><Mail size={18} /></div>
                            <span className="font-bold text-gray-200 tracking-tight">Zoho Mail</span>
                        </div>
                    </div>
                    
                    <div className="p-4 px-6">
                        <button 
                            onClick={() => { setComposing(true); setSelectedMessage(null); setIsMobileMenuOpen(false); }}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 px-4 rounded-xl transition-all shadow-lg active:scale-95 group"
                        >
                            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" /> 
                            <span className="font-bold text-sm">Compose</span>
                        </button>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5 custom-scrollbar">
                        <div className="mt-4 mb-3 px-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Folders</div>
                        {folders.map(folder => (
                            <button
                                key={folder.folderId}
                                onClick={() => { setSelectedFolder(folder.folderId); setSelectedMessage(null); setComposing(false); setSearchTerm(''); setIsMobileMenuOpen(false); }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${selectedFolder === folder.folderId ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`${selectedFolder === folder.folderId ? 'text-white' : 'text-gray-500 group-hover:text-blue-400'}`}>
                                        {folder.folderName.toLowerCase().includes('inbox') ? <Inbox size={18} /> : 
                                         folder.folderName.toLowerCase().includes('archive') ? <Archive size={18} /> : 
                                         <Mail size={18} />}
                                    </div>
                                    <span className="text-sm font-semibold">{folder.folderName}</span>
                                </div>
                                {folder.unreadCount > 0 && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${selectedFolder === folder.folderId ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>{folder.unreadCount}</span>
                                )}
                            </button>
                        ))}
                    </nav>

                    <div className="p-4 mt-auto border-t border-white/5 space-y-3">
                        <div className="px-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">AI Tools</div>
                        <button 
                            onClick={handleSubscribeAutoResponder}
                            disabled={aiGenerating}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-gray-400 hover:bg-teal-500/10 hover:text-teal-400 transition-all border border-transparent hover:border-teal-500/20"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-teal-500/10 rounded-lg text-teal-400"><ShieldCheck size={16} /></div>
                                <span className="text-sm font-semibold">AI Auto-Reply</span>
                            </div>
                            {aiGenerating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        </button>
                        <button 
                            onClick={() => setIsLeadModalOpen(true)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-indigo-500/10 hover:text-indigo-400 transition-all border border-transparent hover:border-indigo-500/20"
                        >
                            <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400"><Sparkles size={16} /></div>
                            <span className="text-sm font-semibold">Lead Outreach</span>
                        </button>
                    </div>
                </div>

                <div className={`flex flex-col h-full bg-gray-900/10 border-r border-white/5 shrink-0 transition-all duration-300 ${selectedMessage ? 'hidden md:flex w-80 lg:w-96' : 'flex-1 md:w-80 lg:w-96'}`}>
                    <div className="p-4 border-b border-white/5 flex items-center gap-4 bg-gray-950/20 backdrop-blur-xl sticky top-0 z-10">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2.5 hover:bg-white/5 rounded-xl text-gray-400"><Menu size={22} /></button>
                        <form onSubmit={handleSearch} className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors" size={16} />
                            <input 
                                type="text" placeholder="Search mail..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-950/40 border border-white/5 rounded-xl pl-12 pr-4 py-2.5 focus:ring-1 focus:ring-blue-500/30 outline-none text-sm placeholder:text-gray-600"
                            />
                        </form>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pt-0 divide-y divide-white/5">
                        {/* Category Filter */}
                        <div className="flex gap-2 px-2 py-3 overflow-x-auto custom-scrollbar">
                            {(['all', 'urgent', 'follow-up', 'newsletter', 'spam', 'normal'] as const).map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategoryFilter(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                                        categoryFilter === cat
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                    }`}
                                >
                                    {cat === 'all' ? 'All' : cat}
                                </button>
                            ))}
                        </div>

                        {loading && messages.length === 0 ? (
                            <div className="space-y-2 px-2 mt-4">
                                {[1,2,3,4,5].map(i => <div key={i} className="w-full h-20 bg-gray-800/20 rounded-xl animate-pulse" />)}
                            </div>
                        ) : filteredMessages.length === 0 ? (
                            <div className="text-center py-20 text-gray-600 text-sm">No messages in this category</div>
                        ) : (
                            filteredMessages.map(msg => {
                                const categoryColors = {
                                    urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
                                    'follow-up': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
                                    newsletter: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
                                    spam: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                                    normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                };
                                const categoryColor = categoryColors[msg.category || 'normal'];
                                
                                return (
                                    <button
                                        key={msg.messageId}
                                        onClick={() => fetchMessageContent(msg.messageId)}
                                        className={`w-full text-left p-4 rounded-xl transition-all flex flex-col gap-1 relative mb-1 ${selectedMessage === msg.messageId ? 'bg-blue-600/10 border border-blue-500/20' : 'hover:bg-white/5 border border-transparent'}`}
                                    >
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className={`font-bold text-xs truncate max-w-[150px] ${msg.status === 'unread' ? 'text-white' : 'text-gray-400'}`}>
                                                {(msg.sender || '').split('<')[0].trim() || 'Unknown'}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {msg.category && msg.category !== 'normal' && (
                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border ${categoryColor}`}>
                                                        {msg.category}
                                                    </span>
                                                )}
                                                <span className="text-[11px] text-gray-600">{formatDate(msg.receivedTime)}</span>
                                            </div>
                                        </div>
                                        <p className={`text-xs font-semibold truncate ${msg.status === 'unread' ? 'text-blue-200' : 'text-gray-500'}`}>{msg.subject}</p>
                                        <p className="text-[10px] text-gray-600 truncate opacity-60">{msg.snippet}</p>
                                        {selectedMessage === msg.messageId && <div className="absolute inset-y-0 left-0 w-1 bg-blue-500 rounded-full" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-w-0 bg-slate-900/50">
                    <AnimatePresence mode="popLayout" initial={false}>
                        {composing ? (
                            <motion.div key="compose" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col p-6 lg:p-12 overflow-y-auto w-full">
                                <div className="flex justify-between items-center mb-10">
                                    <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">New Message</h2>
                                    <button onClick={() => setComposing(false)} className="p-3 text-gray-500 hover:text-white rounded-xl hover:bg-white/5"><X size={24} /></button>
                                </div>
                                <form onSubmit={handleSend} className="space-y-6">
                                    {availableProviders.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-6">
                                            {availableProviders.map(provider => (
                                                <button
                                                    key={provider.id}
                                                    type="button"
                                                    onClick={() => setSelectedProvider(provider)}
                                                    className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedProvider?.id === provider.id
                                                        ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                                                        : 'bg-gray-950/50 text-gray-500 border-white/5 hover:border-white/10'
                                                        }`}
                                                >
                                                    {provider.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <div className="flex justify-between"><label className="text-xs font-medium text-gray-400">To</label><button type="button" onClick={() => setIsContactPickerOpen(true)} className="text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full">Directory</button></div>
                                            <input type="email" required value={emailData.to} onChange={e => setEmailData({...emailData, to: e.target.value})} className="w-full bg-gray-900/40 border border-white/5 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/30 outline-none" placeholder="recipient@example.com" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-gray-400">Subject</label>
                                            <input type="text" required value={emailData.subject} onChange={e => setEmailData({...emailData, subject: e.target.value})} className="w-full bg-gray-900/40 border border-white/5 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/30 outline-none" placeholder="Topic" />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between"><label className="text-xs font-medium text-gray-400">Message</label><button type="button" onClick={() => setShowAiPrompt(!showAiPrompt)} className="text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full"><Sparkles size={10} className="inline mr-1"/> Draft with AI</button></div>
                                        {showAiPrompt && (
                                            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 space-y-3">
                                                <textarea placeholder="Tell AI what to write..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className="w-full bg-slate-950/50 border border-indigo-500/10 rounded-xl px-4 py-3 text-sm focus:outline-none h-20 resize-none" />
                                                <div className="flex justify-end"><button type="button" onClick={handleGenerateAiDraft} className="bg-indigo-600 text-white text-[10px] font-black uppercase px-6 py-2 rounded-lg">Generate Draft</button></div>
                                            </div>
                                        )}
                                        <textarea required rows={12} value={emailData.body} onChange={e => setEmailData({...emailData, body: e.target.value})} className="w-full bg-gray-900/40 border border-white/5 rounded-2xl px-6 py-6 focus:ring-2 focus:ring-blue-500/30 outline-none resize-none text-lg" placeholder="Write here..." />
                                    </div>
                                    <div className="flex justify-end pt-6"><button disabled={sending} type="submit" className="bg-blue-600 text-white font-black px-12 py-4 rounded-2xl shadow-xl active:scale-95">{sending ? 'Sending...' : 'Send Email'}</button></div>
                                </form>
                            </motion.div>
                        ) : selectedMessage ? (
                            <motion.div key={selectedMessage} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="flex-1 flex flex-col bg-gray-900/10">
                                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-gray-950/20 backdrop-blur-xl">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <button onClick={() => setSelectedMessage(null)} className="p-2.5 hover:bg-white/5 rounded-xl text-gray-400"><ArrowLeft size={20} /></button>
                                        <div className="min-w-0"><h2 className="text-sm font-black truncate text-gray-200">{messageContent?.subject}</h2><p className="text-xs text-blue-400 truncate">{messageContent?.sender}</p></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleSummarizeEmail()} disabled={isSummarizing} className="flex items-center gap-2 bg-indigo-600/10 text-indigo-400 px-3 py-1.5 rounded-xl border border-indigo-600/20"><Sparkles size={14} /> {isSummarizing ? 'Summarizing...' : 'Summarize'}</button>
                                        <button onClick={() => handleGenerateReplySuggestions()} disabled={isGeneratingSuggestions} className="flex items-center gap-2 bg-teal-600/10 text-teal-400 px-3 py-1.5 rounded-xl border border-teal-600/20"><Sparkles size={14} /> {isGeneratingSuggestions ? 'Generating...' : 'Smart Replies'}</button>
                                        <button onClick={() => setShowRouteModal(true)} className="flex items-center gap-2 bg-indigo-600/10 text-indigo-400 px-3 py-1.5 rounded-xl border border-indigo-600/20"><Users size={14} /> Route</button>
                                        <button onClick={() => handleCreateTaskFromEmail()} className="flex items-center gap-2 bg-teal-600/10 text-teal-400 px-3 py-1.5 rounded-xl border border-teal-600/20"><CheckSquare size={14} /> Create Task</button>
                                        <button onClick={() => handleAiReply()} disabled={aiGenerating} className="flex items-center gap-2 bg-blue-600/10 text-blue-400 px-3 py-1.5 rounded-xl border border-blue-600/20"><Sparkles size={14} /> AI Reply</button>
                                        <button onClick={() => handleArchive(selectedMessage!)} className="p-2 hover:bg-white/5 text-gray-500"><Archive size={18} /></button>
                                        <button onClick={() => handleDelete(selectedMessage!)} className="p-2 hover:bg-white/5 text-gray-500"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar min-h-0">
                                    {loading ? <div className="text-center py-40 opacity-30"><Loader2 className="animate-spin inline mr-2"/>Loading...</div> : (
                                        <div className="max-w-4xl mx-auto space-y-8">
                                            <div className="flex justify-between items-center pb-6 border-b border-white/5">
                                                <div className="flex gap-4">
                                                    <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center font-black text-blue-400 border border-white/5 shadow-inner">{getInitials(messageContent?.sender)}</div>
                                                    <div><p className="font-semibold text-white">{messageContent?.sender}</p><p className="text-gray-500 text-xs">{formatDate(messageContent?.receivedTime)}</p></div>
                                                </div>
                                            </div>
                                            <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed text-base break-words" dangerouslySetInnerHTML={{ __html: (messageContent?.content && messageContent.content !== 'na') ? messageContent.content : '<div class="flex flex-col items-center justify-center py-20 text-gray-500 italic"><p>No message content available</p></div>' }} />
                                            
                                            {emailSummary && (
                                                <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Sparkles className="w-4 h-4 text-indigo-400" />
                                                        <span className="text-sm font-semibold text-indigo-400">AI Summary</span>
                                                    </div>
                                                    <p className="text-sm text-gray-300">{emailSummary}</p>
                                                </div>
                                            )}

                                            {replySuggestions.length > 0 && (
                                                <div className="mt-6 p-4 bg-teal-500/10 border border-teal-500/30 rounded-xl">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <Sparkles className="w-4 h-4 text-teal-400" />
                                                            <span className="text-sm font-semibold text-teal-400">Smart Reply Suggestions</span>
                                                        </div>
                                                        <button
                                                            onClick={() => setReplySuggestions([])}
                                                            className="text-slate-500 hover:text-white"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {replySuggestions.map((suggestion, index) => (
                                                            <button
                                                                key={index}
                                                                onClick={() => {
                                                                    const subjectBase = selectedMessageMeta?.subject || messageContent?.subject || '';
                                                                    setEmailData({
                                                                        to: selectedMessageMeta?.sender ?? messageContent?.sender ?? '',
                                                                        subject: /^re:/i.test(subjectBase) ? subjectBase : `Re: ${subjectBase}`,
                                                                        body: suggestion,
                                                                        provider: null
                                                                    });
                                                                    setComposing(true);
                                                                    setReplySuggestions([]);
                                                                }}
                                                                className="w-full text-left p-3 bg-slate-900/50 rounded-lg hover:bg-slate-800 transition-colors"
                                                            >
                                                                <p className="text-sm text-gray-300">{suggestion}</p>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="pt-10 pb-20">
                                                {/* Original Reply button removed in favor of pinned reply box */}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ── Pinned Reply Box ────────────────────────────────────── */}
                                <div className="p-4 bg-gray-900/80 backdrop-blur-md border-t border-white/5 sticky bottom-0 z-10">
                                    <div className="max-w-4xl mx-auto space-y-3">
                                        <div className="relative">
                                            <textarea 
                                                value={replyBody}
                                                onChange={(e) => setReplyBody(e.target.value)}
                                                placeholder="Write a reply or use Smart replies above..."
                                                className="w-full bg-gray-950/50 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 min-h-[100px] resize-none placeholder:text-gray-600"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => setReplyBody('')}
                                                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-white transition-colors"
                                                >
                                                    Discard
                                                </button>
                                                <button 
                                                    onClick={() => toast.success('Draft saved')}
                                                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-white transition-colors"
                                                >
                                                    Save draft
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => toast.success('Scheduled!')}
                                                    className="px-4 py-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                                                >
                                                    Schedule send
                                                </button>
                                                <button 
                                                    disabled={sending || !replyBody.trim()}
                                                    onClick={async () => {
                                                        const recipient = selectedMessageMeta?.sender || messageContent?.sender || '';
                                                        const subjectBase = selectedMessageMeta?.subject || messageContent?.subject || '';
                                                        setSending(true);
                                                        try {
                                                            const res = await fetch('/api/email/send', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    to: recipient,
                                                                    subject: /^re:/i.test(subjectBase) ? subjectBase : `Re: ${subjectBase}`,
                                                                    text: replyBody,
                                                                    tenantId: currentTenant?.id,
                                                                    userId: user?.id,
                                                                    provider: selectedProvider?.type || 'zoho'
                                                                })
                                                            });
                                                            if (!res.ok) throw new Error('Failed to send');
                                                            setReplyBody('');
                                                            toast.success('Reply sent!');
                                                        } catch (err: any) {
                                                            toast.error(err.message || 'Failed to send reply');
                                                        } finally {
                                                            setSending(false);
                                                        }
                                                    }}
                                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white text-xs font-bold px-6 py-2 rounded-lg shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex items-center gap-2"
                                                >
                                                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                    Send
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-600 p-8 text-center bg-gray-900/10"><Mail size={40} className="mb-4 opacity-30" /><h3 className="text-lg font-semibold text-gray-400">No message selected</h3><p className="text-sm text-gray-600">Select an email to read.</p></div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            <div className="h-10 bg-gray-950 border-t border-white/5 px-4 flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-green-500 rounded-full" /><span>Zoho connected</span></div>
                <div className="flex items-center gap-1.5 text-blue-400/70"><Sparkles size={11} /><span>AI Auto-Apply active</span></div>
            </div>

            <LeadOutreachModal 
                isOpen={isLeadModalOpen} 
                onClose={() => setIsLeadModalOpen(false)} 
                onEmailDrafted={(data) => {
                    setEmailData({
                        to: data.to,
                        subject: data.subject,
                        body: data.body,
                        provider: data.provider || null
                    });
                    setComposing(true);
                    setSelectedMessage(null);
                }} 
            />
            <CRMContactPickerModal isOpen={isContactPickerOpen} onClose={() => setIsContactPickerOpen(false)} onSelectContact={email => setEmailData(prev => ({ ...prev, to: email }))} />

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
                .prose img { max-width: 100%; border-radius: 8px; margin: 16px 0; border: 1px solid rgba(255,255,255,0.05); }
            `}</style>

            {/* Task Creation Modal */}
            {showTaskModal && taskFromEmail && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold text-white mb-4">Create Task from Email</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Task Title</label>
                                <input
                                    type="text"
                                    value={taskFromEmail.title}
                                    onChange={(e) => setTaskFromEmail({ ...taskFromEmail, title: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                                <textarea
                                    value={taskFromEmail.description}
                                    onChange={(e) => setTaskFromEmail({ ...taskFromEmail, description: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white h-32 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Priority</label>
                                <select
                                    value={taskFromEmail.priority}
                                    onChange={(e) => setTaskFromEmail({ ...taskFromEmail, priority: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            <div className="flex gap-3 justify-end pt-4">
                                <button
                                    onClick={() => setShowTaskModal(false)}
                                    className="px-4 py-2 text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleSaveTask(taskFromEmail)}
                                    className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700"
                                >
                                    Create Task
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Route Email Modal */}
            {showRouteModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold text-white mb-4">Route Email to Team Member</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Team Member Email</label>
                                <input
                                    type="email"
                                    value={routeToEmail}
                                    onChange={(e) => setRouteToEmail(e.target.value)}
                                    placeholder="colleague@company.com"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                />
                            </div>
                            <div className="flex gap-3 justify-end pt-4">
                                <button
                                    onClick={() => setShowRouteModal(false)}
                                    className="px-4 py-2 text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRouteEmail}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                                >
                                    Route Email
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

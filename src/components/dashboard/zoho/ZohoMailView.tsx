'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
    Mail, Send, Inbox, Archive, Trash2, Search, Loader2, Plus, 
    ArrowLeft, Menu, X, MoreVertical, Sparkles, Reply, Forward,
    MoreHorizontal, CheckCircle2, RotateCcw, AlertCircle, FileText, ShieldCheck
} from 'lucide-react';
import { generateEmailReply } from '@/services/unifiedAIService';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
    messageId: string;
    sender: string;
    subject: string;
    receivedTime: string;
    snippet: string;
    status?: string; // read/unread
}

interface Folder {
    folderId: string;
    folderName: string;
    unreadCount: number;
}

import LeadOutreachModal from './LeadOutreachModal';

export default function ZohoMailView() {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string>('1'); // Inbox
    const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
    const [messageContent, setMessageContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [composing, setComposing] = useState(false);
    const [emailData, setEmailData] = useState({ to: '', subject: '', body: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [needsReconnect, setNeedsReconnect] = useState(false);

    // Central fetch helper — detects AUTH_EXPIRED (reconnect: true) from API
    const zohoFetch = async (url: string, options?: RequestInit): Promise<any> => {
        const res = await fetch(url, options);
        const data = await res.json();
        if (res.status === 401 && data?.reconnect) {
            setNeedsReconnect(true);
            setError('Your Zoho session has expired. Please reconnect your account.');
            return null;
        }
        if (!res.ok) {
            setError(data?.error || `Request failed (${res.status})`);
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
            // Auto-select inbox (or first folder) using real folder ID from Zoho
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
            if (Array.isArray(data)) setMessages(data);
            else setMessages([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessageContent = async (id: string) => {
        setLoading(true);
        try {
            const data = await zohoFetch(`/api/zoho/mail?action=content&messageId=${id}`);
            if (data) {
                setMessageContent(data);
                setSelectedMessage(id);
                fetch(`/api/zoho/mail?action=markRead&messageId=${id}`).catch(() => {});
            }
        } finally {
            setLoading(false);
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
        const data = await zohoFetch(`/api/zoho/mail?messageId=${id}`, { method: 'DELETE' });
        if (data !== null) {
            setSelectedMessage(null);
            fetchMessages(selectedFolder);
        }
    };

    const handleArchive = async (id: string) => {
        const data = await zohoFetch(`/api/zoho/mail?action=archive&messageId=${id}`);
        if (data !== null) {
            setSelectedMessage(null);
            fetchMessages(selectedFolder);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        try {
            const data = await zohoFetch('/api/zoho/mail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toAddress: emailData.to,
                    subject: emailData.subject,
                    content: emailData.body,
                }),
            });
            if (data !== null) {
                setComposing(false);
                setEmailData({ to: '', subject: '', body: '' });
            }
        } finally {
            setSending(false);
        }
    };

    const handleAiReply = async () => {
        if (!messageContent) return;
        const emailText = messageContent.content || messageContent.body || messageContent.text || '';
        if (!emailText) {
            toast.error('No email content found to generate a reply for.');
            return;
        }
        setAiGenerating(true);
        try {
            const reply = await generateEmailReply(emailText, 'Be helpful, professional and try to move the discussion forward.');
            if (!reply) throw new Error('AI returned an empty response.');
            setEmailData({
                to: messageContent.sender || messageContent.fromAddress || '',
                subject: `Re: ${messageContent.subject || ''}`,
                body: reply,
            });
            setComposing(true);
            toast.success('AI reply drafted!');
        } catch (err: any) {
            console.error('AI Reply failed', err);
            toast.error(err?.message || 'AI reply failed. Check that an AI provider key is configured in Settings.');
        } finally {
            setAiGenerating(false);
        }
    };

    return (
        <div className="flex flex-col bg-gray-950 text-gray-100 rounded-2xl border border-white/5 overflow-hidden shadow-2xl h-[calc(100vh-140px)] min-h-[600px] relative">
            {needsReconnect && (
                <div className="flex items-center justify-between gap-3 px-5 py-3 bg-red-900/40 border-b border-red-500/30 text-sm">
                    <div className="flex items-center gap-2 text-red-300">
                        <AlertCircle size={16} />
                        <span className="font-semibold">Zoho session expired.</span>
                        <span className="text-red-400">{error}</span>
                    </div>
                    <a
                        href="/api/auth/zoho/connect"
                        className="shrink-0 bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors"
                    >
                        Reconnect Zoho
                    </a>
                </div>
            )}
            {error && !needsReconnect && (
                <div className="flex items-center justify-between gap-3 px-5 py-2 bg-yellow-900/30 border-b border-yellow-500/20 text-xs text-yellow-300">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={14} />
                        <span>{error}</span>
                    </div>
                    <button onClick={() => setError(null)} className="text-yellow-500 hover:text-yellow-300">
                        <X size={14} />
                    </button>
                </div>
            )}
            <div className="flex flex-1 overflow-hidden">
                {/* Folder Sidebar */}
                <div className={`
                    ${isMobileMenuOpen ? 'fixed inset-0 z-50 bg-gray-950 w-64 border-r border-white/5 shadow-2xl shadow-blue-500/10' : 'hidden lg:flex'} 
                    w-64 flex-col bg-gray-900/40 backdrop-blur-xl shrink-0 transition-all duration-300
                `}>
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-blue-600/20 rounded-lg text-blue-400">
                                <Mail size={18} />
                            </div>
                            <span className="font-bold text-gray-200 tracking-tight">Zoho Cloud</span>
                        </div>
                        <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                    
                    <div className="p-4 px-6">
                        <button 
                            onClick={() => { setComposing(true); setSelectedMessage(null); setIsMobileMenuOpen(false); }}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 group"
                        >
                            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" /> 
                            <span className="font-bold text-sm">Compose</span>
                        </button>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5 custom-scrollbar">
                        <div className="mt-2 mb-4 px-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">Folders {folders.length === 0 && loading && <Loader2 size={10} className="inline ml-2 animate-spin" />}</div>
                        {folders.map(folder => (
                            <button
                                key={folder.folderId}
                                onClick={() => {
                                    setSelectedFolder(folder.folderId);
                                    setSelectedMessage(null);
                                    setComposing(false);
                                    setSearchTerm('');
                                    setIsMobileMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${selectedFolder === folder.folderId ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`transition-colors ${selectedFolder === folder.folderId ? 'text-white' : 'text-gray-500 group-hover:text-blue-400'}`}>
                                        {folder.folderName.toLowerCase().includes('inbox') ? <Inbox size={18} /> : 
                                         folder.folderName.toLowerCase().includes('archive') ? <Archive size={18} /> : 
                                         folder.folderName.toLowerCase().includes('sent') ? <Send size={18} /> :
                                         folder.folderName.toLowerCase().includes('draft') ? <FileText size={18} /> :
                                         folder.folderName.toLowerCase().includes('trash') || folder.folderName.toLowerCase().includes('spam') ? <Trash2 size={18} /> : 
                                         <Mail size={18} />}
                                    </div>
                                    <span className="text-sm font-semibold">{folder.folderName}</span>
                                </div>
                                {folder.unreadCount > 0 && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${selectedFolder === folder.folderId ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
                                        {folder.unreadCount}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>

                    <div className="p-4 mt-auto border-t border-white/5">
                        <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 rounded-2xl p-4 border border-indigo-500/20 shadow-xl overflow-hidden relative group">
                            <div className="absolute -top-4 -right-4 w-16 h-16 bg-blue-500/10 blur-2xl group-hover:bg-blue-500/30 transition-all duration-700" />
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles size={16} className="text-indigo-400 animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">AI Growth Agent</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mb-3 leading-relaxed">Let AI identify high-intent leads and draft personalized outreach.</p>
                            <button 
                                onClick={() => setIsLeadModalOpen(true)}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold py-2 rounded-lg transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                            >
                                Find Leads
                            </button>
                        </div>
                    </div>
                </div>

                {/* Message List */}
                <div className={`flex flex-col h-full bg-gray-900/10 border-r border-white/5 shrink-0 transition-all duration-300 ${selectedMessage ? 'hidden md:flex w-80 lg:w-96' : 'flex-1 md:w-80 lg:w-96'}`}>
                    <div className="p-4 border-b border-white/5 flex items-center gap-4 bg-gray-950/20 backdrop-blur-xl sticky top-0 z-10">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2.5 hover:bg-white/5 rounded-xl text-gray-400">
                            <Menu size={22} />
                        </button>
                        <form onSubmit={handleSearch} className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors pointer-events-none" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search mail..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-800/20 border border-white/5 rounded-xl pl-12 pr-4 py-2.5 focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/30 focus:outline-none transition-all placeholder:text-gray-600 text-sm"
                            />
                        </form>
                        <button onClick={() => fetchMessages(selectedFolder)} className="p-2 text-gray-500 hover:text-white rounded-lg transition-all active:rotate-180 duration-500">
                            <RotateCcw size={16} />
                        </button>
                    </div>

                    <div className="px-6 py-5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">
                                {folders.find(f => f.folderId === selectedFolder)?.folderName || 'Inbox'}
                            </h3>
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                        </div>
                        <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{messages.length} Items</div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pt-0 divide-y divide-white/5">
                        {loading && messages.length === 0 ? (
                            <div className="space-y-2 px-2">
                                {[1,2,3,4,5,6].map(i => (
                                    <div key={i} className="w-full h-20 bg-gray-800/20 rounded-xl animate-pulse border border-white/5" />
                                ))}
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-600 opacity-60 text-sm text-center px-6">
                                <Mail size={40} className="mb-4 opacity-30" />
                                <p className="font-semibold text-gray-400 mb-1">No messages</p>
                                <p className="text-xs text-gray-600">This folder is empty or still loading.<br />Try refreshing or selecting another folder.</p>
                            </div>
                        ) : (
                            messages.map(msg => (
                                <button
                                    key={msg.messageId}
                                    onClick={() => fetchMessageContent(msg.messageId)}
                                    className={`w-full text-left p-4 rounded-xl transition-all group flex flex-col gap-1 relative overflow-hidden mb-1 ${selectedMessage === msg.messageId ? 'bg-blue-600/10 border border-blue-500/20' : 'hover:bg-white/5 border border-transparent'}`}
                                >
                                    <div className="flex justify-between items-center mb-0.5">
                                        <span className={`font-bold text-xs truncate max-w-[150px] transition-colors ${msg.status === 'unread' ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                                            {msg.sender.split('<')[0].trim()}
                                        </span>
                                        <span className="text-[9px] font-black text-gray-600 group-hover:text-gray-500 uppercase">{new Date(msg.receivedTime).toLocaleDateString()}</span>
                                    </div>
                                    <p className={`text-xs font-semibold truncate ${msg.status === 'unread' ? 'text-blue-200' : 'text-gray-500 group-hover:text-gray-400'}`}>{msg.subject}</p>
                                    <p className="text-[10px] text-gray-600 truncate line-clamp-1 opacity-60 group-hover:opacity-100">{msg.snippet}</p>
                                    
                                    {selectedMessage === msg.messageId && (
                                        <div className="absolute inset-y-0 left-0 w-1 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-w-0 bg-slate-900/50 relative">
                    <AnimatePresence mode="popLayout" initial={false}>
                        {composing ? (
                            <motion.div 
                                key="compose"
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 1.05, y: -20 }}
                                transition={{ type: "spring", damping: 20, stiffness: 150 }}
                                className="flex-1 flex flex-col p-6 lg:p-12 overflow-y-auto max-w-5xl mx-auto w-full bg-gray-900/10"
                            >
                                <div className="flex justify-between items-center mb-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-gradient-to-br from-blue-600/30 to-indigo-600/30 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-xl shadow-blue-500/5">
                                            <Send size={28} />
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 tracking-tight">New Message</h2>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Smart outreach enabled</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setComposing(false)} className="p-3 text-gray-500 hover:text-white rounded-xl hover:bg-white/5 transition-all">
                                        <X size={24} />
                                    </button>
                                </div>
                                
                                <form onSubmit={handleSend} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-2">To</label>
                                            <input 
                                                type="email" 
                                                placeholder="recipient@example.com" 
                                                required
                                                value={emailData.to}
                                                onChange={e => setEmailData({...emailData, to: e.target.value})}
                                                className="w-full bg-gray-900/40 border border-white/5 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 focus:outline-none transition-all placeholder:text-gray-700"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-2">Subject</label>
                                            <input 
                                                type="text" 
                                                placeholder="Briefly describe your topic" 
                                                required
                                                value={emailData.subject}
                                                onChange={e => setEmailData({...emailData, subject: e.target.value})}
                                                className="w-full bg-gray-900/40 border border-white/5 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 focus:outline-none transition-all placeholder:text-gray-700"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2 relative">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-2">Body</label>
                                        <textarea 
                                            placeholder="Craft your message with AlphaClone intelligence..." 
                                            rows={14}
                                            required
                                            value={emailData.body}
                                            onChange={e => setEmailData({...emailData, body: e.target.value})}
                                            className="w-full bg-gray-900/40 border border-white/5 rounded-2xl px-6 py-6 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 focus:outline-none resize-none transition-all scrollbar-hide text-lg leading-relaxed placeholder:text-gray-700"
                                        />
                                        <div className="absolute top-12 right-6">
                                            <motion.button 
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                type="button"
                                                onClick={() => {
                                                    setEmailData({
                                                        ...emailData,
                                                        body: emailData.body + "\n\nRegards,\nSent with AlphaClone Growth Agent"
                                                    });
                                                }}
                                                className="bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white px-4 py-2 rounded-xl transition-all border border-indigo-600/30 flex items-center gap-2 shadow-lg"
                                            >
                                                <Sparkles size={14} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Enrich</span>
                                            </motion.button>
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-6">
                                        <button 
                                            disabled={sending}
                                            type="submit" 
                                            className="group flex items-center gap-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-black px-12 py-4 rounded-2xl transition-all shadow-2xl shadow-blue-600/40 active:scale-95 text-lg"
                                        >
                                            {sending ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />} 
                                            <span>{sending ? 'Sending...' : 'Transmit Mail'}</span>
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        ) : selectedMessage ? (
                            <motion.div 
                                key={selectedMessage}
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="flex-1 flex flex-col overflow-hidden bg-gray-900/10"
                            >
                                <div className="p-4 border-b border-white/5 flex items-center justify-between sticky top-0 bg-gray-950/20 backdrop-blur-xl z-20">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <button onClick={() => setSelectedMessage(null)} className="p-2.5 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors">
                                            <ArrowLeft size={20} />
                                        </button>
                                        <div className="min-w-0">
                                            <h2 className="text-sm font-black truncate pr-4 text-gray-200 tracking-tight">{messageContent?.subject}</h2>
                                            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest truncate">{messageContent?.sender}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button 
                                            onClick={handleAiReply}
                                            disabled={aiGenerating}
                                            className="flex items-center gap-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-1.5 rounded-xl transition-all border border-blue-600/20 active:scale-95 disabled:opacity-50"
                                        >
                                            {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                            <span className="text-[10px] font-black uppercase tracking-widest">AI Reply</span>
                                        </button>
                                        <div className="w-[1px] h-6 bg-white/10 mx-1 hidden lg:block" />
                                        <button onClick={() => handleArchive(selectedMessage!)} className="p-2 hover:bg-white/5 text-gray-500 hover:text-amber-400 rounded-lg transition-colors" title="Archive">
                                            <Archive size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(selectedMessage!)} className="p-2 hover:bg-white/5 text-gray-500 hover:text-red-400 rounded-lg transition-colors" title="Delete">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-30">
                                            <Loader2 className="animate-spin text-blue-500" size={40} />
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Loading Content</p>
                                        </div>
                                    ) : (
                                        <div className="max-w-4xl mx-auto space-y-10">
                                            <div className="flex justify-between items-start pb-8 border-b border-white/5">
                                                <div className="flex gap-5">
                                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-xl font-black border border-white/10 shadow-2xl shadow-blue-500/20">
                                                        {messageContent?.sender?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-xl text-white tracking-tight">{messageContent?.sender}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">To me</span>
                                                            <div className="w-1 h-1 bg-gray-700 rounded-full" />
                                                            <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{new Date(messageContent?.receivedTime).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div 
                                                className="prose prose-invert max-w-none text-gray-300 leading-relaxed text-lg font-medium selection:bg-blue-500/30" 
                                                dangerouslySetInnerHTML={{ __html: messageContent?.content }} 
                                            />
                                            <div className="pt-12 flex gap-4">
                                                <button 
                                                    onClick={() => {
                                                        setEmailData({
                                                            to: messageContent.sender,
                                                            subject: `Re: ${messageContent.subject}`,
                                                            body: ""
                                                        });
                                                        setComposing(true);
                                                        // No need to clear selectedMessage, ComposeView overlay handles it
                                                    }}
                                                    className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 font-black uppercase tracking-widest text-[10px]"
                                                >
                                                    <Reply size={14} />
                                                    <span>Reply</span>
                                                </button>
                                                <button className="flex items-center gap-2 bg-gray-800 hover:bg-gray-750 text-white px-8 py-3 rounded-xl border border-white/5 transition-all active:scale-95 font-black uppercase tracking-widest text-[10px]">
                                                    <Forward size={14} />
                                                    <span>Forward</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex-1 flex flex-col items-center justify-center text-gray-600 p-8 text-center bg-gray-900/10"
                            >
                                <div className="w-24 h-24 bg-gray-800/20 rounded-3xl flex items-center justify-center mb-6 border border-white/5">
                                    <Mail size={40} className="text-gray-700" />
                                </div>
                                <h3 className="text-xl font-black text-gray-400 uppercase tracking-widest mb-2">Secure Inbox</h3>
                                <p className="text-xs text-gray-600 max-w-xs leading-relaxed uppercase tracking-tighter">Select a communication thread from the list to begin processing.</p>
                                
                                <div className="mt-12 p-6 bg-blue-600/5 rounded-2xl border border-blue-500/10 max-w-sm">
                                    <div className="flex items-center gap-2 mb-3 text-blue-400">
                                        <ShieldCheck size={16} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Secure Connection</span>
                                    </div>
                                    <p className="text-xs text-gray-500 text-left leading-relaxed">
                                        Your Zoho Mail is connected via <span className="text-gray-300 font-bold">OAuth 2.0</span> protocol. 
                                        Authentication tokens are encrypted and stored securely in our private vault. 
                                        No passwords are ever shared.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>


            <LeadOutreachModal 
                isOpen={isLeadModalOpen}
                onClose={() => setIsLeadModalOpen(false)}
                onEmailDrafted={(data) => {
                    setEmailData(data);
                    setComposing(true);
                    setSelectedMessage(null);
                }}
            />

            {/* AI Floating Status Bar */}
            <div className="h-10 bg-gray-950 border-t border-white/5 px-4 flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest z-30">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span>Zoho Sync Active</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-blue-400">
                        <Sparkles size={12} />
                        <span>AI Co-Pilot Ready</span>
                    </div>
                </div>
                <div className="hidden md:flex gap-4">
                    <span>AlphaClone Node v6.2</span>
                    <span>Last Synced: Just Now</span>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
            `}</style>
        </div>
    );
}

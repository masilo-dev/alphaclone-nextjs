'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
    Loader2, 
    Plus, 
    MessageSquare, 
    Clock, 
    AlertCircle, 
    CheckCircle, 
    XCircle, 
    Search, 
    User, 
    Send, 
    Sparkles, 
    ChevronRight, 
    Filter, 
    ArrowLeft, 
    Bot, 
    Shield, 
    Activity, 
    Briefcase,
    RefreshCw,
    UserCheck,
    Check
} from 'lucide-react';
import { ticketService, type Ticket, type TicketComment, type TicketPriority, type TicketStatus, type TicketSource } from '@/services/ticketService';
import { generateText } from '@/services/unifiedAIService';
import toast from 'react-hot-toast';

const PRIORITY_COLORS: Record<TicketPriority, string> = {
    low: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
    medium: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
    high: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
    urgent: 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold animate-pulse',
};

const STATUS_COLORS: Record<TicketStatus, string> = {
    open: 'bg-blue-500 text-white',
    in_progress: 'bg-amber-500 text-white',
    resolved: 'bg-emerald-500 text-white',
    closed: 'bg-slate-600 text-white',
    reopened: 'bg-purple-500 text-white',
};

export default function DeepDeskView() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
    const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [comments, setComments] = useState<TicketComment[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    
    // Form states
    const [newComment, setNewComment] = useState('');
    const [isInternalNote, setIsInternalNote] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newPriority, setNewPriority] = useState<TicketPriority>('medium');
    const [newSource, setNewSource] = useState<TicketSource>('general');
    const [newSourceName, setNewSourceName] = useState('');
    const [creatingTicket, setCreatingTicket] = useState(false);

    // AI states
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiResult, setAiResult] = useState('');

    const commentsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadAllTickets();
    }, []);

    useEffect(() => {
        if (selectedTicket) {
            loadTicketComments(selectedTicket.id);
        }
    }, [selectedTicket]);

    useEffect(() => {
        if (commentsEndRef.current) {
            commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [comments]);

    const loadAllTickets = async () => {
        try {
            setLoading(true);
            // By passing empty/undefined filters we get all tickets
            const data = await ticketService.getAll({} as any);
            setTickets(data || []);
        } catch (error) {
            console.error('Failed to load tickets:', error);
            toast.error('Failed to load tickets');
        } finally {
            setLoading(false);
        }
    };

    const loadTicketComments = async (ticketId: string) => {
        try {
            setCommentsLoading(true);
            const data = await ticketService.getComments(ticketId);
            setComments(data || []);
        } catch (error) {
            console.error('Failed to load comments:', error);
            toast.error('Failed to load conversation');
        } finally {
            setCommentsLoading(false);
        }
    };

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim() || !newDescription.trim()) {
            toast.error('Title and description are required');
            return;
        }

        try {
            setCreatingTicket(true);
            const ticket = await ticketService.create({
                title: newTitle,
                description: newDescription,
                priority: newPriority,
                source: newSource,
                source_id: 'manual_' + Date.now(),
                source_name: newSourceName || 'Dashboard Agent',
            });

            setTickets(prev => [ticket, ...prev]);
            setSelectedTicket(ticket);
            setShowCreateModal(false);
            setNewTitle('');
            setNewDescription('');
            setNewPriority('medium');
            setNewSource('general');
            setNewSourceName('');
            toast.success('Ticket created successfully');
        } catch (error) {
            console.error('Failed to create ticket:', error);
            toast.error('Failed to create ticket');
        } finally {
            setCreatingTicket(false);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !selectedTicket) return;

        try {
            const comment = await ticketService.addComment(selectedTicket.id, newComment, isInternalNote);
            setComments(prev => [...prev, comment]);
            setNewComment('');
            toast.success(isInternalNote ? 'Internal note added' : 'Public reply sent');
        } catch (error) {
            console.error('Failed to add comment:', error);
            toast.error('Failed to submit response');
        }
    };

    const handleStatusChange = async (status: TicketStatus) => {
        if (!selectedTicket) return;
        try {
            await ticketService.updateStatus(selectedTicket.id, status);
            setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status } : t));
            setSelectedTicket(prev => prev ? { ...prev, status } : null);
            toast.success(`Ticket status updated to ${status.replace('_', ' ')}`);
        } catch (error) {
            console.error('Failed to update status:', error);
            toast.error('Failed to update status');
        }
    };

    const handlePriorityChange = async (priority: TicketPriority) => {
        if (!selectedTicket) return;
        try {
            // Update priority local mock or API update if exists, else reflect in UI state
            setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, priority } : t));
            setSelectedTicket(prev => prev ? { ...prev, priority } : null);
            toast.success(`Ticket priority set to ${priority}`);
        } catch (error) {
            console.error('Failed to update priority:', error);
        }
    };

    // Deep-Desk Copilot AI Actions
    const handleAIDraftReply = async () => {
        if (!selectedTicket) return;
        try {
            setAiGenerating(true);
            setAiResult('');
            
            const conversationSnippet = comments
                .slice(-5)
                .map(c => `${c.is_internal ? '[Internal Note]' : '[Public]'} User(${c.user_id.slice(0, 8)}): ${c.content}`)
                .join('\n');

            const prompt = `You are the Deep-Desk AI Copilot. Draft a professional, empathetic, and direct response to the customer's support ticket.
            
            TICKET TITLE: ${selectedTicket.title}
            TICKET DESCRIPTION: ${selectedTicket.description}
            PRIORITY: ${selectedTicket.priority}
            
            RECENT CONVERSATION HISTORY:
            ${conversationSnippet || 'No messages yet.'}
            
            STRICT RULES:
            - Provide ONLY the direct response to the client. No greetings like "Subject:", no markdown formatting like bold asterisks.
            - Keep it helpful, precise, and friendly.
            - Ensure any placeholder is omitted.`;

            const res = await generateText(prompt);
            if (res.text) {
                setAiResult(res.text.trim());
            } else {
                toast.error('Failed to draft reply');
            }
        } catch (error) {
            console.error('AI generate error:', error);
            toast.error('AI Generation error');
        } finally {
            setAiGenerating(false);
        }
    };

    const handleAISummarize = async () => {
        if (!selectedTicket) return;
        try {
            setAiGenerating(true);
            setAiResult('');

            const conversationSnippet = comments
                .map(c => `${c.is_internal ? '[Internal Note]' : '[Public]'} User(${c.user_id.slice(0, 8)}): ${c.content}`)
                .join('\n');

            const prompt = `You are the Deep-Desk AI Copilot. Summarize the following support ticket and conversation history in 3 concise bullet points for the assigned agent.
            
            TICKET TITLE: ${selectedTicket.title}
            TICKET DESCRIPTION: ${selectedTicket.description}
            
            CONVERSATION HISTORY:
            ${conversationSnippet || 'No messages yet.'}
            
            Provide only the 3 bullet points, using plain text (no asterisks).`;

            const res = await generateText(prompt);
            if (res.text) {
                setAiResult(res.text.trim());
            } else {
                toast.error('Failed to summarize ticket');
            }
        } catch (error) {
            console.error('AI generate error:', error);
            toast.error('AI Generation error');
        } finally {
            setAiGenerating(false);
        }
    };

    const applyAIDraft = () => {
        if (aiResult) {
            setNewComment(prev => prev ? prev + '\n' + aiResult : aiResult);
            toast.success('Applied AI draft to editor');
        }
    };

    // Filter tickets
    const filteredTickets = tickets.filter(ticket => {
        const matchesSearch = 
            ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (ticket.source_name && ticket.source_name.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
        const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;

        return matchesSearch && matchesStatus && matchesPriority;
    });

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            
            {/* Top Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-slate-800 bg-slate-900/60 gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold tracking-tight text-white">Deep-Desk Support Center</h2>
                        <p className="text-xs text-slate-400">Enterprise ticketing powered by Deep-Desk AI Copilot</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl shadow-lg shadow-teal-950/20 transition-all duration-150 active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        Create Ticket
                    </button>
                    <button
                        onClick={loadAllTickets}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 rounded-xl transition-all"
                        title="Reload Tickets"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex flex-1 overflow-hidden relative">
                
                {/* Tickets Sidebar */}
                <div className={`w-full md:w-80 flex flex-col border-r border-slate-800 bg-slate-950 transition-all ${selectedTicket ? 'hidden md:flex' : 'flex'}`}>
                    {/* Filters & Search */}
                    <div className="p-3 border-b border-slate-800/80 space-y-3 bg-slate-900/20">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search tickets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Status</label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as any)}
                                    className="w-full px-2 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-teal-500"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="open">Open</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="resolved">Resolved</option>
                                    <option value="closed">Closed</option>
                                    <option value="reopened">Reopened</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Priority</label>
                                <select
                                    value={priorityFilter}
                                    onChange={(e) => setPriorityFilter(e.target.value as any)}
                                    className="w-full px-2 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-teal-500"
                                >
                                    <option value="all">All Priorities</option>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Ticket List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-900/60 p-2 space-y-1">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                <Loader2 className="w-8 h-8 animate-spin text-teal-400 mb-2" />
                                <span className="text-xs">Loading tickets...</span>
                            </div>
                        ) : filteredTickets.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-xs">No tickets match criteria.</p>
                            </div>
                        ) : (
                            filteredTickets.map(t => {
                                const isSelected = selectedTicket?.id === t.id;
                                const dateStr = new Date(t.created_at).toLocaleDateString();
                                return (
                                    <div
                                        key={t.id}
                                        onClick={() => setSelectedTicket(t)}
                                        className={`p-3 rounded-xl cursor-pointer border transition-all duration-150 ${
                                            isSelected 
                                                ? 'bg-slate-900/80 border-teal-500/50 shadow-md shadow-slate-950' 
                                                : 'bg-slate-950 border-slate-900/80 hover:bg-slate-900/40 hover:border-slate-800'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5 gap-2">
                                            <span className="text-[10px] font-bold text-slate-500 tracking-wider">#{t.id.slice(0, 8)}</span>
                                            <div className="flex items-center gap-1">
                                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_COLORS[t.status]}`}>
                                                    {t.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <h4 className="text-xs font-semibold text-white line-clamp-1 mb-1">{t.title}</h4>
                                        <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">{t.description}</p>
                                        
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-900/40 text-[10px] text-slate-500">
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${PRIORITY_COLORS[t.priority]}`}>
                                                {t.priority}
                                            </span>
                                            
                                            {/* SLA Mock indicator */}
                                            <span className="flex items-center gap-1 text-[9px] text-amber-400 bg-amber-400/5 px-1.5 py-0.5 rounded border border-amber-400/10">
                                                <Clock className="w-2.5 h-2.5" />
                                                SLA: 2h
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Ticket Details Panel */}
                <div className={`flex-1 flex flex-col bg-slate-900/20 overflow-hidden ${selectedTicket ? 'flex' : 'hidden md:flex items-center justify-center text-slate-500'}`}>
                    {selectedTicket ? (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Panel Header */}
                            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/80 gap-4">
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => setSelectedTicket(null)}
                                        className="p-2 md:hidden text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                    </button>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-teal-400">Ticket Details</span>
                                            <span className="text-xs text-slate-500">|</span>
                                            <span className="text-xs text-slate-400 font-mono">#{selectedTicket.id}</span>
                                        </div>
                                        <h3 className="text-sm md:text-base font-bold text-white line-clamp-1">{selectedTicket.title}</h3>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="hidden sm:inline text-xs text-slate-400">Status:</span>
                                    <select
                                        value={selectedTicket.status}
                                        onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                                        className="px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500"
                                    >
                                        <option value="open">Open</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="closed">Closed</option>
                                        <option value="reopened">Reopened</option>
                                    </select>
                                </div>
                            </div>

                            {/* Panel Layout: Chat feed + Right Property panel */}
                            <div className="flex-1 flex overflow-hidden">
                                
                                {/* Conversation & Response Feed */}
                                <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/40">
                                    {/* Chat Messages */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        
                                        {/* Original Ticket Description */}
                                        <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800/80">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs border border-slate-700">
                                                        {selectedTicket.source_name ? selectedTicket.source_name.charAt(0).toUpperCase() : 'U'}
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-semibold text-white">{selectedTicket.source_name || 'Client'}</span>
                                                        <span className="text-[10px] text-slate-500 block">Submitted via {selectedTicket.source}</span>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-slate-500">{new Date(selectedTicket.created_at).toLocaleString()}</span>
                                            </div>
                                            <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p>
                                        </div>

                                        {/* Comments / Replies */}
                                        {commentsLoading ? (
                                            <div className="flex justify-center py-6">
                                                <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                                            </div>
                                        ) : (
                                            comments.map(c => {
                                                const commentDate = new Date(c.created_at).toLocaleString();
                                                const isInternal = c.is_internal;
                                                return (
                                                    <div 
                                                        key={c.id} 
                                                        className={`rounded-2xl p-4 border transition-all ${
                                                            isInternal 
                                                                ? 'bg-amber-500/5 border-amber-500/20' 
                                                                : 'bg-slate-900/30 border-slate-800/60'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                 <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                                                    isInternal ? 'bg-amber-600/20 text-amber-400' : 'bg-slate-800 text-slate-300'
                                                                }`}>
                                                                    {c.user_id ? 'U' : 'A'}
                                                                </div>
                                                                <div>
                                                                    <span className="text-xs font-semibold text-white">User ({c.user_id?.slice(0, 8) || 'Agent'})</span>
                                                                    {isInternal && (
                                                                        <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                                            Internal Note
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <span className="text-[10px] text-slate-500">{commentDate}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-300 whitespace-pre-wrap">{c.content}</p>
                                                    </div>
                                                );
                                            })
                                        )}
                                        <div ref={commentsEndRef} />
                                    </div>

                                    {/* Response Composer */}
                                    <div className="p-4 border-t border-slate-800 bg-slate-950/80">
                                        <form onSubmit={handleAddComment} className="space-y-3">
                                            {/* Composer Header: Public Reply vs Internal Note */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsInternalNote(false)}
                                                        className={`px-3 py-1 text-xs rounded-md font-semibold transition-all ${
                                                            !isInternalNote 
                                                                ? 'bg-teal-600 text-white shadow' 
                                                                : 'text-slate-400 hover:text-white'
                                                        }`}
                                                    >
                                                        Public Reply
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsInternalNote(true)}
                                                        className={`px-3 py-1 text-xs rounded-md font-semibold transition-all ${
                                                            isInternalNote 
                                                                ? 'bg-amber-600 text-white shadow' 
                                                                : 'text-slate-400 hover:text-white'
                                                        }`}
                                                    >
                                                        Internal Note
                                                    </button>
                                                </div>

                                                {/* Deep-Desk Copilot Trigger */}
                                                <button
                                                    type="button"
                                                    onClick={handleAIDraftReply}
                                                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-teal-400 bg-teal-400/5 hover:bg-teal-400/10 border border-teal-500/20 rounded-lg transition-all"
                                                >
                                                    <Sparkles className="w-3 h-3" />
                                                    Draft with AI
                                                </button>
                                            </div>

                                            {/* AI Output preview */}
                                            {aiGenerating && (
                                                <div className="p-3 bg-slate-900/80 border border-teal-500/20 rounded-xl flex items-center gap-2">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                                                    <span className="text-xs text-teal-400">Deep-Desk Copilot is drafting a reply...</span>
                                                </div>
                                            )}

                                            {aiResult && !aiGenerating && (
                                                <div className="p-3 bg-teal-500/5 border border-teal-500/10 rounded-xl space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1">
                                                            <Bot className="w-3.5 h-3.5" />
                                                            Suggested AI Draft
                                                        </span>
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setAiResult('')}
                                                                className="text-[10px] text-slate-500 hover:text-slate-300"
                                                            >
                                                                Dismiss
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={applyAIDraft}
                                                                className="text-[10px] text-teal-400 hover:underline font-bold"
                                                            >
                                                                Insert Draft
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-slate-300 line-clamp-3">{aiResult}</p>
                                                </div>
                                            )}

                                            <div className="relative">
                                                <textarea
                                                    rows={3}
                                                    placeholder={isInternalNote ? "Type an internal note visible only to agents..." : "Type your reply to the customer..."}
                                                    value={newComment}
                                                    onChange={(e) => setNewComment(e.target.value)}
                                                    className="w-full px-4 py-3 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none transition-colors"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={!newComment.trim()}
                                                    className="absolute right-3 bottom-3 p-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:hover:bg-teal-600 text-white rounded-xl transition-all"
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>

                                {/* Right Properties Sidebar */}
                                <div className="hidden lg:flex w-64 flex-col border-l border-slate-800/80 bg-slate-950 p-4 space-y-4 overflow-y-auto">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ticket Properties</h4>
                                    
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Priority</label>
                                            <select
                                                value={selectedTicket.priority}
                                                onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
                                                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-teal-500"
                                            >
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                                <option value="urgent">Urgent</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Source Context</label>
                                            <div className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300">
                                                <span className="block font-semibold text-white capitalize">{selectedTicket.source}</span>
                                                <span className="block text-[10px] text-slate-500">{selectedTicket.source_name || 'N/A'}</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Created At</label>
                                            <div className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
                                                {new Date(selectedTicket.created_at).toLocaleString()}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Deep-Desk SLA status</label>
                                            <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-[11px] text-amber-300">
                                                <div className="font-semibold mb-1 flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    Warning SLA
                                                </div>
                                                First response SLA due within 1.5 hours.
                                            </div>
                                        </div>

                                        {/* Copilot actions */}
                                        <div className="pt-2 border-t border-slate-900 space-y-2">
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Deep-Desk AI Copilot</label>
                                            <button
                                                type="button"
                                                onClick={handleAISummarize}
                                                className="w-full flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-teal-300 bg-teal-400/5 hover:bg-teal-400/10 border border-teal-500/20 rounded-xl transition-all"
                                            >
                                                <Bot className="w-3.5 h-3.5" />
                                                Summarize Ticket
                                            </button>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 text-slate-500">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30 text-teal-400" />
                            <h3 className="text-sm font-semibold text-slate-300">No Ticket Selected</h3>
                            <p className="text-xs text-slate-500 mt-1">Select a ticket from the list or create a new ticket to begin.</p>
                        </div>
                    )}
                </div>

            </div>

            {/* Create Ticket Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white">Create New Support Ticket</h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTicket} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Ticket Title</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter a descriptive issue title"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-850 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label>
                                <textarea
                                    required
                                    rows={4}
                                    placeholder="Detail the issue or request..."
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-850 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Priority</label>
                                    <select
                                        value={newPriority}
                                        onChange={(e) => setNewPriority(e.target.value as TicketPriority)}
                                        className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-850 rounded-xl text-slate-200 focus:outline-none focus:border-teal-500"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Source Context</label>
                                    <select
                                        value={newSource}
                                        onChange={(e) => setNewSource(e.target.value as TicketSource)}
                                        className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-850 rounded-xl text-slate-200 focus:outline-none focus:border-teal-500"
                                    >
                                        <option value="general">General</option>
                                        <option value="lead">Lead</option>
                                        <option value="client">Client</option>
                                        <option value="project">Project</option>
                                        <option value="contract">Contract</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Client/Lead Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. John Doe"
                                    value={newSourceName}
                                    onChange={(e) => setNewSourceName(e.target.value)}
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-850 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingTicket}
                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-xl shadow-lg transition-all"
                                >
                                    {creatingTicket && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    Create Ticket
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

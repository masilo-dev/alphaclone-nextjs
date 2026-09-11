'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, MessageSquare, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { ticketService, type Ticket, type TicketComment, type TicketSource, type TicketPriority, type TicketStatus } from '@/services/ticketService';

interface TicketPanelProps {
    source: TicketSource;
    sourceId: string;
    sourceName?: string;
    onTicketCreated?: (ticket: Ticket) => void;
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
    low: 'bg-gray-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    urgent: 'bg-red-500',
};

const STATUS_COLORS: Record<TicketStatus, string> = {
    new: 'bg-blue-500',
    open: 'bg-blue-500',
    in_progress: 'bg-yellow-500',
    waiting_on_customer: 'bg-amber-500',
    waiting_on_business: 'bg-orange-500',
    escalated: 'bg-red-500',
    resolved: 'bg-green-500',
    closed: 'bg-gray-500',
    reopened: 'bg-purple-500',
};

export default function TicketPanel({ source, sourceId, sourceName, onTicketCreated }: TicketPanelProps) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [comments, setComments] = useState<TicketComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [newTicketTitle, setNewTicketTitle] = useState('');
    const [newTicketDescription, setNewTicketDescription] = useState('');
    const [newTicketPriority, setNewTicketPriority] = useState<TicketPriority>('medium');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        loadTickets();
    }, [source, sourceId]);

    const loadTickets = async () => {
        try {
            setLoading(true);
            const data = await ticketService.getBySource(source, sourceId);
            setTickets(data);
        } catch (error) {
            console.error('Failed to load tickets:', error);
            // Show error state to user
            setTickets([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTicket = async () => {
        if (!newTicketTitle.trim() || !newTicketDescription.trim()) return;

        try {
            setCreating(true);
            const ticket = await ticketService.create({
                title: newTicketTitle,
                description: newTicketDescription,
                priority: newTicketPriority,
                source,
                source_id: sourceId,
                source_name: sourceName,
            });

            setTickets(prev => [ticket, ...prev]);
            setShowCreateForm(false);
            setNewTicketTitle('');
            setNewTicketDescription('');
            setNewTicketPriority('medium');
            onTicketCreated?.(ticket);
        } catch (error) {
            console.error('Failed to create ticket:', error);
        } finally {
            setCreating(false);
        }
    };

    const handleSelectTicket = async (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setComments([]);
        try {
            const data = await ticketService.getComments(ticket.id);
            setComments(data);
        } catch (error) {
            console.error('Failed to load comments:', error);
            // Show error state to user
            setComments([]);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim() || !selectedTicket) return;

        try {
            const comment = await ticketService.addComment(selectedTicket.id, newComment);
            setComments(prev => [...prev, comment]);
            setNewComment('');
        } catch (error) {
            console.error('Failed to add comment:', error);
        }
    };

    const handleStatusChange = async (ticketId: string, status: TicketStatus) => {
        try {
            await ticketService.updateStatus(ticketId, status);
            setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t));
            if (selectedTicket?.id === ticketId) {
                setSelectedTicket(prev => prev ? { ...prev, status } : null);
            }
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Tickets ({tickets.length})</h3>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    New Ticket
                </button>
            </div>

            {showCreateForm && (
                <div className="bg-slate-800 rounded-lg p-4 space-y-3 border border-slate-700">
                    <input
                        type="text"
                        placeholder="Ticket title"
                        value={newTicketTitle}
                        onChange={(e) => setNewTicketTitle(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <textarea
                        placeholder="Describe the issue..."
                        value={newTicketDescription}
                        onChange={(e) => setNewTicketDescription(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                    />
                    <div className="flex items-center gap-3">
                        <select
                            value={newTicketPriority}
                            onChange={(e) => setNewTicketPriority(e.target.value as TicketPriority)}
                            className="px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                        </select>
                        <button
                            onClick={handleCreateTicket}
                            disabled={creating || !newTicketTitle.trim() || !newTicketDescription.trim()}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                        >
                            {creating ? 'Creating...' : 'Create Ticket'}
                        </button>
                    </div>
                </div>
            )}

            {tickets.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No tickets yet</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {tickets.map(ticket => (
                        <div
                            key={ticket.id}
                            onClick={() => handleSelectTicket(ticket)}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                selectedTicket?.id === ticket.id
                                    ? 'bg-slate-700 border-blue-500'
                                    : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-white truncate flex-1">
                                    {ticket.title}
                                </span>
                                <div className="flex items-center gap-2 ml-2">
                                    <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[ticket.priority]}`} />
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white ${STATUS_COLORS[ticket.status]}`}>
                                        {ticket.status.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(ticket.created_at).toLocaleDateString()}
                                </span>
                                {ticket.assigned_to && (
                                    <span>Assigned</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedTicket && (
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-white">{selectedTicket.title}</h4>
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedTicket.status}
                                onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value as TicketStatus)}
                                className="text-xs px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white"
                            >
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                                <option value="reopened">Reopened</option>
                            </select>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400">{selectedTicket.description}</p>

                    <div className="space-y-2 mt-3">
                        {comments.map(comment => (
                            <div key={comment.id} className="bg-slate-900 rounded p-2">
                                <p className="text-xs text-slate-300">{comment.content}</p>
                                <span className="text-[10px] text-slate-500 mt-1 block">
                                    {new Date(comment.created_at).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Add a comment..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                        <button
                            onClick={handleAddComment}
                            disabled={!newComment.trim()}
                            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                        >
                            Send
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

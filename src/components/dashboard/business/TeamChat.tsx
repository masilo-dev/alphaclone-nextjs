import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Send, MessageCircle, CheckCircle, CheckCheck } from 'lucide-react';
import { User } from '../../../types';
import { format } from 'date-fns';
import { taskService } from '../../../services/taskService';
import { messageService } from '../../../services/messageService';
import toast from 'react-hot-toast';

const TEAM_GROUP_ID = 'team';

interface TeamMember {
    user_id: string;
    user: {
        id: string;
        name: string;
        email: string;
        avatar?: string;
    };
    role: string;
}

interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    content: string;
    timestamp: Date;
    readAt?: Date | null;
    deliveredAt?: Date | null;
    type: 'text' | 'task_created' | 'goal_created';
    metadata?: any;
}

type DeliverySummary = {
    recipientCount: number;
    deliveredCount: number;
    readCount: number;
};

interface TeamChatProps {
    user: User;
    teamMembers: TeamMember[];
    tenantId?: string;
}

export const TeamChat: React.FC<TeamChatProps> = ({ user, teamMembers, tenantId }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [deliverySummaries, setDeliverySummaries] = useState<Record<string, DeliverySummary>>({});
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const mapMessage = (m: any): ChatMessage => ({
        id: m.id,
        userId: m.role === 'system' ? 'system' : m.senderId,
        userName: m.senderName || 'Unknown',
        content: m.text,
        timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp),
        readAt: m.readAt || null,
        deliveredAt: m.deliveredAt || null,
        type: m.role === 'system' ? 'task_created' : 'text',
    });

    // Load persisted team messages and subscribe to realtime updates.
    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            const { messages: rows } = await messageService.getGroupMessages(TEAM_GROUP_ID);
            if (!active) return;
            setMessages(rows.map(mapMessage));
            setLoading(false);
            await syncMyReceipts(rows.map((row) => row.id));
            await loadReceiptSummaries(rows.map((row) => row.id));
        })();

        // isAdmin=true so the callback receives all tenant inserts; we filter to the team group.
        const unsubscribe = messageService.subscribeToMessages(user.id, true, (message, eventType) => {
            if (eventType !== 'INSERT') return;
            if (message.group_id !== TEAM_GROUP_ID) return;
            setMessages(prev => {
                if (prev.some(m => m.id === message.id)) return prev;
                return [...prev, mapMessage(message)];
            });
            void syncMyReceipts([message.id]);
            void loadReceiptSummaries([message.id]);
        });

        return () => { active = false; unsubscribe(); };
    }, [user.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        const unread = messages
            .filter(msg => msg.userId !== user.id && msg.type === 'text' && !msg.readAt)
            .slice(0, 10);

        if (unread.length === 0) return;

        let cancelled = false;
        (async () => {
            for (const msg of unread) {
                if (cancelled) break;
                await messageService.markAsRead(msg.id);
                updateMessageDelivery(msg.id, { readAt: new Date() });
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [messages, user.id]);

    const persistMessage = async (
        text: string,
        role: 'user' | 'system' = 'user',
        senderName?: string,
    ) => {
        const { message, error } = await messageService.sendMessage(
            role === 'system' ? user.id : user.id,
            senderName || (role === 'system' ? 'System' : (user.name || 'You')),
            role === 'system' ? 'system' : 'user',
            text,
            undefined,
            [],
            'normal',
            undefined,
            TEAM_GROUP_ID,
        );
        if (error) {
            toast.error('Message failed to send');
            return;
        }
        if (message) {
            setMessages(prev => prev.some(m => m.id === message.id) ? prev : [...prev, mapMessage(message)]);
        }
    };

    const updateMessageDelivery = (messageId: string, updates: Partial<ChatMessage>) => {
        setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, ...updates } : msg));
    };

    const loadReceiptSummaries = async (messageIds: string[]) => {
        if (!tenantId || messageIds.length === 0) return;

        const response = await fetch(`/api/tenant/${tenantId}/team-message-receipts?messageIds=${encodeURIComponent(messageIds.join(','))}`, { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        const data = payload.receipts || [];

        const grouped: Record<string, DeliverySummary> = {};
        for (const receipt of data as any[]) {
            const current = grouped[receipt.message_id] || { recipientCount: 0, deliveredCount: 0, readCount: 0 };
            current.recipientCount += 1;
            if (receipt.delivered_at) current.deliveredCount += 1;
            if (receipt.read_at) current.readCount += 1;
            grouped[receipt.message_id] = current;
        }

        setDeliverySummaries(prev => ({ ...prev, ...grouped }));
    };

    const syncMyReceipts = async (messageIds: string[]) => {
        if (!tenantId || messageIds.length === 0) return;

        await fetch(`/api/tenant/${tenantId}/team-message-receipts`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageIds }) });

        await loadReceiptSummaries(messageIds);
    };

    const sendTeamEmail = async (messageText: string, senderMessageId: string) => {
        if (!tenantId) return;

        const recipientMembers = teamMembers.filter((m) => m.user?.email && m.user_id !== user.id);
        const recipients = recipientMembers.map((m) => m.user.email).filter((email): email is string => Boolean(email));

        if (recipients.length === 0) {
            await persistMessage('Saved to chat, but no teammate emails were found.', 'system');
            return;
        }

        const subject = `Team update: ${messageText.slice(0, 60).replace(/\s+/g, ' ').trim()}${messageText.length > 60 ? '…' : ''}`;
        const intro = `${user.name || user.email} posted an internal team update in AlphaClone.`;
        const response = await fetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: recipients,
                subject,
                text: `${intro}\n\nUpdate:\n${messageText}\n\nOpen AlphaClone to reply in context.`,
                html: `
                    <div style="font-family: Inter, Arial, sans-serif; color: #e2e8f0; background: #020617; padding: 24px;">
                        <div style="max-width: 720px; margin: 0 auto; background: linear-gradient(180deg, rgba(15,23,42,0.96), rgba(15,23,42,0.92)); border: 1px solid #1f2937; border-radius: 20px; overflow: hidden;">
                            <div style="padding: 20px 24px; border-bottom: 1px solid #1f2937; background: rgba(15, 118, 110, 0.10);">
                                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; color: #2dd4bf; margin-bottom: 8px;">Internal team memo</div>
                                <div style="font-size: 22px; font-weight: 700; color: #ffffff; line-height: 1.25;">${subject}</div>
                                <div style="margin-top: 8px; color: #94a3b8; font-size: 13px;">From ${user.name || user.email} inside AlphaClone</div>
                            </div>
                            <div style="padding: 24px;">
                                <div style="background: #0f172a; border: 1px solid #1f2937; border-radius: 16px; padding: 20px;">
                                    <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.14em; margin-bottom: 10px;">Message</div>
                                    <div style="white-space: pre-wrap; color: #e2e8f0; font-size: 15px; line-height: 1.7;">${messageText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                                </div>
                                <div style="margin-top: 16px; display: grid; gap: 10px;">
                                    <div style="color: #cbd5e1; font-size: 13px;">Use the business OS to reply, convert this into a task, or check the related inbox thread.</div>
                                    <div style="color: #94a3b8; font-size: 12px;">This email was sent to ${recipients.length} teammates.</div>
                                </div>
                            </div>
                            <div style="padding: 16px 24px; border-top: 1px solid #1f2937; color: #64748b; font-size: 12px;">
                                AlphaClone team communication
                            </div>
                        </div>
                    </div>
                `,
                tenantId,
                userId: user.id,
                fromName: user.name || 'AlphaClone',
                replyTo: user.email,
                isPlatformNotification: false,
            }),
        });

        if (!response.ok) {
            throw new Error('Email delivery failed');
        }

        const deliveredAt = new Date();
        updateMessageDelivery(senderMessageId, { deliveredAt });
        const receiptResponse = await fetch(`/api/tenant/${tenantId}/team-message-receipts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId: senderMessageId, recipientUserIds: recipientMembers.map((member) => member.user_id), deliveredAt: deliveredAt.toISOString() }),
        });
        if (!receiptResponse.ok) throw new Error('Email was sent, but delivery receipts could not be recorded');
        await loadReceiptSummaries([senderMessageId]);
        await persistMessage(`Emailed ${recipients.length} teammate${recipients.length === 1 ? '' : 's'}.`, 'system');
    };

    const handleSendMessage = async () => {
        if (!input.trim() || sending) return;
        const text = input;
        setInput('');
        setSending(true);
        try {
            // @mention task assignment: "@name assign task <title>"
            const mentionMatch = text.match(/@(\w+)/);
            if (mentionMatch && (text.toLowerCase().includes('assign') || text.toLowerCase().includes('task'))) {
                const mentionedName = mentionMatch[1].toLowerCase();
                const targetMember = teamMembers.find(m =>
                    m.user.name?.toLowerCase().includes(mentionedName) ||
                    m.user.email?.toLowerCase().includes(mentionedName)
                );
                if (targetMember) {
                    let taskTitle = text.replace(/@\w+/g, '').trim();
                    taskTitle = taskTitle.replace(/^(assign\s+task|assign\s+to|assign|task\s+to|task)\s+/i, '').trim();
                    if (taskTitle) {
                        await taskService.createTask(user.id, {
                            assignedTo: targetMember.user_id,
                            title: taskTitle,
                            description: `Assigned via chat by ${user.name}`,
                            priority: 'medium',
                            dueDate: new Date(Date.now() + 86400000).toISOString(),
                        });
                        const { message: sentMessage } = await messageService.sendMessage(
                            user.id,
                            user.name || 'You',
                            'user',
                            text,
                            undefined,
                            [],
                            'normal',
                            undefined,
                            TEAM_GROUP_ID
                        );

                        if (!sentMessage) {
                            throw new Error('Message could not be saved');
                        }

                        setMessages(prev => prev.some(m => m.id === sentMessage.id) ? prev : [...prev, mapMessage(sentMessage)]);
                        await persistMessage(`Task "${taskTitle}" assigned to ${targetMember.user.name}`, 'system');
                        await sendTeamEmail(text, sentMessage.id);
                        return;
                    }
                }
            }

            const { message: sentMessage } = await messageService.sendMessage(
                user.id,
                user.name || 'You',
                'user',
                text,
                undefined,
                [],
                'normal',
                undefined,
                TEAM_GROUP_ID
            );

            if (!sentMessage) {
                throw new Error('Message could not be saved');
            }

            setMessages(prev => prev.some(m => m.id === sentMessage.id) ? prev : [...prev, mapMessage(sentMessage)]);

            await sendTeamEmail(text, sentMessage.id);
        } catch (e) {
            console.error(e);
            toast.error('Could not send message');
        } finally {
            setSending(false);
        }
    };

    const getDeliveryLabel = (msg: ChatMessage) => {
        const summary = deliverySummaries[msg.id];
        if (msg.userId === user.id && summary) {
            if (summary.readCount > 0) {
                return { label: `Seen by ${summary.readCount}/${summary.recipientCount}`, icon: CheckCheck, color: 'text-teal-400' };
            }
            if (summary.deliveredCount > 0) {
                return { label: `Delivered to ${summary.deliveredCount}/${summary.recipientCount}`, icon: CheckCircle, color: 'text-sky-400' };
            }
        }
        if (msg.readAt) {
            return { label: 'Seen', icon: CheckCheck, color: 'text-teal-400' };
        }
        if (msg.deliveredAt) {
            return { label: 'Delivered by email', icon: CheckCircle, color: 'text-sky-400' };
        }
        return { label: 'Sending...', icon: Send, color: 'text-slate-500' };
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
            <div className="flex flex-col h-[600px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {/* Chat Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <MessageCircle className="w-5 h-5 text-indigo-400" />
                        </div>
                    <div>
                        <h3 className="font-bold text-white">Team Stream</h3>
                        <p className="text-xs text-slate-400">Internal chat, task handoff, and email delivery</p>
                    </div>
                </div>
                    <div className="flex -space-x-2">
                        {teamMembers.slice(0, 5).map(m => (
                            <div key={m.user_id} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-xs font-bold text-white" title={m.user.name}>
                                {m.user.name?.charAt(0)}
                            </div>
                        ))}
                        {teamMembers.length > 5 && (
                            <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                                +{teamMembers.length - 5}
                            </div>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-800/40 rounded-xl animate-pulse" />)}</div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 gap-2">
                            <MessageCircle className="w-8 h-8 text-slate-700" />
                            <p className="text-sm">No messages yet. Say hello to your team!</p>
                            <p className="text-xs">Tip: type <span className="font-mono text-slate-400">@name assign task …</span> to create a task.</p>
                        </div>
                    ) : messages.map((msg) => {
                        const isMe = msg.userId === user.id;
                        const isSystem = msg.userId === 'system';

                        if (isSystem) {
                            return (
                                <div key={msg.id} className="flex justify-center my-4">
                                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-full px-4 py-1 text-xs text-slate-400 flex items-center gap-2">
                                        {msg.type === 'task_created' && <CheckCircle className="w-3 h-3 text-green-400" />}
                                        {msg.content}
                                    </div>
                                </div>
                            );
                        }

                            return (
                                <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center font-bold text-xs relative overflow-hidden">
                                    {msg.userAvatar ? (
                                        <Image src={msg.userAvatar} fill className="object-cover" alt="" sizes="32px" />
                                    ) : (
                                        msg.userName.charAt(0)
                                    )}
                                </div>
                                <div className={`max-w-[70%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <span className="font-bold text-slate-300">{msg.userName}</span>
                                        <span>{format(msg.timestamp, 'h:mm a')}</span>
                                    </div>
                                    <div className={`p-3 rounded-2xl text-sm ${
                                        isMe 
                                            ? 'bg-indigo-600 text-white rounded-tr-sm' 
                                            : 'bg-slate-800 text-slate-200 rounded-tl-sm'
                                    }`}>
                                        {msg.content}
                                    </div>
                                    <div className={`flex items-center gap-1.5 text-[10px] ${isMe ? 'justify-end' : 'justify-start'} text-slate-500`}>
                                        {(() => {
                                            const status = getDeliveryLabel(msg);
                                            const StatusIcon = status.icon;
                                            return (
                                                <>
                                                    <StatusIcon className={`w-3 h-3 ${status.color}`} />
                                                    <span>{status.label}</span>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 bg-slate-900 border-t border-slate-800">
                    <div className="relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message or use @ to assign tasks..."
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none h-12"
                        />
                        <button
                            onClick={handleSendMessage}
                            className="absolute right-2 top-2 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex gap-2 mt-2 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                            <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono">@name assign task</span>
                            <span>to create task</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Email</span>
                            <span>delivers to teammates automatically</span>
                        </div>
                    </div>
                </div>
            </div>
    );
};

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Send, MessageCircle, CheckCircle } from 'lucide-react';
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
    type: 'text' | 'task_created' | 'goal_created';
    metadata?: any;
}

interface TeamChatProps {
    user: User;
    teamMembers: TeamMember[];
}

export const TeamChat: React.FC<TeamChatProps> = ({ user, teamMembers }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
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
        })();

        // isAdmin=true so the callback receives all tenant inserts; we filter to the team group.
        const unsubscribe = messageService.subscribeToMessages(user.id, true, (message, eventType) => {
            if (eventType !== 'INSERT') return;
            if (message.group_id !== TEAM_GROUP_ID) return;
            setMessages(prev => {
                if (prev.some(m => m.id === message.id)) return prev;
                return [...prev, mapMessage(message)];
            });
        });

        return () => { active = false; unsubscribe(); };
    }, [user.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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
                        await persistMessage(text, 'user');
                        await persistMessage(`Task "${taskTitle}" assigned to ${targetMember.user.name}`, 'system');
                        return;
                    }
                }
            }

            await persistMessage(text, 'user');
        } catch (e) {
            console.error(e);
            toast.error('Could not send message');
        } finally {
            setSending(false);
        }
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
                            <p className="text-xs text-slate-400">Real-time collaboration & tasking</p>
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
                    </div>
                </div>
            </div>
    );
};

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, MessageSquare, Search, Smile, User as UserIcon, Menu, X, Paperclip, Loader2, Flag, Bot, ArrowLeft } from 'lucide-react';
import { User, ChatMessage } from '../../types';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { userService } from '../../services/userService';
import { messageService } from '../../services/messageService';
import { chatWithAI } from '../../services/unifiedAIService';
import { MessageBubble } from './MessageBubble';
import { supabase } from '../../lib/supabase';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface MessagesTabProps {
    user: User;
    filteredMessages: ChatMessage[];
    newMessage: string;
    setNewMessage: (msg: string) => void;
    handleSendMessage: (text: string, recipientId?: string, attachments?: any[], priority?: 'normal' | 'high' | 'urgent') => void;
}

const MessagesTab: React.FC<MessagesTabProps> = ({
    user,
    filteredMessages,
    newMessage,
    setNewMessage,
    handleSendMessage,
}) => {
    const [clients, setClients] = useState<User[]>([]);
    const [selectedClient, setSelectedClient] = useState<User | null>(null);
    const [adminUser, setAdminUser] = useState<User | null>(null); // For client view - store admin
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Mobile Detection
    const isMobile = useMediaQuery('(max-width: 768px)');

    // Sidebar visibility logic - simplified
    // On desktop: controlled by manual toggle (default open)
    // On mobile: controlled strictly by view state (List vs Chat)
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

    // Derived state for rendering
    const showSidebar = !isMobile || (isMobile && !selectedClient);
    const showChat = !isMobile || (isMobile && !!selectedClient);

    // New State for Premium Features
    const [isDragging, setIsDragging] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState<{ id: string, url: string, type: 'image' | 'file', name: string }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const [presenceChannel, setPresenceChannel] = useState<any>(null);

    // Feature States
    const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
    const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Helper for admin checks
    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin';

    // Fetch clients for Admin view OR fetch admin for Client view
    useEffect(() => {
        if (isAdmin) {
            const loadClients = async () => {
                const { users, error } = await userService.getUsers();
                if (error) {
                    console.error('Failed to load clients:', error);
                    return;
                }
                const filteredClients = users.filter(u => u.id !== user.id);
                setClients(filteredClients);
            };
            loadClients();
        } else {
            // Client view: Fetch admin user to send messages to
            const loadAdmin = async () => {
                try {
                    // First, try to get from cache
                    const cachedAdminId = localStorage.getItem('admin_user_id');
                    if (cachedAdminId) {
                        const { user: cachedAdmin, error: getUserError } = await userService.getUser(cachedAdminId);
                        if (!getUserError && cachedAdmin && cachedAdmin.role === 'admin') {
                            setAdminUser(cachedAdmin);
                            return;
                        }
                    }

                    // If cache failed or doesn't exist, fetch from API
                    const { users, error } = await userService.getUsers();
                    if (error) {
                        console.error('Failed to load admin user:', error);
                        // Try again after 3 seconds
                        setTimeout(loadAdmin, 3000);
                        return;
                    }

                    const admin = users.find(u => u.role === 'admin');
                    if (admin) {
                        setAdminUser(admin);
                        // Cache the admin ID for offline access
                        localStorage.setItem('admin_user_id', admin.id);
                    } else {
                        console.error('No admin user found in the system');
                    }
                } catch (err) {
                    console.error('Error loading admin:', err);
                    // Retry after 3 seconds
                    setTimeout(loadAdmin, 3000);
                }
            };
            loadAdmin();
        }
    }, [user.role, user.id]);

    // Auto-select admin as recipient for clients
    useEffect(() => {
        if (!isAdmin && adminUser && !selectedClient) {
            setSelectedClient(adminUser);
        }
    }, [adminUser, user.role, selectedClient]);

    // Track online users properly
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

    // Presence & Typing Subscription
    useEffect(() => {
        const channel = supabase.channel('chat_presence');

        channel
            .on('presence', { event: 'sync' }, () => {
                // Get all online users from presence state
                const presenceState = channel.presenceState();
                const online = new Set<string>();
                Object.values(presenceState).forEach((presences: any) => {
                    presences.forEach((presence: any) => {
                        if (presence.user_id) {
                            online.add(presence.user_id);
                        }
                    });
                });
                setOnlineUsers(online);
            })
            .on('presence', { event: 'join' }, ({ newPresences }: any) => {
                newPresences.forEach((presence: any) => {
                    if (presence.user_id) {
                        setOnlineUsers(prev => new Set([...prev, presence.user_id]));
                    }
                });
            })
            .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
                leftPresences.forEach((presence: any) => {
                    if (presence.user_id) {
                        setOnlineUsers(prev => {
                            const next = new Set(prev);
                            next.delete(presence.user_id);
                            return next;
                        });
                    }
                });
            })
            .on('broadcast', { event: 'typing' }, (payload: any) => {
                const { user_id, is_typing } = payload.payload;
                setTypingUsers(prev => {
                    const next = new Set(prev);
                    if (is_typing) {
                        next.add(user_id);
                    } else {
                        next.delete(user_id);
                    }
                    return next;
                });
            })
            .subscribe(async (status: string) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
                }
            });

        setPresenceChannel(channel);

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user.id]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [filteredMessages, selectedClient, pendingAttachments, typingUsers]);

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setNewMessage(newMessage + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    // Filter messages based on view - Use useMemo to prevent re-initialization issues
    const visibleMessages = useMemo(() => {
        if (isAdmin) {
            if (!selectedClient) return [];
            return filteredMessages.filter(m =>
                (m.senderId === user.id && m.recipientId === selectedClient.id) ||
                (m.senderId === selectedClient.id)
            );
        }
        return filteredMessages;
    }, [user.role, selectedClient, filteredMessages, user.id]);

    /**
     * AUTO-PILOT & READ STATUS LOGIC
     */
    useEffect(() => {
        if (!visibleMessages || visibleMessages.length === 0) return undefined;

        const lastMessage = visibleMessages[visibleMessages.length - 1];
        if (!lastMessage) return undefined;

        const isClientMessage = lastMessage.senderId !== user.id;

        // 1. Mark as Read
        if (isClientMessage && !lastMessage.readAt) {
            messageService.markAsRead(lastMessage.id).catch(console.error);
        }

        // 2. Auto-Reply (Stealth Mode)
        if (
            isAdmin &&
            autoReplyEnabled &&
            isClientMessage &&
            !lastMessage.isThinking &&
            selectedClient
        ) {
            const timer = setTimeout(async () => {
                try {
                    if (presenceChannel) {
                        presenceChannel.send({
                            type: 'broadcast',
                            event: 'typing',
                            payload: { user_id: user.id, is_typing: true }
                        });
                    }

                    const history = visibleMessages.slice(-10).map(m => ({
                        role: m.senderId === user.id ? 'model' : 'user',
                        text: m.text
                    }));

                    const systemPrompt = `You are ${user.name}, a helpful and professional administrator. 
                    Reply to the user's last message concisely. 
                    Do not sign off with a name.
                    Keep it friendly but business-like.`;

                    const { text } = await chatWithAI(
                        [{ role: 'user', text: systemPrompt }, ...history],
                        lastMessage.text
                    );

                    if (text && selectedClient) {
                        await handleSendMessage(text, selectedClient.id, [], 'normal');
                    }
                } catch (err) {
                    console.error("Auto-Pilot Failed:", err);
                } finally {
                    if (presenceChannel) {
                        presenceChannel.send({
                            type: 'broadcast',
                            event: 'typing',
                            payload: { user_id: user.id, is_typing: false }
                        });
                    }
                }
            }, 3000);

            return () => clearTimeout(timer);
        }

        return undefined;
    }, [visibleMessages, autoReplyEnabled, user.id, user.role, user.name, selectedClient, presenceChannel, handleSendMessage]);

    const handleSend = () => {
        if (!newMessage.trim() && pendingAttachments.length === 0) return;

        // Determine recipient based on user role
        // const isAdmin = user.role === 'admin' || user.role === 'tenant_admin'; // Already defined
        let recipientId: string | undefined;

        if (isAdmin) {
            // Admin sends to selected client
            recipientId = selectedClient?.id;
            if (!recipientId) {
                alert("Please select a recipient first.");
                return;
            }
        } else {
            // Client sends to admin
            recipientId = adminUser?.id;
            if (!recipientId) {
                alert("Connecting to admin... Please wait a moment and try again.");
                return;
            }
        }

        // Pass attachments to handler
        handleSendMessage(newMessage, recipientId, pendingAttachments, priority);

        setNewMessage('');
        setPendingAttachments([]);
        setPriority('normal');
        setShowEmojiPicker(false);

        // Stop typing indicator
        if (presenceChannel) {
            presenceChannel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { user_id: user.id, is_typing: false }
            });
        }
    };

    const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNewMessage(e.target.value);

        if (presenceChannel) {
            presenceChannel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { user_id: user.id, is_typing: true }
            });

            // Debounce stop typing
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                presenceChannel.send({
                    type: 'broadcast',
                    event: 'typing',
                    payload: { user_id: user.id, is_typing: false }
                });
            }, 2000);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            await processFiles(Array.from(e.target.files));
        }
    };

    const processFiles = async (files: File[]) => {
        setIsUploading(true);
        try {
            const uploaded = await Promise.all(files.map(async (file) => {
                const result = await messageService.uploadAttachment(file);
                if (result.error) {
                    console.error("Upload failed", result.error);
                    return null;
                }
                return { id: result.id, url: result.url, type: result.type, name: result.name };
            }));

            setPendingAttachments(prev => [...prev, ...uploaded.filter(Boolean) as any]);
        } finally {
            setIsUploading(false);
        }
    };

    // Drag & Drop Handlers
    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const onDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await processFiles(Array.from(e.dataTransfer.files));
        }
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isRecipientTyping = isAdmin
        ? (selectedClient ? typingUsers.has(selectedClient.id) : false)
        : typingUsers.has('admin'); // Assuming single admin or we need admin ID

    return (
        <div
            className="h-[100dvh] md:h-[calc(100dvh-140px)] flex glass-panel rounded-none md:rounded-2xl overflow-hidden shadow-none md:shadow-2xl animate-fade-in relative backdrop-blur-xl border-0 md:border border-white/5"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -mt-20 -mr-20"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none -mb-20 -ml-20"></div>

            {/* Drag Overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-teal-500/20 backdrop-blur-sm border-2 border-teal-500 border-dashed m-4 rounded-xl flex items-center justify-center pointer-events-none">
                    <div className="text-white font-bold text-xl flex flex-col items-center gap-4 animate-bounce">
                        <Paperclip className="w-12 h-12" />
                        Drop files to attach
                    </div>
                </div>
            )}

            {/* --- ADMIN SIDEBAR --- */}
            {isAdmin && showSidebar && (
                <div className={`${isMobile ? 'w-full' : desktopSidebarOpen ? 'w-80' : 'w-0'
                    } border-r border-white/5 bg-slate-900/50 flex flex-col z-30 relative h-full transition-all duration-300`}>
                    <div className="p-4 border-b border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-teal-400" /> Messaging Center
                            </h3>
                            <button
                                onClick={() => setDesktopSidebarOpen(false)}
                                className="hidden md:block p-1 text-slate-400 hover:text-white transition-colors"
                                aria-label="Close sidebar"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                            <input
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                                placeholder="Search clients..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredClients.map(client => (
                            <div
                                key={client.id}
                                onClick={() => setSelectedClient(client)}
                                className={`p-4 flex items-center gap-3 cursor-pointer transition-all border-b border-white/5 hover:bg-slate-800/50 ${selectedClient?.id === client.id ? 'bg-teal-500/10 border-l-2 border-l-teal-500' : 'border-l-2 border-l-transparent'}`}
                            >
                                <div className="relative">
                                    <img src={client.avatar} alt={client.name} className="w-10 h-10 rounded-full" />
                                    {typingUsers.has(client.id) ? (
                                        <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-[2px]">
                                            <div className="flex gap-[2px] px-1">
                                                <span className="w-1 h-1 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                <span className="w-1 h-1 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                <span className="w-1 h-1 bg-teal-400 rounded-full animate-bounce"></span>
                                            </div>
                                        </div>
                                    ) : onlineUsers.has(client.id) ? (
                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></div>
                                    ) : (
                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-slate-600 border-2 border-slate-900 rounded-full"></div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className={`text-sm font-medium truncate ${selectedClient?.id === client.id ? 'text-white' : 'text-slate-300'}`}>{client.name}</h4>
                                    <p className="text-xs text-slate-500 truncate">{client.email}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- CHAT AREA --- */}
            {showChat && (
                <div className="flex-1 flex flex-col z-10 bg-slate-900/20 min-w-0 overflow-hidden h-full">
                    {/* Chat Header */}
                    <div className="p-3 sm:p-5 border-b border-white/5 flex justify-between items-center bg-white/5 backdrop-blur-md flex-shrink-0 h-[60px] md:h-auto">
                        <div className="flex items-center gap-3">
                            {/* Mobile Back Button */}
                            {isMobile && isAdmin && selectedClient && (
                                <button
                                    onClick={() => setSelectedClient(null)}
                                    className="p-2 -ml-2 text-slate-300 hover:text-white"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            )}

                            {/* Desktop Toggle */}
                            {isAdmin && !isMobile && !desktopSidebarOpen && (
                                <button
                                    onClick={() => setDesktopSidebarOpen(true)}
                                    className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
                                >
                                    <Menu className="w-5 h-5" />
                                </button>
                            )}

                            <h3 className="font-bold text-white flex items-center gap-3 text-lg overflow-hidden">
                                {isAdmin ? (
                                    selectedClient ? (
                                        <>
                                            <img src={selectedClient.avatar} className="w-8 h-8 rounded-full flex-shrink-0" />
                                            <div className="flex flex-col min-w-0">
                                                <span className="truncate">{selectedClient.name}</span>
                                                {isRecipientTyping && (
                                                    <span className="text-xs text-teal-400 font-normal animate-pulse">typing...</span>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-slate-400">Select a client</span>
                                    )
                                ) : (
                                    <>
                                        <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20">
                                            <UserIcon className="w-5 h-5 text-teal-400" />
                                        </div>
                                        <span className="truncate">Admin Support</span>
                                    </>
                                )}
                            </h3>
                        </div>

                        {/* Admin Auto-Pilot Toggle */}
                        {isAdmin && !isMobile && (
                            <button
                                onClick={() => setAutoReplyEnabled(!autoReplyEnabled)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${autoReplyEnabled
                                    ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30'
                                    : 'bg-slate-800 text-slate-400 hover:text-white border border-white/10'
                                    }`}
                            >
                                <Bot size={14} className={autoReplyEnabled ? 'animate-pulse' : ''} />
                                {autoReplyEnabled ? 'AUTO-PILOT ON' : 'ENABLE AI AGENT'}
                            </button>
                        )}
                    </div>

                    {/* Messages List */}
                    <div className="flex-1 overflow-y-auto p-3 sm:p-6 relative custom-scrollbar" style={{ minHeight: 0 }}>
                        {isAdmin && !selectedClient ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <MessageSquare className="w-16 h-16 opacity-20 mb-4" />
                                <p>Select a client from the sidebar to view conversation</p>
                            </div>
                        ) : (
                            <>
                                {visibleMessages.length === 0 && (
                                    <div className="text-center text-slate-500 mt-10">No messages yet. Start the conversation!</div>
                                )}

                                <div className="space-y-1">
                                    {visibleMessages.map((msg, index) => {
                                        const isOwn = msg.senderId === user.id;
                                        const prevMsg = visibleMessages[index - 1];
                                        const isSequence = prevMsg && prevMsg.senderId === msg.senderId && (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() < 60000);

                                        // Logic for showing avatar/name
                                        // Show avatar if it's NOT a sequence (first message of a group)
                                        // OR if the previous message was a long time ago
                                        const showAvatar = !isSequence;
                                        const showSenderName = !isSequence && !isOwn; // Only show name for others, once per group

                                        return (
                                            <MessageBubble
                                                key={msg.id}
                                                message={msg}
                                                isOwn={isOwn}
                                                showAvatar={showAvatar}
                                                showSenderName={showSenderName}
                                            />
                                        );
                                    })}
                                </div>

                                {/* Typing Indicator for Recipient in Chat Area */}
                                {isRecipientTyping && (
                                    <div className="flex items-center gap-2 mt-2 ml-4 text-slate-500 text-xs">
                                        <div className="flex gap-1 bg-slate-800 p-2 rounded-xl rounded-tl-none">
                                            <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </>
                        )}
                    </div>

                    {/* Input Area */}
                    {(!isAdmin || selectedClient) && (
                        <div className="p-3 sm:p-5 border-t border-white/5 relative bg-black/20 backdrop-blur-md flex-shrink-0">
                            {/* Pending Attachments Preview */}
                            {pendingAttachments.length > 0 && (
                                <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                                    {pendingAttachments.map((att, idx) => (
                                        <div key={idx} className="relative group/preview">
                                            <div className="w-16 h-16 rounded-lg border border-white/10 overflow-hidden bg-slate-800 flex items-center justify-center">
                                                {att.type === 'image' ? (
                                                    <img src={att.url} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Paperclip className="w-6 h-6 text-slate-400" />
                                                )}
                                            </div>
                                            <button
                                                onClick={() => setPendingAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/preview:opacity-100 transition-opacity"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {isUploading && (
                                        <div className="w-16 h-16 rounded-lg border border-white/10 flex items-center justify-center bg-slate-800">
                                            <Loader2 className="animate-spin text-teal-500" />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-2 sm:gap-3 relative items-end w-full">
                                <div className="relative flex items-end gap-1 sm:gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        className="p-2 sm:p-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-teal-400 rounded-xl transition-colors border border-white/10 flex-shrink-0"
                                        aria-label="Add emoji"
                                    >
                                        <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </button>

                                    <button
                                        onClick={() => setPriority(prev => prev === 'normal' ? 'high' : prev === 'high' ? 'urgent' : 'normal')}
                                        className={`p-2 sm:p-3 rounded-xl transition-all border border-white/10 flex items-center justify-center flex-shrink-0 ${priority === 'urgent' ? 'bg-red-500/20 text-red-400 border-red-500/50' :
                                            priority === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' :
                                                'bg-white/5 text-slate-400 hover:text-teal-400 hover:bg-white/10'
                                            }`}
                                        title={`Priority: ${priority.toUpperCase()}`}
                                        aria-label={`Set priority (current: ${priority})`}
                                    >
                                        <Flag className={`w-4 h-4 sm:w-5 sm:h-5 ${priority !== 'normal' ? 'fill-current' : ''}`} />
                                    </button>

                                    <input
                                        type="file"
                                        multiple
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-2 sm:p-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-teal-400 rounded-xl transition-colors border border-white/10 flex-shrink-0"
                                        aria-label="Attach file"
                                    >
                                        <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </button>

                                    {showEmojiPicker && (
                                        <div className="absolute bottom-16 left-0 z-50 animate-fade-in shadow-2xl">
                                            <EmojiPicker onEmojiClick={handleEmojiClick} theme={Theme.DARK} width={300} height={400} />
                                        </div>
                                    )}
                                </div>

                                <textarea
                                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50 focus:bg-white/10 transition-all hover:bg-white/10 resize-none h-[44px] sm:h-[50px] min-h-[44px] sm:min-h-[50px] max-h-[120px] sm:max-h-[150px]"
                                    placeholder="Type your message..."
                                    rows={1}
                                    value={newMessage}
                                    onChange={handleTyping}
                                    onFocus={(e) => {
                                        // Mobile: Scroll into view when keyboard opens
                                        setTimeout(() => {
                                            e.target.scrollIntoView({
                                                behavior: 'smooth',
                                                block: 'center',
                                                inline: 'nearest'
                                            });
                                        }, 300); // Wait for keyboard animation
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    autoComplete="off"
                                    autoCorrect="on"
                                    autoCapitalize="sentences"
                                    spellCheck="true"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={(!newMessage.trim() && pendingAttachments.length === 0) || isUploading}
                                    className="p-2 sm:p-3 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl shadow-lg shadow-teal-500/20 hover:shadow-teal-500/40 hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:shadow-none transition-all duration-300 h-[44px] sm:h-[50px] w-[44px] sm:w-[50px] flex items-center justify-center flex-shrink-0"
                                    aria-label="Send message"
                                >
                                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MessagesTab;

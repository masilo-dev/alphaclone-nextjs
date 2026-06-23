import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, MessageSquare, Search, Smile, User as UserIcon, Menu, X, Paperclip, Loader2, Flag, Bot, ArrowLeft, Mail, Users, UserPlus, Wand2, Inbox, AlertTriangle } from 'lucide-react';
import { ModuleStatCards, type ModuleStat } from './common/ModuleStatCards';
import { User, ChatMessage } from '../../types';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { userService } from '../../services/userService';
import { messageService } from '../../services/messageService';
import { chatWithAI } from '../../services/unifiedAIService';
import { MessageBubble } from './MessageBubble';
import { supabase } from '../../lib/supabase';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { presenceService, PresenceStatus } from '../../services/presenceService';
import OnlineStatusBadge from './OnlineStatusBadge';
import CampaignBuilder from '../dashboard/business/CampaignBuilder';
import { useClients } from '../../hooks/useClients';
import { useTenant } from '../../contexts/TenantContext';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useSearchParams } from 'next/navigation';

interface MessagesTabProps {
    user: User;
    filteredMessages: ChatMessage[];
    newMessage: string;
    setNewMessage: (msg: string) => void;
    handleSendMessage: (text: string, recipientId?: string, attachments?: any[], priority?: 'normal' | 'high' | 'urgent') => void;
    initialSelectedClientId?: string | null;
}

function isExpectedRealtimeCloseError(error: unknown): boolean {
    if (!error) return false;
    const msg = error instanceof Error ? error.message : String(error);
    return msg.includes('WebSocket is closed before the connection is established');
}

function cleanupChannelsByTopic(topic: string) {
    const existing = supabase.getChannels().filter((channel: RealtimeChannel) => channel.topic === topic);
    existing.forEach((channel: RealtimeChannel) => {
        channel.unsubscribe();
        void supabase.removeChannel(channel).catch((error: unknown) => {
            if (!isExpectedRealtimeCloseError(error)) {
                console.warn('[Messages] stale channel cleanup failed:', error);
            }
        });
    });
}

const MessagesTab: React.FC<MessagesTabProps> = ({
    user,
    filteredMessages,
    newMessage,
    setNewMessage,
    handleSendMessage,
    initialSelectedClientId = null,
}) => {
    const [clients, setClients] = useState<User[]>([]);
    const [selectedClient, setSelectedClient] = useState<User | null>(null);
    const [adminUser, setAdminUser] = useState<User | null>(null); // For client view - store admin
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sidebarTab, setSidebarTab] = useState<'chats' | 'contacts'>('chats');
    const [selectedCRMContact, setSelectedCRMContact] = useState<{ id: string; name: string; email?: string; phone?: string } | null>(null);
    const [activeChannel, setActiveChannel] = useState<'all' | 'email' | 'whatsapp' | 'sms' | 'internal'>('all');
    const [isAIGenerating, setIsAIGenerating] = useState(false);
    const { currentTenant } = useTenant();
    const { clients: crmClients, isLoading: isLoadingCRM } = useClients(currentTenant?.id, { limit: 100 });
    const [unifiedMessages, setUnifiedMessages] = useState<ChatMessage[]>([]);


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
    const searchParams = useSearchParams();
    const selectedClientIdFromQuery = searchParams?.get('selectedClientId') || null;
    const deepLinkClientId = initialSelectedClientId || selectedClientIdFromQuery;
    const deepLinkAppliedRef = useRef<string | null>(null);

    // Feature States
    const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
    const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
    const [conversationSummary, setConversationSummary] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const cachedAdminUserIdRef = useRef<string | null>(null);

    // Helper for admin checks
    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin';

    // View mode for admin (messages vs campaigns)
    const [adminView, setAdminView] = useState<'messages' | 'campaigns'>('messages');

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
                    const cachedAdminId = cachedAdminUserIdRef.current;
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
                        cachedAdminUserIdRef.current = admin.id;
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

    // Deep-link selection: ensure target conversation opens when selectedClientId is present.
    useEffect(() => {
        if (!deepLinkClientId || !isAdmin) return;
        if (deepLinkAppliedRef.current === deepLinkClientId) return;

        const candidate = clients.find((client) => client.id === deepLinkClientId);
        if (!candidate) return;

        setSelectedClient(candidate);
        setConversationSummary(null);
        if (isMobile) {
            setDesktopSidebarOpen(false);
        }
        deepLinkAppliedRef.current = deepLinkClientId;
    }, [deepLinkClientId, isAdmin, clients, isMobile]);

    // Track online users properly
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [adminPresence, setAdminPresence] = useState<PresenceStatus>('offline');

    // Subscribe to admin presence specifically for client view
    useEffect(() => {
        if (isAdmin || !adminUser) return;

        // Initial check
        const fetchAdminPresence = async () => {
            const { presence } = await presenceService.getUserPresence(adminUser.id);
            if (presence) {
                setAdminPresence(presence.status);
            }
        };
        fetchAdminPresence();

        // Subscribe
        const unsubscribe = presenceService.subscribeToUserPresence(adminUser.id, (p) => {
            setAdminPresence(p.status);
        });

        return () => unsubscribe();
    }, [isAdmin, adminUser]);

    // Presence & Typing Subscription
    useEffect(() => {
        const tenantId = currentTenant?.id;
        if (!tenantId) return;
        const channelName = `chat_presence:${tenantId}`;

        // Prevent duplicate subscriptions during fast remounts or HMR.
        cleanupChannelsByTopic(channelName);

        const channel = supabase.channel(channelName);

        channel
            .on('presence', { event: 'sync' }, () => {
                // Get all online users from presence state
                const presenceState = channel.presenceState();
                const online = new Set<string>();
                Object.values(presenceState).forEach((presences: any) => {
                    presences.forEach((presence: any) => {
                        if (presence.user_id && presence.tenant_id === tenantId) {
                            online.add(presence.user_id);
                        }
                    });
                });
                setOnlineUsers(online);
            })
            .on('presence', { event: 'join' }, ({ newPresences }: any) => {
                newPresences.forEach((presence: any) => {
                    if (presence.user_id && presence.tenant_id === tenantId) {
                        setOnlineUsers(prev => new Set([...prev, presence.user_id]));
                    }
                });
            })
            .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
                leftPresences.forEach((presence: any) => {
                    if (presence.user_id && presence.tenant_id === tenantId) {
                        setOnlineUsers(prev => {
                            const next = new Set(prev);
                            next.delete(presence.user_id);
                            return next;
                        });
                    }
                });
            })
            .on('broadcast', { event: 'typing' }, (payload: any) => {
                const { user_id, is_typing, tenant_id } = payload.payload || {};
                if (!user_id || tenant_id !== tenantId) return;
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
                    await channel.track({ user_id: user.id, tenant_id: tenantId, online_at: new Date().toISOString() });
                }
            });

        setPresenceChannel(channel);

        return () => {
            channel.unsubscribe();
            supabase.removeChannel(channel).catch((error: unknown) => {
                if (!isExpectedRealtimeCloseError(error)) {
                    console.warn('[Messages] presence cleanup failed:', error);
                }
            });
        };
    }, [user.id, currentTenant?.id]);

    // Fetch Unified Messages (WhatsApp, email, SMS, internal) for both chat clients and CRM contacts
    useEffect(() => {
        const contactId = selectedCRMContact?.id || selectedClient?.id;
        const contactName = selectedCRMContact?.name || selectedClient?.name || '';
        if (!contactId || !currentTenant?.id) {
            setUnifiedMessages([]);
            return;
        }

        const fetchUnified = async () => {
            const { data, error } = await supabase
                .from('unified_messages')
                .select('*')
                .eq('tenant_id', currentTenant.id)
                .eq('contact_id', contactId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Failed to fetch unified messages', error);
                return;
            }

            if (data) {
                const mapped: ChatMessage[] = data.map((um: any) => ({
                    id: um.id,
                    role: um.direction === 'inbound' ? 'user' : 'model',
                    senderId: um.direction === 'inbound' ? contactId : user.id,
                    senderName: um.direction === 'inbound' ? contactName : user.name,
                    recipientId: um.direction === 'inbound' ? user.id : contactId,
                    text: um.body || um.subject || '',
                    timestamp: new Date(um.received_at || um.sent_at || um.created_at),
                    source: um.source,
                    readAt: um.read_at ? new Date(um.read_at) : null
                }));
                setUnifiedMessages(mapped);
            }
        };

        fetchUnified();

        // Setup realtime listener
        const channelName = `unified_msg_${currentTenant.id}_${contactId}`;
        const channel = supabase.channel(channelName)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'unified_messages', filter: `contact_id=eq.${contactId}` }, (payload: any) => {
                const um = payload.new as any;
                const newMsg: ChatMessage = {
                    id: um.id,
                    role: um.direction === 'inbound' ? 'user' : 'model',
                    senderId: um.direction === 'inbound' ? contactId : user.id,
                    senderName: um.direction === 'inbound' ? contactName : user.name,
                    recipientId: um.direction === 'inbound' ? user.id : contactId,
                    text: um.body || um.subject || '',
                    timestamp: new Date(um.received_at || um.sent_at || um.created_at),
                    source: um.source,
                    readAt: um.read_at ? new Date(um.read_at) : null
                };
                setUnifiedMessages(prev => [...prev.filter(m => m.id !== newMsg.id), newMsg]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel).catch(() => {});
        };
    }, [selectedClient, selectedCRMContact, currentTenant?.id, user.id, user.name]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [filteredMessages, unifiedMessages, selectedClient, pendingAttachments, typingUsers]);

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setNewMessage(newMessage + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    const handleSummarizeConversation = async () => {
        if (visibleMessages.length === 0) {
            toast.error('No messages to summarize');
            return;
        }

        setIsSummarizing(true);
        try {
            const conversationText = visibleMessages
                .map(msg => `${msg.senderId === user.id ? 'You' : (isAdmin ? selectedClient?.name : 'Admin')}: ${msg.text}`)
                .join('\n');
            
            const { text } = await chatWithAI(
                [],
                `Summarize this conversation concisely.\n\n${conversationText}`
            );
            
            if (text) {
                setConversationSummary(text);
                toast.success('Conversation summarized!');
            } else {
                toast.error('Failed to summarize conversation');
            }
        } catch (err) {
            console.error('Summarization error:', err);
            toast.error('Failed to summarize conversation');
        } finally {
            setIsSummarizing(false);
        }
    };

    // Filter messages based on view - Use useMemo to prevent re-initialization issues
    const visibleMessages = useMemo(() => {
        let internal: ChatMessage[] = [];
        if (isAdmin) {
            // CRM contact mode: only show unified messages
            if (selectedCRMContact) {
                const filtered = unifiedMessages.filter(m => {
                    if (activeChannel === 'all') return true;
                    return m.source === activeChannel;
                });
                return filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            }
            if (!selectedClient) return [];
            internal = filteredMessages.filter(m =>
                (m.senderId === user.id && m.recipientId === selectedClient.id) ||
                (m.senderId === selectedClient.id)
            );
        } else {
            internal = filteredMessages;
        }
        
        // Merge with unified messages and sort by timestamp
        const combined = [...internal, ...unifiedMessages];
        return combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [user.role, selectedClient, selectedCRMContact, activeChannel, filteredMessages, user.id, unifiedMessages, isAdmin]);

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
                            payload: { user_id: user.id, tenant_id: currentTenant?.id, is_typing: true }
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
                            payload: { user_id: user.id, tenant_id: currentTenant?.id, is_typing: false }
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
                toast.error("Please select a recipient first.");
                return;
            }
        } else {
            // Client sends to admin
            recipientId = adminUser?.id;
            if (!recipientId) {
                toast.error("Connecting to admin... Please wait a moment and try again.");
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
                payload: { user_id: user.id, tenant_id: currentTenant?.id, is_typing: false }
            });
        }
    };

    const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNewMessage(e.target.value);

        if (presenceChannel) {
            presenceChannel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { user_id: user.id, tenant_id: currentTenant?.id, is_typing: true }
            });

            // Debounce stop typing
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                presenceChannel.send({
                    type: 'broadcast',
                    event: 'typing',
                    payload: { user_id: user.id, tenant_id: currentTenant?.id, is_typing: false }
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

    // AI Assist logic
    const handleAiAssist = async () => {
        if (!selectedClient) return;

        setIsAIGenerating(true);
        try {
            // Get last message context
            const lastClientMessage = [...visibleMessages]
                .reverse()
                .find(m => m.senderId === selectedClient.id);

            if (!lastClientMessage) {
                toast.error("No recent message to reply to.");
                return;
            }

            const { reply, error } = await messageService.draftAutoReply(
                lastClientMessage.id,
                lastClientMessage.text,
                selectedClient.name
            );

            if (error) throw new Error(error);
            if (reply) {
                setNewMessage(reply);
            }
        } catch (err: any) {
            console.error("AI Assist failed:", err);
            toast.error("Failed to generate AI assist reply.");
        } finally {
            setIsAIGenerating(false);
        }
    };

    const filteredClients = clients.filter(c =>
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isRecipientTyping = isAdmin
        ? (selectedClient ? typingUsers.has(selectedClient.id) : false)
        : (adminUser ? typingUsers.has(adminUser.id) : false);

    const messageStats = useMemo<ModuleStat[]>(() => {
        const unread = filteredMessages.filter(m => !m.readAt && m.senderId !== user.id).length;
        const priority = filteredMessages.filter(m => m.priority === 'high' || m.priority === 'urgent').length;
        const threadCount = isAdmin ? clients.length : 1;
        const channels = new Set(
            filteredMessages.map(m => m.source).filter((s): s is string => !!s && s !== 'internal')
        );
        return [
            {
                label: isAdmin ? 'Conversations' : 'Thread',
                value: threadCount,
                sub: isAdmin ? 'Active chat clients' : 'With your team',
                Icon: MessageSquare,
                accent: 'teal',
            },
            {
                label: 'Unread',
                value: unread,
                sub: unread > 0 ? 'Needs attention' : 'All caught up',
                Icon: Inbox,
                accent: unread > 0 ? 'amber' : 'emerald',
            },
            {
                label: 'CRM Contacts',
                value: crmClients.length,
                sub: 'Linked in sidebar',
                Icon: Users,
                accent: 'blue',
            },
            {
                label: 'Priority / Channels',
                value: priority,
                sub: `${channels.size} external channel${channels.size === 1 ? '' : 's'}`,
                Icon: AlertTriangle,
                accent: priority > 0 ? 'rose' : 'purple',
            },
        ];
    }, [filteredMessages, user.id, clients.length, crmClients.length, isAdmin]);

    return (
        <div
            className="h-[100dvh] md:h-[calc(100dvh-140px)] flex flex-col glass-panel rounded-none md:rounded-2xl overflow-hidden shadow-none md:shadow-2xl animate-fade-in relative backdrop-blur-xl border-0 md:border border-white/5"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* Admin view toggle */}
            {isAdmin && (
                <div className="flex-shrink-0 flex items-center gap-2 px-4 pt-4 pb-2 border-b border-slate-700">
                    <button
                        onClick={() => setAdminView('messages')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${adminView === 'messages' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        <MessageSquare className="w-4 h-4" /> Messages
                    </button>
                    <button
                        onClick={() => setAdminView('campaigns')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${adminView === 'campaigns' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        <Mail className="w-4 h-4" /> Campaigns
                    </button>
                </div>
            )}

            {/* Campaigns View */}
            {isAdmin && adminView === 'campaigns' && (
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <CampaignBuilder userId={user.id} />
                </div>
            )}

            {/* Messages View */}
            {(!isAdmin || adminView === 'messages') && (
                <>
                <div className="flex-shrink-0 px-3 sm:px-4 pt-3 pb-1 border-b border-white/5">
                    <ModuleStatCards stats={messageStats} className="grid-cols-2 lg:grid-cols-4" />
                </div>
                <div className="flex-1 flex overflow-hidden relative min-h-0">
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
                                <div className="mt-4 flex bg-slate-800/50 p-1 rounded-xl border border-white/5">
                                    <button
                                        onClick={() => setSidebarTab('chats')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${sidebarTab === 'chats' ? 'bg-teal-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        <MessageSquare className="w-3.5 h-3.5" /> Recent
                                    </button>
                                    <button
                                        onClick={() => setSidebarTab('contacts')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${sidebarTab === 'contacts' ? 'bg-teal-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        <Users className="w-3.5 h-3.5" /> Contacts
                                    </button>
                                </div>
                                <div className="relative mt-4">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                    <input
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                                        placeholder={sidebarTab === 'chats' ? "Search chats..." : "Search CRM contacts..."}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {sidebarTab === 'chats' ? (
                                    filteredClients.map(client => (
                                        <div
                                            key={client.id}
                                            onClick={() => { setSelectedClient(client); setConversationSummary(null); }}
                                            className={`p-3 md:p-4 flex items-center gap-3 cursor-pointer transition-all border-b border-slate-700 hover:bg-slate-800/50 ${selectedClient?.id === client.id ? 'bg-teal-500/10 border-l-2 border-l-teal-500' : 'border-l-2 border-l-transparent'}`}
                                        >
                                            <div className="relative">
                                             <div className="relative w-10 h-10 shrink-0">
                                                <Image 
                                                  src={client.avatar} 
                                                  alt={client.name} 
                                                  fill
                                                  className="rounded-full object-cover" 
                                                  sizes="40px"
                                                />
                                             </div>
                                                {typingUsers.has(client.id) ? (
                                                    <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-[2px]">
                                                        <div className="flex gap-[2px] px-1">
                                                            <span className="w-1 h-1 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                            <span className="w-1 h-1 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                            <span className="w-1 h-1 bg-teal-400 rounded-full animate-bounce"></span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="absolute -bottom-1 -right-1">
                                                        <OnlineStatusBadge status={onlineUsers.has(client.id) ? 'online' : 'offline'} size="sm" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`text-sm font-medium truncate ${selectedClient?.id === client.id ? 'text-white' : 'text-slate-300'}`}>{client.name}</h4>
                                                <p className="text-xs text-slate-400 truncate">{client.email}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col">
                                        {isLoadingCRM ? (
                                            <div className="flex flex-col items-center justify-center p-8 text-slate-400 gap-3">
                                                <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                                                <p className="text-sm">Loading contacts...</p>
                                            </div>
                                        ) : crmClients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.email?.toLowerCase().includes(searchQuery.toLowerCase())).map(contact => (
                                            <div
                                                key={contact.id}
                                                onClick={() => {
                                                    setSelectedCRMContact({ id: contact.id, name: contact.name, email: contact.email || undefined });
                                                    setSelectedClient(null);
                                                    setConversationSummary(null);
                                                    setActiveChannel('all');
                                                }}
                                                className={`p-3 md:p-4 flex items-center gap-3 cursor-pointer transition-all border-b border-slate-700 hover:bg-slate-800/50 ${selectedCRMContact?.id === contact.id ? 'bg-teal-500/10 border-l-2 border-l-teal-500' : 'border-l-2 border-l-transparent'}`}
                                            >
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
                                                    {(contact.name || '?').charAt(0)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-medium text-slate-300 truncate">{contact.name}</h4>
                                                    <p className="text-xs text-slate-400 truncate">{contact.email || 'No email'}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-medium">CRM</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- CHAT AREA --- */}
                    {showChat && (
                        <div className="flex-1 flex flex-col z-10 bg-slate-900/20 min-w-0 overflow-hidden h-full">
                            {/* CRM Omnichannel Header */}
                            {isAdmin && selectedCRMContact && (
                                <div className="px-4 pt-3 pb-0 border-b border-slate-700 bg-slate-900/60 flex-shrink-0">
                                    <div className="flex items-center gap-3 mb-3">
                                        {isMobile && (
                                            <button onClick={() => { setSelectedCRMContact(null); }} className="p-1 text-slate-400 hover:text-white">
                                                <ArrowLeft className="w-5 h-5" />
                                            </button>
                                        )}
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
                                            {selectedCRMContact.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold text-sm">{selectedCRMContact.name}</h3>
                                            <p className="text-xs text-slate-400">{selectedCRMContact.email || 'CRM Contact'}</p>
                                        </div>
                                        <span className="ml-auto text-[10px] px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30 font-semibold">OMNICHANNEL</span>
                                    </div>
                                    <div className="flex gap-1 pb-0 overflow-x-auto">
                                        {(['all', 'email', 'whatsapp', 'sms', 'internal'] as const).map(ch => (
                                            <button
                                                key={ch}
                                                onClick={() => setActiveChannel(ch)}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap ${
                                                    activeChannel === ch
                                                        ? 'text-teal-400 border-teal-400 bg-teal-500/10'
                                                        : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800'
                                                }`}
                                            >
                                                {ch === 'all' ? '🌐 All' : ch === 'email' ? '✉️ Email' : ch === 'whatsapp' ? '💬 WhatsApp' : ch === 'sms' ? '📱 SMS' : '🔒 Internal'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Chat Header */}
                            <div className={`p-3 md:p-5 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 backdrop-blur-md flex-shrink-0 ${isAdmin && selectedCRMContact ? 'hidden' : 'h-[60px] md:h-auto'}`}>
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
                                                    <div className="relative w-8 h-8 shrink-0">
                                                        <Image 
                                                          src={selectedClient.avatar} 
                                                          alt={selectedClient.name} 
                                                          fill
                                                          className="rounded-full object-cover" 
                                                          sizes="32px"
                                                        />
                                                    </div>
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
                                                <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 relative">
                                                    <UserIcon className="w-5 h-5 text-teal-400" />
                                                    <div className="absolute -bottom-1 -right-1">
                                                        <OnlineStatusBadge status={adminPresence} size="sm" />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="truncate">AlphaClone Admin</span>
                                                    <span className="text-xs text-slate-400 font-medium">
                                                        {adminPresence === 'online' ? 'Typically replies in minutes' : 'Back soon'}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={async () => {
                                            toast.loading('Nexus: Triaging support messages...', { id: 'nexus-support' });
                                            const res = await fetch('/api/social/command-center', { 
                                                method: 'POST', 
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ tenantId: currentTenant?.id, mode: 'nexus_system_action', systemKey: 'support_triage' })
                                            });
                                            const data = await res.json();
                                            toast.success(data.result.message, { id: 'nexus-support' });
                                        }}
                                        className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-violet-400 rounded-lg text-xs font-bold border border-white/5 transition-all shadow-lg shadow-violet-900/5"
                                    >
                                        <Bot className="w-3.5 h-3.5" />
                                        Nexus Triage
                                    </button>
                                </div>

                                {/* Admin Auto-Pilot Toggle */}
                                {isAdmin && !isMobile && (
                                    <div className="flex items-center gap-2">
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
                                        <button
                                            onClick={handleSummarizeConversation}
                                            disabled={isSummarizing || visibleMessages.length === 0}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isSummarizing
                                                ? 'bg-purple-500/50 text-white'
                                                : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                                                }`}
                                        >
                                            <Wand2 size={14} className={isSummarizing ? 'animate-spin' : ''} />
                                            {isSummarizing ? 'Summarizing...' : 'Summarize'}
                                        </button>
                                    </div>
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
                                        {conversationSummary && (
                                            <div className="mb-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Wand2 className="w-4 h-4 text-purple-400" />
                                                        <span className="text-sm font-semibold text-purple-400">AI Summary</span>
                                                    </div>
                                                    <button
                                                        onClick={() => setConversationSummary(null)}
                                                        className="text-slate-500 hover:text-white"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <p className="text-sm text-slate-300">{conversationSummary}</p>
                                            </div>
                                        )}

                                        {visibleMessages.length === 0 && !conversationSummary && (
                                            <div className="text-center text-slate-500 mt-10">No messages yet. Start the conversation!</div>
                                        )}

                                        <div className="space-y-1">
                                            {visibleMessages.map((msg, index) => {
                                                const isOwn = msg.senderId === user.id || msg.role === 'model';
                                                const prevMsg = visibleMessages[index - 1];
                                                const isSequence = prevMsg && prevMsg.senderId === msg.senderId && (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() < 60000);
                                                const showAvatar = !isSequence;
                                                const showSenderName = !isSequence && !isOwn;
                                                const channelSource = msg.source;
                                                const channelBadge = channelSource && channelSource !== 'internal'
                                                    ? channelSource === 'gmail' || channelSource === 'zoho' || channelSource === 'sendgrid' || channelSource === 'resend' || channelSource === 'brevo' ? '✉️'
                                                    : channelSource === 'whatsapp' ? '💬'
                                                    : channelSource === 'sms' ? '📱'
                                                    : null
                                                    : null;

                                                return (
                                                    <div key={msg.id} className="relative">
                                                        {channelBadge && (
                                                            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-0.5 px-2`}>
                                                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                                    {channelBadge} <span className="capitalize">{channelSource}</span>
                                                                </span>
                                                            </div>
                                                        )}
                                                        <MessageBubble
                                                            message={msg}
                                                            isOwn={isOwn}
                                                            showAvatar={showAvatar}
                                                            showSenderName={showSenderName}
                                                        />
                                                    </div>
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
                            {(!isAdmin || selectedClient || selectedCRMContact) && (
                                <div className="p-3 md:p-5 border-t border-slate-700 relative bg-slate-900/40 backdrop-blur-md flex-shrink-0">
                                    {/* Pending Attachments Preview */}
                                    {pendingAttachments.length > 0 && (
                                        <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                                            {pendingAttachments.map((att, idx) => (
                                                <div key={idx} className="relative group/preview">
                                                     <div className="w-16 h-16 rounded-lg border border-slate-600 overflow-hidden bg-slate-800 relative">
                                                        {att.type === 'image' ? (
                                                            <Image 
                                                              src={att.url} 
                                                              alt={att.name}
                                                              fill
                                                              className="object-cover"
                                                              sizes="64px"
                                                              unoptimized
                                                            />
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

                                    <div className="flex gap-2 md:gap-3 relative items-end w-full">
                                        <div className="relative flex items-end gap-1 md:gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                className="p-2 md:p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-teal-400 rounded-xl transition-colors border border-slate-600 flex-shrink-0"
                                                aria-label="Add emoji"
                                            >
                                                <Smile className="w-4 h-4 md:w-5 md:h-5" />
                                            </button>

                                            <button
                                                onClick={() => setPriority(prev => prev === 'normal' ? 'high' : prev === 'high' ? 'urgent' : 'normal')}
                                                className={`p-2 md:p-3 rounded-xl transition-all border flex items-center justify-center flex-shrink-0 ${priority === 'urgent' ? 'bg-red-500/20 text-red-400 border-red-500/50' :
                                                    priority === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' :
                                                        'bg-slate-800 text-slate-400 hover:text-teal-400 hover:bg-slate-700 border-slate-600'
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
                                                className="p-2 md:p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-teal-400 rounded-xl transition-colors border border-slate-600 flex-shrink-0"
                                                aria-label="Attach file"
                                            >
                                                <Paperclip className="w-4 h-4 md:w-5 md:h-5" />
                                            </button>

                                            {isAdmin && (
                                                <button
                                                    onClick={handleAiAssist}
                                                    disabled={isAIGenerating || !selectedClient}
                                                    className={`p-2 md:p-3 rounded-xl transition-all border flex items-center justify-center flex-shrink-0 ${isAIGenerating ? 'bg-teal-500/20 text-teal-400 border-teal-500/50' : 'bg-slate-800 text-slate-400 hover:text-teal-400 hover:bg-slate-700 border-slate-600'}`}
                                                    title="AI Draft Assistant"
                                                    aria-label="Generate AI draft"
                                                >
                                                    <Wand2 className={`w-4 h-4 sm:w-5 sm:h-5 ${isAIGenerating ? 'animate-pulse' : ''}`} />
                                                </button>
                                            )}

                                            {showEmojiPicker && (
                                                <div className="absolute bottom-16 left-0 z-50 animate-fade-in shadow-2xl">
                                                    <EmojiPicker onEmojiClick={handleEmojiClick} theme={Theme.DARK} width={300} height={400} />
                                                </div>
                                            )}
                                        </div>

                                        <textarea
                                            className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded-xl px-3 md:px-4 py-2 md:py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:bg-slate-700 transition-all hover:bg-slate-700 resize-none h-[44px] md:h-[50px] min-h-[44px] md:min-h-[50px] max-h-[120px] md:max-h-[150px]"
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
                                            className="p-2 md:p-3 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl shadow-lg shadow-teal-500/20 hover:shadow-teal-500/40 hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:shadow-none transition-all duration-300 h-[44px] md:h-[50px] w-[44px] md:w-[50px] flex items-center justify-center flex-shrink-0"
                                            aria-label="Send message"
                                        >
                                            <Send className="w-4 h-4 md:w-5 md:h-5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                </>
            )
            }
        </div >
    );
};

export default MessagesTab;


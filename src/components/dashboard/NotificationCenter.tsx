'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Bell, X, Check, Trash2, ExternalLink,
    MessageCircle, FolderOpen, CreditCard, Settings, AlertTriangle, BellOff
} from 'lucide-react';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationCenterProps {
    userId: string;
    tenantId: string;
}

import { notificationService, Notification } from '../../services/dashboardService';

const TYPE_CONFIG: Record<string, { Icon: any; color: string; bg: string; label: string }> = {
    message: { Icon: MessageCircle, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Message' },
    project: { Icon: FolderOpen, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', label: 'Project' },
    payment: { Icon: CreditCard, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20', label: 'Payment' },
    system: { Icon: Settings, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', label: 'System' },
    alert: { Icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Alert' },
};

const getGroup = (dateStr: string): string => {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return 'Earlier';
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId, tenantId }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    const loadNotifications = useCallback(async () => {
        const { notifications: loaded } = await notificationService.getNotifications(userId, tenantId);
        if (loaded) setNotifications(loaded);
    }, [userId, tenantId]);

    const handleMarkAsRead = useCallback(async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        await notificationService.markAsRead(id);
    }, []);

    const handleMarkAllAsRead = useCallback(async () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        await notificationService.markAllAsRead(userId, tenantId);
    }, [userId, tenantId]);

    const handleDelete = useCallback(async (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        await notificationService.deleteNotification(id);
    }, []);

    useEffect(() => {
        if (!userId) return;
        loadNotifications();

        const unsubscribe = notificationService.subscribeToNotifications(userId, tenantId, (newNotif: Notification) => {
            setNotifications(prev => [newNotif, ...prev]);
        });

        return () => { unsubscribe(); };
    }, [userId, loadNotifications]);

    useEffect(() => {
        setUnreadCount(notifications.filter(n => !n.read).length);
    }, [notifications]);

    const filteredNotifications = filter === 'unread'
        ? notifications.filter(n => !n.read)
        : notifications;

    // Group by date and type
    const groups: Record<string, Record<string, Notification[]>> = {};
    for (const n of filteredNotifications) {
        const dateGroup = getGroup(n.created_at);
        if (!groups[dateGroup]) groups[dateGroup] = {};
        if (!groups[dateGroup][n.type]) groups[dateGroup][n.type] = [];
        groups[dateGroup][n.type].push(n);
    }
    const dateOrder = ['Today', 'Yesterday', 'Earlier'];

    return (
        <div className="relative">
            {/* Bell Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-slate-800"
                aria-label="Open notifications"
            >
                <Bell className="w-5 h-5" />
                <AnimatePresence>
                    {unreadCount > 0 && (
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute -top-0.5 -right-0.5 bg-gradient-to-br from-teal-400 to-violet-500 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow-lg shadow-teal-500/30"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </motion.span>
                    )}
                </AnimatePresence>
            </button>

            {/* Backdrop */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[1px]"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Panel */}
                        <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.97 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                            className="absolute right-0 mt-2 w-[22rem] sm:w-96 max-h-[75vh] sm:max-h-[600px] bg-slate-950 border border-white/10 rounded-2xl shadow-2xl shadow-black/50 z-50 flex flex-col overflow-hidden"
                        >
                            {/* Header */}
                            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-950">
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Notifications</h3>
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                        {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                                    </p>
                                </div>
                                <div className="flex gap-2 items-center">
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={handleMarkAllAsRead}
                                            className="text-[10px] font-bold text-teal-400 hover:text-teal-300 transition-colors px-2 py-1 rounded-lg hover:bg-teal-500/10"
                                        >
                                            Mark all read
                                        </button>
                                    )}
                                    <button onClick={() => setIsOpen(false)} className="p-1.5 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Filter Pills */}
                            <div className="flex gap-2 px-4 py-2 border-b border-white/5 bg-slate-950">
                                {(['all', 'unread'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${filter === f
                                            ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                                            : 'text-slate-500 hover:text-slate-300 bg-white/5'
                                            }`}
                                    >
                                        {f === 'all' ? 'All' : `Unread (${unreadCount})`}
                                    </button>
                                ))}
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {filteredNotifications.length === 0 ? (
                                    <div className="py-16 flex flex-col items-center justify-center text-slate-600">
                                        <BellOff className="w-10 h-10 mb-3 opacity-40" />
                                        <p className="text-xs font-bold uppercase tracking-widest">
                                            {filter === 'unread' ? 'All caught up!' : 'No notifications'}
                                        </p>
                                    </div>
                                ) : (
                                    dateOrder.map(dateGroup => {
                                        const typeGroups = groups[dateGroup];
                                        if (!typeGroups || Object.keys(typeGroups).length === 0) return null;
                                        return (
                                            <div key={dateGroup}>
                                                <div className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 bg-slate-950 sticky top-0 z-10">
                                                    {dateGroup}
                                                </div>
                                                {Object.entries(typeGroups).map(([type, notifs]) => {
                                                    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.system;
                                                    const Icon = cfg.Icon;
                                                    const unreadCount = notifs.filter(n => !n.read).length;
                                                    
                                                    return (
                                                        <div key={type} className="border-b border-white/[0.03]">
                                                            {/* Type Header */}
                                                            <div className="px-4 py-2 bg-white/[0.02] flex items-center gap-2">
                                                                <div className={`w-5 h-5 rounded-lg flex items-center justify-center border ${cfg.bg}`}>
                                                                    <Icon className={`w-3 h-3 ${cfg.color}`} />
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-1">
                                                                    {cfg.label}
                                                                </span>
                                                                <span className="text-[9px] text-slate-600 font-mono">
                                                                    {notifs.length} {unreadCount > 0 ? `(${unreadCount} unread)` : ''}
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Notifications of this type */}
                                                            {notifs.map((n) => (
                                                                <motion.div
                                                                    key={n.id}
                                                                    layout
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: 1 }}
                                                                    exit={{ opacity: 0 }}
                                                                    className={`group px-4 py-3 border-b border-white/[0.02] hover:bg-white/[0.02] transition-all pl-12 ${!n.read ? 'bg-teal-500/[0.02]' : ''}`}
                                                                >
                                                                    <div className="flex items-start justify-between gap-1">
                                                                        <p className={`text-xs font-bold leading-snug ${n.read ? 'text-slate-400' : 'text-white'}`}>
                                                                            {n.title}
                                                                        </p>
                                                                        {!n.read && (
                                                                            <div className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0 mt-1 shadow-[0_0_6px_rgba(45,212,191,0.6)]" />
                                                                        )}
                                                                    </div>
                                                                    {n.message && (
                                                                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                                                    )}
                                                                    <div className="flex items-center justify-between mt-2">
                                                                        <span className="text-[10px] text-slate-600">
                                                                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                                                        </span>
                                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            {!n.read && (
                                                                                <button
                                                                                    onClick={() => handleMarkAsRead(n.id)}
                                                                                    className="p-1 rounded-md hover:bg-teal-500/10 text-slate-500 hover:text-teal-400 transition-colors"
                                                                                    title="Mark as read"
                                                                                >
                                                                                    <Check className="w-3 h-3" />
                                                                                </button>
                                                                            )}
                                                                            {n.link && (
                                                                                <a
                                                                                    href={n.link}
                                                                                    className="p-1 rounded-md hover:bg-violet-500/10 text-slate-500 hover:text-violet-400 transition-colors"
                                                                                    onClick={() => setIsOpen(false)}
                                                                                >
                                                                                    <ExternalLink className="w-3 h-3" />
                                                                                </a>
                                                                            )}
                                                                            <button
                                                                                onClick={() => handleDelete(n.id)}
                                                                                className="p-1 rounded-md hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors"
                                                                            >
                                                                                <Trash2 className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Footer */}
                            {notifications.length > 0 && (
                                <div className="p-3 border-t border-white/5 bg-slate-950 text-center">
                                    <p className="text-[10px] text-slate-600 font-mono">{notifications.length} total notifications</p>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default NotificationCenter;

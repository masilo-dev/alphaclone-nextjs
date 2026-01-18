import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Trash2, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationCenterProps {
    userId: string;
}

// Inline type definition
interface Notification {
    id: string;
    type: string;
    title: string;
    message?: string;
    read: boolean;
    link?: string;
    created_at: string;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    useEffect(() => {
        loadNotifications();
    }, [userId]);

    const loadNotifications = async () => {
        // Mock data for now - replace with actual service call
        const mockNotifications: Notification[] = [];
        setNotifications(mockNotifications);
    };

    const handleMarkAsRead = async (notificationId: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const handleMarkAllAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    const handleDelete = async (notificationId: string) => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
    };

    const getNotificationIcon = (type: string) => {
        const icons: Record<string, string> = {
            message: '💬',
            project: '📁',
            payment: '💰',
            system: '⚙️',
            alert: '⚠️',
        };
        return icons[type] || '🔔';
    };

    const filteredNotifications = filter === 'unread'
        ? notifications.filter(n => !n.read)
        : notifications;

    return (
        <div className="relative">
            {/* Bell Icon */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Panel */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-screen max-w-md sm:w-96 max-h-[80vh] sm:max-h-[600px] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col mx-2 sm:mx-0">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white">Notifications</h3>
                                <p className="text-xs text-slate-400">{unreadCount} unread</p>
                            </div>
                            <div className="flex gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllAsRead}
                                        className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                                    >
                                        Mark all read
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex border-b border-slate-800">
                            <button
                                onClick={() => setFilter('all')}
                                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${filter === 'all'
                                        ? 'text-teal-400 border-b-2 border-teal-400'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilter('unread')}
                                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${filter === 'unread'
                                        ? 'text-teal-400 border-b-2 border-teal-400'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                Unread ({unreadCount})
                            </button>
                        </div>

                        {/* Notifications List */}
                        <div className="flex-1 overflow-y-auto">
                            {filteredNotifications.length === 0 ? (
                                <div className="p-8 text-center text-slate-400">
                                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No notifications</p>
                                </div>
                            ) : (
                                filteredNotifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`p-4 border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${!notification.read ? 'bg-slate-800/30' : ''
                                            }`}
                                    >
                                        <div className="flex gap-3">
                                            <div className="text-2xl flex-shrink-0">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h4 className="font-semibold text-white text-sm">
                                                        {notification.title}
                                                    </h4>
                                                    {!notification.read && (
                                                        <button
                                                            onClick={() => handleMarkAsRead(notification.id)}
                                                            className="text-teal-400 hover:text-teal-300 transition-colors flex-shrink-0"
                                                            title="Mark as read"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                                {notification.message && (
                                                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                                                        {notification.message}
                                                    </p>
                                                )}
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-xs text-slate-500">
                                                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                                    </span>
                                                    <div className="flex gap-2">
                                                        {notification.link && (
                                                            <a
                                                                href={notification.link}
                                                                className="text-teal-400 hover:text-teal-300 transition-colors"
                                                                onClick={() => setIsOpen(false)}
                                                            >
                                                                <ExternalLink className="w-4 h-4" />
                                                            </a>
                                                        )}
                                                        <button
                                                            onClick={() => handleDelete(notification.id)}
                                                            className="text-slate-500 hover:text-red-400 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationCenter;

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, CloudOff } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSupabaseConnected, setIsSupabaseConnected] = useState(true);
    const [showStatus, setShowStatus] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setShowStatus(true);
            setTimeout(() => setShowStatus(false), 3000);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowStatus(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check Supabase connection
        const checkSupabaseConnection = () => {
            // Simple connectivity check - you could make this more robust
            setIsSupabaseConnected(navigator.onLine);
        };

        const interval = setInterval(checkSupabaseConnection, 30000); // Check every 30s

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, []);

    // Auto-hide after 3 seconds when online
    useEffect(() => {
        if (isOnline && showStatus) {
            const timer = setTimeout(() => setShowStatus(false), 3000);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [isOnline, showStatus]);

    // Always show when offline
    const shouldShow = !isOnline || showStatus;

    if (!shouldShow) return null;

    return (
        <div className={`fixed top-4 right-4 z-50 animate-slide-in-from-top ${
            isOnline ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
        } backdrop-blur-xl border rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg`}>
            {isOnline ? (
                <>
                    <Wifi className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-400 font-medium">Connected</span>
                    {!isSupabaseConnected && (
                        <>
                            <div className="w-px h-4 bg-slate-600" />
                            <CloudOff className="w-4 h-4 text-amber-400" />
                            <span className="text-xs text-amber-400">Database syncing...</span>
                        </>
                    )}
                </>
            ) : (
                <>
                    <WifiOff className="w-4 h-4 text-red-400 animate-pulse" />
                    <span className="text-sm text-red-400 font-medium">No connection</span>
                    <CloudOff className="w-4 h-4 text-red-400" />
                </>
            )}
        </div>
    );
};

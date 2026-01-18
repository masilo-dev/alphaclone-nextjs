import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../ui/UIComponents';
import { Copy, Check, Video, ExternalLink, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { User } from '../../types';

interface PermanentMeetingLinkProps {
    user: User;
    onJoinRoom: (roomUrl: string) => void;
}

/**
 * Permanent Meeting Link Component - REBUILT FOR STABILITY
 *
 * Architecture:
 * - Minimal state updates
 * - Memoized callbacks
 * - No re-render loops
 * - Single API call on mount
 */
const PermanentMeetingLink: React.FC<PermanentMeetingLinkProps> = ({ user, onJoinRoom }) => {
    const [roomData, setRoomData] = useState<{
        link: string;
        url: string;
        loading: boolean;
        error: string | null;
    }>({
        link: '',
        url: '',
        loading: true,
        error: null
    });

    const [copied, setCopied] = useState(false);

    // Memoize the room initialization - ONLY runs once per user.id
    const initializeRoom = useCallback(async () => {
        try {
            setRoomData(prev => ({ ...prev, loading: true, error: null }));

            // Call API to create/get permanent room
            const response = await fetch('/api/daily/create-permanent-room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    userName: user.name,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create permanent room');
            }

            const data = await response.json();
            const shareLink = `${window.location.origin}/room/${data.name}`;

            // Single state update with all data
            setRoomData({
                link: shareLink,
                url: data.url,
                loading: false,
                error: null
            });

            // Store in localStorage for quick access
            localStorage.setItem(`permanent_room_${user.id}`, JSON.stringify({
                roomName: data.name,
                roomUrl: data.url,
                link: shareLink,
                createdAt: new Date().toISOString()
            }));

        } catch (err) {
            console.error('Failed to initialize permanent room:', err);
            setRoomData({
                link: '',
                url: '',
                loading: false,
                error: err instanceof Error ? err.message : 'Failed to load room'
            });
            toast.error('Failed to load permanent meeting room');
        }
    }, [user.id, user.name]); // Only depends on user.id and user.name

    // Run initialization ONCE on mount
    useEffect(() => {
        initializeRoom();
    }, [initializeRoom]);

    // Memoized handlers - stable references
    const handleCopyLink = useCallback(async () => {
        if (!roomData.link) return;

        try {
            await navigator.clipboard.writeText(roomData.link);
            setCopied(true);
            toast.success('Permanent link copied!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Failed to copy link');
        }
    }, [roomData.link]);

    const handleJoinNow = useCallback(() => {
        if (roomData.url) {
            onJoinRoom(roomData.url);
        }
    }, [roomData.url, onJoinRoom]);

    // Loading state
    if (roomData.loading) {
        return (
            <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl p-6 border-2 border-blue-500/30 animate-pulse">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl"></div>
                    <div className="flex-1">
                        <div className="h-6 bg-blue-500/20 rounded w-48 mb-2"></div>
                        <div className="h-4 bg-blue-500/20 rounded w-full"></div>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (roomData.error) {
        return (
            <div className="bg-gradient-to-br from-red-900/30 to-orange-900/30 rounded-xl p-6 border-2 border-red-500/30">
                <div className="flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 text-red-400 shrink-0 mt-1" />
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-2">Failed to Load Room</h3>
                        <p className="text-sm text-red-300 mb-4">{roomData.error}</p>
                        <Button onClick={initializeRoom} variant="outline" size="sm">
                            Retry
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl p-6 border-2 border-blue-500/30 shadow-lg shadow-blue-500/10">
            <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/50">
                    <Video className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                        Your Permanent Meeting Room
                        <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-full">
                            Always Available
                        </span>
                    </h3>
                    <p className="text-sm text-gray-300">
                        This link is always active - share it instantly. Works unlimited times!
                    </p>
                </div>
            </div>

            {/* Permanent Link Display */}
            <div className="bg-gray-900/50 border-2 border-blue-500/50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                    <ExternalLink className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                        Permanent Meeting Link
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <p className="flex-1 text-blue-400 font-mono text-sm break-all select-all bg-black/30 p-2 rounded">
                        {roomData.link}
                    </p>
                    <Button
                        onClick={handleCopyLink}
                        className="bg-blue-600 hover:bg-blue-500 shrink-0"
                        size="sm"
                    >
                        {copied ? (
                            <>
                                <Check className="w-4 h-4 mr-1" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4 mr-1" />
                                Copy
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                <div className="flex gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-gray-300 space-y-1">
                        <p><strong className="text-white">Always Ready:</strong> Link never expires - reuse unlimited times</p>
                        <p><strong className="text-white">Max 10 people:</strong> Anyone with the link can join instantly</p>
                        <p><strong className="text-white">Your Domain:</strong> Business-branded professional meeting links</p>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <Button
                    onClick={handleJoinNow}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
                >
                    <Video className="w-4 h-4 mr-2" />
                    Join Your Room Now
                </Button>
                <Button
                    onClick={handleCopyLink}
                    variant="outline"
                    className="border-blue-500/50 hover:bg-blue-500/10"
                >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                </Button>
            </div>
        </div>
    );
};

export default PermanentMeetingLink;

import React, { useState } from 'react';
import { Button } from '../ui/UIComponents';
import { Video, Copy, Check, ExternalLink, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { User } from '../../types';
import { dailyService } from '../../services/dailyService';

interface SimpleVideoMeetingProps {
    user: User;
    onJoinRoom: (roomUrl: string) => void;
}

interface MeetingRoom {
    name: string;
    url: string;
    shareLink: string;
}

/**
 * Simple Video Meeting Component
 *
 * Ultra-minimal approach:
 * - No auto-loading (prevents Error 310)
 * - User clicks to create
 * - Manual join only
 * - Zero complex state
 */
const SimpleVideoMeeting: React.FC<SimpleVideoMeetingProps> = ({ user, onJoinRoom }) => {
    const [room, setRoom] = useState<MeetingRoom | null>(null);
    const [creating, setCreating] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCreateMeeting = async () => {
        setCreating(true);

        try {
            // Generate unique room name
            const roomName = `meeting-${Date.now()}-${Math.random().toString(36).substring(7)}`;

            // Call API to create room
            const response = await fetch('/api/daily/create-room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: roomName,
                    properties: {
                        enable_screenshare: true,
                        enable_chat: true,
                        max_participants: 10,
                        enable_prejoin_ui: true,
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create meeting');
            }

            const data = await response.json();
            const shareLink = `${window.location.origin}/room/${data.name}`;

            setRoom({
                name: data.name,
                url: data.url,
                shareLink: shareLink
            });

            toast.success('Meeting created! Copy the link to share.');

        } catch (err) {
            console.error('Failed to create meeting:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to create meeting');
        } finally {
            setCreating(false);
        }
    };

    const handleCopyLink = async () => {
        if (!room) return;

        try {
            await navigator.clipboard.writeText(room.shareLink);
            setCopied(true);
            toast.success('Link copied!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Failed to copy link');
        }
    };

    const handleJoin = async () => {
        if (!room) return;

        try {
            // For the host (admin), we get an owner token
            const { token } = await dailyService.getMeetingToken(room.name, user.name, true);

            // Trigger the join room callback which Dashboard.tsx listens to
            // This will open the CustomVideoRoom overlay
            onJoinRoom(room.url);

            toast.success('Joining secure meet...');
        } catch (err) {
            console.error('Failed to get token for join:', err);
            // Still try to join even without token as fallback
            onJoinRoom(room.url);
        }
    };

    const handleReset = () => {
        setRoom(null);
        setCopied(false);
    };

    // State 1: No meeting created yet
    if (!room) {
        return (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 sm:p-8 border-2 border-slate-700">
                <div className="text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-teal-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Video className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    </div>

                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                        Create Instant Meeting
                    </h3>

                    <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
                        Click below to create a new meeting room. You&apos;ll get a shareable link that works for up to 10 participants.
                    </p>

                    <Button
                        onClick={handleCreateMeeting}
                        disabled={creating}
                        className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-base sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3 w-full sm:w-auto"
                    >
                        {creating ? (
                            <>
                                <Loader className="w-5 h-5 mr-2 animate-spin" />
                                Creating Meeting...
                            </>
                        ) : (
                            <>
                                <Video className="w-5 h-5 mr-2" />
                                Create Meeting Room
                            </>
                        )}
                    </Button>

                    <p className="text-xs text-gray-500 mt-4">
                        ✓ No automatic loading • ✓ Simple and stable • ✓ Manual control
                    </p>
                </div>
            </div>
        );
    }

    // State 2: Meeting created - show link and actions
    return (
        <div className="bg-gradient-to-br from-teal-900/30 to-blue-900/30 rounded-xl p-6 border-2 border-teal-500/30">
            <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-blue-500 rounded-xl flex items-center justify-center shrink-0">
                    <Video className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-1">
                        Meeting Room Ready!
                    </h3>
                    <p className="text-sm text-gray-300">
                        Share this link with up to 10 participants
                    </p>
                </div>
            </div>

            {/* Meeting Link Display */}
            <div className="bg-gray-900/50 border-2 border-teal-500/50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                    <ExternalLink className="w-4 h-4 text-teal-400" />
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                        Meeting Link
                    </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <p className="flex-1 text-teal-400 font-mono text-sm break-all select-all bg-black/30 p-2 rounded min-w-0">
                        {room.shareLink}
                    </p>
                    <Button
                        onClick={handleCopyLink}
                        className="bg-teal-600 hover:bg-teal-500 shrink-0"
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

            {/* Room Info */}
            <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-3 mb-4">
                <div className="text-xs text-gray-300 space-y-1">
                    <p><strong className="text-white">Room ID:</strong> {room.name}</p>
                    <p><strong className="text-white">Max Participants:</strong> 10 people</p>
                    <p><strong className="text-white">Features:</strong> Screen share, Chat enabled</p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 flex-wrap">
                <Button
                    onClick={handleJoin}
                    className="flex-1 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 min-w-[150px]"
                >
                    <Video className="w-4 h-4 mr-2" />
                    Join Meeting
                </Button>

                <Button
                    onClick={handleCopyLink}
                    variant="outline"
                    className="border-teal-500/50 hover:bg-teal-500/10"
                >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                </Button>

                <Button
                    onClick={handleReset}
                    variant="outline"
                    className="border-gray-500/50 hover:bg-gray-500/10"
                >
                    Create New
                </Button>
            </div>
        </div>
    );
};

export default SimpleVideoMeeting;

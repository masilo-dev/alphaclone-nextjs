import React, { useState, useEffect } from 'react';
import {
    Mic,
    MicOff,
    Video as VideoIcon,
    VideoOff,
    Monitor,
    MonitorOff,
    PhoneOff,
    Settings,
    Users,
    Copy,
    Check,
    MessageCircle,
    MoreHorizontal
} from 'lucide-react';
import toast from 'react-hot-toast';

interface VideoControlsProps {
    isMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing: boolean;
    onToggleMic: () => void;
    onToggleVideo: () => void;
    onToggleScreenShare: () => void;
    onLeave: () => void;
    onToggleParticipants?: () => void;
    onToggleChat?: () => void;
    onToggleSettings?: () => void;
    onEndForAll?: (() => void | Promise<void>) | undefined;
    isAdmin?: boolean;
    roomUrl?: string;
    callId?: string;
    unreadMessageCount?: number;
}

/**
 * Custom Video Controls Bar - Zoom/Teams Style
 * Optimized for both Desktop and Mobile
 */
const VideoControls: React.FC<VideoControlsProps> = ({
    isMuted,
    isVideoOff,
    isScreenSharing,
    onToggleMic,
    onToggleVideo,
    onToggleScreenShare,
    onLeave,
    onToggleParticipants,
    onToggleChat,
    onToggleSettings,
    onEndForAll,

    isAdmin = false,
    roomUrl,
    callId,
    unreadMessageCount = 0
}) => {
    const [copied, setCopied] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showMoreActions, setShowMoreActions] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleCopyLink = async () => {
        try {
            let linkToCopy = '';
            if (callId) {
                linkToCopy = `${window.location.origin}/meet/${callId}`;
            } else if (window.location.pathname.startsWith('/meet/') || window.location.pathname.startsWith('/call/')) {
                linkToCopy = window.location.href;
            } else if (roomUrl) {
                linkToCopy = roomUrl;
            } else {
                toast.error('No link available to copy');
                return;
            }

            await navigator.clipboard.writeText(linkToCopy);
            setCopied(true);
            toast.success('Meeting link copied!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Failed to copy link');
        }
    };

    const ControlButton = ({
        onClick,
        active,
        icon: Icon,
        activeIcon: ActiveIcon,
        label,
        danger,
        highlight,
        badgeCount
    }: any) => (
        <div className="flex flex-col items-center gap-1 group">
            <button
                onClick={onClick}
                className={`
                    relative flex items-center justify-center
                    w-12 h-12 sm:w-14 sm:h-14 rounded-full
                    transition-all duration-300 transform active:scale-90
                    ${danger
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40'
                        : highlight
                            ? 'bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/40'
                            : active
                                ? 'bg-red-500/20 border-2 border-red-500/50 text-red-500 hover:bg-red-500/30'
                                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-white/10'
                    }
                `}
                title={label}
            >
                {(active && ActiveIcon) ? <ActiveIcon className="w-5 h-5 sm:w-6 sm:h-6" /> : <Icon className="w-5 h-5 sm:w-6 sm:h-6" />}

                {badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 border-2 border-slate-900 text-[10px] font-bold text-white items-center justify-center">
                            {badgeCount > 9 ? '9+' : badgeCount}
                        </span>
                    </span>
                )}
            </button>
            <span className="text-[10px] sm:text-xs font-medium text-slate-400 group-hover:text-white transition-colors">
                {label}
            </span>
        </div>
    );

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 sm:pb-8 pointer-events-none">
            {/* Background Gradient */}
            <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />

            <div className="relative max-w-5xl mx-auto flex flex-col items-center pointer-events-auto">
                {/* Secondary Actions (More Menu) */}
                {showMoreActions && isMobile && (
                    <div className="mb-4 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 grid grid-cols-3 gap-4 animate-fade-in-up w-full shadow-2xl">
                        <ControlButton
                            onClick={() => { onToggleScreenShare(); setShowMoreActions(false); }}
                            highlight={isScreenSharing}
                            icon={isScreenSharing ? MonitorOff : Monitor}
                            label={isScreenSharing ? "Stop Share" : "Share"}
                        />
                        {onToggleChat && (
                            <ControlButton
                                onClick={() => { onToggleChat(); setShowMoreActions(false); }}
                                icon={MessageCircle}
                                label="Chat"
                                badgeCount={unreadMessageCount}
                            />
                        )}
                        {onToggleParticipants && (
                            <ControlButton
                                onClick={() => { onToggleParticipants(); setShowMoreActions(false); }}
                                icon={Users}
                                label="Users"
                            />
                        )}
                        {onToggleSettings && (
                            <ControlButton
                                onClick={() => { onToggleSettings(); setShowMoreActions(false); }}
                                icon={Settings}
                                label="Settings"
                            />
                        )}
                        <ControlButton
                            onClick={handleCopyLink}
                            icon={copied ? Check : Copy}
                            label="Invite"
                        />
                    </div>
                )}

                {/* Main Controls Bar */}
                <div className="bg-slate-950/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-3 sm:p-5 flex items-center justify-center gap-4 sm:gap-8 shadow-2xl ring-1 ring-white/10">

                    {/* Audio/Video Section */}
                    <div className="flex items-center gap-3 sm:gap-6">
                        <ControlButton
                            onClick={onToggleMic}
                            active={isMuted}
                            icon={Mic}
                            activeIcon={MicOff}
                            label={isMuted ? "Unmute" : "Mute"}
                        />
                        <ControlButton
                            onClick={onToggleVideo}
                            active={isVideoOff}
                            icon={VideoIcon}
                            activeIcon={VideoOff}
                            label={isVideoOff ? "Start" : "Stop"}
                        />
                    </div>

                    {/* Share Section - Hidden on Mobile main bar to satisfy "not a lot of button" requirement */}
                    {!isMobile && (
                        <>
                            <div className="w-px h-10 bg-white/10" />
                            <ControlButton
                                onClick={onToggleScreenShare}
                                highlight={isScreenSharing}
                                icon={isScreenSharing ? MonitorOff : Monitor}
                                label={isScreenSharing ? "Stop Share" : "Share"}
                            />
                        </>
                    )}

                    {/* End Call Section */}
                    <ControlButton
                        onClick={onLeave}
                        danger
                        icon={PhoneOff}
                        label="End Call"
                    />

                    {/* Desktop-only Extra Actions */}
                    {!isMobile && (
                        <>
                            <div className="w-px h-10 bg-white/10" />
                            <div className="flex items-center gap-3 sm:gap-6">
                                {onToggleChat && (
                                    <ControlButton
                                        onClick={onToggleChat}
                                        icon={MessageCircle}
                                        label="Chat"
                                        badgeCount={unreadMessageCount}
                                    />
                                )}
                                {onToggleParticipants && (
                                    <ControlButton
                                        onClick={onToggleParticipants}
                                        icon={Users}
                                        label="Users"
                                    />
                                )}
                                {onToggleSettings && (
                                    <ControlButton
                                        onClick={onToggleSettings}
                                        icon={Settings}
                                        label="Settings"
                                    />
                                )}
                            </div>
                        </>
                    )}

                    {/* Mobile "More" Toggle */}
                    {isMobile && (
                        <ControlButton
                            onClick={() => setShowMoreActions(!showMoreActions)}
                            icon={MoreHorizontal}
                            label="More"
                            active={showMoreActions}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoControls;

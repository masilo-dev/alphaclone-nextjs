import React from 'react';
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
    MessageCircle
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
}

/**
 * Custom Video Controls Bar
 * Full control over meeting actions with your branding
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
    callId
}) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopyLink = async () => {
        try {
            // Priority:
            // 1. callId -> Construct branded link
            // 2. window.location.href -> If we are on the call page
            // 3. roomUrl -> Fallback (but we try to avoid exposing this)

            let linkToCopy = '';

            if (callId) {
                linkToCopy = `${window.location.origin}/meet/${callId}`;
            } else if (window.location.pathname.startsWith('/meet/') || window.location.pathname.startsWith('/call/')) {
                linkToCopy = window.location.href;
            } else if (roomUrl) {
                // If we don't have a callId and aren't on a call page, we might have to use roomUrl
                // But for security, we prefer not to.
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

    const handleScreenShareClick = () => {
        // Mobile check
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            toast.error('Screen sharing is only available on desktop devices.');
            return;
        }
        onToggleScreenShare();
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50">
            {/* Gradient Fade up */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black via-slate-950/80 to-transparent pointer-events-none" />

            {/* Glass Bar */}
            <div className="relative max-w-4xl mx-auto mb-4 sm:mb-6 px-4 sm:px-6">
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-2 sm:p-4 flex items-center justify-between transition-all hover:bg-slate-900/70 hover:border-white/20">

                    {/* Left side - Meeting info */}
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse box-shadow-glow-red"></div>
                            <span className="text-red-100 text-xs font-bold tracking-wide uppercase">Live</span>
                        </div>
                        {roomUrl && (
                            <button
                                onClick={handleCopyLink}
                                className="flex items-center space-x-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5 group"
                            >
                                {copied ? (
                                    <Check className="w-3.5 h-3.5 text-teal-400" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
                                )}
                                <span className="text-xs text-slate-400 group-hover:text-white transition-colors">Invite</span>
                            </button>
                        )}
                    </div>

                    {/* Center - Main controls */}
                    <div className="flex items-center justify-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide py-1 px-1">
                        {/* Microphone toggle */}
                        <button
                            onClick={onToggleMic}
                            className={`p-3.5 rounded-xl transition-all duration-300 border backdrop-blur-md shadow-lg group relative overflow-hidden ${isMuted
                                ? 'bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30'
                                : 'bg-white/10 border-white/10 text-white hover:bg-white/20 hover:border-white/20 box-shadow-glow-teal'
                                }`}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            {isMuted ? (
                                <MicOff className="w-5 h-5 relative z-10" />
                            ) : (
                                <Mic className="w-5 h-5 relative z-10" />
                            )}
                        </button>

                        {/* Video toggle */}
                        <button
                            onClick={onToggleVideo}
                            className={`p-3.5 rounded-xl transition-all duration-300 border backdrop-blur-md shadow-lg group relative overflow-hidden ${isVideoOff
                                ? 'bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30'
                                : 'bg-white/10 border-white/10 text-white hover:bg-white/20 hover:border-white/20 box-shadow-glow-teal'
                                }`}
                            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                        >
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            {isVideoOff ? (
                                <VideoOff className="w-5 h-5 relative z-10" />
                            ) : (
                                <VideoIcon className="w-5 h-5 relative z-10" />
                            )}
                        </button>

                        {/* Screen share toggle */}
                        <button
                            onClick={handleScreenShareClick}
                            className={`p-3.5 rounded-xl transition-all duration-300 border backdrop-blur-md shadow-lg group relative overflow-hidden ${isScreenSharing
                                ? 'bg-teal-500/20 border-teal-500/50 text-teal-500 hover:bg-teal-500/30 box-shadow-glow-teal'
                                : 'bg-white/10 border-white/10 text-white hover:bg-white/20 hover:border-white/20'
                                }`}
                            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                        >
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            {isScreenSharing ? (
                                <MonitorOff className="w-5 h-5 relative z-10" />
                            ) : (
                                <Monitor className="w-5 h-5 relative z-10" />
                            )}
                        </button>

                        {/* Leave button */}
                        <button
                            onClick={onLeave}
                            className="p-3.5 sm:p-3.5 rounded-xl bg-red-600 hover:bg-red-500 transition-all ml-2 sm:ml-4 border-2 border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)] transform hover:scale-105 active:scale-95 group relative overflow-hidden"
                            title="End Call"
                        >
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <PhoneOff className="w-6 h-6 sm:w-5 sm:h-5 text-white group-hover:rotate-90 transition-transform relative z-10" />
                        </button>

                        {/* Admin: End meeting for all button */}
                        {isAdmin && onEndForAll && (
                            <button
                                onClick={onEndForAll}
                                className="hidden sm:flex items-center space-x-2 px-4 py-3.5 rounded-xl bg-slate-800 hover:bg-red-900/50 transition-all ml-2 border border-red-500/30 hover:border-red-500/80 group"
                                title="End meeting for everyone"
                            >
                                <PhoneOff className="w-4 h-4 text-red-400 group-hover:text-red-200 transition-colors" />
                                <span className="text-sm text-red-400 group-hover:text-red-200 font-medium transition-colors">End All</span>
                            </button>
                        )}
                    </div>

                    {/* Right side - Additional controls */}
                    <div className="flex items-center space-x-2 pl-2 border-l border-white/5 ml-2">
                        {onToggleChat && (
                            <button
                                onClick={onToggleChat}
                                className="p-3 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
                                title="Chat"
                            >
                                <MessageCircle className="w-5 h-5" />
                            </button>
                        )}
                        {onToggleParticipants && (
                            <button
                                onClick={onToggleParticipants}
                                className="p-3 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
                                title="Participants"
                            >
                                <Users className="w-5 h-5" />
                            </button>
                        )}
                        {onToggleSettings && (
                            <button
                                onClick={onToggleSettings}
                                className="p-3 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
                                title="Settings"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoControls;

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
    roomUrl
}) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopyLink = async () => {
        if (!roomUrl) return;

        try {
            await navigator.clipboard.writeText(roomUrl);
            setCopied(true);
            toast.success('Meeting link copied!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Failed to copy link');
        }
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 z-50 pb-safe">
            <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-4">
                {/* Mobile: Stack controls vertically, Desktop: Horizontal with justify-between */}
                {/* Left side - Meeting info */}
                <div className="flex items-center justify-between w-full sm:w-auto sm:justify-start space-x-3 mb-3 sm:mb-0">
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                        <span className="text-white text-sm font-medium">Live</span>
                    </div>
                    {roomUrl && (
                        <button
                            onClick={handleCopyLink}
                            className="flex items-center space-x-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            {copied ? (
                                <Check className="w-4 h-4 text-teal-400" />
                            ) : (
                                <Copy className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="text-sm text-gray-300">Copy Link</span>
                        </button>
                    )}
                </div>

                {/* Center - Main controls (centered on mobile and desktop) */}
                <div className="flex items-center justify-center space-x-2 sm:space-x-3">
                    {/* Microphone toggle */}
                    <button
                        onClick={onToggleMic}
                        className={`p-3 sm:p-4 rounded-full transition-all ${isMuted
                            ? 'bg-red-500 hover:bg-red-600'
                            : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? (
                            <MicOff className="w-5 h-5 text-white" />
                        ) : (
                            <Mic className="w-5 h-5 text-white" />
                        )}
                    </button>

                    {/* Video toggle */}
                    <button
                        onClick={onToggleVideo}
                        className={`p-3 sm:p-4 rounded-full transition-all ${isVideoOff
                            ? 'bg-red-500 hover:bg-red-600'
                            : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                        title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                    >
                        {isVideoOff ? (
                            <VideoOff className="w-5 h-5 text-white" />
                        ) : (
                            <VideoIcon className="w-5 h-5 text-white" />
                        )}
                    </button>

                    {/* Screen share toggle */}
                    <button
                        onClick={onToggleScreenShare}
                        className={`p-3 sm:p-4 rounded-full transition-all ${isScreenSharing
                            ? 'bg-teal-500 hover:bg-teal-600'
                            : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                        title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                    >
                        {isScreenSharing ? (
                            <MonitorOff className="w-5 h-5 text-white" />
                        ) : (
                            <Monitor className="w-5 h-5 text-white" />
                        )}
                    </button>

                    {/* Leave button */}
                    <button
                        onClick={onLeave}
                        className="p-3 sm:p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all ml-2 sm:ml-4"
                        title="Leave meeting"
                    >
                        <PhoneOff className="w-5 h-5 text-white" />
                    </button>

                    {/* Admin: End meeting for all button */}
                    {isAdmin && onEndForAll && (
                        <button
                            onClick={onEndForAll}
                            className="hidden sm:flex items-center space-x-2 px-3 sm:px-4 py-2 sm:py-3 rounded-full bg-red-700 hover:bg-red-800 transition-all ml-2 border-2 border-red-500"
                            title="End meeting for everyone"
                        >
                            <PhoneOff className="w-4 h-4 text-white" />
                            <span className="text-xs sm:text-sm text-white font-medium">End for All</span>
                        </button>
                    )}
                </div>

                {/* Right side - Additional controls (hidden on mobile to save space) */}
                <div className="hidden sm:flex items-center space-x-3">
                    {onToggleChat && (
                        <button
                            onClick={onToggleChat}
                            className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                            title="Chat"
                        >
                            <MessageCircle className="w-5 h-5 text-gray-300" />
                        </button>
                    )}
                    {onToggleParticipants && (
                        <button
                            onClick={onToggleParticipants}
                            className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                            title="Participants"
                        >
                            <Users className="w-5 h-5 text-gray-300" />
                        </button>
                    )}
                    {onToggleSettings && (
                        <button
                            onClick={onToggleSettings}
                            className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                            title="Settings"
                        >
                            <Settings className="w-5 h-5 text-gray-300" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoControls;

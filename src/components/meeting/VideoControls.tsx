import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Users, MonitorUp } from 'lucide-react';
import { DailyCall } from '@daily-co/daily-js';

interface VideoControlsProps {
    callObject: DailyCall | null;
    muted: boolean;
    cameraOff: boolean;
    chatOpen: boolean;
    participantsOpen: boolean;
    onToggleMute: () => void;
    onToggleCamera: () => void;
    onToggleChat: () => void;
    onToggleParticipants: () => void;
    onLeave: () => void;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
    callObject,
    muted,
    cameraOff,
    chatOpen,
    participantsOpen,
    onToggleMute,
    onToggleCamera,
    onToggleChat,
    onToggleParticipants,
    onLeave
}) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-center px-4 z-50">
            <div className="flex items-center gap-2 md:gap-4">
                {/* Audio */}
                <button
                    onClick={onToggleMute}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${muted ? 'text-red-500 bg-red-500/10' : 'text-white hover:bg-slate-800'
                        }`}
                >
                    <div className={`p-2 rounded-full ${muted ? 'bg-red-500 text-white' : 'bg-slate-700'}`}>
                        {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </div>
                    <span className="text-[10px] font-medium hidden md:block">
                        {muted ? 'Unmute' : 'Mute'}
                    </span>
                </button>

                {/* Video */}
                <button
                    onClick={onToggleCamera}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${cameraOff ? 'text-red-500 bg-red-500/10' : 'text-white hover:bg-slate-800'
                        }`}
                >
                    <div className={`p-2 rounded-full ${cameraOff ? 'bg-red-500 text-white' : 'bg-slate-700'}`}>
                        {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </div>
                    <span className="text-[10px] font-medium hidden md:block">
                        {cameraOff ? 'Start Video' : 'Stop Video'}
                    </span>
                </button>

                {/* Separator */}
                <div className="w-px h-8 bg-slate-700 mx-2" />

                {/* Chat */}
                <button
                    onClick={onToggleChat}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${chatOpen ? 'text-teal-400 bg-teal-400/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                >
                    <div className="p-2 bg-slate-800 rounded-full">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium hidden md:block">Chat</span>
                </button>

                {/* Participants (Desktop only maybe?) */}
                <button
                    onClick={onToggleParticipants}
                    className="hidden md:flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-slate-400 hover:text-white hover:bg-slate-800"
                >
                    <div className="p-2 bg-slate-800 rounded-full">
                        <Users className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium">People</span>
                </button>

                {/* Leave Button */}
                <button
                    onClick={onLeave}
                    className="ml-2 md:ml-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold flex items-center gap-2 shadow-lg shadow-red-900/20"
                >
                    <PhoneOff className="w-5 h-5" />
                    <span className="hidden md:inline">End Call</span>
                </button>
            </div>
        </div>
    );
};

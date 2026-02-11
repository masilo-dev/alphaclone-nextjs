import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Users, MonitorUp, MonitorOff } from 'lucide-react';
import { DailyCall } from '@daily-co/daily-js';

interface VideoControlsProps {
    callObject: DailyCall | null;
    muted: boolean;
    cameraOff: boolean;
    screenShareOn: boolean;
    chatOpen: boolean;
    participantsOpen: boolean;
    onToggleMute: () => void;
    onToggleCamera: () => void;
    onToggleScreenShare: () => void;
    onToggleChat: () => void;
    onToggleParticipants: () => void;
    onLeave: () => void;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
    callObject,
    muted,
    cameraOff,
    screenShareOn,
    chatOpen,
    participantsOpen,
    onToggleMute,
    onToggleCamera,
    onToggleScreenShare,
    onToggleChat,
    onToggleParticipants,
    onLeave
}) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 h-auto md:h-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-center px-2 py-3 md:py-0 z-50 transition-transform duration-300 safe-area-bottom">
            <div className="flex items-center justify-between w-full max-w-2xl px-2 gap-1 md:gap-4 md:justify-center">

                {/* Audio */}
                <button
                    onClick={onToggleMute}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all flex-1 md:flex-none ${muted ? 'text-red-500 bg-red-500/10' : 'text-white hover:bg-slate-800'}`}
                >
                    <div className={`p-2.5 rounded-full ${muted ? 'bg-red-500 text-white' : 'bg-slate-800 md:bg-slate-700'}`}>
                        {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </div>
                    <span className="text-[10px] font-medium hidden md:block">
                        {muted ? 'Unmute' : 'Mute'}
                    </span>
                </button>

                {/* Video */}
                <button
                    onClick={onToggleCamera}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all flex-1 md:flex-none ${cameraOff ? 'text-red-500 bg-red-500/10' : 'text-white hover:bg-slate-800'}`}
                >
                    <div className={`p-2.5 rounded-full ${cameraOff ? 'bg-red-500 text-white' : 'bg-slate-800 md:bg-slate-700'}`}>
                        {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </div>
                    <span className="text-[10px] font-medium hidden md:block">
                        {cameraOff ? 'Start Video' : 'Stop Video'}
                    </span>
                </button>

                {/* Screen Share (Now visible on Mobile) */}
                <button
                    onClick={onToggleScreenShare}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all flex-1 md:flex-none ${screenShareOn ? 'text-teal-400 bg-teal-400/10' : 'text-white hover:bg-slate-800'}`}
                >
                    <div className={`p-2.5 rounded-full ${screenShareOn ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 md:bg-slate-700'}`}>
                        {screenShareOn ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
                    </div>
                    <span className="text-[10px] font-medium hidden md:block">
                        {screenShareOn ? 'Stop Share' : 'Share'}
                    </span>
                </button>

                {/* Chat */}
                <button
                    onClick={onToggleChat}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all flex-1 md:flex-none ${chatOpen ? 'text-teal-400 bg-teal-400/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                    <div className="p-2.5 bg-slate-800 md:bg-slate-800 rounded-full">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium hidden md:block">Chat</span>
                </button>

                {/* Participants (Hidden on small mobile to save space, relies on drawer or other UI if strictly needed, but protecting space for End Call) */}
                <button
                    onClick={onToggleParticipants}
                    className="hidden sm:flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-slate-400 hover:text-white hover:bg-slate-800 flex-1 md:flex-none"
                >
                    <div className="p-2.5 bg-slate-800 rounded-full">
                        <Users className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium hidden md:block">People</span>
                </button>

                {/* End Call (Critical - Always Visible) */}
                <button
                    onClick={onLeave}
                    className="flex flex-col items-center gap-1 p-1 md:p-2 rounded-lg transition-all flex-1 md:flex-none"
                >
                    <div className="p-2.5 md:px-6 md:py-2 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center gap-2 shadow-lg shadow-red-900/20">
                        <PhoneOff className="w-5 h-5" />
                        <span className="hidden md:inline font-bold">End Call</span>
                    </div>
                    <span className="text-[10px] font-medium text-red-500 md:hidden block mt-1">End</span>
                </button>
            </div>
        </div>
    );
};

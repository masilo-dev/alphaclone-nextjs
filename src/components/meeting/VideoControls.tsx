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
        <>
            {/* Desktop / Standard Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 h-20 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-center px-4 z-50 transition-transform duration-300">
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

                    {/* Screen Share (Desktop Only) */}
                    <button
                        onClick={onToggleScreenShare}
                        className={`hidden md:flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${screenShareOn ? 'text-teal-400 bg-teal-400/10' : 'text-white hover:bg-slate-800'
                            }`}
                    >
                        <div className={`p-2 rounded-full ${screenShareOn ? 'bg-teal-500 text-slate-950' : 'bg-slate-700'}`}>
                            {screenShareOn ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
                        </div>
                        <span className="text-[10px] font-medium hidden md:block">
                            {screenShareOn ? 'Stop Share' : 'Share'}
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

                    {/* Participants (Desktop only) */}
                    <button
                        onClick={onToggleParticipants}
                        className="hidden md:flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                        <div className="p-2 bg-slate-800 rounded-full">
                            <Users className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-medium">People</span>
                    </button>

                    {/* Desktop End Call Button */}
                    <button
                        onClick={onLeave}
                        className="hidden md:flex ml-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold items-center gap-2 shadow-lg shadow-red-900/20"
                    >
                        <PhoneOff className="w-5 h-5" />
                        <span>End Call</span>
                    </button>
                </div>
            </div>

            {/* Mobile End Call FAB */}
            <button
                onClick={onLeave}
                className="md:hidden fixed bottom-24 right-4 w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-2xl shadow-red-900/40 z-50 active:scale-90 transition-transform"
                aria-label="End Call"
            >
                <PhoneOff className="w-6 h-6 text-white" />
            </button>
        </>
    );
};

import React, { useEffect, useRef, useState } from 'react';
import { DailyCall, DailyParticipant } from '@daily-co/daily-js';
import { Maximize2, Minimize2, Move } from 'lucide-react';

interface VideoLayoutProps {
    callObject: DailyCall | null;
    participants: Record<string, DailyParticipant>; // Map from Daily
    localParticipant: DailyParticipant | null;
}

export const VideoLayout: React.FC<VideoLayoutProps> = ({ callObject, participants, localParticipant }) => {
    const participantIds = Object.keys(participants);
    const [pipMinimized, setPipMinimized] = useState(false);
    const [pipPosition, setPipPosition] = useState({ x: 16, y: 16 }); // top-right offset

    // Filter for screen shares
    const screenShares = participantIds.filter(id => participants[id]?.tracks?.screenVideo?.persistentTrack);

    return (
        <div className="flex-1 bg-black relative overflow-hidden flex items-center justify-center">
            {participantIds.length === 0 ? (
                // Alone in meeting
                <div className="text-center">
                    <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <span className="text-4xl">👋</span>
                    </div>
                    <h3 className="text-xl font-bold text-white">Waiting for others...</h3>
                    <p className="text-slate-400 mt-2">Share the link to invite participants.</p>
                </div>
            ) : (
                // Grid or Speaker view
                <div className={`w-full h-full p-4 grid gap-4 ${screenShares.length > 0
                    ? 'grid-cols-1' // Stack if screen sharing
                    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    }`}>

                    {/* Render Screen Shares Priority */}
                    {screenShares.map(id => (
                        <div key={`${id}-screen`} className="col-span-full aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl relative group">
                            <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white">
                                {participants[id].user_name} is sharing screen
                            </div>
                            <ParticipantTile participant={participants[id]} isScreenShare />
                        </div>
                    ))}

                    {/* Render Camera Feeds */}
                    {participantIds.map(id => (
                        <div key={id} className={`${screenShares.length > 0 ? 'h-32 md:h-auto' : ''}`}>
                            <ParticipantTile participant={participants[id]} />
                        </div>
                    ))}
                </div>
            )}

            {/* Local User (Self View PiP) - Draggable/Minimizable on Mobile */}
            {localParticipant && (
                <div
                    className={`absolute z-50 transition-all duration-300 ease-in-out shadow-2xl border border-slate-700 overflow-hidden bg-slate-900
                        ${pipMinimized
                            ? 'w-16 h-16 rounded-full bottom-24 right-4 md:bottom-8 md:right-8 cursor-pointer'
                            : 'w-32 md:w-48 aspect-video rounded-xl top-4 right-4'
                        }
                    `}
                    onClick={() => setPipMinimized(!pipMinimized)}
                >
                    {pipMinimized ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white">
                            <span className="text-xs font-bold">You</span>
                        </div>
                    ) : (
                        <>
                            <ParticipantTile participant={localParticipant} isLocal />
                            <div className="absolute top-1 right-1 p-1 bg-black/50 rounded-full cursor-pointer hover:bg-black/70 md:hidden">
                                <Minimize2 className="w-3 h-3 text-white" />
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

const ParticipantTile = ({ participant, isLocal, isScreenShare }: { participant: DailyParticipant, isLocal?: boolean, isScreenShare?: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (!participant) return;

        // Determine which track to use
        const videoTrack = isScreenShare
            ? participant.tracks.screenVideo?.persistentTrack
            : participant.tracks.video?.persistentTrack;

        const audioTrack = participant.tracks.audio?.persistentTrack;
        const screenAudioTrack = participant.tracks.screenAudio?.persistentTrack;

        if (videoRef.current && videoTrack) {
            videoRef.current.srcObject = new MediaStream([videoTrack]);
        }

        if (audioRef.current && !isLocal) {
            const tracks = [];
            if (audioTrack) tracks.push(audioTrack);
            if (screenAudioTrack && isScreenShare) tracks.push(screenAudioTrack);

            if (tracks.length > 0) {
                audioRef.current.srcObject = new MediaStream(tracks);
            }
        }

    }, [participant, isScreenShare]); // Re-run if tracks change

    return (
        <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden group">
            {/* Initials Placeholder (Only for Camera, not Screen) */}
            {!isScreenShare && !participant.video && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                    <span className="text-2xl font-bold text-slate-400">
                        {participant.user_name?.substring(0, 2).toUpperCase() || '??'}
                    </span>
                </div>
            )}

            {/* Actual Video */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal} // Always mute local video
                className={`w-full h-full object-cover ${isLocal && !isScreenShare ? 'scale-x-[-1]' : ''} ${isScreenShare ? 'object-contain bg-black' : ''}`}
            />

            {/* Audio (for remote) */}
            {!isLocal && <audio ref={audioRef} autoPlay playsInline />}

            {/* Name Tag */}
            {!isScreenShare && (
                <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-xs text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100">
                    {participant.user_name} {isLocal && '(You)'}
                    {participant.audio ? '' : ' 🔇'}
                </div>
            )}
        </div>
    );
}

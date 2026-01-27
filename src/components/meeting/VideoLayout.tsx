import React, { useEffect, useRef } from 'react';
import { DailyCall, DailyParticipant } from '@daily-co/daily-js';

interface VideoLayoutProps {
    callObject: DailyCall | null;
    participants: Record<string, DailyParticipant>; // Map from Daily
    localParticipant: DailyParticipant | null;
}

export const VideoLayout: React.FC<VideoLayoutProps> = ({ callObject, participants, localParticipant }) => {
    // We need to manage video tracks manually if we are doing custom layout.
    // However, Daily's 'createFrame' (iframe) handles this automatically inside the iframe.
    // If we want CUSTOM layout, we usually use 'createCallObject' (custom mode) not 'createFrame'.

    // NOTE: The current MeetingPage implementation uses `createFrame` (Iframe Mode).
    // Iframe mode draws its OWN UI. We cannot easily overlay our own React UI *inside* the iframe 
    // or rearrange the video tiles unless we switch to Custom Mode (`createCallObject`).

    // Switching to Custom Mode is a larger task.
    // For now, if we are keeping `createFrame`, we are limited to CSS overrides on the iframe 
    // (which is blocked by cross-origin usually) or using Daily's `iframeStyle` and custom logic.

    // BUT, the requirements said "Zoom/Teams" style.
    // To achieve true custom layout (PiP, Bottom Bar), we MUST use `createCallObject`.

    // Since I am already creating `VideoControls` and `VideoLayout`, I am assuming we are migrating 
    // from Iframe Mode to Custom Mode in `MeetingPage`.

    // For this Layout component, we need to render <video> tags for each participant.

    const participantIds = Object.keys(participants);

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
                <div className="w-full h-full p-4 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {participantIds.map(id => (
                        <ParticipantTile key={id} participant={participants[id]} />
                    ))}
                </div>
            )}

            {/* Local User (Self View PiP) */}
            {localParticipant && (
                <div className="absolute top-4 right-4 w-32 md:w-48 aspect-video bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-2xl z-40">
                    <ParticipantTile participant={localParticipant} isLocal />
                </div>
            )}
        </div>
    );
};

const ParticipantTile = ({ participant, isLocal }: { participant: DailyParticipant, isLocal?: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (!participant) return;

        const videoTrack = participant.tracks.video.persistentTrack;
        const audioTrack = participant.tracks.audio.persistentTrack;

        if (videoRef.current && videoTrack) {
            videoRef.current.srcObject = new MediaStream([videoTrack]);
        }

        if (audioRef.current && audioTrack && !isLocal) {
            // Audio ref for remote participants
            audioRef.current.srcObject = new MediaStream([audioTrack]);
        }

    }, [participant, participant.tracks.video.persistentTrack, participant.tracks.audio.persistentTrack]);

    return (
        <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden">
            {/* Initials Placeholder */}
            {!participant.video && (
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
                muted={isLocal} // Always mute local video to prevent echo
                className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`} // Mirror local
            />

            {/* Audio (for remote) */}
            {!isLocal && <audio ref={audioRef} autoPlay playsInline />}

            {/* Name Tag */}
            <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-xs text-white font-medium">
                {participant.user_name} {isLocal && '(You)'}
                {participant.audio ? '' : ' 🔇'}
            </div>
        </div>
    );
}

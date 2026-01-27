import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, User } from 'lucide-react';
import { ParticipantMediaState } from '../../../services/video/MediaStateManager';
import AdminParticipantControls from './AdminParticipantControls';

interface CustomVideoTileProps {
    participant: ParticipantMediaState;
    isLocal?: boolean;
    isAdmin?: boolean;
    onMuteParticipant?: (sessionId: string) => void;
    onRemoveParticipant?: (sessionId: string) => void;
}

/**
 * Custom Video Tile Component
 * Displays individual participant video with custom styling
 * Works with new layered architecture (no Daily React hooks)
 */
const CustomVideoTile: React.FC<CustomVideoTileProps> = ({
    participant,
    isLocal = false,
    isAdmin = false,
    onMuteParticipant,
    onRemoveParticipant
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Attach video track to video element
    useEffect(() => {
        if (videoRef.current && participant.video.track) {
            const stream = new MediaStream([participant.video.track]);
            videoRef.current.srcObject = stream;

            // Play the video
            videoRef.current.play().catch(err => {
                console.error('Error playing video:', err);
            });
        }

        // Cleanup
        return () => {
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };
    }, [participant.video.track]);

    // Attach audio track to audio element (only for remote participants)
    useEffect(() => {
        if (!isLocal && audioRef.current && participant.audio.track) {
            const stream = new MediaStream([participant.audio.track]);
            audioRef.current.srcObject = stream;

            // Play the audio
            audioRef.current.play().catch(err => {
                console.error('Error playing audio:', err);
            });
        }

        // Cleanup
        return () => {
            if (audioRef.current) {
                audioRef.current.srcObject = null;
            }
        };
    }, [participant.audio.track, isLocal]);

    const displayName = participant.userName || 'Guest';
    const isVideoOff = !participant.video.enabled || !participant.video.track;
    const isAudioOff = !participant.audio.enabled || !participant.audio.track;

    return (
        <div className="relative bg-slate-900 rounded-2xl overflow-hidden aspect-video group border border-slate-800 shadow-2xl transition-all hover:border-teal-500/30">
            {/* Admin controls overlay */}
            <AdminParticipantControls
                participant={participant}
                isAdmin={isAdmin}
                onMuteParticipant={onMuteParticipant}
                onRemoveParticipant={onRemoveParticipant}
            />

            {/* Video element */}
            {!isVideoOff ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className="w-full h-full object-cover"
                />
            ) : (
                /* Placeholder when video is off */
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black relative">
                    <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />

                    <div className="text-center relative z-10">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/20">
                                <span className="text-3xl font-bold text-white">
                                    {(displayName?.[0] || 'G').toUpperCase()}
                                </span>
                            </div>
                            {/* Speaking Indicator */}
                            {participant.audio.enabled && (
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-teal-500 rounded-full border-4 border-slate-950 flex items-center justify-center animate-pulse">
                                    <Mic className="w-3 h-3 text-white" />
                                </div>
                            )}
                        </div>
                        <p className="text-white font-semibold text-lg">{displayName}</p>
                        <p className="text-slate-500 text-sm mt-1">Camera is off</p>
                    </div>
                </div>
            )}

            {/* Audio element (hidden, only for remote participants) */}
            {!isLocal && <audio ref={audioRef} autoPlay />}

            {/* Participant info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 transition-opacity duration-300">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${!isAudioOff ? 'bg-teal-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-white text-sm font-semibold tracking-wide shadow-black drop-shadow-md">
                            {displayName} {isLocal && '(You)'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1">
                        {isAudioOff ? (
                            <MicOff className="w-3.5 h-3.5 text-red-400" />
                        ) : (
                            <Mic className="w-3.5 h-3.5 text-teal-400" />
                        )}
                        {isVideoOff ? (
                            <VideoOff className="w-3.5 h-3.5 text-red-400" />
                        ) : (
                            <VideoIcon className="w-3.5 h-3.5 text-teal-400" />
                        )}
                    </div>
                </div>
            </div>

            {/* Local indicator */}
            {isLocal && (
                <div className="absolute top-4 left-4 bg-teal-500/90 backdrop-blur-md px-3 py-1 rounded-lg shadow-lg shadow-teal-900/20 border border-teal-400/20">
                    <span className="text-white text-xs font-bold tracking-wider uppercase">You</span>
                </div>
            )}
        </div>
    );
};

export default CustomVideoTile;

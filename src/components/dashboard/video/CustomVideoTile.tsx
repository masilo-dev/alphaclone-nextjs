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
        <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video group">
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
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                    <div className="text-center">
                        <div className="w-20 h-20 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto mb-3">
                            <User className="w-10 h-10 text-teal-400" />
                        </div>
                        <p className="text-white font-medium">{displayName}</p>
                    </div>
                </div>
            )}

            {/* Audio element (hidden, only for remote participants) */}
            {!isLocal && <audio ref={audioRef} autoPlay />}

            {/* Participant info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <span className="text-white text-sm font-medium truncate">
                            {displayName} {isLocal && '(You)'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2">
                        {isAudioOff ? (
                            <MicOff className="w-4 h-4 text-red-400" />
                        ) : (
                            <Mic className="w-4 h-4 text-teal-400" />
                        )}
                        {isVideoOff ? (
                            <VideoOff className="w-4 h-4 text-red-400" />
                        ) : (
                            <VideoIcon className="w-4 h-4 text-teal-400" />
                        )}
                    </div>
                </div>
            </div>

            {/* Local indicator */}
            {isLocal && (
                <div className="absolute top-3 left-3 bg-teal-500/90 backdrop-blur-sm px-2 py-1 rounded-full">
                    <span className="text-white text-xs font-medium">You</span>
                </div>
            )}
        </div>
    );
};

export default CustomVideoTile;

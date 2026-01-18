/**
 * UI ADAPTER LAYER - React Hook
 *
 * Responsibilities:
 * - Maps state → UI
 * - Handles button interactions
 * - Provides visual feedback
 *
 * Constraints:
 * - NEVER directly calls Daily APIs
 * - NEVER manages media directly
 * - Only reacts to state changes
 * - Clean, stable interface for UI components
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { VideoPlatform, VideoPlatformConfig } from '../services/video/VideoPlatform';
import { VideoConfiguration, videoConfig } from '../services/video/VideoConfiguration';
import { MediaState, ParticipantMediaState } from '../services/video/MediaStateManager';
import { NormalizedError } from '../services/video/ErrorHandler';

// Singleton instance - persists across component remounts (React Strict Mode protection)
let globalPlatformInstance: VideoPlatform | null = null;

export interface UseVideoPlatformResult {
    // State
    isJoined: boolean;
    isJoining: boolean;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    isScreenSharing: boolean;
    participants: ParticipantMediaState[];
    localParticipant: ParticipantMediaState | null;
    remoteParticipants: ParticipantMediaState[];
    error: NormalizedError | null;

    // Actions
    join: (config: VideoPlatformConfig) => Promise<void>;
    leave: () => Promise<void>;
    toggleAudio: () => Promise<void>;
    toggleVideo: () => Promise<void>;
    toggleScreenShare: () => Promise<void>;
    sendChatMessage: (message: string) => Promise<void>;
    muteParticipant: (sessionId: string) => Promise<void>;
    removeParticipant: (sessionId: string) => Promise<void>;

    // Config
    config: VideoConfiguration;
}

/**
 * React Hook for Video Platform
 * Provides clean UI adapter for video functionality
 */
export function useVideoPlatform(): UseVideoPlatformResult {
    const platformRef = useRef<VideoPlatform | null>(null);
    const initializingRef = useRef(false); // Prevent double initialization
    const [isJoined, setIsJoined] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [mediaState, setMediaState] = useState<MediaState>({
        isAudioEnabled: true,
        isVideoEnabled: true,
        isScreenSharing: false,
        participants: new Map(),
        localSessionId: null,
    });
    const [error, setError] = useState<NormalizedError | null>(null);

    // Throttle media state updates to prevent Error 310
    const pendingStateUpdateRef = useRef<MediaState | null>(null);
    const stateUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastUpdateTimeRef = useRef<number>(0);
    const THROTTLE_MS = 250; // Max 4 updates per second (reduced from 100ms for better stability)

    // Throttled state update function
    const throttledSetMediaState = useCallback((state: MediaState) => {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

        // Store the latest state
        pendingStateUpdateRef.current = state;

        // If enough time has passed, update immediately
        if (timeSinceLastUpdate >= THROTTLE_MS) {
            lastUpdateTimeRef.current = now;
            setMediaState(state);
            pendingStateUpdateRef.current = null;
        } else {
            // Schedule update for later (cancel existing scheduled update)
            if (stateUpdateTimeoutRef.current) {
                clearTimeout(stateUpdateTimeoutRef.current);
            }

            stateUpdateTimeoutRef.current = setTimeout(() => {
                if (pendingStateUpdateRef.current) {
                    lastUpdateTimeRef.current = Date.now();
                    setMediaState(pendingStateUpdateRef.current);
                    pendingStateUpdateRef.current = null;
                }
                stateUpdateTimeoutRef.current = null;
            }, THROTTLE_MS - timeSinceLastUpdate);
        }
    }, []);

    // Initialize platform on mount
    useEffect(() => {
        console.log('useVideoPlatform: useEffect running');

        // Use or create singleton instance
        if (!globalPlatformInstance) {
            console.log('Creating singleton VideoPlatform instance...');
            globalPlatformInstance = new VideoPlatform(videoConfig);

            globalPlatformInstance.initialize().catch(err => {
                console.error('Failed to initialize video platform:', err);
                setError(err);
            });
        } else {
            console.log('Reusing existing singleton VideoPlatform instance');
        }

        platformRef.current = globalPlatformInstance;

        // Subscribe to media state changes with throttling
        const unsubscribe = globalPlatformInstance.subscribeToMediaState((state) => {
            throttledSetMediaState(state);
        });

        // Cleanup on unmount - unsubscribe but keep singleton alive
        return () => {
            console.log('useVideoPlatform: Cleanup running (unsubscribing only)');
            unsubscribe();

            // Clear any pending throttled updates
            if (stateUpdateTimeoutRef.current) {
                clearTimeout(stateUpdateTimeoutRef.current);
                stateUpdateTimeoutRef.current = null;
            }

            // Note: We don't destroy or null the globalPlatformInstance
            // It persists across React Strict Mode remounts
        };
    }, [throttledSetMediaState]);

    /**
     * Join a video call
     */
    const join = useCallback(async (config: VideoPlatformConfig) => {
        const platform = platformRef.current;
        if (!platform) {
            throw new Error('Platform not initialized');
        }

        try {
            setIsJoining(true);
            setError(null);
            await platform.join(config);
            setIsJoined(true);
        } catch (err: any) {
            setError(err);
            throw err;
        } finally {
            setIsJoining(false);
        }
    }, []);

    /**
     * Leave the video call
     */
    const leave = useCallback(async () => {
        const platform = platformRef.current;
        if (!platform) return;

        try {
            await platform.leave();
            setIsJoined(false);
        } catch (err: any) {
            setError(err);
            console.error('Error leaving call:', err);
        }
    }, []);

    /**
     * Toggle audio
     */
    const toggleAudio = useCallback(async () => {
        const platform = platformRef.current;
        if (!platform) return;

        try {
            setError(null);
            await platform.toggleAudio();
        } catch (err: any) {
            setError(err);
        }
    }, []);

    /**
     * Toggle video
     */
    const toggleVideo = useCallback(async () => {
        const platform = platformRef.current;
        if (!platform) return;

        try {
            setError(null);
            await platform.toggleVideo();
        } catch (err: any) {
            setError(err);
        }
    }, []);

    /**
     * Toggle screen share
     */
    const toggleScreenShare = useCallback(async () => {
        const platform = platformRef.current;
        if (!platform) return;

        try {
            setError(null);
            await platform.toggleScreenShare();
        } catch (err: any) {
            setError(err);
        }
    }, []);

    /**
     * Send chat message
     */
    const sendChatMessage = useCallback(async (message: string) => {
        const platform = platformRef.current;
        if (!platform) return;

        try {
            setError(null);
            await platform.sendChatMessage(message);
        } catch (err: any) {
            setError(err);
        }
    }, []);

    /**
     * Mute participant (admin only)
     */
    const muteParticipant = useCallback(async (sessionId: string) => {
        const platform = platformRef.current;
        if (!platform) return;

        try {
            setError(null);
            await platform.muteParticipant(sessionId);
        } catch (err: any) {
            setError(err);
        }
    }, []);

    /**
     * Remove participant (admin only)
     */
    const removeParticipant = useCallback(async (sessionId: string) => {
        const platform = platformRef.current;
        if (!platform) return;

        try {
            setError(null);
            await platform.removeParticipant(sessionId);
        } catch (err: any) {
            setError(err);
        }
    }, []);

    // Memoize participant arrays to prevent unnecessary re-renders (prevents Error 310)
    const participants = useMemo(() => {
        return Array.from(mediaState.participants.values());
    }, [mediaState.participants]);

    const localParticipant = useMemo(() => {
        return participants.find(p => p.isLocal) || null;
    }, [participants]);

    const remoteParticipants = useMemo(() => {
        return participants.filter(p => !p.isLocal);
    }, [participants]);

    return {
        // State
        isJoined,
        isJoining,
        isAudioEnabled: mediaState.isAudioEnabled,
        isVideoEnabled: mediaState.isVideoEnabled,
        isScreenSharing: mediaState.isScreenSharing,
        participants,
        localParticipant,
        remoteParticipants,
        error,

        // Actions
        join,
        leave,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        sendChatMessage,
        muteParticipant,
        removeParticipant,

        // Config
        config: videoConfig,
    };
}

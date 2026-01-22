/**
 * MEDIA STATE LAYER
 *
 * Responsibilities:
 * - Camera state (on/off)
 * - Microphone state (on/off)
 * - Participant streams
 * - Audio/video availability
 * - Screen share state
 *
 * Constraints:
 * - Single source of truth
 * - Prevents UI desync
 * - Guarantees audio/video correctness
 * - NO UI knowledge
 * - NO Direct Daily API calls (uses VideoEngine)
 */

import { VideoEngine } from './VideoEngine';
import { DailyParticipant } from '@daily-co/daily-js';
import { unstable_batchedUpdates } from 'react-dom';

export interface MediaState {
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    isScreenSharing: boolean;
    participants: Map<string, ParticipantMediaState>;
    localSessionId: string | null;
}

export interface ParticipantMediaState {
    sessionId: string;
    userName: string;
    isLocal: boolean;
    audio: {
        enabled: boolean;
        track: MediaStreamTrack | null;
    };
    video: {
        enabled: boolean;
        track: MediaStreamTrack | null;
    };
    screen: {
        enabled: boolean;
        track: MediaStreamTrack | null;
    };
}

export type MediaStateChangeListener = (state: MediaState) => void;

/**
 * Media State Manager
 * Centralizes all media state and ensures consistency
 */
export class MediaStateManager {
    private engine: VideoEngine;
    private state: MediaState;
    private listeners = new Set<MediaStateChangeListener>();
    private syncTimeout: NodeJS.Timeout | null = null;
    private lastParticipantHash: string = '';

    constructor(engine: VideoEngine) {
        this.engine = engine;
        this.state = {
            isAudioEnabled: true,
            isVideoEnabled: true,
            isScreenSharing: false,
            participants: new Map(),
            localSessionId: null,
        };

        this.setupEngineListeners();
    }

    /**
     * Get current media state (immutable)
     * Returns a shallow copy - the Map reference itself is what React tracks
     */
    getState(): Readonly<MediaState> {
        return {
            isAudioEnabled: this.state.isAudioEnabled,
            isVideoEnabled: this.state.isVideoEnabled,
            isScreenSharing: this.state.isScreenSharing,
            participants: this.state.participants, // Map reference (replaced on changes)
            localSessionId: this.state.localSessionId,
        };
    }

    /**
     * Toggle local audio
     */
    async toggleAudio(): Promise<void> {
        const newState = !this.state.isAudioEnabled;
        await this.engine.setLocalAudio(newState);
        this.state.isAudioEnabled = newState;
        this.notifyListeners();
    }

    /**
     * Toggle local video
     */
    async toggleVideo(): Promise<void> {
        const newState = !this.state.isVideoEnabled;
        await this.engine.setLocalVideo(newState);
        this.state.isVideoEnabled = newState;
        this.notifyListeners();
    }

    /**
     * Toggle screen share
     */
    async toggleScreenShare(): Promise<void> {
        if (this.state.isScreenSharing) {
            await this.engine.stopScreenShare();
            this.state.isScreenSharing = false;
        } else {
            await this.engine.startScreenShare();
            this.state.isScreenSharing = true;
        }
        this.notifyListeners();
    }

    /**
     * Get participant by session ID
     */
    getParticipant(sessionId: string): ParticipantMediaState | null {
        return this.state.participants.get(sessionId) || null;
    }

    /**
     * Get all participants as array
     */
    getAllParticipants(): ParticipantMediaState[] {
        return Array.from(this.state.participants.values());
    }

    /**
     * Get local participant
     */
    getLocalParticipant(): ParticipantMediaState | null {
        if (!this.state.localSessionId) {
            return null;
        }
        return this.getParticipant(this.state.localSessionId);
    }

    /**
     * Get remote participants
     */
    getRemoteParticipants(): ParticipantMediaState[] {
        return this.getAllParticipants().filter(p => !p.isLocal);
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: MediaStateChangeListener): () => void {
        this.listeners.add(listener);
        // Return unsubscribe function
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Clean up
     */
    destroy(): void {
        // Clear pending sync timeout
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
            this.syncTimeout = null;
        }
        this.listeners.clear();
        this.state.participants.clear();
    }

    /**
     * Setup listeners for engine events
     */
    private setupEngineListeners(): void {
        // When joined, update local session ID
        this.engine.on('joined-meeting', () => {
            this.state.localSessionId = this.engine.getLocalSessionId();
            this.syncParticipants();
            this.notifyListeners();
        });

        // When participant joins
        this.engine.on('participant-joined', () => {
            this.syncParticipants();
            this.notifyListeners();
        });

        // When participant leaves
        this.engine.on('participant-left', (event: any) => {
            if (event?.participant?.session_id) {
                this.state.participants.delete(event.participant.session_id);
                this.notifyListeners();
            }
        });

        // When participant updates (audio/video change)
        this.engine.on('participant-updated', () => {
            this.syncParticipants();
            this.notifyListeners();
        });

        // When track starts
        this.engine.on('track-started', () => {
            this.syncParticipants();
            this.notifyListeners();
        });

        // When track stops
        this.engine.on('track-stopped', () => {
            this.syncParticipants();
            this.notifyListeners();
        });
    }

    /**
     * Sync participants from engine
     * CRITICAL: Ensures ALL participants are tracked and visible
     * Now with debouncing to prevent rapid re-renders (Error 310 protection)
     */
    private syncParticipants(): void {
        // Clear existing timeout to debounce rapid events
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }

        // Debounce sync by 100ms to batch rapid events
        this.syncTimeout = setTimeout(() => {
            this.performSync();
            this.syncTimeout = null;
        }, 100);
    }

    /**
     * Perform the actual participant sync
     * Separated from syncParticipants for debouncing
     */
    private performSync(): void {
        const engineParticipants = this.engine.getParticipants() as Record<string, DailyParticipant>;
        const localSessionId = this.engine.getLocalSessionId();

        // Calculate hash of participant state to detect meaningful changes
        const participantHash = this.calculateParticipantHash(engineParticipants);

        // Skip sync if nothing actually changed
        if (participantHash === this.lastParticipantHash) {
            return;
        }

        this.lastParticipantHash = participantHash;

        // DEBUG: Log what we're getting from the engine
        console.log('🔄 SYNCING PARTICIPANTS:', {
            localSessionId,
            engineParticipantCount: Object.keys(engineParticipants).length,
            engineParticipants: Object.keys(engineParticipants).map((key: any) => ({
                key,
                sessionId: engineParticipants[key].session_id,
                userName: engineParticipants[key].user_name,
                hasAudio: !!engineParticipants[key].tracks?.audio,
                hasVideo: !!engineParticipants[key].tracks?.video
            }))
        });

        // Create NEW Map instead of mutating (fixes React Error 310)
        // This allows React's useMemo to properly detect changes
        this.state.participants = new Map();

        Object.values(engineParticipants).forEach((p: DailyParticipant) => {
            if (!p.session_id) {
                console.warn('⚠️ Skipping participant without session_id:', p);
                return;
            }

            const isLocal = p.session_id === localSessionId;

            const participantState = {
                sessionId: p.session_id,
                userName: p.user_name || 'Guest',
                isLocal,
                audio: {
                    enabled: p.audio !== false, // true when audio is ON
                    track: p.tracks?.audio?.track || null,
                },
                video: {
                    enabled: p.video !== false, // true when video is ON
                    track: p.tracks?.video?.track || null,
                },
                screen: {
                    enabled: !!p.screen,
                    track: p.tracks?.screenVideo?.track || null,
                },
            };

            this.state.participants.set(p.session_id, participantState);

            console.log('✅ Added participant:', {
                sessionId: p.session_id,
                userName: p.user_name,
                isLocal,
                hasVideo: !!p.tracks?.video?.track,
                hasAudio: !!p.tracks?.audio?.track
            });
        });

        console.log('📊 SYNC COMPLETE:', {
            totalParticipants: this.state.participants.size,
            local: this.getLocalParticipant() ? 1 : 0,
            remote: this.getRemoteParticipants().length
        });
    }

    /**
     * Calculate hash of participant state to detect changes
     * Used to prevent unnecessary syncs when nothing changed
     */
    private calculateParticipantHash(participants: Record<string, DailyParticipant>): string {
        const keys = Object.keys(participants).sort();
        const hashParts = keys.map((key: any) => {
            const p = participants[key];
            if (!p) return '';
            return `${p.session_id}:${p.user_name}:${p.audio}:${p.video}:${p.screen}:${!!p.tracks?.audio}:${!!p.tracks?.video}`;
        }).filter(Boolean);
        return hashParts.join('|');
    }

    /**
     * Notify all listeners of state change
     * Uses batched updates to prevent multiple re-renders (Error 310 protection)
     */
    private notifyListeners(): void {
        const state = this.getState();
        // Batch all listener updates into a single React render cycle
        unstable_batchedUpdates(() => {
            this.listeners.forEach(listener => {
                try {
                    listener(state);
                } catch (error) {
                    console.error('Error in media state listener:', error);
                }
            });
        });
    }
}

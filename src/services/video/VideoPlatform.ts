/**
 * VIDEO PLATFORM - Main Orchestrator
 *
 * This is the primary interface for the video platform.
 * It coordinates all layers and provides a clean API.
 *
 * Architecture:
 * - VideoEngine (Daily wrapper)
 * - MediaStateManager (State management)
 * - ErrorHandler (Error handling)
 * - VideoConfiguration (Customization)
 */

import { VideoEngine, VideoEngineConfig } from './VideoEngine';
import { MediaStateManager, MediaState } from './MediaStateManager';
import { ErrorHandler, NormalizedError } from './ErrorHandler';
import { VideoConfiguration } from './VideoConfiguration';

export interface VideoPlatformConfig extends VideoEngineConfig {
    // Additional platform config
}

export type VideoPlatformState =
    | 'idle'
    | 'joining'
    | 'joined'
    | 'leaving'
    | 'error';

/**
 * Video Platform
 * Main entry point for video functionality
 */
export class VideoPlatform {
    private engine: VideoEngine;
    private mediaState: MediaStateManager;
    private errorHandler: ErrorHandler;
    private config: VideoConfiguration;
    private state: VideoPlatformState = 'idle';
    private currentRoomUrl: string | null = null; // Track current room

    constructor(config: VideoConfiguration) {
        this.engine = new VideoEngine();
        this.mediaState = new MediaStateManager(this.engine);
        this.errorHandler = new ErrorHandler();
        this.config = config;
    }

    /**
     * Initialize the platform
     */
    async initialize(): Promise<void> {
        try {
            await this.engine.initialize();
        } catch (error) {
            const normalized = this.errorHandler.handle(error, { action: 'initialize' });
            throw normalized;
        }
    }

    /**
     * Start camera immediately (pre-join)
     */
    async startCamera(): Promise<void> {
        try {
            await this.engine.startCamera();
        } catch (error) {
            const normalized = this.errorHandler.handle(error, { action: 'startCamera' });
            throw normalized;
        }
    }

    /**
     * Join a video call
     */
    async join(config: VideoPlatformConfig): Promise<void> {
        // If already joined to the SAME room, skip
        if (this.state === 'joined' && this.currentRoomUrl === config.url) {
            console.log('VideoPlatform: Already joined to this room, skipping');
            return;
        }

        // If already joined to a DIFFERENT room, leave first
        if (this.state === 'joined' && this.currentRoomUrl !== config.url) {
            console.log('VideoPlatform: Joining different room, leaving current room first...');
            await this.leave();
            // Wait a bit for cleanup
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // If in joining state, throw error to prevent concurrent joins
        if (this.state === 'joining') {
            throw new Error(`Cannot join from state: ${this.state}`);
        }

        // If in error state, reset to idle to allow retry
        if (this.state === 'error') {
            console.log('VideoPlatform: Recovering from error state, resetting to idle');
            this.state = 'idle';
            this.currentRoomUrl = null;
        }

        // If in leaving state, wait for leave to complete
        if (this.state === 'leaving') {
            console.log('VideoPlatform: Currently leaving, waiting...');
            // Wait a bit for leave to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            if ((this.state as VideoPlatformState) !== 'idle') {
                throw new Error('Failed to leave previous call');
            }
        }

        try {
            this.state = 'joining';
            await this.engine.join(config);
            this.state = 'joined';
            this.currentRoomUrl = config.url; // Store current room URL
        } catch (error) {
            this.state = 'error';
            this.currentRoomUrl = null;
            const normalized = this.errorHandler.handle(error, { action: 'join', config });
            throw normalized;
        }
    }

    /**
     * Leave the video call
     */
    async leave(): Promise<void> {
        if (this.state !== 'joined') {
            return;
        }

        try {
            this.state = 'leaving';
            await this.engine.leave();
            this.state = 'idle';
            this.currentRoomUrl = null; // Clear room URL on leave
        } catch (error) {
            this.state = 'error';
            this.currentRoomUrl = null; // Clear room URL on error
            const normalized = this.errorHandler.handle(error, { action: 'leave' });
            console.error('Error leaving call:', normalized);
        }
    }

    /**
     * Destroy the platform
     */
    async destroy(): Promise<void> {
        try {
            await this.engine.destroy();
            this.mediaState.destroy();
            this.state = 'idle';
            this.currentRoomUrl = null; // Clear room URL
        } catch (error) {
            console.error('Error destroying platform:', error);
        }
    }

    /**
     * Toggle audio
     */
    async toggleAudio(): Promise<void> {
        try {
            await this.mediaState.toggleAudio();
        } catch (error) {
            const normalized = this.errorHandler.handle(error, { action: 'toggleAudio' });
            throw normalized;
        }
    }

    /**
     * Toggle video
     */
    async toggleVideo(): Promise<void> {
        try {
            await this.mediaState.toggleVideo();
        } catch (error) {
            const normalized = this.errorHandler.handle(error, { action: 'toggleVideo' });
            throw normalized;
        }
    }

    /**
     * Toggle screen share
     */
    async toggleScreenShare(): Promise<void> {
        try {
            await this.mediaState.toggleScreenShare();
        } catch (error) {
            const normalized = this.errorHandler.handle(error, { action: 'toggleScreenShare' });
            throw normalized;
        }
    }

    /**
     * Send chat message to all participants
     */
    async sendChatMessage(message: string): Promise<void> {
        try {
            await this.engine.sendChatMessage(message);
        } catch (error) {
            const normalized = this.errorHandler.handle(error, { action: 'sendChatMessage' });
            throw normalized;
        }
    }

    /**
     * Mute participant (admin only)
     */
    async muteParticipant(sessionId: string): Promise<void> {
        try {
            await this.engine.muteParticipant(sessionId);
        } catch (error) {
            const normalized = this.errorHandler.handle(error, { action: 'muteParticipant' });
            throw normalized;
        }
    }

    /**
     * Remove participant (admin only)
     */
    async removeParticipant(sessionId: string): Promise<void> {
        try {
            await this.engine.removeParticipant(sessionId);
        } catch (error) {
            const normalized = this.errorHandler.handle(error, { action: 'removeParticipant' });
            throw normalized;
        }
    }

    /**
     * Get media state
     */
    getMediaState(): Readonly<MediaState> {
        return this.mediaState.getState();
    }

    /**
     * Subscribe to media state changes
     */
    subscribeToMediaState(listener: (state: MediaState) => void): () => void {
        return this.mediaState.subscribe(listener);
    }

    /**
     * Get configuration
     */
    getConfiguration(): VideoConfiguration {
        return this.config;
    }

    /**
     * Get platform state
     */
    getState(): VideoPlatformState {
        return this.state;
    }

    /**
     * Get error handler
     */
    getErrorHandler(): ErrorHandler {
        return this.errorHandler;
    }

    /**
     * Get engine (for advanced use cases)
     */
    getEngine(): VideoEngine {
        return this.engine;
    }
}

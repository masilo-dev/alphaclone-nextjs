/**
 * CORE VIDEO ENGINE LAYER
 *
 * Responsibilities:
 * - Daily call object lifecycle
 * - Join/leave operations
 * - Device management
 * - Network state
 * - Media constraints
 *
 * Constraints:
 * - NO UI knowledge
 * - NO state management
 * - Only exposes clean, stable interface
 * - Fully defensive against failures
 */

import Daily, { DailyCall, DailyEvent, DailyEventObjectParticipant } from '@daily-co/daily-js';

export interface VideoEngineConfig {
    url: string;
    userName: string;
    token?: string;
}

export interface DeviceInfo {
    camera: MediaDeviceInfo | null;
    microphone: MediaDeviceInfo | null;
    speaker: MediaDeviceInfo | null;
}

export type VideoEngineState =
    | 'idle'
    | 'initializing'
    | 'joining'
    | 'joined'
    | 'leaving'
    | 'left'
    | 'error';

export interface VideoEngineError {
    code: string;
    message: string;
    recoverable: boolean;
}

/**
 * Core Video Engine
 * Wraps Daily.co as a low-level transport layer
 */
export class VideoEngine {
    private callObject: DailyCall | null = null;
    private state: VideoEngineState = 'idle';
    private eventListeners = new Map<string, Set<Function>>();

    /**
     * Initialize the video engine
     */
    async initialize(): Promise<void> {
        // If already initialized and in good state, skip
        if (this.callObject && this.state === 'idle') {
            console.log('VideoEngine already initialized, skipping...');
            return;
        }

        // Prevent concurrent initialization (React Strict Mode protection)
        if (this.state === 'initializing') {
            console.log('VideoEngine initialization already in progress, skipping...');
            return;
        }

        // If already initialized but in error state, destroy and reinitialize
        if (this.callObject) {
            console.warn('VideoEngine in bad state, cleaning up first...');
            await this.destroy();
            // Wait a bit for cleanup to complete
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        try {
            this.state = 'initializing';

            // Check for any existing Daily instances globally and destroy them
            try {
                const existingInstances = Daily.getCallInstance();
                if (existingInstances) {
                    console.warn('Found existing Daily instance, destroying...');
                    await existingInstances.destroy();
                    await new Promise(resolve => setTimeout(resolve, 200));
                    console.log('Existing Daily instance destroyed');
                }
            } catch (err) {
                console.warn('Error checking for existing Daily instance:', err);
            }

            console.log('Creating new Daily call object...');
            this.callObject = Daily.createCallObject();
            console.log('Daily call object created successfully');
            this.setupEventForwarding();
            this.state = 'idle';
        } catch (error) {
            this.state = 'error';
            console.error('Error in VideoEngine.initialize:', error);
            throw this.normalizeError(error);
        }
    }

    /**
     * Join a video call
     */
    async join(config: VideoEngineConfig): Promise<void> {
        if (!this.callObject) {
            throw new Error('VideoEngine not initialized');
        }

        if (this.state !== 'idle') {
            throw new Error(`Cannot join from state: ${this.state}`);
        }

        try {
            this.state = 'joining';

            // Build join config with explicit media settings
            const joinConfig: any = {
                url: config.url,
                userName: config.userName,
                // Explicitly start with audio and video enabled
                startVideoOff: false,
                startAudioOff: false,
            };

            if (config.token) {
                joinConfig.token = config.token;
            }

            await this.callObject.join(joinConfig);

            // Enable camera and microphone by default after joining
            // This ensures user can see/hear themselves immediately
            await this.callObject.setLocalAudio(true);
            await this.callObject.setLocalVideo(true);

            this.state = 'joined';
        } catch (error) {
            this.state = 'error';
            throw this.normalizeError(error);
        }
    }

    /**
     * Leave the video call
     */
    async leave(): Promise<void> {
        if (!this.callObject) {
            return;
        }

        if (this.state !== 'joined') {
            return;
        }

        try {
            this.state = 'leaving';
            await this.callObject.leave();
            this.state = 'left';
        } catch (error) {
            this.state = 'error';
            throw this.normalizeError(error);
        }
    }

    /**
     * Destroy the video engine
     */
    async destroy(): Promise<void> {
        if (!this.callObject) {
            return;
        }

        try {
            await this.callObject.destroy();
            this.callObject = null;
            this.state = 'idle';
            this.eventListeners.clear();
        } catch (error) {
            console.error('Error destroying video engine:', error);
        }
    }

    /**
     * Set local audio state
     */
    async setLocalAudio(enabled: boolean): Promise<void> {
        if (!this.callObject || this.state !== 'joined') {
            throw new Error('Cannot set audio: not in call');
        }

        try {
            await this.callObject.setLocalAudio(enabled);
        } catch (error) {
            throw this.normalizeError(error);
        }
    }

    /**
     * Set local video state
     */
    async setLocalVideo(enabled: boolean): Promise<void> {
        if (!this.callObject || this.state !== 'joined') {
            throw new Error('Cannot set video: not in call');
        }

        try {
            await this.callObject.setLocalVideo(enabled);
        } catch (error) {
            throw this.normalizeError(error);
        }
    }

    /**
     * Start screen share
     * IMPROVED: Mobile detection + Better error messages
     */
    async startScreenShare(): Promise<void> {
        if (!this.callObject || this.state !== 'joined') {
            throw new Error('Cannot share screen: not in call');
        }

        // Detect mobile devices
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Check if screen share is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            if (isMobile) {
                throw new Error('Screen sharing is not supported on mobile devices. Please use a desktop browser.');
            } else {
                throw new Error('Screen sharing is not supported in this browser. Please use Chrome, Firefox, or Edge.');
            }
        }

        try {
            await this.callObject.startScreenShare();
        } catch (error: any) {
            // Handle specific error cases with user-friendly messages
            if (error?.errorMsg === 'User cancelled screen share prompt') {
                throw new Error('Screen sharing was cancelled. Click the screen share button to try again.');
            } else if (error?.errorMsg?.includes('Permission denied')) {
                throw new Error('Screen sharing permission was denied. Please allow screen sharing in your browser settings.');
            } else if (error?.errorMsg?.includes('NotAllowedError')) {
                throw new Error('Permission denied. Please allow screen sharing when prompted.');
            } else if (error?.errorMsg?.includes('NotSupportedError')) {
                throw new Error('Screen sharing is not supported on this device.');
            } else if (error?.errorMsg?.includes('NotFoundError')) {
                throw new Error('No screen available to share. Please check your display settings.');
            } else {
                throw new Error(`Screen sharing failed: ${error?.errorMsg || error?.message || 'Unknown error'}`);
            }
        }
    }

    /**
     * Stop screen share
     */
    async stopScreenShare(): Promise<void> {
        if (!this.callObject || this.state !== 'joined') {
            return;
        }

        try {
            await this.callObject.stopScreenShare();
        } catch (error) {
            throw this.normalizeError(error);
        }
    }

    /**
     * ADMIN CONTROLS - Mute a participant (server-authoritative)
     */
    async muteParticipant(sessionId: string): Promise<void> {
        if (!this.callObject || this.state !== 'joined') {
            throw new Error('Cannot mute participant: not in call');
        }

        try {
            await this.callObject.updateParticipant(sessionId, {
                setAudio: false
            });
        } catch (error) {
            throw new Error(`Failed to mute participant: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * ADMIN CONTROLS - Unmute a participant
     */
    async unmuteParticipant(sessionId: string): Promise<void> {
        if (!this.callObject || this.state !== 'joined') {
            throw new Error('Cannot unmute participant: not in call');
        }

        try {
            await this.callObject.updateParticipant(sessionId, {
                setAudio: true
            });
        } catch (error) {
            throw new Error(`Failed to unmute participant: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * ADMIN CONTROLS - Disable participant's camera
     */
    async disableParticipantCamera(sessionId: string): Promise<void> {
        if (!this.callObject || this.state !== 'joined') {
            throw new Error('Cannot disable camera: not in call');
        }

        try {
            await this.callObject.updateParticipant(sessionId, {
                setVideo: false
            });
        } catch (error) {
            throw new Error(`Failed to disable camera: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * ADMIN CONTROLS - Enable participant's camera
     */
    async enableParticipantCamera(sessionId: string): Promise<void> {
        if (!this.callObject || this.state !== 'joined') {
            throw new Error('Cannot enable camera: not in call');
        }

        try {
            await this.callObject.updateParticipant(sessionId, {
                setVideo: true
            });
        } catch (error) {
            throw new Error(`Failed to enable camera: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * ADMIN CONTROLS - Remove a participant from the call
     */
    async removeParticipant(sessionId: string): Promise<void> {
        if (!this.callObject || this.state !== 'joined') {
            throw new Error('Cannot remove participant: not in call');
        }

        try {
            await this.callObject.updateParticipant(sessionId, {
                eject: true
            });
        } catch (error) {
            throw new Error(`Failed to remove participant: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * ADMIN CONTROLS - Lock/unlock the room
     */
    async setRoomLocked(locked: boolean): Promise<void> {
        if (!this.callObject || this.state !== 'joined') {
            throw new Error('Cannot lock room: not in call');
        }

        try {
            // Note: Daily.co uses "enable_knocking" to lock rooms
            // When enabled, new participants must be admitted by the owner
            await this.callObject.updateRoomConfig({
                enable_knocking: locked
            });
        } catch (error) {
            throw new Error(`Failed to ${locked ? 'lock' : 'unlock'} room: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * ADMIN CONTROLS - Send chat message to all or specific participant
     */
    async sendChatMessage(message: string, toSessionId?: string): Promise<void> {
        if (!this.callObject || this.state !== 'joined') {
            throw new Error('Cannot send message: not in call');
        }

        try {
            const participants = this.callObject.participants();
            const senderName = participants.local?.user_name || 'Anonymous';

            await this.callObject.sendAppMessage({
                type: 'chat',
                message: message,
                sender: senderName,
                senderSessionId: participants.local?.session_id,
                timestamp: Date.now()
            }, toSessionId || '*'); // '*' broadcasts to all
        } catch (error) {
            throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get available devices
     */
    async getDevices(): Promise<DeviceInfo> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return {
                camera: devices.find(d => d.kind === 'videoinput') || null,
                microphone: devices.find(d => d.kind === 'audioinput') || null,
                speaker: devices.find(d => d.kind === 'audiooutput') || null,
            };
        } catch (error) {
            throw this.normalizeError(error);
        }
    }

    /**
     * Get participants
     */
    getParticipants() {
        if (!this.callObject) {
            return {};
        }
        return this.callObject.participants();
    }

    /**
     * Get local session ID
     */
    getLocalSessionId(): string | null {
        if (!this.callObject) {
            return null;
        }
        const participants = this.callObject.participants();
        return participants.local?.session_id || null;
    }

    /**
     * Get current state
     */
    getState(): VideoEngineState {
        return this.state;
    }

    /**
     * Get Daily call object (for advanced use cases only)
     */
    getCallObject(): DailyCall | null {
        return this.callObject;
    }

    /**
     * Register event listener
     */
    on(event: string, handler: Function): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)!.add(handler);
    }

    /**
     * Unregister event listener
     */
    off(event: string, handler: Function): void {
        const handlers = this.eventListeners.get(event);
        if (handlers) {
            handlers.delete(handler);
        }
    }

    /**
     * Setup event forwarding from Daily to our listeners
     */
    private setupEventForwarding(): void {
        if (!this.callObject) return;

        // Forward all Daily events to our listeners
        const events = [
            'joined-meeting',
            'left-meeting',
            'participant-joined',
            'participant-left',
            'participant-updated',
            'error',
            'track-started',
            'track-stopped',
            'recording-started',
            'recording-stopped',
            'app-message',
        ];

        events.forEach(event => {
            this.callObject!.on(event as DailyEvent, (data?: any) => {
                this.emit(event, data);
            });
        });
    }

    /**
     * Emit event to all listeners
     */
    private emit(event: string, data?: any): void {
        const handlers = this.eventListeners.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Normalize errors from Daily into consistent format
     */
    private normalizeError(error: any): VideoEngineError {
        const message = error?.errorMsg || error?.message || 'Unknown error';
        const code = error?.error || 'UNKNOWN_ERROR';

        // Determine if error is recoverable
        const recoverable = [
            'network-error',
            'connection-error',
            'timeout',
        ].includes(code);

        return {
            code,
            message,
            recoverable,
        };
    }
}

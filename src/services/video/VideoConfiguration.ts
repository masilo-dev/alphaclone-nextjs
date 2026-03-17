/**
 * CONFIGURATION & CUSTOMIZATION LAYER
 *
 * Responsibilities:
 * - Brand colors
 * - Layout rules
 * - Feature flags
 * - Behavior toggles
 *
 * Constraints:
 * - Declarative, not imperative
 * - Allows future customization without touching core logic
 * - Easy to override per-deployment
 */

export interface VideoUIConfig {
    // Branding
    branding: {
        primaryColor: string;
        accentColor: string;
        backgroundColor: string;
        textColor: string;
        logoUrl?: string;
    };

    // Layout
    layout: {
        maxParticipantsPerRow: number;
        aspectRatio: '16:9' | '4:3' | '1:1';
        showParticipantNames: boolean;
        showConnectionQuality: boolean;
    };

    // Features
    features: {
        screenShare: boolean;
        recording: boolean;
        chat: boolean;
        reactions: boolean;
        virtualBackground: boolean;
        noiseCancellation: boolean;
    };

    // Behavior
    behavior: {
        autoJoinAudio: boolean;
        autoJoinVideo: boolean;
        showPrejoinScreen: boolean;
        allowGuestJoin: boolean;
        maxParticipants: number;
    };

    // Controls
    controls: {
        showMuteButton: boolean;
        showVideoButton: boolean;
        showScreenShareButton: boolean;
        showLeaveButton: boolean;
        showSettingsButton: boolean;
        showParticipantsButton: boolean;
        showCopyLinkButton: boolean;
    };
}

/**
 * Default video configuration
 * Matches AlphaClone branding
 */
export const DEFAULT_VIDEO_CONFIG: VideoUIConfig = {
    branding: {
        primaryColor: '#14b8a6', // Teal-500
        accentColor: '#3b82f6',  // Blue-500
        backgroundColor: '#111827', // Gray-900
        textColor: '#ffffff',
    },

    layout: {
        maxParticipantsPerRow: 4,
        aspectRatio: '16:9',
        showParticipantNames: true,
        showConnectionQuality: false,
    },

    features: {
        screenShare: true,
        recording: false, // Disabled by default, enable when ready
        chat: true,
        reactions: false,
        virtualBackground: false,
        noiseCancellation: false,
    },

    behavior: {
        autoJoinAudio: true,
        autoJoinVideo: true,
        showPrejoinScreen: false,
        allowGuestJoin: true,
        maxParticipants: 10,
    },

    controls: {
        showMuteButton: true,
        showVideoButton: true,
        showScreenShareButton: true,
        showLeaveButton: true,
        showSettingsButton: false,
        showParticipantsButton: true,
        showCopyLinkButton: true,
    },
};

/**
 * Video Configuration Manager
 */
export class VideoConfiguration {
    private config: VideoUIConfig;

    constructor(customConfig?: Partial<VideoUIConfig>) {
        this.config = this.mergeConfig(DEFAULT_VIDEO_CONFIG, customConfig);
    }

    /**
     * Get full configuration
     */
    getConfig(): Readonly<VideoUIConfig> {
        return { ...this.config };
    }

    /**
     * Get branding config
     */
    getBranding() {
        return { ...this.config.branding };
    }

    /**
     * Get layout config
     */
    getLayout() {
        return { ...this.config.layout };
    }

    /**
     * Get features config
     */
    getFeatures() {
        return { ...this.config.features };
    }

    /**
     * Get behavior config
     */
    getBehavior() {
        return { ...this.config.behavior };
    }

    /**
     * Get controls config
     */
    getControls() {
        return { ...this.config.controls };
    }

    /**
     * Check if feature is enabled
     */
    isFeatureEnabled(feature: keyof VideoUIConfig['features']): boolean {
        return this.config.features[feature];
    }

    /**
     * Check if control is visible
     */
    isControlVisible(control: keyof VideoUIConfig['controls']): boolean {
        return this.config.controls[control];
    }

    /**
     * Update configuration
     */
    updateConfig(updates: Partial<VideoUIConfig>): void {
        this.config = this.mergeConfig(this.config, updates);
    }

    /**
     * Deep merge configurations
     */
    private mergeConfig(base: VideoUIConfig, updates?: Partial<VideoUIConfig>): VideoUIConfig {
        if (!updates) return base;

        return {
            branding: { ...base.branding, ...updates.branding },
            layout: { ...base.layout, ...updates.layout },
            features: { ...base.features, ...updates.features },
            behavior: { ...base.behavior, ...updates.behavior },
            controls: { ...base.controls, ...updates.controls },
        };
    }
}

// Global configuration instance
export const videoConfig = new VideoConfiguration();

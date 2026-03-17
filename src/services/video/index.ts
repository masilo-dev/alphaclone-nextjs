/**
 * VIDEO PLATFORM - Entry Point
 *
 * Clean, layered architecture for video conferencing
 * Built on Daily.co infrastructure
 */

// Core Engine Layer
export { VideoEngine } from './VideoEngine';
export type {
    VideoEngineConfig,
    VideoEngineState,
    VideoEngineError,
    DeviceInfo,
} from './VideoEngine';

// Media State Layer
export { MediaStateManager } from './MediaStateManager';
export type {
    MediaState,
    ParticipantMediaState,
    MediaStateChangeListener,
} from './MediaStateManager';

// Configuration Layer
export { VideoConfiguration, videoConfig, DEFAULT_VIDEO_CONFIG } from './VideoConfiguration';
export type { VideoUIConfig } from './VideoConfiguration';

// Error & Resilience Layer
export { ErrorHandler, errorHandler } from './ErrorHandler';
export type {
    NormalizedError,
    RecoveryAction,
    ErrorSeverity,
    ErrorLog,
} from './ErrorHandler';

// Platform Orchestrator
export { VideoPlatform } from './VideoPlatform';
export type {
    VideoPlatformConfig,
    VideoPlatformState,
} from './VideoPlatform';

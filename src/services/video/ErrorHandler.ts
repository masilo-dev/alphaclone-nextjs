/**
 * ERROR & RESILIENCE LAYER
 *
 * Responsibilities:
 * - Error normalization
 * - Logging
 * - Recovery logic
 * - Crash prevention
 *
 * Constraints:
 * - Prevent crashes
 * - Prevent UI freezes
 * - Turn Daily errors into safe platform states
 * - Provide clear user-facing messages
 */

import { VideoEngineError } from './VideoEngine';

export interface NormalizedError {
    code: string;
    message: string;
    userMessage: string;
    recoverable: boolean;
    action?: RecoveryAction;
}

export type RecoveryAction =
    | 'retry'
    | 'rejoin'
    | 'refresh'
    | 'contact-support'
    | 'none';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'fatal';

export interface ErrorLog {
    timestamp: Date;
    severity: ErrorSeverity;
    code: string;
    message: string;
    stack?: string;
    context?: Record<string, any>;
}

/**
 * Error Handler
 * Normalizes errors and provides recovery strategies
 */
export class ErrorHandler {
    private errorLog: ErrorLog[] = [];
    private maxLogSize = 100;

    /**
     * Handle and normalize error
     */
    handle(error: any, context?: Record<string, any>): NormalizedError {
        const normalized = this.normalizeError(error);
        this.log({
            timestamp: new Date(),
            severity: this.getSeverity(normalized),
            code: normalized.code,
            message: normalized.message,
            stack: error?.stack,
            context,
        });

        return normalized;
    }

    /**
     * Normalize error into consistent format
     */
    private normalizeError(error: any): NormalizedError {
        // Handle VideoEngineError
        if (this.isVideoEngineError(error)) {
            return this.normalizeVideoEngineError(error);
        }

        // Handle Daily errors
        if (error?.error && error?.errorMsg) {
            return this.normalizeDailyError(error);
        }

        // Handle browser errors
        if (error instanceof DOMException) {
            return this.normalizeBrowserError(error);
        }

        // Handle generic errors
        return {
            code: 'UNKNOWN_ERROR',
            message: error?.message || 'An unknown error occurred',
            userMessage: 'Something went wrong. Please try again.',
            recoverable: true,
            action: 'retry',
        };
    }

    /**
     * Normalize VideoEngine error
     */
    private normalizeVideoEngineError(error: VideoEngineError): NormalizedError {
        const errorMap: Record<string, { userMessage: string; action: RecoveryAction }> = {
            'network-error': {
                userMessage: 'Network connection lost. Please check your internet.',
                action: 'retry',
            },
            'connection-error': {
                userMessage: 'Failed to connect to meeting. Please try again.',
                action: 'rejoin',
            },
            'timeout': {
                userMessage: 'Connection timed out. Please try again.',
                action: 'retry',
            },
            'permission-denied': {
                userMessage: 'Camera/microphone permission denied. Please allow access in browser settings.',
                action: 'none',
            },
        };

        const mapped = errorMap[error.code] || {
            userMessage: error.message,
            action: error.recoverable ? 'retry' : 'refresh',
        };

        return {
            code: error.code,
            message: error.message,
            userMessage: mapped.userMessage,
            recoverable: error.recoverable,
            action: mapped.action,
        };
    }

    /**
     * Normalize Daily error
     */
    private normalizeDailyError(error: any): NormalizedError {
        const errorMap: Record<string, string> = {
            'meeting-full': 'This meeting is full. Please try again later.',
            'meeting-ended': 'This meeting has ended.',
            'not-allowed': 'You are not allowed to join this meeting.',
            'cam-in-use': 'Your camera is being used by another application.',
            'mic-in-use': 'Your microphone is being used by another application.',
        };

        return {
            code: error.error,
            message: error.errorMsg,
            userMessage: errorMap[error.error] || error.errorMsg,
            recoverable: !['meeting-ended', 'not-allowed'].includes(error.error),
            action: this.getRecoveryAction(error.error),
        };
    }

    /**
     * Normalize browser error (permissions, etc.)
     */
    private normalizeBrowserError(error: DOMException): NormalizedError {
        const errorMap: Record<string, { userMessage: string; action: RecoveryAction }> = {
            'NotAllowedError': {
                userMessage: 'Permission denied. Please allow camera/microphone access.',
                action: 'none',
            },
            'NotFoundError': {
                userMessage: 'Camera or microphone not found. Please check your devices.',
                action: 'none',
            },
            'NotReadableError': {
                userMessage: 'Camera or microphone is already in use.',
                action: 'refresh',
            },
            'OverconstrainedError': {
                userMessage: 'Camera or microphone constraints cannot be satisfied.',
                action: 'retry',
            },
        };

        const mapped = errorMap[error.name] || {
            userMessage: error.message,
            action: 'retry',
        };

        return {
            code: error.name,
            message: error.message,
            userMessage: mapped.userMessage,
            recoverable: error.name !== 'NotAllowedError',
            action: mapped.action,
        };
    }

    /**
     * Get recovery action for error code
     */
    private getRecoveryAction(code: string): RecoveryAction {
        const actions: Record<string, RecoveryAction> = {
            'network-error': 'retry',
            'connection-error': 'rejoin',
            'timeout': 'retry',
            'meeting-full': 'retry',
            'meeting-ended': 'none',
            'not-allowed': 'contact-support',
        };

        return actions[code] || 'retry';
    }

    /**
     * Get error severity
     */
    private getSeverity(error: NormalizedError): ErrorSeverity {
        if (!error.recoverable) return 'fatal';
        if (error.code.includes('permission')) return 'warning';
        if (error.code.includes('network')) return 'error';
        return 'error';
    }

    /**
     * Check if error is VideoEngineError
     */
    private isVideoEngineError(error: any): error is VideoEngineError {
        return error && typeof error.code === 'string' && typeof error.recoverable === 'boolean';
    }

    /**
     * Log error
     */
    private log(entry: ErrorLog): void {
        this.errorLog.push(entry);

        // Trim log if too large
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(-this.maxLogSize);
        }

        // Console output based on severity
        const logFn = entry.severity === 'fatal' || entry.severity === 'error'
            ? console.error
            : entry.severity === 'warning'
                ? console.warn
                : console.info;

        logFn(`[VideoError] ${entry.code}: ${entry.message}`, entry.context);
    }

    /**
     * Get error log
     */
    getLog(): Readonly<ErrorLog[]> {
        return [...this.errorLog];
    }

    /**
     * Clear error log
     */
    clearLog(): void {
        this.errorLog = [];
    }

    /**
     * Get recent errors
     */
    getRecentErrors(count: number = 10): ErrorLog[] {
        return this.errorLog.slice(-count);
    }
}

// Global error handler instance
export const errorHandler = new ErrorHandler();

import { auditLoggingService } from './auditLoggingService';

export interface ConferenceFailure {
    type: 'connection' | 'api' | 'permission' | 'timeout';
    message: string;
    timestamp: Date;
    userId: string;
    meetingId?: string;
}

export interface FallbackOption {
    type: 'phone' | 'reschedule' | 'chat';
    available: boolean;
    details?: any;
}

class VideoConferenceService {
    private failureCount: number = 0;
    private lastFailure: Date | null = null;

    /**
     * Handle video conference failure with fallback options
     */
    async handleConferenceFailure(
        failure: ConferenceFailure
    ): Promise<{ fallbackOptions: FallbackOption[]; incident: any }> {
        this.failureCount++;
        this.lastFailure = new Date();

        // Log incident
        const incident = await this.logIncident(failure);

        // Generate fallback options
        const fallbackOptions = this.generateFallbackOptions(failure);

        // Notify admin of repeated failures
        if (this.failureCount >= 3) {
            await this.notifyAdminOfIssue(failure);
        }

        return { fallbackOptions, incident };
    }

    /**
     * Generate fallback communication options
     */
    private generateFallbackOptions(failure: ConferenceFailure): FallbackOption[] {
        const options: FallbackOption[] = [];

        // Phone bridge fallback
        options.push({
            type: 'phone',
            available: true,
            details: {
                dialIn: '+1-555-MEETING',
                accessCode: this.generateAccessCode(),
                instructions: 'Dial the number and enter the access code when prompted',
            },
        });

        // Reschedule option
        options.push({
            type: 'reschedule',
            available: true,
            details: {
                message: 'We apologize for the technical difficulty. Would you like to reschedule?',
                creditOffered: failure.type === 'api',
            },
        });

        // Chat fallback for quick questions
        options.push({
            type: 'chat',
            available: true,
            details: {
                message: 'Continue via text chat for quick questions',
            },
        });

        return options;
    }

    /**
     * Log conference failure incident
     */
    private async logIncident(failure: ConferenceFailure): Promise<any> {
        try {
            await auditLoggingService.logAction(
                'video_conference_failure',
                'meeting',
                failure.meetingId || 'unknown',
                undefined,
                {
                    type: failure.type,
                    message: failure.message,
                    userId: failure.userId,
                    failureCount: this.failureCount,
                }
            );

            return {
                id: `incident_${Date.now()}`,
                type: failure.type,
                timestamp: failure.timestamp,
                resolved: false,
            };
        } catch (error) {
            console.error('Error logging incident:', error);
            return null;
        }
    }

    /**
     * Notify admin of repeated failures
     */
    private async notifyAdminOfIssue(failure: ConferenceFailure): Promise<void> {
        console.warn(`Video conference system experiencing issues. Failure count: ${this.failureCount}`);

        // In production, send email/SMS to admin
        // await emailService.sendAlert({
        //   to: 'admin@alphaclone.com',
        //   subject: 'Video Conference System Alert',
        //   body: `Multiple video conference failures detected. Type: ${failure.type}, Count: ${this.failureCount}`
        // });
    }

    /**
     * Generate phone bridge access code
     */
    private generateAccessCode(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Test connection quality before meeting
     */
    async testConnectionQuality(): Promise<{
        quality: 'excellent' | 'good' | 'poor' | 'failed';
        latency: number;
        bandwidth: number;
        recommendation: string;
    }> {
        try {
            const startTime = Date.now();

            // Simple ping test
            await fetch('https://www.google.com/generate_204', { mode: 'no-cors' });

            const latency = Date.now() - startTime;

            let quality: 'excellent' | 'good' | 'poor' | 'failed';
            let recommendation: string;

            if (latency < 100) {
                quality = 'excellent';
                recommendation = 'Connection is excellent for video calls';
            } else if (latency < 200) {
                quality = 'good';
                recommendation = 'Connection is good for video calls';
            } else if (latency < 400) {
                quality = 'poor';
                recommendation = 'Consider using audio-only mode';
            } else {
                quality = 'failed';
                recommendation = 'Use phone bridge instead';
            }

            return {
                quality,
                latency,
                bandwidth: 0, // Would need more sophisticated test
                recommendation,
            };
        } catch (error) {
            return {
                quality: 'failed',
                latency: 9999,
                bandwidth: 0,
                recommendation: 'Connection test failed. Use phone bridge.',
            };
        }
    }

    /**
     * Switch to audio-only mode
     */
    async switchToAudioOnly(meetingId: string): Promise<{ success: boolean; message: string }> {
        try {
            // In production, this would call Daily.co API to disable video
            console.log(`Switching meeting ${meetingId} to audio-only mode`);

            await auditLoggingService.logAction(
                'switched_to_audio_only',
                'meeting',
                meetingId,
                { mode: 'video' },
                { mode: 'audio' }
            );

            return {
                success: true,
                message: 'Switched to audio-only mode to improve connection quality',
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to switch to audio-only mode',
            };
        }
    }

    /**
     * Send SMS with dial-in details
     */
    async sendDialInSMS(phoneNumber: string, accessCode: string): Promise<boolean> {
        try {
            // In production, integrate with Twilio or similar
            console.log(`Sending dial-in details to ${phoneNumber}: Code ${accessCode}`);

            const message = `AlphaClone Meeting - Dial: +1-555-MEETING, Code: ${accessCode}`;

            // Simulate SMS send
            await new Promise((resolve) => setTimeout(resolve, 100));

            return true;
        } catch (error) {
            console.error('Error sending SMS:', error);
            return false;
        }
    }

    /**
     * Get failure statistics
     */
    getFailureStats(): { count: number; lastFailure: Date | null } {
        return {
            count: this.failureCount,
            lastFailure: this.lastFailure,
        };
    }

    /**
     * Reset failure counter (call after successful meeting)
     */
    resetFailureCount(): void {
        this.failureCount = 0;
        this.lastFailure = null;
    }
}

export const videoConferenceService = new VideoConferenceService();

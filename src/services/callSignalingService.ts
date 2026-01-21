import { supabase } from '../lib/supabase';

export type CallSignalType = 'incoming' | 'accepted' | 'rejected' | 'ended' | 'busy';

export interface CallSignal {
    type: CallSignalType;
    callId: string;
    callerId: string;
    callerName: string;
    recipientId: string;
    roomId?: string; // Daily room URL (only present in 'accepted')
    timestamp: number;
}

class CallSignalingService {
    /**
     * Send a "Call" signal to a recipient
     */
    async initiateCall(recipientId: string, callerId: string, callerName: string): Promise<string> {
        const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await this.sendSignal({
            type: 'incoming',
            callId,
            callerId,
            callerName,
            recipientId,
            timestamp: Date.now()
        });

        return callId;
    }

    /**
     * Accept an incoming call
     */
    async acceptCall(signal: CallSignal, roomUrl: string): Promise<void> {
        await this.sendSignal({
            type: 'accepted',
            callId: signal.callId,
            callerId: signal.recipientId, // Current user is now the "sender" of the acceptance
            callerName: '', // Not needed for acceptance
            recipientId: signal.callerId, // Send back to original caller
            roomId: roomUrl,
            timestamp: Date.now()
        });
    }

    /**
     * Reject an incoming call
     */
    async rejectCall(signal: CallSignal, reason: 'rejected' | 'busy' = 'rejected'): Promise<void> {
        await this.sendSignal({
            type: reason,
            callId: signal.callId,
            callerId: signal.recipientId,
            callerName: '',
            recipientId: signal.callerId,
            timestamp: Date.now()
        });
    }

    /**
     * Subscribe to signals for the current user
     */
    subscribeToSignals(userId: string, onSignal: (signal: CallSignal) => void): () => void {
        const channel = supabase.channel(`calls:${userId}`);

        channel
            .on(
                'broadcast',
                { event: 'signal' },
                (payload: any) => {
                    // Check if this signal is meant for us (double check, though channel name should ensure it)
                    if (payload.payload.recipientId === userId) {
                        onSignal(payload.payload as CallSignal);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }

    /**
     * Internal helper to broadcast a signal
     */
    private async sendSignal(signal: CallSignal): Promise<void> {
        // We broadcast to the RECIPIENT's channel
        const channel = supabase.channel(`calls:${signal.recipientId}`);

        // Ensure channel is subscribed before sending (limitation of some realtime setups, 
        // though typically broadcast works if just targeting the channel name. 
        // For simplicity in this 'fire and forget' model, we assume generic channel access).
        // A more robust way is to use a shared 'signaling' channel or rely on presence.
        // Here we try to send to their specific channel.

        await channel.subscribe(async (status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR') => {
            if (status === 'SUBSCRIBED') {
                await channel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: signal
                });
                // Clean up channel reference after sending? 
                // Keeping it might be better if we expect frequent calls.
                // For now, we leave it open or let Supabase handle cleanup.
                supabase.removeChannel(channel);
            }
        });
    }
}

export const callSignalingService = new CallSignalingService();

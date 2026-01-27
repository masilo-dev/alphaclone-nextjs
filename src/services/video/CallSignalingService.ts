import { supabase } from '@/lib/supabase';

export interface CallSignal {
    type: 'call:ringing';
    callerId: string;
    callerName: string;
    roomUrl: string;
    roomId: string;
}

export const callSignalingService = {
    /**
     * Send a "Ringing" signal to a specific user
     */
    async sendCallSignal(recipientId: string, signal: Omit<CallSignal, 'type'>) {
        console.log(`📡 Sending call signal to ${recipientId}...`, signal);

        try {
            const channel = supabase.channel(`user-calls:${recipientId}`);

            await channel.subscribe(async (status: string) => {
                if (status === 'SUBSCRIBED') {
                    await channel.send({
                        type: 'broadcast',
                        event: 'call:signal',
                        payload: {
                            type: 'call:ringing',
                            ...signal
                        }
                    });
                    console.log('✅ Signal sent successfully');
                    // Cleanup after sending (we don't need to stay subscribed to their channel)
                    supabase.removeChannel(channel);
                }
            });
        } catch (error) {
            console.error('Failed to send call signal:', error);
            throw error;
        }
    }
};

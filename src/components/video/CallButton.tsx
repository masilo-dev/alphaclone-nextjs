import React, { useState } from 'react';
import { Video, Phone } from 'lucide-react';
import { callSignalingService } from '@/services/callSignalingService';
import { dailyService } from '@/services/dailyService';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/UIComponents'; // Assuming Button exists here

interface CallButtonProps {
    recipientId: string;
    recipientName: string;
    onCallStarted?: (roomUrl: string) => void;
    className?: string;
}

export const CallButton: React.FC<CallButtonProps> = ({
    recipientId,
    recipientName,
    onCallStarted,
    className
}) => {
    const { currentTenant } = useTenant(); // We need current user ID really, or assume context has user
    // ideally we get userId from auth context or similar. 
    // For now let's assume usage where we might need to fetch it or pass it.
    // Wait, CallButton usually implies "I" am calling.

    // We'll rely on the service to handle "current user" if possible, or we need AuthContext.
    // Let's import authService to get current user temporarily if context isn't handy, 
    // or just assume the click handler checks it.

    const [calling, setCalling] = useState(false);

    const handleCall = async () => {
        setCalling(true);
        try {
            const { user } = await import('@/services/authService').then(m => m.authService.getCurrentUser());
            if (!user) throw new Error('Not authenticated');

            // 1. Create Room
            const { call, error: callError } = await dailyService.createVideoCall({
                hostId: user.id,
                title: `Call with ${recipientName}`,
                participants: [user.id, recipientId],
                allowClientCancellation: true,
                duration: 30 // Implicit infinite for instant? Or 30m limit? Let's default to standard logic
            });

            if (callError || !call) throw new Error(callError || 'Failed to create call');

            // 2. Signal Recipient
            await callSignalingService.initiateCall(
                recipientId,
                user.id,
                user.user_metadata?.full_name || user.email || 'Unknown'
            );

            // 3. Open Room for Caller
            if (call.daily_room_url) {
                // Open in new window or callback
                if (onCallStarted) {
                    onCallStarted(call.daily_room_url);
                } else {
                    window.open(call.daily_room_url, '_blank');
                }
            }

        } catch (err) {
            console.error('Call failed:', err);
            alert('Failed to start call. Please try again.');
        } finally {
            setCalling(false);
        }
    };

    return (
        <Button
            onClick={handleCall}
            disabled={calling}
            className={`flex items-center gap-2 ${className}`}
            variant="primary"
        >
            <Video className="w-4 h-4" />
            {calling ? 'Calling...' : 'Video Call'}
        </Button>
    );
};

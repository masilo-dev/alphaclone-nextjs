import React from 'react';
import { AdminControls } from './AdminControls';
import { DailyCall } from '@daily-co/daily-js';

interface HostControlsProps {
    callObject: DailyCall | null;
    isHost: boolean;
    onEndMeeting: () => void;
    callId?: string;
}

/**
 * Host Controls for Tenant Admins
 * Provides the same controls as admin for meetings they host
 */
export const HostControls: React.FC<HostControlsProps> = ({
    callObject,
    isHost,
    onEndMeeting,
    callId,
}) => {
    return (
        <AdminControls callObject={callObject} isAdmin={isHost} onEndMeeting={onEndMeeting} callId={callId} />
    );
};

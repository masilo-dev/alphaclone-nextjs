import React from 'react';
import { AdminControls } from './AdminControls';
import DailyIframe from '@daily-co/daily-js';

interface HostControlsProps {
    callObject: DailyIframe | null;
    isHost: boolean;
    onEndMeeting: () => void;
}

/**
 * Host Controls for Tenant Admins
 * Provides the same controls as admin for meetings they host
 */
export const HostControls: React.FC<HostControlsProps> = ({
    callObject,
    isHost,
    onEndMeeting
}) => {
    // Host controls are the same as admin controls
    // Just with different permission check
    return (
        <AdminControls
            callObject={callObject}
            isAdmin={isHost}
            onEndMeeting={onEndMeeting}
        />
    );
};

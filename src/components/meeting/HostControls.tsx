import React from 'react';
import { AdminControls } from './AdminControls';
import { DailyCall } from '@daily-co/daily-js';
import { sendAuditToMeeting } from '../../lib/meetingAudit';

interface HostControlsProps {
    callObject: DailyCall | null;
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
    const handleSendAuditReport = () => {
        if (!callObject) return;
        sendAuditToMeeting(callObject, {
            source: 'host_controls',
            type: 'manual_audit_report',
            details: {
                triggeredBy: 'host',
                timestamp: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
        });
    };

    return (
        <div className="space-y-2">
            <AdminControls
                callObject={callObject}
                isAdmin={isHost}
                onEndMeeting={onEndMeeting}
            />
            {isHost && (
                <button
                    onClick={handleSendAuditReport}
                    className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    Send Audit Report to Meeting
                </button>
            )}
        </div>
    );
};

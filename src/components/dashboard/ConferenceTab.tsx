import React, { useState, useCallback } from 'react';
// import CustomVideoRoom from './video/CustomVideoRoom';
import SimpleVideoMeeting from './SimpleVideoMeeting';
import { User } from '../../types';

interface Props {
    user: User;
    onCallStateChange?: (isInCall: boolean) => void;
    onToggleSidebar?: () => void;
    showSidebar?: boolean;
    onJoinRoom?: (url: string) => void;
}

/**
 * Conference Tab - REBUILT
 * Delegates video rendering to parent Dashboard for persistence
 */
const ConferenceTab: React.FC<Props> = ({ user, onCallStateChange, onToggleSidebar, showSidebar, onJoinRoom }) => {

    const handleJoin = useCallback((roomUrl: string) => {
        if (onJoinRoom) {
            onJoinRoom(roomUrl);
        }
    }, [onJoinRoom]);

    // Main conference tab view
    return (
        <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-5xl mx-auto px-4 sm:px-0">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Video Meetings</h2>
                <p className="text-slate-400">
                    Simple, secure video meetings - Create and join with one click
                </p>
            </div>

            {/* Unified Video Meeting System for All Users */}
            <div className="space-y-6">
                <SimpleVideoMeeting user={user} onJoinRoom={handleJoin} />
            </div>
        </div>
    );
};

export default ConferenceTab;

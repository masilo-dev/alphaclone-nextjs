import React, { useState, useCallback } from 'react';
// import CustomVideoRoom from './video/CustomVideoRoom';
import SimpleVideoMeeting from './SimpleVideoMeeting';
import ManualMeetingLink from './ManualMeetingLink';
import { User } from '../../types';
import { ClientMeetingsView } from './client/ClientMeetingsView';

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
                    {user.role === 'admin'
                        ? 'Simple, stable video meetings - Create and join with one click'
                        : 'Join your scheduled meetings'
                    }
                </p>
            </div>

            {/* Admin: Simple Video Meeting System */}
            {user.role === 'admin' && (
                <div className="space-y-6">
                    <SimpleVideoMeeting user={user} onJoinRoom={handleJoin} />

                    {/* Fallback: Manual URL input */}
                    <div>
                        <h3 className="text-lg font-bold text-white mb-3">Or Use Existing Room</h3>
                        <ManualMeetingLink user={user} onJoinRoom={handleJoin} />
                    </div>
                </div>
            )}

            {/* Client: Message */}
            {user.role === 'client' && (
                <ClientMeetingsView onJoinRoom={handleJoin} />
            )}
        </div>
    );
};

export default ConferenceTab;

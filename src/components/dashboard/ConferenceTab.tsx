import React, { useState, useCallback } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { Brain, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { tenantService } from '../../services/tenancy/TenantService';
// import CustomVideoRoom from './video/CustomVideoRoom';
import SimpleVideoMeeting from './SimpleVideoMeeting';
import { User } from '../../types';

interface Props {
    user: User;
    onCallStateChange?: (isInCall: boolean) => void;
    onToggleSidebar?: () => void;
    showSidebar?: boolean;
    onJoinRoom?: (callId: string) => void;
}

/**
 * Conference Tab - REBUILT
 * Delegates video rendering to parent Dashboard for persistence
 */
const ConferenceTab: React.FC<Props> = ({ user, onCallStateChange, onToggleSidebar, showSidebar, onJoinRoom }) => {
    const { currentTenant } = useTenant();

    const handleJoin = useCallback((callId: string) => {
        if (onJoinRoom) {
            onJoinRoom(callId);
        }
    }, [onJoinRoom]);


    // Main conference tab view
    return (
        <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Video Meetings</h2>
                    <p className="text-slate-400 text-xs sm:text-sm">
                        Simple, secure video meetings - Create and join with one click
                    </p>
                </div>
                <button 
                    onClick={async () => {
                        toast.loading('Nexus: Synthesizing meeting intelligence...', { id: 'nexus-video' });
                        const tenantId = currentTenant?.id;
                        const res = await fetch('/api/social/command-center', { 
                            method: 'POST', 
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tenantId, mode: 'nexus_system_action', systemKey: 'meeting_intelligence' })
                        });
                        const data = await res.json();
                        toast.success(data.result.message, { id: 'nexus-video' });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-violet-400 rounded-xl text-xs font-bold border border-slate-800 transition-all shadow-lg shadow-violet-900/10"
                >
                    <Brain className="w-4 h-4" />
                    Nexus Intelligence
                </button>
            </div>

            {/* Unified Video Meeting System for All Users */}
            <div className="space-y-6">
                <SimpleVideoMeeting user={user} onJoinRoom={handleJoin} />
            </div>
        </div>
    );
};

export default ConferenceTab;

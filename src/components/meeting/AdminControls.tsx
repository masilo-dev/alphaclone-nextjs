import React, { useState } from 'react';
import { Mic, MicOff, UserX, Lock, Unlock, StopCircle, Circle, Monitor, Users } from 'lucide-react';
import DailyIframe from '@daily-co/daily-js';
import toast from 'react-hot-toast';

interface AdminControlsProps {
    callObject: DailyIframe | null;
    isAdmin: boolean;
    onEndMeeting: () => void;
}

export const AdminControls: React.FC<AdminControlsProps> = ({
    callObject,
    isAdmin,
    onEndMeeting
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isMeetingLocked, setIsMeetingLocked] = useState(false);

    if (!isAdmin) return null;

    const muteAll = async () => {
        if (!callObject) return;
        try {
            await callObject.updateParticipants({ '*': { setAudio: false } });
            toast.success('All participants muted');
        } catch (error) {
            console.error('Mute all error:', error);
            toast.error('Failed to mute participants');
        }
    };

    const lockMeeting = async () => {
        if (!callObject) return;
        try {
            // Daily.co uses access levels: 'full', 'lobby', or 'none'
            await callObject.updateMeetingState({
                access: { level: isMeetingLocked ? 'full' : 'lobby' }
            });
            setIsMeetingLocked(!isMeetingLocked);
            toast.success(isMeetingLocked ? 'Meeting unlocked' : 'Meeting locked');
        } catch (error) {
            console.error('Lock meeting error:', error);
            toast.error('Failed to lock meeting');
        }
    };

    const toggleRecording = async () => {
        if (!callObject) return;
        try {
            if (isRecording) {
                await callObject.stopRecording();
                setIsRecording(false);
                toast.success('Recording stopped');
            } else {
                await callObject.startRecording();
                setIsRecording(true);
                toast.success('Recording started');
            }
        } catch (error) {
            console.error('Recording error:', error);
            toast.error('Failed to toggle recording');
        }
    };

    const endMeetingForAll = () => {
        if (confirm('Are you sure you want to end this meeting for everyone?')) {
            if (callObject) {
                callObject.destroy();
            }
            onEndMeeting();
        }
    };

    return (
        <div className="bg-slate-900 border-t border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-400" />
                    <h4 className="text-sm font-bold text-white">Admin Controls</h4>
                </div>
                <span className="text-xs px-2 py-1 bg-teal-500/10 text-teal-400 rounded-full border border-teal-500/20">
                    Admin
                </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button
                    onClick={muteAll}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-sm text-white"
                    title="Mute all participants"
                >
                    <MicOff className="w-4 h-4" />
                    <span className="hidden sm:inline">Mute All</span>
                </button>

                <button
                    onClick={lockMeeting}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm text-white ${isMeetingLocked
                            ? 'bg-yellow-600 hover:bg-yellow-700'
                            : 'bg-slate-800 hover:bg-slate-700'
                        }`}
                    title={isMeetingLocked ? 'Unlock meeting' : 'Lock meeting'}
                >
                    {isMeetingLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    <span className="hidden sm:inline">{isMeetingLocked ? 'Unlock' : 'Lock'}</span>
                </button>

                <button
                    onClick={toggleRecording}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm text-white ${isRecording
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-slate-800 hover:bg-slate-700'
                        }`}
                    title={isRecording ? 'Stop recording' : 'Start recording'}
                >
                    {isRecording ? <StopCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    <span className="hidden sm:inline">{isRecording ? 'Stop Rec' : 'Record'}</span>
                </button>

                <button
                    onClick={endMeetingForAll}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm text-white"
                    title="End meeting for all participants"
                >
                    <StopCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">End Meeting</span>
                </button>
            </div>

            <p className="text-xs text-slate-500 mt-2 text-center">
                Admin controls affect all participants
            </p>
        </div>
    );
};

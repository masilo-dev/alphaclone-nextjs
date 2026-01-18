import React from 'react';
import { ParticipantMediaState } from '../../../services/video/MediaStateManager';
import { MicOff, Mic, VideoOff, Video, UserX, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

interface AdminParticipantControlsProps {
    participant: ParticipantMediaState;
    isAdmin: boolean;
    onMuteParticipant?: (sessionId: string) => void;
    onRemoveParticipant?: (sessionId: string) => void;
}

/**
 * Admin Controls for Participants
 * Shows admin-only buttons to control other participants
 */
const AdminParticipantControls: React.FC<AdminParticipantControlsProps> = ({
    participant,
    isAdmin,
    onMuteParticipant,
    onRemoveParticipant
}) => {
    // Don't show admin controls for non-admins or for local participant
    if (!isAdmin || participant.isLocal) {
        return null;
    }

    const handleMute = () => {
        if (onMuteParticipant) {
            onMuteParticipant(participant.sessionId);
            toast.success(`Muted ${participant.userName}`);
        }
    };

    const handleRemove = () => {
        if (confirm(`Remove ${participant.userName} from the meeting?`)) {
            if (onRemoveParticipant) {
                onRemoveParticipant(participant.sessionId);
                toast.success(`Removed ${participant.userName}`);
            }
        }
    };

    return (
        <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {/* Admin badge */}
            <div className="bg-teal-500/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center space-x-1">
                <Shield className="w-3 h-3 text-white" />
                <span className="text-xs text-white font-medium">Admin</span>
            </div>

            {/* Mute button */}
            <button
                onClick={handleMute}
                className="p-2 bg-red-500/90 hover:bg-red-600/90 backdrop-blur-sm rounded-full transition-colors"
                title={`Mute ${participant.userName}`}
            >
                <MicOff className="w-3 h-3 text-white" />
            </button>

            {/* Remove button */}
            <button
                onClick={handleRemove}
                className="p-2 bg-red-600/90 hover:bg-red-700/90 backdrop-blur-sm rounded-full transition-colors"
                title={`Remove ${participant.userName}`}
            >
                <UserX className="w-3 h-3 text-white" />
            </button>
        </div>
    );
};

export default AdminParticipantControls;

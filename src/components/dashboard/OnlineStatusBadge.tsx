import React from 'react';
import { PresenceStatus } from '../../services/presenceService';

interface OnlineStatusBadgeProps {
    status: PresenceStatus;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const OnlineStatusBadge: React.FC<OnlineStatusBadgeProps> = ({
    status,
    showLabel = false,
    size = 'md',
    className = ''
}) => {
    const sizeClasses = {
        sm: 'w-2 h-2',
        md: 'w-3 h-3',
        lg: 'w-4 h-4'
    };

    const statusConfig = {
        online: {
            color: 'bg-green-500',
            label: 'Online',
            pulse: true
        },
        away: {
            color: 'bg-yellow-500',
            label: 'Away',
            pulse: false
        },
        busy: {
            color: 'bg-red-500',
            label: 'Busy',
            pulse: false
        },
        offline: {
            color: 'bg-slate-500',
            label: 'Offline',
            pulse: false
        }
    };

    const config = statusConfig[status];

    return (
        <div className={`inline-flex items-center gap-2 ${className}`}>
            <div className="relative">
                <div className={`${sizeClasses[size]} ${config.color} rounded-full ${config.pulse ? 'animate-pulse' : ''}`} />
                {config.pulse && (
                    <div className={`absolute inset-0 ${config.color} rounded-full opacity-30 animate-ping`} />
                )}
            </div>
            {showLabel && (
                <span className="text-xs font-medium text-slate-400">{config.label}</span>
            )}
        </div>
    );
};

export default OnlineStatusBadge;

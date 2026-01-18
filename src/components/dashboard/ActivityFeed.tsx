import React, { useState, useEffect } from 'react';
import { Activity, Clock, FileText, MessageSquare, DollarSign, User } from 'lucide-react';
import { activityService, ActivityLog } from '../../services/dashboardService';
import { formatDistanceToNow } from 'date-fns';

interface ActivityFeedProps {
    userId: string;
    limit?: number;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ userId, limit = 20 }) => {
    const [activities, setActivities] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadActivities();
    }, [userId]);

    const loadActivities = async () => {
        setIsLoading(true);
        const { logs } = await activityService.getActivityLogs(userId, limit);
        if (logs) setActivities(logs);
        setIsLoading(false);
    };

    const getActivityIcon = (entityType?: string) => {
        switch (entityType) {
            case 'project':
                return <FileText className="w-4 h-4" />;
            case 'message':
                return <MessageSquare className="w-4 h-4" />;
            case 'payment':
                return <DollarSign className="w-4 h-4" />;
            case 'user':
                return <User className="w-4 h-4" />;
            default:
                return <Activity className="w-4 h-4" />;
        }
    };

    const getActivityColor = (entityType?: string) => {
        switch (entityType) {
            case 'project':
                return 'text-blue-400 bg-blue-400/10';
            case 'message':
                return 'text-purple-400 bg-purple-400/10';
            case 'payment':
                return 'text-green-400 bg-green-400/10';
            case 'user':
                return 'text-yellow-400 bg-yellow-400/10';
            default:
                return 'text-slate-400 bg-slate-400/10';
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                        <div className="w-8 h-8 rounded-lg bg-slate-800" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-slate-800 rounded w-3/4" />
                            <div className="h-3 bg-slate-800 rounded w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {activities.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No recent activity</p>
                </div>
            ) : (
                activities.map((activity) => (
                    <div
                        key={activity.id}
                        className="flex gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors"
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getActivityColor(activity.entity_type)}`}>
                            {getActivityIcon(activity.entity_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium">
                                {activity.action}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <span className="text-xs text-slate-500">
                                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                                </span>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default ActivityFeed;

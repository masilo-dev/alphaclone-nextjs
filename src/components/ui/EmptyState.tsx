import React, { ReactNode } from 'react';

interface EmptyStateProps {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    action?: ReactNode;
    className?: string;
}

/**
 * Empty state component for when there's no data to display
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    action,
    className = '',
}) => {
    return (
        <div className={`flex flex-col items-center justify-center py-20 px-4 ${className}`}>
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-violet-500/10" />
                <Icon className="w-10 h-10 text-slate-600 relative z-10" />
            </div>

            <h3 className="text-2xl font-bold text-white mb-2 text-center">
                {title}
            </h3>

            <p className="text-slate-400 text-center mb-8 max-w-md">
                {description}
            </p>

            {action && <div className="flex gap-3">{action}</div>}
        </div>
    );
};

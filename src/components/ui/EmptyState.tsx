import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

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
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col items-center justify-center py-24 px-6 rounded-[2.5rem] bg-slate-900/40 border border-dashed border-white/5 backdrop-blur-xl ${className}`}
        >
            <div className="w-24 h-24 bg-slate-800 rounded-3xl flex items-center justify-center mb-8 relative overflow-hidden shadow-2xl group transition-all duration-500 hover:scale-110 hover:rotate-3">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-violet-500/20 group-hover:opacity-100 transition-opacity" />
                <Icon className="w-12 h-12 text-teal-400 relative z-10 transition-transform duration-500 group-hover:scale-110" />
                
                {/* Decorative particles */}
                <div className="absolute top-2 right-2 w-1 h-1 bg-teal-400 rounded-full animate-pulse" />
                <div className="absolute bottom-4 left-3 w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse delay-75" />
            </div>

            <h3 className="text-3xl font-black text-white mb-3 text-center tracking-tighter uppercase">
                {title}
            </h3>

            <p className="text-slate-400 text-center mb-10 max-w-sm text-lg font-medium leading-relaxed">
                {description}
            </p>

            {action && (
                <motion.div 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex gap-3"
                >
                    {action}
                </motion.div>
            )}
        </motion.div>
    );
};

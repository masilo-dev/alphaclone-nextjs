'use client';

import React from 'react';
import { Heart, ThumbsUp, Smile, Star, Zap, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageReactionsProps {
  reactions: { [emoji: string]: string[] };
  messageId: string;
  currentUserId: string;
  onReaction: (messageId: string, emoji: string) => void;
  className?: string;
}

const REACTION_EMOJIS = [
  { emoji: '👍', icon: ThumbsUp, label: 'Like' },
  { emoji: '❤️', icon: Heart, label: 'Love' },
  { emoji: '😄', icon: Smile, label: 'Laugh' },
  { emoji: '⭐', icon: Star, label: 'Star' },
  { emoji: '⚡', icon: Zap, label: 'Zap' }
];

export default function MessageReactions({
  reactions,
  messageId,
  currentUserId,
  onReaction,
  className
}: MessageReactionsProps) {
  const handleReaction = (emoji: string) => {
    onReaction(messageId, emoji);
  };

  const getReactionCount = (emoji: string) => {
    return reactions[emoji]?.length || 0;
  };

  const hasUserReacted = (emoji: string) => {
    return reactions[emoji]?.includes(currentUserId) || false;
  };

  return (
    <div className={cn("flex items-center space-x-1 mt-1", className)}>
      {REACTION_EMOJIS.map(({ emoji, icon: Icon, label }) => {
        const count = getReactionCount(emoji);
        const isActive = hasUserReacted(emoji);
        
        if (count === 0) return null;
        
        return (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            title={label}
            className={cn(
              "flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors",
              isActive
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
            )}
          >
            <span>{emoji}</span>
            <span className="font-medium">{count}</span>
          </button>
        );
      })}
      
      {/* Add Reaction Button */}
      <div className="relative group">
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Show emoji picker
          }}
          className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
        
        {/* Quick reaction menu */}
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex bg-white rounded-lg shadow-lg border border-gray-200 p-1 space-x-1 z-10">
          {REACTION_EMOJIS.map(({ emoji }) => (
            <button
              key={emoji}
              onClick={(e) => {
                e.stopPropagation();
                handleReaction(emoji);
              }}
              className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-sm"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
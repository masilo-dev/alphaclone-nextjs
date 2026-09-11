'use client';

import React from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

interface UserPresenceProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar_url?: string;
    status?: 'online' | 'away' | 'offline';
    last_seen?: string;
  };
  showStatus?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function UserPresence({ 
  user, 
  showStatus = true, 
  size = 'md',
  className 
}: UserPresenceProps) {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return 'w-6 h-6';
      case 'md': return 'w-8 h-8';
      case 'lg': return 'w-10 h-10';
      default: return 'w-8 h-8';
    }
  };

  const getStatusSize = () => {
    switch (size) {
      case 'sm': return 'w-2 h-2';
      case 'md': return 'w-3 h-3';
      case 'lg': return 'w-4 h-4';
      default: return 'w-3 h-3';
    }
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <Avatar
        src={user.avatar_url}
        name={user.name}
        email={user.email}
        size={size === 'sm' ? 24 : size === 'lg' ? 40 : 32}
        className={cn(getSizeClasses())}
      />
      
      {showStatus && (
        <div
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-white",
            getStatusColor(user.status),
            getStatusSize()
          )}
          title={`${user.status || 'offline'}`}
        />
      )}
    </div>
  );
}

'use client';

import React from 'react';
import { 
  Linkedin, 
  Facebook, 
  Instagram, 
  Twitter, 
  Music2, 
  Mail, 
  MessageCircle,
  Chrome,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SocialPlatform =
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'x'
  | 'tiktok'
  | 'whatsapp'
  | 'mail'
  | 'chrome'
  | 'globe';

const PLATFORM_CONFIG: Record<SocialPlatform, { icon: React.ElementType; colorClass: string; bgClass: string }> = {
  linkedin: { icon: Linkedin, colorClass: 'text-[var(--logo-linkedin)]', bgClass: 'bg-[var(--logo-linkedin)]/10' },
  facebook: { icon: Facebook, colorClass: 'text-[var(--logo-facebook)]', bgClass: 'bg-[var(--logo-facebook)]/10' },
  instagram: { icon: Instagram, colorClass: 'text-[var(--logo-instagram)]', bgClass: 'bg-[var(--logo-instagram)]/10' },
  twitter: { icon: Twitter, colorClass: 'text-[var(--logo-twitter)]', bgClass: 'bg-[var(--logo-twitter)]/10' },
  x: { icon: Twitter, colorClass: 'text-[var(--ws-text-secondary)]', bgClass: 'bg-[var(--ws-hover)]' },
  tiktok: { icon: Music2, colorClass: 'text-[var(--logo-tiktok, var(--error-500))]', bgClass: 'bg-[var(--logo-tiktok, var(--error-500))]/10' },
  whatsapp: { icon: MessageCircle, colorClass: 'text-[var(--logo-whatsapp)]', bgClass: 'bg-[var(--logo-whatsapp)]/10' },
  mail: { icon: Mail, colorClass: 'text-[var(--logo-google-red)]', bgClass: 'bg-[var(--logo-google-red)]/10' },
  chrome: { icon: Chrome, colorClass: 'text-[var(--logo-google-blue)]', bgClass: 'bg-[var(--logo-google-blue)]/10' },
  globe: { icon: Globe, colorClass: 'text-teal-400', bgClass: 'bg-teal-500/10' },
};

interface SocialPlatformIconProps {
  platform: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showBackground?: boolean;
}

export function SocialPlatformIcon({
  platform,
  className,
  size = 'md',
  showBackground = false,
}: SocialPlatformIconProps) {
  const norm = platform?.toLowerCase()?.trim() as SocialPlatform;
  const config = PLATFORM_CONFIG[norm] || PLATFORM_CONFIG['globe'];
  const IconComponent = config.icon;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const wrapperSizeClasses = {
    sm: 'w-7 h-7 rounded-md',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-12 h-12 rounded-2xl',
  };

  if (showBackground) {
    return (
      <div
        className={cn(
          'flex items-center justify-center transition-all duration-300 border border-[var(--ws-border)] group-hover:border-teal-500/30',
          config.bgClass,
          wrapperSizeClasses[size],
          className
        )}
      >
        <IconComponent className={cn(sizeClasses[size], config.colorClass)} />
      </div>
    );
  }

  return (
    <IconComponent className={cn(sizeClasses[size], config.colorClass, className)} />
  );
}

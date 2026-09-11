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
  linkedin: { icon: Linkedin, colorClass: 'text-[#0A66C2]', bgClass: 'bg-[#0A66C2]/10' },
  facebook: { icon: Facebook, colorClass: 'text-[#1877F2]', bgClass: 'bg-[#1877F2]/10' },
  instagram: { icon: Instagram, colorClass: 'text-[#E1306C]', bgClass: 'bg-[#E1306C]/10' },
  twitter: { icon: Twitter, colorClass: 'text-[#1DA1F2]', bgClass: 'bg-[#1DA1F2]/10' },
  x: { icon: Twitter, colorClass: 'text-slate-200', bgClass: 'bg-white/10' },
  tiktok: { icon: Music2, colorClass: 'text-[#FE2C55]', bgClass: 'bg-[#FE2C55]/10' },
  whatsapp: { icon: MessageCircle, colorClass: 'text-[#25D366]', bgClass: 'bg-[#25D366]/10' },
  mail: { icon: Mail, colorClass: 'text-[#EA4335]', bgClass: 'bg-[#EA4335]/10' },
  chrome: { icon: Chrome, colorClass: 'text-[#4285F4]', bgClass: 'bg-[#4285F4]/10' },
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
          'flex items-center justify-center transition-all duration-300 border border-white/5 group-hover:border-teal-500/30',
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

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
  fallbackType?: 'initials' | 'icon' | 'gradient';
  shape?: 'circle' | 'square' | 'rounded';
}

/**
 * Unified Avatar Component
 * 
 * Handles all avatar display with intelligent fallback chain:
 * 1. User-uploaded image (src prop)
 * 2. Generated gradient with initials
 * 3. Icon fallback
 * 
 * Prevents 400 errors from external services (Clearbit, ui-avatars)
 */
export function Avatar({
  src,
  name,
  email,
  size = 40,
  className = '',
  fallbackType = 'initials',
  shape = 'circle'
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
  }, [src]);

  const displayName = name || email || 'User';
  
  const initials = useMemo(() => {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }, [displayName]);

  const gradientColors = useMemo(() => {
    const hash = displayName.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const hue = Math.abs(hash) % 360;
    const saturation = 65 + (Math.abs(hash) % 20);
    const lightness = 45 + (Math.abs(hash) % 15);
    
    return {
      from: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
      to: `hsl(${(hue + 30) % 360}, ${saturation}%, ${lightness - 10}%)`
    };
  }, [displayName]);

  const shapeClass = {
    circle: 'rounded-full',
    square: 'rounded-none',
    rounded: 'rounded-lg'
  }[shape];

  const containerStyle = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
  };

  const fontSize = Math.max(size * 0.4, 12);

  if (src && !imgError) {
    return (
      <div 
        className={`relative overflow-hidden ${shapeClass} ${className}`}
        style={containerStyle}
      >
        <img
          src={src}
          alt={displayName}
          onError={() => setImgError(true)}
          onLoad={() => setImgLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {!imgLoaded && (
          <div 
            className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${shapeClass}`}
            style={{
              backgroundImage: `linear-gradient(135deg, ${gradientColors.from}, ${gradientColors.to})`
            }}
          >
            <span 
              className="text-white font-bold select-none"
              style={{ fontSize: `${fontSize}px` }}
            >
              {initials}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (fallbackType === 'icon') {
    return (
      <div 
        className={`flex items-center justify-center bg-slate-700 ${shapeClass} ${className}`}
        style={containerStyle}
      >
        <User className="text-slate-400" style={{ width: size * 0.6, height: size * 0.6 }} />
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center justify-center ${shapeClass} ${className}`}
      style={{
        ...containerStyle,
        backgroundImage: `linear-gradient(135deg, ${gradientColors.from}, ${gradientColors.to})`
      }}
    >
      <span 
        className="text-white font-bold select-none"
        style={{ fontSize: `${fontSize}px` }}
      >
        {initials}
      </span>
    </div>
  );
}

export default Avatar;

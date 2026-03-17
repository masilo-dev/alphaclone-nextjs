import React, { useState, useEffect } from 'react';
import { mediaOptimizationService } from '../../services/mediaOptimizationService';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  fallback?: string;
  loading?: 'lazy' | 'eager';
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  responsive?: boolean;
  sizes?: string;
}

/**
 * Optimized Image Component
 * - Lazy loading by default
 * - Error handling with fallback
 * - Async decoding for better performance
 * - Prevents crashes from broken images
 * - WebP/AVIF format support
 * - Responsive images with srcset
 * - Automatic compression
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  fallback = '/placeholder.png',
  loading = 'lazy',
  quality = 80,
  format,
  responsive = false,
  sizes,
}) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [optimizedSrc, setOptimizedSrc] = useState(src);
  const [srcSet, setSrcSet] = useState<string>('');

  useEffect(() => {
    const optimizeImage = async () => {
      // Get best format for browser
      const formatToUse = format || (await mediaOptimizationService.getBestFormat());

      // Generate optimized URL
      const widthValue = typeof width === 'number' ? width : undefined;
      const heightValue = typeof height === 'number' ? height : undefined;

      const options: any = {
        quality,
        format: formatToUse as any,
      };

      if (widthValue !== undefined) options.width = widthValue;
      if (heightValue !== undefined) options.height = heightValue;

      const optimized = mediaOptimizationService.getOptimizedImageUrl(src, options);
      setOptimizedSrc(optimized);

      // Generate responsive srcset if needed
      if (responsive) {
        const srcset = mediaOptimizationService.getResponsiveSrcSet(src, undefined, formatToUse as any);
        setSrcSet(srcset);
      }
    };

    optimizeImage();
  }, [src, quality, format, width, height, responsive]);

  const handleError = () => {
    setError(true);
    console.warn(`Failed to load image: ${src}`);
  };

  const handleLoad = () => {
    setLoaded(true);
  };

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {/* Loading skeleton */}
      {!loaded && !error && (
        <div className="absolute inset-0 bg-slate-800 animate-pulse rounded" aria-hidden="true" />
      )}
      
      <img
        src={error ? fallback : optimizedSrc}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        onError={handleError}
        onLoad={handleLoad}
        srcSet={responsive && srcSet ? srcSet : undefined}
        sizes={responsive && sizes ? sizes : undefined}
        className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{
          maxWidth: '100%',
          height: 'auto',
        }}
        role="img"
        aria-label={alt}
      />
    </div>
  );
};

export default OptimizedImage;





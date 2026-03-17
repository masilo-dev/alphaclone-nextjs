/**
 * Media Optimization Service
 * Handles image compression, format conversion, and optimization
 */

export interface ImageOptimizationOptions {
    quality?: number; // 0-100
    format?: 'webp' | 'avif' | 'jpeg' | 'png';
    width?: number;
    height?: number;
    maxWidth?: number;
    maxHeight?: number;
}

export interface ThumbnailOptions {
    width: number;
    height: number;
    quality?: number;
}

export const mediaOptimizationService = {
    /**
     * Get optimized image URL
     * In production, this would use a CDN or image optimization service
     */
    getOptimizedImageUrl(
        originalUrl: string,
        options: ImageOptimizationOptions = {}
    ): string {
        // If using a CDN like Cloudinary, Imgix, or Next.js Image Optimization
        // This would generate the optimized URL
        const params = new URLSearchParams();

        if (options.width) params.set('w', options.width.toString());
        if (options.height) params.set('h', options.height.toString());
        if (options.maxWidth) params.set('max-w', options.maxWidth.toString());
        if (options.maxHeight) params.set('max-h', options.maxHeight.toString());
        if (options.quality) params.set('q', options.quality.toString());
        if (options.format) params.set('f', options.format);

        // For now, return original URL with query params
        // In production, integrate with actual image optimization service
        return params.toString() ? `${originalUrl}?${params.toString()}` : originalUrl;
    },

    /**
     * Get responsive image srcset
     */
    getResponsiveSrcSet(
        baseUrl: string,
        sizes: number[] = [320, 640, 768, 1024, 1280, 1920],
        format?: 'webp' | 'avif'
    ): string {
        return sizes
            .map(size => {
                const options: any = { width: size };
                if (format) options.format = format;
                const url = this.getOptimizedImageUrl(baseUrl, options);
                return `${url} ${size}w`;
            })
            .join(', ');
    },

    /**
     * Get responsive sizes attribute
     */
    getResponsiveSizes(breakpoints: Record<string, string> = {}): string {
        const defaultBreakpoints = {
            '(max-width: 640px)': '100vw',
            '(max-width: 1024px)': '50vw',
            default: '33vw',
        };

        const merged = { ...defaultBreakpoints, ...breakpoints };
        return Object.entries(merged)
            .map(([condition, size]) => {
                if (condition === 'default') {
                    return size;
                }
                return `${condition} ${size}`;
            })
            .join(', ');
    },

    /**
     * Compress image (client-side using Canvas API)
     */
    async compressImage(
        file: File,
        options: ImageOptimizationOptions = {}
    ): Promise<{ blob: Blob; url: string; sizeReduction: number }> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    if (!ctx) {
                        reject(new Error('Canvas context not available'));
                        return;
                    }

                    // Calculate dimensions
                    let width = img.width;
                    let height = img.height;

                    if (options.maxWidth && width > options.maxWidth) {
                        height = (height * options.maxWidth) / width;
                        width = options.maxWidth;
                    }

                    if (options.maxHeight && height > options.maxHeight) {
                        width = (width * options.maxHeight) / height;
                        height = options.maxHeight;
                    }

                    if (options.width) width = options.width;
                    if (options.height) height = options.height;

                    canvas.width = width;
                    canvas.height = height;

                    // Draw and compress
                    ctx.drawImage(img, 0, 0, width, height);

                    const quality = (options.quality || 80) / 100;
                    const format = options.format || 'jpeg';
                    const mimeType = format === 'webp' ? 'image/webp' : format === 'png' ? 'image/png' : 'image/jpeg';

                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error('Image compression failed'));
                                return;
                            }

                            const url = URL.createObjectURL(blob);
                            const sizeReduction = ((file.size - blob.size) / file.size) * 100;

                            resolve({
                                blob,
                                url,
                                sizeReduction,
                            });
                        },
                        mimeType,
                        quality
                    );
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target?.result as string;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    },

    /**
     * Generate thumbnail
     */
    async generateThumbnail(
        file: File,
        options: ThumbnailOptions
    ): Promise<{ blob: Blob; url: string }> {
        return this.compressImage(file, {
            width: options.width,
            height: options.height,
            quality: options.quality || 75,
        }).then((result) => ({
            blob: result.blob,
            url: result.url,
        }));
    },

    /**
     * Check if browser supports WebP
     */
    supportsWebP(): boolean {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    },

    /**
     * Check if browser supports AVIF
     */
    async supportsAVIF(): Promise<boolean> {
        return new Promise((resolve) => {
            const avif = new Image();
            avif.onload = () => resolve(true);
            avif.onerror = () => resolve(false);
            avif.src =
                'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
        });
    },

    /**
     * Get best image format for browser
     */
    async getBestFormat(): Promise<'webp' | 'avif' | 'jpeg'> {
        if (await this.supportsAVIF()) {
            return 'avif';
        }
        if (this.supportsWebP()) {
            return 'webp';
        }
        return 'jpeg';
    },

    /**
     * Preload critical images
     */
    preloadImage(src: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`Failed to preload image: ${src}`));
            img.src = src;
        });
    },

    /**
     * Get image dimensions
     */
    getImageDimensions(src: string): Promise<{ width: number; height: number }> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                });
            };
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            img.src = src;
        });
    },
};


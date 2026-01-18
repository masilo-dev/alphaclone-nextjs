/**
 * Advanced Caching Service
 * Implements multiple caching strategies for optimal performance
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
    staleTime: number;
}

export class CacheService {
    private memoryCache: Map<string, CacheEntry<any>> = new Map();
    private maxSize: number = 1000;
    private defaultTTL: number = 5 * 60 * 1000; // 5 minutes
    private defaultStaleTime: number = 10 * 60 * 1000; // 10 minutes

    /**
     * Get cached data with stale-while-revalidate pattern
     */
    async get<T>(
        key: string,
        fetcher: () => Promise<T>,
        options?: { ttl?: number; staleTime?: number }
    ): Promise<T> {
        const entry = this.memoryCache.get(key);
        const now = Date.now();
        const ttl = options?.ttl || this.defaultTTL;
        const staleTime = options?.staleTime || this.defaultStaleTime;

        // Cache hit and fresh
        if (entry && (now - entry.timestamp) < ttl) {
            return entry.data;
        }

        // Cache hit but stale - return stale data and revalidate in background
        if (entry && (now - entry.timestamp) < staleTime) {
            // Revalidate in background
            fetcher().then((freshData) => {
                this.set(key, freshData, { ttl, staleTime });
            }).catch(() => {
                // Silently fail revalidation
            });

            return entry.data; // Return stale data immediately
        }

        // Cache miss or expired - fetch fresh data
        const data = await fetcher();
        this.set(key, data, { ttl, staleTime });
        return data;
    }

    /**
     * Set cache entry
     */
    set<T>(key: string, data: T, options?: { ttl?: number; staleTime?: number }): void {
        // Evict if cache is full
        if (this.memoryCache.size >= this.maxSize) {
            this.evictOldest();
        }

        const ttl = options?.ttl || this.defaultTTL;
        const staleTime = options?.staleTime || this.defaultStaleTime;

        this.memoryCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
            staleTime,
        });
    }

    /**
     * Invalidate cache entry
     */
    invalidate(key: string): void {
        this.memoryCache.delete(key);
    }

    /**
     * Invalidate cache by pattern
     */
    invalidatePattern(pattern: RegExp): void {
        for (const key of this.memoryCache.keys()) {
            if (pattern.test(key)) {
                this.memoryCache.delete(key);
            }
        }
    }

    /**
     * Clear all cache
     */
    clear(): void {
        this.memoryCache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
        keys: string[];
    } {
        return {
            size: this.memoryCache.size,
            maxSize: this.maxSize,
            hitRate: 0, // Would need to track hits/misses
            keys: Array.from(this.memoryCache.keys()),
        };
    }

    /**
     * Evict oldest entry
     */
    private evictOldest(): void {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.memoryCache.delete(oldestKey);
        }
    }

    /**
     * Cache with index for database queries
     */
    async getWithIndex<T>(
        indexKey: string,
        itemKey: string,
        fetcher: () => Promise<T>,
        options?: { ttl?: number; staleTime?: number }
    ): Promise<T> {
        // Check index first
        const index = this.memoryCache.get(`index:${indexKey}`);
        if (index) {
            const cached = this.memoryCache.get(`${indexKey}:${itemKey}`);
            if (cached) {
                const now = Date.now();
                if ((now - cached.timestamp) < (options?.ttl || this.defaultTTL)) {
                    return cached.data;
                }
            }
        }

        // Fetch and cache
        const data = await fetcher();
        this.set(`${indexKey}:${itemKey}`, data, options);
        
        // Update index
        if (!index) {
            const opts: any = {};
            if (options?.ttl !== undefined) opts.ttl = options.ttl;
            if (options?.staleTime !== undefined) opts.staleTime = options.staleTime;
            this.set(`index:${indexKey}`, [itemKey], opts);
        } else {
            const keys = index.data as string[];
            if (!keys.includes(itemKey)) {
                keys.push(itemKey);
                const opts: any = {};
                if (options?.ttl !== undefined) opts.ttl = options.ttl;
                if (options?.staleTime !== undefined) opts.staleTime = options.staleTime;
                this.set(`index:${indexKey}`, keys, opts);
            }
        }

        return data;
    }
}

// Singleton instance
export const cacheService = new CacheService();

/**
 * Cache decorator for functions
 */
export function cached<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    keyGenerator?: (...args: Parameters<T>) => string,
    options?: { ttl?: number; staleTime?: number }
): T {
    return (async (...args: Parameters<T>) => {
        const key = keyGenerator
            ? keyGenerator(...args)
            : `${fn.name}:${JSON.stringify(args)}`;

        return cacheService.get(
            key,
            () => fn(...args),
            options
        );
    }) as T;
}

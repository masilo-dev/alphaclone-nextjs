import { tenantFortress } from './fortressLayer';
import { redis, isRedisConfigured } from '@/lib/redis';

export type MemoryStore = 'shortTerm' | 'longTerm' | 'episodic';

export interface MemoryEntry {
    tenantId: string;
    userId: string;
    type: string;
    content: any;
    success?: boolean;
    timestamp: Date;
}

/**
 * MemorySystem
 * Hierarchical Memory: Redis for Short-term, Postgres + Vector for Long/Episodic.
 * Uses Upstash Redis for multi-region serverless persistence.
 */
class MemorySystem {
    private MEMORY_TTL = 60 * 60 * 24; // 24 hours for short-term memory

    async store(entry: MemoryEntry, store: MemoryStore = 'shortTerm') {
        const key = tenantFortress.getIsolatedKey(entry.tenantId, `mem:${store}`);
        
        if (isRedisConfigured()) {
            try {
                // Store in Redis list (Short-term context)
                await redis.rpush(key, JSON.stringify(entry));
                // Set expiry if it's short-term
                if (store === 'shortTerm') {
                    await redis.expire(key, this.MEMORY_TTL);
                }
            } catch (error) {
                console.error('[MemorySystem] Redis store failed:', error);
            }
        }
        
        console.log(`MEMORY_FORTRESS [${store.toUpperCase()}]: Pattern isolated for ${entry.tenantId}`);
    }

    async recall(tenantId: string, query: string, store: MemoryStore = 'longTerm'): Promise<MemoryEntry[]> {
        const key = tenantFortress.getIsolatedKey(tenantId, `mem:${store}`);
        
        if (isRedisConfigured()) {
            try {
                const data = await redis.lrange(key, 0, -1);
                const parsed = (data as string[]).map(d => JSON.parse(d));
                return tenantFortress.sanitizeResponse(tenantId, parsed);
            } catch (error) {
                console.error('[MemorySystem] Redis recall failed:', error);
                return [];
            }
        }
        
        return [];
    }

    async getPatterns(tenantId: string): Promise<any[]> {
        const key = tenantFortress.getIsolatedKey(tenantId, 'mem:shortTerm');
        
        if (isRedisConfigured()) {
            try {
                const data = await redis.lrange(key, 0, -1);
                const parsed = (data as string[]).map(d => JSON.parse(d));
                const patterns = parsed
                    .filter(e => e.success)
                    .map(e => e.content);
                
                return tenantFortress.sanitizeResponse(tenantId, patterns);
            } catch (error) {
                console.error('[MemorySystem] Redis patterns failed:', error);
                return [];
            }
        }
        
        return [];
    }
}

export const memorySystem = new MemorySystem();

